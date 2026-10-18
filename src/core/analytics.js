// Agregações para o painel analítico. Funções puras sobre o livro-razão.
import { addDays, monthKey, rangeDays, weekKey, weekStart, parseDay, dayKey } from './dates.js';
import { ATTR_KEYS } from './defaults.js';
import { EFFORT_KINDS } from './ledger.js';
import { levelFromXp } from './levels.js';
import { isProtected } from './streaks.js';

const sumBy = (entries, keyFn) => {
  const map = new Map();
  for (const e of entries) {
    const k = keyFn(e);
    map.set(k, (map.get(k) || 0) + (e.xp || 0));
  }
  return map;
};

export function xpByDay(state, days, today) {
  const from = addDays(today, -(days - 1));
  const map = sumBy(state.log.filter((e) => e.date >= from), (e) => e.date);
  return rangeDays(from, today).map((date) => ({ key: date, xp: map.get(date) || 0 }));
}

export function xpByWeek(state, weeks, today) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const map = sumBy(state.log.filter((e) => e.date >= start), (e) => weekKey(e.date));
  const out = [];
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(start, i * 7);
    out.push({ key: weekKey(ws), start: ws, xp: map.get(weekKey(ws)) || 0 });
  }
  return out;
}

export function xpByMonth(state, months, today) {
  const t = parseDay(today);
  const out = [];
  const map = sumBy(state.log, (e) => monthKey(e.date));
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1, 12);
    const key = monthKey(dayKey(d));
    out.push({ key, xp: map.get(key) || 0 });
  }
  return out;
}

/** Pontos acumulados de cada atributo ao longo do tempo (amostrado por dia). */
export function attrTimeline(state, days, today) {
  const from = addDays(today, -(days - 1));
  const acc = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0]));
  const perDay = new Map();
  for (const e of state.log) {
    if (!e.attrs) continue;
    if (e.date < from) {
      for (const [k, v] of Object.entries(e.attrs)) if (k in acc) acc[k] += v;
    } else {
      if (!perDay.has(e.date)) perDay.set(e.date, []);
      perDay.get(e.date).push(e);
    }
  }
  return rangeDays(from, today).map((date) => {
    for (const e of perDay.get(date) || []) for (const [k, v] of Object.entries(e.attrs)) if (k in acc) acc[k] += v;
    return { key: date, ...acc };
  });
}

/** Missões e atividades concluídas por dia. */
export function habitsByDay(state, days, today) {
  const from = addDays(today, -(days - 1));
  const map = new Map();
  for (const e of state.log) {
    if (e.date >= from && (e.kind === 'mission' || e.kind === 'activity')) map.set(e.date, (map.get(e.date) || 0) + 1);
  }
  return rangeDays(from, today).map((date) => ({ key: date, count: map.get(date) || 0 }));
}

/** Mapa de consistência: XP de esforço por dia + estado do dia. */
export function consistency(state, weeks, today) {
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const map = sumBy(state.log.filter((e) => e.date >= from && EFFORT_KINDS.includes(e.kind)), (e) => e.date);
  return rangeDays(from, addDays(weekStart(today), 6)).map((date) => ({
    key: date,
    xp: map.get(date) || 0,
    status: state.days[date]?.status || null,
    protected: isProtected(state, date),
    future: date > today,
  }));
}

/** Recalcula quando cada nível foi alcançado. */
export function levelHistory(state) {
  const rules = state.settings.rules;
  const entries = [...state.log].filter((e) => e.xp).sort((a, b) => a.ts - b.ts);
  const out = [{ level: 1, date: entries[0]?.date || null, ts: entries[0]?.ts || state.createdAt }];
  let total = 0;
  let level = 1;
  for (const e of entries) {
    total += e.xp;
    const l = levelFromXp(total, rules).level;
    while (level < l) {
      level++;
      out.push({ level, date: e.date, ts: e.ts });
    }
  }
  return out;
}

/** Áreas de dedicação: pontos de atributo nos últimos N dias. */
export function focusAreas(state, days, today) {
  const from = addDays(today, -(days - 1));
  const acc = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0]));
  const lastDay = Object.fromEntries(ATTR_KEYS.map((k) => [k, null]));
  for (const e of state.log) {
    for (const [k, v] of Object.entries(e.attrs || {})) {
      if (!(k in acc)) continue;
      if (e.date >= from) acc[k] += v;
      if (!lastDay[k] || e.date > lastDay[k]) lastDay[k] = e.date;
    }
  }
  const list = ATTR_KEYS.map((k) => ({ key: k, points: acc[k], lastDay: lastDay[k] })).sort((a, b) => b.points - a.points);
  const total = list.reduce((s, x) => s + x.points, 0);
  const avg = total / ATTR_KEYS.length;
  return {
    total,
    top: list.filter((x) => x.points > 0).slice(0, 3),
    attention: [...list].reverse().filter((x) => x.points < avg * 0.5).slice(0, 3),
    list,
  };
}

export function records(state, today) {
  const daily = sumBy(state.log.filter((e) => e.xp > 0), (e) => e.date);
  const weekly = sumBy(state.log.filter((e) => e.xp > 0), (e) => weekKey(e.date));
  const best = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const bonusDays = new Set(state.log.filter((e) => e.kind === 'bonus').map((e) => e.date));
  let run = 0;
  let bestRun = 0;
  const sorted = [...bonusDays].sort();
  if (sorted.length) {
    for (const d of rangeDays(sorted[0], today)) {
      if (bonusDays.has(d)) bestRun = Math.max(bestRun, ++run);
      else if (!isProtected(state, d) && d !== today) run = 0;
    }
  }
  const [bestDay, bestDayXp] = best(daily);
  const [bestWeek, bestWeekXp] = best(weekly);
  return {
    bestDay, bestDayXp, bestWeek, bestWeekXp, bestPerfectRun: bestRun,
    activeDays: new Set(state.log.filter((e) => EFFORT_KINDS.includes(e.kind)).map((e) => e.date)).size,
  };
}
