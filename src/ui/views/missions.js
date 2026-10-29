import * as E from '../../core/engine.js';
import { addDays, diffDays, formatDay, weekdayName } from '../../core/dates.js';
import {
  MISSION_TYPES, activityOf, completionKey, isPostponed, isScheduled, missionXp,
} from '../../core/missions.js';
import { habitStreak } from '../../core/streaks.js';
import { pausingPhase } from '../../core/phases.js';
import { closeModal, confirmDialog, esc, fmt, icon, openModal, promptDialog, toast } from '../dom.js';
import { render as rerender, run, ui } from '../app.js';

const TYPES = Object.keys(MISSION_TYPES);

function xpLabel(c, m) {
  const xp = missionXp(c.state, m);
  const light = m.type === 'daily' && m.light && c.state.days[c.today]?.status === 'hard';
  return light ? `+${Math.round(xp * c.state.settings.rules.lightFactor)} XP (leve)` : `+${fmt(xp)} XP`;
}

function dueChip(c, m) {
  if (!m.dueDate || m.status !== 'active') return '';
  const left = diffDays(c.today, m.dueDate);
  const cls = left < 0 ? 'warn' : left <= 3 ? 'warn' : '';
  const txt = left < 0 ? `prazo passou há ${-left}d` : left === 0 ? 'prazo hoje' : `${left}d restantes`;
  return `<span class="chip ${cls}" data-tip="Prazo: ${formatDay(m.dueDate)}">${icon('clock')} ${txt}</span>`;
}

