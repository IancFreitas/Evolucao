import * as E from '../../core/engine.js';
import { ATTRIBUTES, attrInfo } from '../../core/defaults.js';
import { addDays, formatDay } from '../../core/dates.js';
import { PHASE_TYPES, activePhases } from '../../core/phases.js';
import { MOODS, suggestFromText } from '../../core/dayreview.js';
import { confirmDialog, esc, icon } from '../dom.js';
import { render as rerender, run, ui } from '../app.js';

const areaNames = (keys) => (keys || []).map((k) => attrInfo(k)?.name || k).join(', ');

function currentDate(c) {
  const min = addDays(c.today, -c.state.settings.rules.backdateDays);
  const d = ui.filters.dayDate;
  return d && d >= min && d <= c.today ? d : c.today;
}

function review(c) {
  const rules = c.state.settings.rules;
  const date = currentDate(c);
  const saved = c.state.journal?.[date] || {};
  const draft = ui.filters.dayDraft?.date === date ? ui.filters.dayDraft.text : saved.text || '';
  const dates = Array.from({ length: rules.backdateDays + 1 }, (_, i) => addDays(c.today, -i));
  const done = ui.filters.dayDone || {};
  const sugg = saved.text ? suggestFromText(c.state, saved.text, date).filter((x) => !done[`${date}:${x.activity}`]) : [];
  return `<div class="panel"><div class="panel-title"><h2>Como foi seu dia?</h2>
      <div class="row"><label class="sr" for="daydate">Dia</label><select id="daydate" data-change="day-date" style="width:auto">${dates.map((d, i) => `<option value="${d}" ${d === date ? 'selected' : ''}>${i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : formatDay(d)} · ${formatDay(d, { withWeekday: true })}</option>`).join('')}</select></div></div>
    <div class="mood-grid">${Object.entries(MOODS).map(([k, v]) => `<button type="button" class="mood ${k === saved.mood ? 'active' : ''}" data-action="day-mood" data-mood="${k}" aria-pressed="${k === saved.mood}"><span class="ic">${v.icon}</span><b>${v.label}</b></button>`).join('')}</div>
    <p class="hint">${saved.mood === 'cansativo' ? 'Missões do dia na versão leve.' : saved.mood === 'doente' ? 'Sequência protegida. Descanse.' : 'Toque para dizer como foi. Dá para mudar depois.'}</p>
    <form data-form="day-review" class="stack mt" style="gap:10px">
      <input type="hidden" name="date" value="${date}">
      <label class="field big-field">O que você fez hoje?<textarea id="daytext" name="text" rows="4" maxlength="1000" data-change="day-draft" placeholder="Ex.: lavei a louça, estudei inglês, descansei">${esc(draft)}</textarea></label>
      <div class="hint" style="margin:0">🎤 Pode falar pelo microfone do teclado.</div>
      <button class="btn primary big">${icon('check')} Salvar meu dia</button>
    </form>
    ${saved.text ? `<div class="mt"><div class="hud">Combina com o que você contou</div>
      ${sugg.length ? `<div class="list mt-s">${sugg.map((s) => `<div class="mission"><span class="sugg-ic">${s.icon}</span><div style="min-width:0"><div class="m-title">${esc(s.title)}</div></div>
        <div class="m-actions"><button class="btn sm ok" data-action="day-done" data-kind="${s.kind}" data-id="${esc(s.missionId || '')}" data-activity="${esc(s.activity)}" data-date="${date}">✓ Fiz</button></div></div>`).join('')}</div>`
        : '<p class="hint">Nada para marcar agora. Tudo bem!</p>'}</div>` : ''}
  </div>`;
}

function phaseCard(c, p, { past = false } = {}) {
  const def = PHASE_TYPES[p.type] || PHASE_TYPES.custom;
  const future = p.start > c.today;
  return `<div class="phase ${past ? 'past' : ''}">
    <div class="phase-h"><span class="ic">${def.icon}</span><div style="min-width:0"><b>${esc(p.title)}</b>
      <div class="tl-sub">${future ? `Começa em ${formatDay(p.start)}` : `De ${formatDay(p.start)}`} · ${p.end ? `até ${formatDay(p.end)}` : 'sem data para acabar'}</div></div></div>
    ${p.pause?.length ? `<div class="phase-line">⏸ Pausado: ${esc(areaNames(p.pause))}</div>` : ''}
    ${p.protect ? '<div class="phase-line">🛡️ Sequência protegida</div>' : ''}
    ${p.note ? `<div class="tl-sub">${esc(p.note)}</div>` : ''}
    ${past ? '' : `<div class="row wrap mt-s">
      ${future ? '' : `<button class="btn sm ok" data-action="phase-end" data-id="${esc(p.id)}">✅ Acabou / fui liberado</button>`}
      <button class="btn sm ghost danger" data-action="phase-del" data-id="${esc(p.id)}">🗑️ Excluir</button></div>`}
  </div>`;
}

