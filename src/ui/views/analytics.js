import { ATTRIBUTES } from '../../core/defaults.js';
import { formatDay, monthName, parseDay } from '../../core/dates.js';
import {
  attrTimeline, consistency, focusAreas, habitsByDay, levelHistory, records, xpByDay, xpByMonth, xpByWeek,
} from '../../core/analytics.js';
import { esc, fmt } from '../dom.js';
import { barChart, heatmap, legend, lineChart, radar } from '../charts.js';
import { render as rerender, ui } from '../app.js';

const PERIODS = { day: 'Diário (30 dias)', week: 'Semanal (12 semanas)', month: 'Mensal (12 meses)' };

function xpPanel(c) {
  const p = ui.tabs.xpPeriod || 'day';
  let data;
  let every = 1;
  if (p === 'day') {
    data = xpByDay(c.state, 30, c.today).map((x) => ({ label: x.key.slice(8), value: x.xp, tip: formatDay(x.key, { withWeekday: true }) }));
    every = 3;
  } else if (p === 'week') {
    data = xpByWeek(c.state, 12, c.today).map((x) => ({ label: formatDay(x.start).slice(0, 6), value: x.xp, tip: `Semana de ${formatDay(x.start)}` }));
    every = 2;
  } else {
    data = xpByMonth(c.state, 12, c.today).map((x) => ({ label: monthName(Number(x.key.slice(5)) - 1), value: x.xp, tip: `${monthName(Number(x.key.slice(5)) - 1)}/${x.key.slice(0, 4)}` }));
  }
  const total = data.reduce((s, x) => s + x.value, 0);
  const avg = total / data.length;
  return `<div class="panel span2"><div class="panel-title"><h2>Experiência</h2>
    <div class="tabs" style="margin:0">${Object.entries(PERIODS).map(([k, v]) => `<button class="tab ${k === p ? 'active' : ''}" data-action="set-tab" data-view="xpPeriod" data-tab="${k}">${v}</button>`).join('')}</div></div>
    <div class="row wrap" style="gap:22px;margin-bottom:10px"><div><div class="stat v mono" style="font-size:22px;font-weight:800">${fmt(total)}</div><div class="muted" style="font-size:12px">XP no período</div></div>
    <div><div class="mono" style="font-size:22px;font-weight:800">${fmt(avg)}</div><div class="muted" style="font-size:12px">média por ${p === 'day' ? 'dia' : p === 'week' ? 'semana' : 'mês'}</div></div></div>
    ${barChart(data, { every })}</div>`;
}

function attrPanels(c) {
  const hidden = ui.hidden.attrs || [];
  const tl = attrTimeline(c.state, 60, c.today);
  const series = ATTRIBUTES.map((a) => ({ key: a.key, name: a.name, color: a.color, values: tl.map((x) => x[a.key]) }));
  const maxLv = Math.max(5, ...ATTRIBUTES.map((a) => c.d.attrLevels[a.key]));
  return `<div class="panel"><div class="panel-title"><h2>Perfil de atributos</h2></div>
      ${radar(ATTRIBUTES.map((a) => ({ key: a.key, label: a.name, value: c.d.attrLevels[a.key], color: a.color })), maxLv)}</div>
    <div class="panel"><div class="panel-title"><h2>Evolução dos atributos (60 dias)</h2></div>
      ${lineChart(series, tl.map((x) => formatDay(x.key)), { every: 14, hidden })}
      ${legend(series, hidden, 'toggle-attr')}</div>`;
}

function habitsPanel(c) {
  const h = habitsByDay(c.state, 30, c.today);
  const total = h.reduce((s, x) => s + x.count, 0);
  return `<div class="panel"><div class="panel-title"><h2>Hábitos concluídos (30 dias)</h2><span class="chip">${total} registros</span></div>
    ${barChart(h.map((x) => ({ label: x.key.slice(8), value: x.count, tip: formatDay(x.key, { withWeekday: true }) })), { every: 3, unit: 'concluídos', height: 160 })}</div>`;
}

function consistencyPanel(c) {
  const cells = consistency(c.state, 26, c.today);
  const max = Math.max(50, ...cells.map((x) => x.xp));
  const past = cells.filter((x) => !x.future);
  const activeDays = past.filter((x) => x.xp > 0).length;
  const prot = past.filter((x) => !x.xp && x.protected).length;
  const rate = past.length ? Math.round(((activeDays + prot) / past.length) * 100) : 0;
  return `<div class="panel span2"><div class="panel-title"><h2>Consistência (26 semanas)</h2>
    <div class="chips" style="margin:0"><span class="chip">${activeDays} dias ativos</span><span class="chip warn">${prot} protegidos</span><span class="chip accent">${rate}% de presença</span></div></div>
    ${heatmap(cells.map((x) => ({ ...x, label: formatDay(x.key, { withWeekday: true }) })), max)}
    <div class="legend"><span><i style="background:rgba(120,150,255,.08)"></i>sem registro</span><span><i style="background:color-mix(in srgb,var(--accent) 55%,transparent)"></i>ativo</span><span><i style="background:var(--accent2)"></i>dia intenso</span><span><i style="background:rgba(255,200,87,.35)"></i>descanso / doença / imprevisto</span></div></div>`;
}

