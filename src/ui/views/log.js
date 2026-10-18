import * as E from '../../core/engine.js';
import { DAY_STATUSES } from '../../core/defaults.js';
import { addDays, formatDay } from '../../core/dates.js';
import { esc, icon, toast } from '../dom.js';
import { render as rerender, run, ui } from '../app.js';
import { healthForms, pasteHealth } from '../health.js';

function usage(c, key, date) {
  return c.state.log.filter((e) => e.activity === key && e.date === date && (e.kind === 'activity' || (e.kind === 'mission' && e.missionType === 'daily'))).length;
}

function render(c) {
  const rules = c.state.settings.rules;
  const date = ui.filters.logDate && ui.filters.logDate >= addDays(c.today, -rules.backdateDays) ? ui.filters.logDate : c.today;
  const status = c.state.days[date]?.status || 'normal';
  const dates = Array.from({ length: rules.backdateDays + 1 }, (_, i) => addDays(c.today, -i));
  const acts = c.state.settings.activities;
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Registro de progresso</div><h1>Registrar</h1></div>
    <div class="row"><label class="sr" for="logdate">Dia do registro</label><select id="logdate" data-change="log-date" style="width:auto">${dates.map((d, i) => `<option value="${d}" ${d === date ? 'selected' : ''}>${i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : formatDay(d)} · ${formatDay(d, { withWeekday: true })}</option>`).join('')}</select></div></div>

    <div class="panel"><div class="panel-title"><h2>Como está o dia?</h2><span class="muted" style="font-size:13px">Sem punições: dias protegidos não quebram sequências.</span></div>
      <div class="day-status">${Object.entries(DAY_STATUSES).map(([k, v]) => `<button class="ds ${k === status ? 'active' : ''}" data-action="day-status" data-status="${k}" data-date="${date}" aria-pressed="${k === status}"><b>${v.icon} ${v.label}</b><small>${v.desc}</small></button>`).join('')}</div>
    </div>

    <div class="panel mt"><div class="panel-title"><h2>Atividades</h2><span class="muted" style="font-size:13px">Repetições no mesmo dia rendem menos (${rules.diminishing.map((f) => `${Math.round(f * 100)}%`).join(' → ')}).</span></div>
      <div class="quick-grid">${acts.map((a) => {
        const used = usage(c, a.key, date);
        const limit = a.dailyLimit ?? 3;
        const factor = rules.diminishing[used] ?? 0;
        const limited = used >= limit || factor <= 0;
        const attrs = Object.entries(a.attrs).map(([k, v]) => `${k}+${v}`).join(' ');
        return `<button class="quick ${limited ? 'limited' : ''}" data-action="log-activity" data-key="${a.key}" data-date="${date}" ${limited ? 'aria-disabled="true"' : ''}
          data-tip="${limited ? 'Limite diário atingido' : `Próximo registro: ${Math.round(factor * 100)}%`}">
          <span class="ic">${a.icon}</span><span class="nm">${esc(a.name)}</span>
          <span class="meta">${limited ? 'limite atingido' : `+${Math.round(a.xp * factor)} XP`} · ${used}/${limit}</span><span class="meta">${attrs}</span></button>`;
      }).join('')}</div>
      <details class="box mt"><summary>Registrar com anotação</summary>
        <form data-form="log-note" class="form-grid mt">
          <input type="hidden" name="date" value="${date}">
          <label class="field">Atividade<select name="activity">${acts.map((a) => `<option value="${a.key}">${a.icon} ${esc(a.name)}</option>`).join('')}</select></label>
          <label class="field">Anotação<input name="note" maxlength="300" placeholder="Ex.: capítulo 3 de algoritmos"></label>
          <div class="full"><button class="btn primary">${icon('check')} Registrar</button></div>
        </form></details>
    </div>

    <div class="panel mt" id="pending"><div class="panel-title"><h2>Aguardando confirmação</h2><div class="row wrap"><button class="btn sm" data-action="health-paste">❤️ Colar dados do Saúde</button><button class="btn sm ghost" data-action="goto-integrations">Importar dados →</button></div></div>
      ${pendingList(c)}
    </div>`;
}

function pendingList(c) {
  const acts = c.state.settings.activities;
  if (!c.state.pending.length) {
    return '<div class="empty"><b>Nada pendente.</b>Registros importados de calendário, tarefas, atividade física ou estudos aparecem aqui e só geram progresso após sua confirmação.</div>';
  }
  const list = [...c.state.pending].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="row wrap" style="margin-bottom:10px"><button class="btn sm ok" data-action="pending-all">${icon('check')} Confirmar todos com atividade definida</button><button class="btn sm ghost danger" data-action="pending-clear">Descartar todos</button></div>
    <div class="list">${list.map((p) => `<div class="mission"><span class="chip">${esc(p.source)}</span><div style="min-width:0"><div class="m-title">${esc(p.title)}</div>
      <div class="m-meta"><span>${formatDay(p.date, { withWeekday: true })}</span>${p.detail ? `<span>${esc(p.detail)}</span>` : ''}</div></div>
      <div class="m-actions"><select data-pending-act="${p.id}" style="width:auto;max-width:170px" aria-label="Atividade"><option value="">Atividade…</option>${acts.map((a) => `<option value="${a.key}" ${a.key === p.activity ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select>
      <button class="btn icon sm ok" data-action="pending-ok" data-id="${p.id}" aria-label="Confirmar" data-tip="Confirmar">${icon('check')}</button>
      <button class="btn icon sm ghost" data-action="pending-no" data-id="${p.id}" aria-label="Descartar" data-tip="Descartar">${icon('x')}</button></div></div>`).join('')}</div>`;
}

const actions = {
  'health-paste': () => pasteHealth(),
  'goto-integrations': () => { ui.tabs.settings = 'integrations'; location.hash = '#/settings'; },
  'log-activity': (el) => run((s) => E.logActivity(s, el.dataset.key, { date: el.dataset.date }), el),
  'day-status': (el) => {
    run((s) => E.setDayStatus(s, el.dataset.date, el.dataset.status), null, { quiet: true });
  },
  'pending-ok': (el) => {
    const sel = document.querySelector(`[data-pending-act="${el.dataset.id}"]`);
    run((s) => E.confirmPending(s, el.dataset.id, sel?.value || null), el);
  },
  'pending-no': (el) => run((s) => E.rejectPending(s, el.dataset.id), null, { quiet: true }),
  'pending-all': (el) => {
    const choices = Object.fromEntries([...document.querySelectorAll('[data-pending-act]')].map((s) => [s.dataset.pendingAct, s.value]));
    let ok = 0;
    let fail = 0;
    run((s) => {
      for (const p of [...s.pending]) {
        const a = choices[p.id] || p.activity;
        if (!a) continue;
        try { E.confirmPending(s, p.id, a); ok++; } catch { fail++; }
      }
    }, el);
    toast(`${ok} confirmado(s)${fail ? `, ${fail} ignorado(s) por limites diários ou janela de datas` : ''}.`);
  },
  'pending-clear': () => run((s) => { s.pending = []; }, null, { quiet: true }),
};

const changes = {
  'log-date': (el) => { ui.filters.logDate = el.value; rerender(); },
};

const forms = {
  ...healthForms,
  'log-note': (data) => run((s) => E.logActivity(s, data.activity, { date: data.date, note: data.note })),
};

export default {
  id: 'log', title: 'Registrar', icon: 'log', render, actions, changes, forms,
  badge: (c) => c.state.pending.length || null,
};