/** Linha de missão reutilizada pelo Status e pela tela de Missões. */
export function missionRow(c, m, { compact = false } = {}) {
  const act = activityOf(c.state, m);
  const done = c.d.keys.has(completionKey(m, c.today));
  const skipped = m.status === 'active' && isPostponed(m, c.today);
  const archived = m.status === 'archived';
  const completed = m.status === 'completed';
  const hard = c.state.days[c.today]?.status === 'hard';
  const paused = m.type === 'daily' && m.status === 'active' && !done ? pausingPhase(c.state, m, c.today) : null;
  const cls = ['mission', paused ? 'paused' : '', m.type === 'boss' ? 'boss' : '', done || completed ? 'done' : '', skipped ? 'skipped' : '', archived ? 'archived' : ''].join(' ');
  const meta = [];
  if (act) meta.push(`<span>${act.icon} ${esc(act.name)}</span>`);
  meta.push(`<span class="xp-tag">${xpLabel(c, m)}</span>`);
  if (m.type === 'daily') {
    if (m.essential) meta.push('<span class="essential" data-tip="Conta para o bônus diário">★ essencial</span>');
    const st = habitStreak(c.state, m, c.today, c.d.keys);
    if (st.current) meta.push(`<span data-tip="Recorde: ${st.best}">🔥 ${st.current}</span>`);
    if (!compact && m.days.length < 7) meta.push(`<span class="dim">${m.days.map(weekdayName).join(' ')}</span>`);
  }
  if (skipped) meta.push('<span class="chip">adiada hoje</span>');
  if (paused) meta.push(`<span class="chip">⏸ Pausada: ${esc(paused.title)}</span>`);
  if (archived) meta.push('<span class="chip">pausada</span>');
  if (m.source) meta.push(`<span class="chip">via ${esc(m.source)}</span>`);
  meta.push(dueChip(c, m));

  let extra = '';
  if (m.type === 'main' && m.progress?.target) {
    const p = m.progress;
    extra = `<div class="row mt-s"><div class="bar thin" style="flex:1"><i style="--w:${(p.current / p.target) * 100}%"></i></div>
      <span class="mono num" style="font-size:12px">${p.current}/${p.target} ${esc(p.unit)}</span>
      ${completed ? '' : `<button class="btn icon sm ghost" data-action="m-progress" data-id="${m.id}" data-delta="-1" aria-label="Diminuir">${icon('minus')}</button>
      <button class="btn icon sm" data-action="m-progress" data-id="${m.id}" data-delta="1" aria-label="Avançar">${icon('plus')}</button>`}</div>`;
  }
  if (m.type === 'boss' && m.stages?.length) {
    const doneN = m.stages.filter((s) => s.done).length;
    const hp = completed ? 0 : 100 - (doneN / m.stages.length) * 90;
    extra = `<div class="row mt-s"><span class="hud" style="color:#ff7a8f">HP</span><div class="hp" style="flex:1"><i style="--w:${hp}%"></i></div><span class="mono" style="font-size:12px">${doneN}/${m.stages.length}</span></div>
      ${compact ? '' : `<div class="stages">${m.stages.map((s) => `<label class="stage ${s.done ? 'done' : ''}"><input type="checkbox" ${s.done ? 'checked' : ''} ${completed ? 'disabled' : ''} data-change="boss-stage" data-id="${m.id}" data-stage="${s.id}"><span>${esc(s.title)}</span></label>`).join('')}</div>`}`;
  }

  const canCheck = !archived && (m.type !== 'daily' || isScheduled(m, c.today));
  const bossLocked = m.type === 'boss' && m.stages?.some((s) => !s.done) && !completed;
  const check = canCheck
    ? `<button class="m-check" data-action="m-toggle" data-id="${m.id}" aria-label="${done || completed ? 'Desfazer conclusão' : 'Concluir'}: ${esc(m.title)}" ${bossLocked ? 'disabled data-tip="Conclua as etapas para enfrentar o chefe"' : ''}>${icon(m.type === 'boss' && !completed ? 'sword' : 'check')}</button>`
    : '<span class="m-check" style="opacity:.3" aria-hidden="true"></span>';

  const actions = [];
  if (m.status === 'active' && !done && (m.type !== 'daily' || isScheduled(m, c.today))) {
    actions.push(skipped
      ? `<button class="btn sm ghost" data-action="m-resume" data-id="${m.id}">Retomar</button>`
      : `<button class="btn icon sm ghost" data-action="m-postpone" data-id="${m.id}" data-tip="Adiar sem penalidade" aria-label="Adiar">${icon('clock')}</button>`);
  }
  if (!compact) {
    actions.push(`<button class="btn icon sm ghost" data-action="m-edit" data-id="${m.id}" data-tip="Editar" aria-label="Editar">${icon('edit')}</button>`);
    if (!completed) actions.push(`<button class="btn icon sm ghost" data-action="m-archive" data-id="${m.id}" data-tip="${archived ? 'Reativar' : 'Pausar'}" aria-label="${archived ? 'Reativar' : 'Pausar'}">${icon(archived ? 'play' : 'pause')}</button>`);
    actions.push(`<button class="btn icon sm ghost" data-action="m-delete" data-id="${m.id}" data-tip="Excluir" aria-label="Excluir">${icon('trash')}</button>`);
  }
  const showLight = m.type === 'daily' && hard && m.light && !done;
  return `<div class="${cls}">${check}<div style="min-width:0"><div class="m-title">${esc(showLight ? m.light : m.title)}</div>
    ${showLight ? `<div class="m-light">Versão leve de: ${esc(m.title)}</div>` : ''}
    ${!compact && m.description ? `<div class="tl-sub">${esc(m.description)}</div>` : ''}
    <div class="m-meta">${meta.join('')}</div>${extra}</div><div class="m-actions">${actions.join('')}</div></div>`;
}

