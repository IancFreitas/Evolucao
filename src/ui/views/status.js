import * as E from '../../core/engine.js';
import { ATTRIBUTES, DAY_STATUSES } from '../../core/defaults.js';
import { formatDay, formatTime } from '../../core/dates.js';
import { CLASSES } from '../../core/levels.js';
import { completionKey, essentialsFor, isPostponed, isScheduled } from '../../core/missions.js';
import { inactiveGapBefore } from '../../core/streaks.js';
import { focusAreas } from '../../core/analytics.js';
import { esc, fmt, icon } from '../dom.js';
import { run, store } from '../app.js';
import { missionRow } from './missions.js';
import { backupOverdue, backupStatusText, saveBackupToCloud } from '../cloud.js';

function hero(c) {
  const { d, state } = c;
  const title = state.profile.activeTitle || 'Desperto';
  const next = CLASSES[d.classIndex + 1];
  return `<div class="panel hero">
    <div class="avatar" aria-label="Nível ${d.level.level}"><div class="lv"><small>NÍVEL</small>${d.level.level}</div></div>
    <div style="min-width:0">
      <div class="hud">[ Jogador ]</div>
      <div class="hero-name">${esc(state.profile.name)}</div>
      <div class="hero-title">« ${esc(title)} »</div>
      <div class="chips">
        <span class="chip accent">⚜ Classe: ${esc(d.cls.name)}</span>
        <span class="chip" data-tip="Sequência atual · recorde ${d.streak.best}">🔥 ${d.streak.current} dia(s)</span>
        <span class="chip gold num">◈ ${fmt(d.coins)} moedas</span>
        <span class="chip" data-tip="Escudos protegem a sequência em dias perdidos">${icon('shield')} ${d.streak.shieldsLeft} escudo(s)</span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${d.level.needed}" aria-valuenow="${d.level.into}" aria-label="Experiência"><i style="--w:${(d.level.progress * 100).toFixed(1)}%"></i></div>
      <div class="xp-meta"><span>XP ${fmt(d.level.into)} / ${fmt(d.level.needed)}</span><span>Total ${fmt(d.totalXp)}</span></div>
      ${next ? `<div class="tl-sub mt-s">Próxima classe: <b>${esc(next.name)}</b> (${esc(next.reqText)})</div>` : '<div class="tl-sub mt-s">Classe máxima alcançada.</div>'}
    </div></div>`;
}

export function attributesPanel(c) {
  return `<div class="panel"><div class="panel-title"><h2>Atributos</h2><button class="btn sm ghost" data-nav="analytics">Evolução →</button></div>
    ${ATTRIBUTES.map((a) => {
      const x = c.d.attrs[a.key];
      return `<div class="attr" style="--c:${a.color}" data-tip="${esc(a.desc)}<br>${fmt(x.points)} pontos · faltam ${fmt(x.needed - x.into)} para o nível ${x.level + 1}">
        <div class="attr-key">${a.key}</div>
        <div><div class="attr-name"><span>${esc(a.name)}</span><span class="dim mono" style="font-size:11px">${fmt(x.into)}/${fmt(x.needed)}</span></div>
        <div class="bar thin"><i style="--w:${(x.progress * 100).toFixed(1)}%"></i></div></div>
        <div class="attr-lv">${x.level}</div></div>`;
    }).join('')}</div>`;
}

function today(c) {
  const { state } = c;
  const daily = state.missions.filter((m) => m.type === 'daily' && m.status === 'active' && isScheduled(m, c.today));
  const ess = essentialsFor(state, c.today);
  const essDone = ess.filter((m) => c.d.keys.has(completionKey(m, c.today))).length;
  const bonus = c.d.keys.has(`bonus:${c.today}`);
  const status = state.days[c.today]?.status || 'normal';
  const ordered = [...daily].sort((a, b) => Number(b.essential) - Number(a.essential) ||
    Number(c.d.keys.has(completionKey(a, c.today))) - Number(c.d.keys.has(completionKey(b, c.today))));
  const open = state.missions.filter((m) => m.type !== 'daily' && m.status === 'active' && !c.d.keys.has(completionKey(m, c.today)) && !isPostponed(m, c.today))
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9')).slice(0, 3);
  return `<div class="panel"><div class="panel-title"><h2>Missões de hoje</h2><span class="chip">${DAY_STATUSES[status].icon} ${DAY_STATUSES[status].label}</span></div>
    ${ess.length ? `<div class="row between" style="font-size:13px;margin-bottom:6px"><span>Essenciais <b class="mono">${essDone}/${ess.length}</b></span>
      <span class="${bonus ? 'chip ok' : 'muted'}">${bonus ? '🌟 Bônus recebido' : `Bônus +${Math.round(state.settings.rules.dailyBonus * (status === 'hard' ? state.settings.rules.lightFactor : 1))} XP`}</span></div>
      <div class="bar thin" style="margin-bottom:12px"><i style="--w:${(essDone / ess.length) * 100}%"></i></div>` : ''}
    <div class="list">${ordered.map((m) => missionRow(c, m, { compact: true })).join('') || `<div class="empty"><b>Sem missões diárias para hoje.</b>Aproveite para registrar atividades livres ou descansar.</div>`}</div>
    ${open.length ? `<div class="hud mt">Em andamento</div><div class="list mt-s">${open.map((m) => missionRow(c, m, { compact: true })).join('')}</div>` : ''}
    <div class="row wrap mt"><button class="btn sm" data-nav="log">${icon('log')} Registrar atividade</button><button class="btn sm ghost" data-nav="missions">Todas as missões →</button></div>
  </div>`;
}