function phasesPanel(c) {
  const phases = c.state.phases || [];
  const current = activePhases(c.state, c.today);
  const future = phases.filter((p) => p.start > c.today).sort((a, b) => a.start.localeCompare(b.start));
  const past = phases.filter((p) => p.end && p.end < c.today).sort((a, b) => b.end.localeCompare(a.end)).slice(0, 3);
  const ongoing = [...current, ...future];
  const types = Object.entries(PHASE_TYPES);
  return `<div class="panel mt"><div class="panel-title"><h2>Fases</h2></div>
    <p class="hint" style="margin-top:0">Cirurgia, viagem, provas... As missões se ajustam e voltam sozinhas quando a fase acaba.</p>
    ${ongoing.length ? `<div class="stack mt-s" style="gap:10px">${ongoing.map((p) => phaseCard(c, p)).join('')}</div>` : '<p class="hint">Nenhuma fase agora.</p>'}
    <details class="box mt" id="newphase"><summary class="btn big">+ Nova fase</summary>
      <form data-form="phase" class="stack mt" style="gap:12px">
        <div class="field">Que tipo de fase?<div class="day-status">${types.map(([k, t], i) => `<label class="ds" style="cursor:pointer"><input type="radio" name="type" value="${k}" data-change="phase-type" ${i === 0 ? 'checked' : ''} class="sr"><b>${t.icon} ${esc(t.label)}</b><small>${esc(t.desc)}</small></label>`).join('')}</div></div>
        <div class="stack" data-custom style="gap:10px;display:none">
          <div class="field">O que pausar?<div class="chips">${ATTRIBUTES.map((a) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="pause[]" value="${a.key}"> ${esc(a.name)}</label>`).join('')}</div></div>
          <label class="check"><input type="checkbox" name="protect"> Proteger a sequência</label>
        </div>
        <label class="field">Nome (opcional)<input name="title" maxlength="80" placeholder="Ex.: Minha cirurgia"></label>
        <label class="field">Começa em<input type="date" name="start" value="${c.today}" required></label>
        <label class="field">Termina em<input type="date" name="end" id="phaseend"></label>
        <label class="check"><input type="checkbox" name="noend" data-change="phase-noend"> Sem data para acabar</label>
        <button class="btn primary big">${icon('check')} Salvar fase</button>
      </form></details>
    ${past.length ? `<details class="box mt"><summary>Fases que já acabaram (${past.length})</summary><div class="stack mt-s" style="gap:10px">${past.map((p) => phaseCard(c, p, { past: true })).join('')}</div></details>` : ''}
  </div>`;
}

function diary(c) {
  const days = Object.entries(c.state.journal || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  return `<div class="panel mt"><div class="panel-title"><h2>Diário</h2></div>
    ${days.length ? `<div class="list">${days.map(([d, j]) => `<div class="diary-row"><span class="ic">${MOODS[j.mood]?.icon || '📝'}</span><div style="min-width:0"><b>${formatDay(d, { withWeekday: true })}</b>${j.text ? `<div class="tl-sub">${esc(j.text.length > 140 ? `${j.text.slice(0, 140)}…` : j.text)}</div>` : ''}</div></div>`).join('')}</div>`
      : '<div class="empty"><b>Nada por aqui ainda.</b>Quando você contar como foi o dia, ele fica guardado aqui.</div>'}
  </div>`;
}

function render(c) {
  return `<div class="page-head"><div><h1>Meu dia</h1><p class="lead">Conte como foi. As missões se ajustam.</p></div></div>
    ${review(c)}${phasesPanel(c)}${diary(c)}`;
}

const textNow = () => document.getElementById('daytext')?.value ?? '';

const actions = {
  'day-mood': (el, c) => {
    const date = currentDate(c);
    const saved = c.state.journal?.[date] || {};
    const mood = saved.mood === el.dataset.mood ? '' : el.dataset.mood;
    const text = textNow();
    if (ui.filters.dayDraft?.date === date) ui.filters.dayDraft = null;
    run((s) => E.saveDayReview(s, date, { mood, text }), null, { quiet: true });
  },
  'day-done': (el) => {
    const { kind, id, activity, date } = el.dataset;
    // depois de confirmar, a mesma área não volta como sugestão (evita marcar duas vezes)
    ui.filters.dayDone = { ...ui.filters.dayDone, [`${date}:${activity}`]: true };
    run((s) => (kind === 'mission' ? E.completeMission(s, id, { date }) : E.logActivity(s, activity, { date, note: 'Meu dia' })), el);
  },
  'phase-end': async (el, c) => {
    const p = c.state.phases.find((x) => x.id === el.dataset.id);
    const ok = await confirmDialog(`Acabou <b>${esc(p.title)}</b>? As missões voltam ao normal. XP e histórico não mudam.`, { ok: 'Sim, acabou' });
    if (ok) run((s) => E.endPhase(s, p.id));
  },
  'phase-del': async (el, c) => {
    const p = c.state.phases.find((x) => x.id === el.dataset.id);
    const ok = await confirmDialog(`Excluir <b>${esc(p.title)}</b>? XP e histórico não mudam.`, { ok: 'Excluir', danger: true });
    if (ok) run((s) => E.deletePhase(s, p.id));
  },
};

const changes = {
  'day-date': (el) => { ui.filters.dayDate = el.value; ui.filters.dayDraft = null; rerender(); },
  'day-draft': (el, c) => { ui.filters.dayDraft = { date: currentDate(c), text: el.value }; },
  'phase-type': (el) => {
    const form = el.closest('form');
    form.querySelector('[data-custom]').style.display = el.value === 'custom' ? '' : 'none';
  },
  'phase-noend': (el) => {
    const end = el.closest('form').querySelector('#phaseend');
    end.disabled = el.checked;
    if (el.checked) end.value = '';
  },
};

const forms = {
  'day-review': (data, form, c) => {
    const date = data.date;
    const mood = c.state.journal?.[date]?.mood || '';
    ui.filters.dayDraft = null;
    run((s) => E.saveDayReview(s, date, { mood, text: data.text || '' }), null, { quiet: true });
  },
  phase: (data) => {
    const input = { type: data.type, title: data.title, start: data.start || undefined, end: data.noend ? null : (data.end || null) };
    if (data.type === 'custom') {
      input.pause = data.pause || [];
      input.protect = !!data.protect;
    }
    run((s) => E.savePhase(s, input));
  },
};

export default { id: 'day', title: 'Meu dia', icon: 'day', render, actions, changes, forms };