function sortMissions(c, list) {
  const rank = (m) => (m.status === 'archived' ? 3 : m.status === 'completed' ? 2 : c.d.keys.has(completionKey(m, c.today)) ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
}

function render(c) {
  const tab = ui.tabs.missions || 'daily';
  const showDone = ui.filters.showCompleted;
  const counts = Object.fromEntries(TYPES.map((t) => [t, c.state.missions.filter((m) => m.type === t && m.status !== 'completed').length]));
  let list = c.state.missions.filter((m) => m.type === tab);
  const completedCount = list.filter((m) => m.status === 'completed').length;
  if (!showDone) list = list.filter((m) => m.status !== 'completed');
  const info = MISSION_TYPES[tab];
  let body;
  if (tab === 'daily') {
    const todayList = list.filter((m) => isScheduled(m, c.today) || m.status === 'archived');
    const other = list.filter((m) => !todayList.includes(m));
    body = `<div class="list">${sortMissions(c, todayList).map((m) => missionRow(c, m)).join('') || emptyState(tab)}</div>
      ${other.length ? `<div class="hud mt">Não agendadas para hoje</div><div class="list mt-s">${other.map((m) => missionRow(c, m)).join('')}</div>` : ''}`;
  } else {
    body = `<div class="list">${sortMissions(c, list).map((m) => missionRow(c, m)).join('') || emptyState(tab)}</div>`;
  }
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Quadro de missões</div><h1>Missões</h1></div>
    <button class="btn primary" data-action="m-new">${icon('plus')} Nova missão</button></div>
    <div class="tabs" role="tablist">${TYPES.map((t) => `<button class="tab ${t === tab ? 'active' : ''}" role="tab" aria-selected="${t === tab}" data-action="set-tab" data-view="missions" data-tab="${t}">${MISSION_TYPES[t].icon} ${MISSION_TYPES[t].label}<span class="n">${counts[t]}</span></button>`).join('')}</div>
    <div class="panel"><div class="panel-title"><h2>${info.label}</h2><span class="muted" style="font-size:13px">${info.desc}</span></div>
    ${body}
    ${completedCount ? `<div class="mt"><label class="check"><input type="checkbox" data-change="show-completed" ${showDone ? 'checked' : ''}> Mostrar concluídas (${completedCount})</label></div>` : ''}
    </div>`;
}

function emptyState(type) {
  return `<div class="empty"><b>Nenhuma missão ${MISSION_TYPES[type].single.toLowerCase()} ainda.</b>Crie uma missão para começar a evoluir.<div class="mt"><button class="btn sm" data-action="m-new" data-type="${type}">${icon('plus')} Criar</button></div></div>`;
}

/* ------------------------------ Formulário ------------------------------ */

export function missionForm(c, m = null, type = 'daily') {
  const t = m?.type || type;
  const acts = c.state.settings.activities;
  const days = m?.days || [0, 1, 2, 3, 4, 5, 6];
  const sec = (types, html) => `<div class="full form-grid" data-for="${types}" style="${types.split(' ').includes(t) ? '' : 'display:none'}">${html}</div>`;
  const body = `<form data-form="mission" class="form-grid">
    <input type="hidden" name="id" value="${esc(m?.id || '')}">
    <label class="field">Tipo<select name="type" data-change="mission-type" ${m ? 'disabled' : ''}>${TYPES.map((x) => `<option value="${x}" ${x === t ? 'selected' : ''}>${MISSION_TYPES[x].icon} ${MISSION_TYPES[x].single}</option>`).join('')}</select></label>
    <label class="field">Área / atividade<select name="activity">${acts.map((a) => `<option value="${a.key}" ${a.key === m?.activity ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></label>
    <label class="field full">Título<input name="title" required maxlength="120" value="${esc(m?.title || '')}" placeholder="Ex.: Sessão de estudo de 50 min"></label>
    <label class="field full">Descrição (opcional)<textarea name="description" maxlength="600" rows="2">${esc(m?.description || '')}</textarea></label>
    <label class="field">XP (vazio = padrão)<input name="xp" type="number" min="0" max="5000" value="${m?.xp ?? ''}" placeholder="padrão"></label>
    ${sec('daily', `<label class="check" style="align-self:end;padding-bottom:9px"><input type="checkbox" name="essential" ${m?.essential ? 'checked' : ''}> ★ Essencial (conta para o bônus diário)</label>
      <div class="field full">Dias da semana<div class="days-pick">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="days[]" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${weekdayName(d)}</span></label>`).join('')}</div></div>
      <label class="field full">Versão leve para dias difíceis<input name="light" maxlength="160" value="${esc(m?.light || '')}" placeholder="Ex.: Caminhar 10 minutos"></label>`)}
    ${sec('weekly main special boss', `<label class="field">Prazo (opcional)<input type="date" name="dueDate" value="${esc(m?.dueDate || '')}"></label>`)}
    ${sec('main', `<label class="field">Meta numérica<input type="number" name="target" min="0" max="100000" value="${m?.progress?.target ?? 10}"></label>
      <label class="field">Unidade<input name="unit" maxlength="30" value="${esc(m?.progress?.unit || 'etapas')}"></label>
      <label class="field">Progresso atual<input type="number" name="current" min="0" value="${m?.progress?.current ?? 0}"></label>`)}
    ${sec('boss', `<label class="field full">Etapas do chefe (uma por linha)<textarea name="stages" rows="5" placeholder="Definir escopo&#10;Construir&#10;Testar&#10;Entregar">${esc((m?.stages || []).map((s) => s.title).join('\n'))}</textarea></label>`)}
    <div class="full modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">${m ? 'Salvar alterações' : 'Criar missão'}</button></div>
  </form>`;
  openModal(m ? 'Editar missão' : 'Nova missão', body);
}

const actions = {
  'm-new': (el, c) => missionForm(c, null, el.dataset.type || ui.tabs.missions || 'daily'),
  'm-edit': (el, c) => missionForm(c, c.state.missions.find((m) => m.id === el.dataset.id)),
  'm-toggle': (el, c) => {
    const m = c.state.missions.find((x) => x.id === el.dataset.id);
    const done = c.d.keys.has(completionKey(m, c.today));
    run((s) => (done ? E.undoMission(s, m.id) : E.completeMission(s, m.id)), el, { quiet: false });
  },
  'm-progress': (el, c) => {
    const m = c.state.missions.find((x) => x.id === el.dataset.id);
    run((s) => E.setMainProgress(s, m.id, m.progress.current + Number(el.dataset.delta)), el);
  },
  'm-postpone': async (el, c) => {
    const m = c.state.missions.find((x) => x.id === el.dataset.id);
    if (m.type === 'daily') {
      run((s) => E.postponeMission(s, m.id));
      return;
    }
    const def = addDays(m.dueDate && m.dueDate > c.today ? m.dueDate : c.today, 7);
    const v = await promptDialog('Adiar missão', 'Novo prazo', { type: 'date', value: def, ok: 'Adiar' });
    if (v) run((s) => E.postponeMission(s, m.id, { until: v }));
  },
  'm-resume': (el) => run((s) => E.resumeMission(s, el.dataset.id)),
  'm-archive': (el) => run((s) => E.toggleArchive(s, el.dataset.id)),
  'm-delete': async (el, c) => {
    const m = c.state.missions.find((x) => x.id === el.dataset.id);
    const ok = await confirmDialog(`Excluir a missão <b>${esc(m.title)}</b>? O XP já conquistado com ela continua no seu histórico.`, { ok: 'Excluir', danger: true });
    if (ok) run((s) => E.deleteMission(s, m.id));
  },
};

const changes = {
  'mission-type': (el) => {
    const form = el.closest('form');
    form.querySelectorAll('[data-for]').forEach((s) => { s.style.display = s.dataset.for.split(' ').includes(el.value) ? '' : 'none'; });
  },
  'boss-stage': (el) => run((s) => E.toggleBossStage(s, el.dataset.id, el.dataset.stage), el),
  'show-completed': (el) => { ui.filters.showCompleted = el.checked; rerender(); },
};

const forms = {
  mission: (data, form, c) => {
    const existing = data.id && c.state.missions.find((m) => m.id === data.id);
    const type = existing?.type || data.type;
    const input = {
      id: data.id || undefined, type, title: data.title, description: data.description, activity: data.activity, xp: data.xp,
    };
    if (type === 'daily') {
      input.essential = !!data.essential;
      input.days = (data.days || []).map(Number);
      if (!input.days.length) input.days = [0, 1, 2, 3, 4, 5, 6];
      input.light = data.light;
    } else input.dueDate = data.dueDate || null;
    if (type === 'main') input.progress = { target: Number(data.target) || 0, unit: data.unit, current: Number(data.current) || 0 };
    if (type === 'boss') {
      input.stages = String(data.stages || '').split('\n').map((x) => x.trim()).filter(Boolean)
        .map((title) => existing?.stages?.find((s) => s.title === title) || { title });
    }
    closeModal();
    ui.tabs.missions = type;
    const r = run((s) => {
      const m = E.saveMission(s, input);
      if (m.type === 'main' && m.progress?.target && m.status === 'active') E.setMainProgress(s, m.id, m.progress.current);
      return m;
    });
    if (r) toast(existing ? 'Missão atualizada.' : `Missão criada: <b>${esc(r.title)}</b>`);
  },
};

export default { id: 'missions', title: 'Missões', icon: 'missions', render, actions, changes, forms };