function banners(c) {
  const out = [];
  const { state } = c;
  const status = state.days[c.today]?.status;
  const hadEffort = c.d.active.has(c.today);
  const gap = inactiveGapBefore(state, c.today, c.d.active);
  if (!hadEffort && gap >= state.settings.rules.comebackGapDays && status !== 'hard') {
    out.push(`<div class="notice warn"><b>Que bom ter você de volta.</b> Pausas fazem parte. Que tal recomeçar com missões leves hoje?
      Sua próxima atividade concede um <b>bônus de retomada</b>, e nenhuma conquista anterior foi perdida.
      <div class="row wrap mt-s"><button class="btn sm" data-action="day-hard">🌧️ Ativar modo dia difícil</button><button class="btn sm ghost" data-nav="log">Registrar algo pequeno</button></div></div>`);
  }
  if (['rest', 'sick', 'unexpected'].includes(status)) {
    out.push(`<div class="notice ok">${DAY_STATUSES[status].icon} <b>${DAY_STATUSES[status].label}.</b> ${DAY_STATUSES[status].desc} Nenhuma missão é cobrada hoje.</div>`);
  }
  if (status === 'hard') out.push(`<div class="notice warn">🌧️ <b>Modo dia difícil ativo.</b> As missões mostram versões leves. Fazer pouco ainda é fazer.</div>`);
  if (backupOverdue(state)) {
    out.push(`<div class="notice">☁️ <b>Hora de salvar uma cópia no iCloud.</b> ${backupStatusText(state)} Se o iPhone for perdido ou o app apagado, é ela que traz tudo de volta.
      <div class="row wrap mt-s"><button class="btn sm primary" data-action="cloud-save">${icon('upload')} Salvar no iCloud</button></div></div>`);
  }
  if (state.pending.length) {
    out.push(`<div class="notice">📥 <b>${state.pending.length} registro(s) importado(s)</b> aguardando sua confirmação. <button class="btn sm" data-nav="log" data-scroll="pending">Revisar</button></div>`);
  }
  return out.length ? `<div class="stack" style="margin-bottom:16px">${out.join('')}</div>` : '';
}

function focus(c) {
  const f = focusAreas(c.state, 14, c.today);
  const attr = (k) => ATTRIBUTES.find((a) => a.key === k);
  const sugg = c.state.settings.activities;
  const suggestFor = (k) => sugg.filter((a) => a.attrs[k]).sort((a, b) => b.attrs[k] - a.attrs[k])[0];
  return `<div class="panel"><div class="panel-title"><h2>Foco (14 dias)</h2></div>
    ${f.total === 0 ? '<div class="empty"><b>Sem dados ainda.</b>Seus registros revelarão onde você mais se dedica.</div>' : `
    <div class="hud">Maior dedicação</div><div class="chips">${f.top.map((x) => `<span class="chip" style="border-color:${attr(x.key).color}">${x.key} · ${fmt(x.points)} pts</span>`).join('')}</div>
    ${f.attention.length ? `<div class="hud">Pode receber mais atenção</div><div class="list mt-s">${f.attention.map((x) => {
      const s = suggestFor(x.key);
      return `<div class="row between" style="font-size:14px"><span><b style="color:${attr(x.key).color}">${x.key}</b> ${esc(attr(x.key).name)}</span>${s ? `<button class="btn sm ghost" data-action="quick-log" data-key="${s.key}">${s.icon} ${esc(s.name)}</button>` : ''}</div>`;
    }).join('')}</div>` : '<p class="muted">Seus atributos estão equilibrados. Excelente!</p>'}`}
  </div>`;
}

function inbox(c) {
  const items = c.state.inbox.slice(0, 8);
  const unread = c.state.inbox.filter((n) => !n.read).length;
  return `<div class="panel" id="inbox"><div class="panel-title"><h2>Notificações do sistema</h2>${unread ? `<button class="btn sm ghost" data-action="inbox-read">Marcar lidas (${unread})</button>` : ''}</div>
    ${items.length ? `<div class="list">${items.map((n) => `<div class="row" style="align-items:flex-start;font-size:14px;${n.read ? 'opacity:.6' : ''}">
      <span class="mono dim" style="font-size:11px;min-width:76px">${formatDay(new Date(n.ts).toISOString().slice(0, 10))} ${formatTime(n.ts)}</span>
      <div><b>${esc(n.title)}</b><div class="tl-sub">${esc(n.body)}</div></div></div>`).join('')}</div>`
    : '<div class="empty"><b>Nenhuma notificação.</b>Conquistas, níveis e lembretes aparecem aqui.</div>'}</div>`;
}

function render(c) {
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Janela de status · ${formatDay(c.today, { withWeekday: true })}</div><h1>Status</h1></div></div>
    ${banners(c)}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-items:start">
      ${hero(c)}
      ${today(c)}
      ${attributesPanel(c)}
      <div class="stack" style="gap:16px">${focus(c)}${inbox(c)}</div>
    </div>`;
}

const actions = {
  'cloud-save': () => saveBackupToCloud(),
  'day-hard': () => run((s) => E.setDayStatus(s, E.todayKey(s), 'hard')),
  'quick-log': (el) => run((s) => E.logActivity(s, el.dataset.key), el),
  'inbox-read': () => store.mutate((s) => { s.inbox.forEach((n) => { n.read = true; }); }),
};

export default {
  id: 'status', title: 'Status', icon: 'status', render, actions,
  badge: (c) => c.state.inbox.filter((n) => !n.read).length || null,
};
