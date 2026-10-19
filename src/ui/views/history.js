import * as E from '../../core/engine.js';
import { addDays, formatDay, formatTime } from '../../core/dates.js';
import { attrInfo } from '../../core/defaults.js';
import { confirmDialog, esc, fmt, icon } from '../dom.js';
import { logToCsv, download } from '../../storage/backup.js';
import { render as rerender, run, ui } from '../app.js';

const KINDS = {
  all: 'Tudo',
  mission: 'Missões',
  activity: 'Atividades',
  system: 'Bônus e conquistas',
  purchase: 'Loja',
};
const SYSTEM_KINDS = ['dungeon', 'bonus', 'comeback', 'achievement', 'stage', 'milestone'];
const KIND_ICON = { mission: '🎯', activity: '⚡', bonus: '🌟', comeback: '🐦‍🔥', achievement: '🏆', stage: '🗡️', milestone: '🧭', purchase: '🛍️', dungeon: '🚪', adjust: '⚙️' };

function render(c) {
  const kind = ui.tabs.histKind || 'all';
  const range = ui.filters.histRange || '30';
  const from = range === 'all' ? '0000' : addDays(c.today, -Number(range) + 1);
  let list = c.state.log.filter((e) => e.date >= from);
  if (kind === 'system') list = list.filter((e) => SYSTEM_KINDS.includes(e.kind));
  else if (kind !== 'all') list = list.filter((e) => e.kind === kind);
  list.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const shown = list.slice(0, ui.filters.histLimit || 200);
  const groups = new Map();
  for (const e of shown) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }
  const totalXp = list.reduce((s, e) => s + (e.xp || 0), 0);
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Crônica do jogador</div><h1>Histórico</h1></div>
    <div class="row wrap"><select data-change="hist-range" style="width:auto" aria-label="Período">${[['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['365', '1 ano'], ['all', 'Tudo']].map(([v, l]) => `<option value="${v}" ${v === range ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="btn sm" data-action="export-csv">${icon('download')} CSV</button></div></div>
    <div class="tabs">${Object.entries(KINDS).map(([k, v]) => `<button class="tab ${k === kind ? 'active' : ''}" data-action="set-tab" data-view="histKind" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="panel"><div class="panel-title"><h2>${list.length} registro(s)</h2><span class="xp-tag">${fmt(totalXp)} XP no período</span></div>
    ${shown.length ? `<div class="timeline">${[...groups.entries()].map(([date, items]) => `
      <div class="tl-day">${formatDay(date, { withWeekday: true })} · ${fmt(items.reduce((s, e) => s + (e.xp || 0), 0))} XP${c.state.days[date] ? ` · ${esc(c.state.days[date].status === 'hard' ? 'dia difícil' : c.state.days[date].status === 'rest' ? 'descanso' : c.state.days[date].status === 'sick' ? 'doente' : 'imprevisto')}` : ''}</div>
      ${items.map((e) => `<div class="tl-item"><span class="t">${formatTime(e.ts)}</span>
        <div style="min-width:0"><div>${KIND_ICON[e.kind] || '•'} ${esc(e.title || e.kind)}</div>
        <div class="tl-sub">${Object.entries(e.attrs || {}).map(([k, v]) => `<span style="color:${attrInfo(k)?.color}">${k}+${v}</span>`).join(' ')}
        ${e.source && e.source !== 'manual' && e.source !== 'system' ? ` · via ${esc(e.source)}` : ''}${e.backdated ? ' · retroativo' : ''}${e.note ? ` · ${esc(e.note)}` : ''}</div></div>
        <span class="x ${e.coins < 0 ? 'neg' : ''}">${e.xp ? `+${fmt(e.xp)} XP` : ''}${e.coins ? ` <span class="coin">${e.coins > 0 ? '+' : ''}${fmt(e.coins)}◈</span>` : ''}</span>
        <span class="act">${['activity', 'mission'].includes(e.kind) ? `<button class="btn icon sm ghost" data-action="entry-remove" data-id="${e.id}" aria-label="Remover registro" data-tip="Remover (correção)">${icon('undo')}</button>` : ''}</span></div>`).join('')}`).join('')}</div>
      ${list.length > shown.length ? `<div class="mt" style="text-align:center"><button class="btn sm" data-action="hist-more">Mostrar mais</button></div>` : ''}`
    : '<div class="empty"><b>Nada por aqui ainda.</b>Cada missão e atividade registrada aparece nesta crônica.</div>'}</div>`;
}

const actions = {
  'entry-remove': async (el, c) => {
    const e = c.state.log.find((x) => x.id === el.dataset.id);
    if (await confirmDialog(`Remover <b>${esc(e.title)}</b> (${fmt(e.xp)} XP)? Use isto para corrigir registros feitos por engano.`, { ok: 'Remover', danger: true })) {
      run((s) => E.removeEntry(s, e.id));
    }
  },
  'hist-more': () => { ui.filters.histLimit = (ui.filters.histLimit || 200) + 200; rerender(); },
  'export-csv': (el, c) => download(`system-ascension-historico-${c.today}.csv`, logToCsv(c.state), 'text/csv'),
};

const changes = {
  'hist-range': (el) => { ui.filters.histRange = el.value; rerender(); },
};

export default { id: 'history', title: 'Histórico', icon: 'history', render, actions, changes };