function mainPanel(c) {
  const mains = c.state.missions.filter((m) => m.type === 'main' || m.type === 'boss');
  return `<div class="panel"><div class="panel-title"><h2>Missões principais e chefes</h2></div>
    ${mains.length ? `<div class="stack">${mains.map((m) => {
      let pct = 0;
      if (m.status === 'completed') pct = 100;
      else if (m.type === 'main' && m.progress?.target) pct = (m.progress.current / m.progress.target) * 100;
      else if (m.type === 'boss' && m.stages?.length) pct = (m.stages.filter((s) => s.done).length / m.stages.length) * 90;
      return `<div><div class="row between" style="font-size:14px"><span>${m.type === 'boss' ? '🐉' : '🧭'} ${esc(m.title)}</span><span class="mono">${Math.round(pct)}%</span></div>
        <div class="bar thin mt-s"><i style="--w:${pct}%"></i></div></div>`;
    }).join('')}</div>` : '<div class="empty"><b>Sem missões principais.</b>Crie metas de longo prazo para acompanhar aqui.</div>'}</div>`;
}

function levelPanel(c) {
  const hist = levelHistory(c.state).slice(-12).reverse();
  return `<div class="panel"><div class="panel-title"><h2>Histórico de níveis</h2></div>
    <div class="list">${hist.map((h) => `<div class="row between" style="font-size:14px;border-bottom:1px solid var(--line);padding:6px 0">
      <span><b class="mono" style="color:var(--accent)">Nv ${h.level}</b></span><span class="muted">${h.date ? formatDay(h.date, { withWeekday: true }) + ' ' + parseDay(h.date).getFullYear() : 'início'}</span></div>`).join('')}</div></div>`;
}

function areasPanel(c) {
  const f = focusAreas(c.state, 30, c.today);
  const max = Math.max(1, ...f.list.map((x) => x.points));
  const info = (k) => ATTRIBUTES.find((a) => a.key === k);
  const r = records(c.state, c.today);
  return `<div class="panel"><div class="panel-title"><h2>Áreas de dedicação (30 dias)</h2></div>
    ${f.list.map((x) => `<div class="attr" style="--c:${info(x.key).color}"><div class="attr-key">${x.key}</div><div class="bar thin"><i style="--w:${(x.points / max) * 100}%"></i></div><div class="mono" style="font-size:13px">${fmt(x.points)}</div></div>`).join('')}
    ${f.attention.length && f.total ? `<div class="notice warn mt">Precisam de mais atenção: ${f.attention.map((x) => `<b>${esc(info(x.key).name)}</b>`).join(', ')}. Missões pequenas já ajudam.</div>` : ''}
    </div>
    <div class="panel"><div class="panel-title"><h2>Recordes pessoais</h2></div>
    <div class="grid g2">
      <div><div class="mono" style="font-size:22px;font-weight:800">${fmt(r.bestDayXp)}</div><div class="muted" style="font-size:12px">Melhor dia${r.bestDay ? ` (${formatDay(r.bestDay)})` : ''}</div></div>
      <div><div class="mono" style="font-size:22px;font-weight:800">${fmt(r.bestWeekXp)}</div><div class="muted" style="font-size:12px">Melhor semana</div></div>
      <div><div class="mono" style="font-size:22px;font-weight:800">${c.d.streak.best}</div><div class="muted" style="font-size:12px">Maior sequência</div></div>
      <div><div class="mono" style="font-size:22px;font-weight:800">${r.bestPerfectRun}</div><div class="muted" style="font-size:12px">Dias perfeitos seguidos</div></div>
      <div><div class="mono" style="font-size:22px;font-weight:800">${r.activeDays}</div><div class="muted" style="font-size:12px">Dias com progresso</div></div>
      <div><div class="mono" style="font-size:22px;font-weight:800">${fmt(c.d.totalXp)}</div><div class="muted" style="font-size:12px">XP total</div></div>
    </div></div>`;
}

function render(c) {
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Painel analítico</div><h1>Análise</h1></div></div>
    <div class="grid g2">
      ${xpPanel(c)}
      ${attrPanels(c)}
      ${consistencyPanel(c)}
      ${habitsPanel(c)}
      ${mainPanel(c)}
      ${areasPanel(c)}
      ${levelPanel(c)}
    </div>`;
}

const actions = {
  'toggle-attr': (el) => {
    const h = new Set(ui.hidden.attrs || []);
    if (h.has(el.dataset.key)) h.delete(el.dataset.key);
    else h.add(el.dataset.key);
    ui.hidden.attrs = [...h];
    rerender();
  },
};

export default { id: 'analytics', title: 'Análise', icon: 'analytics', render, actions };
