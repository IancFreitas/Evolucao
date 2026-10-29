// Sequências não punitivas: dias protegidos (descanso, doença, imprevisto) e escudos
// semanais não quebram a sequência, e o recorde nunca é perdido.
import { addDays, rangeDays, weekKey } from './dates.js';
import { PROTECTED_STATUSES } from './defaults.js';
import { EFFORT_KINDS } from './ledger.js';
import { completionKey, isScheduled } from './missions.js';
import { isPhaseProtected, pausingPhase } from './phases.js';

export function effortDays(state) {
  const set = new Set();
  for (const e of state.log) if (EFFORT_KINDS.includes(e.kind) && e.xp > 0) set.add(e.date);
  return set;
}

export const isProtected = (state, date) => PROTECTED_STATUSES.includes(state.days[date]?.status) || isPhaseProtected(state, date);

export function computeStreak(state, today, shieldsPerWeek, active = effortDays(state)) {
  const result = { current: 0, best: 0, shieldsLeft: shieldsPerWeek, shieldsUsed: 0, protectedDays: 0 };
  if (!active.size) return result;
  const first = [...active].sort()[0];
  if (first > today) return result;
  const used = {};
  let cur = 0;
  let best = 0;
  for (const d of rangeDays(first, today)) {
    if (active.has(d)) {
      cur++;
      best = Math.max(best, cur);
    } else if (d === today) {
      // o dia ainda não acabou: não conta nem quebra
    } else if (isProtected(state, d)) {
      result.protectedDays++;
    } else {
      const wk = weekKey(d);
      if ((used[wk] || 0) < shieldsPerWeek) {
        used[wk] = (used[wk] || 0) + 1;
        result.shieldsUsed++;
      } else {
        cur = 0;
      }
    }
  }
  result.current = cur;
  result.best = best;
  result.shieldsLeft = Math.max(0, shieldsPerWeek - (used[weekKey(today)] || 0));
  return result;
}

/** Dias sem esforço e sem proteção imediatamente antes de `date`. */
export function inactiveGapBefore(state, date, active = effortDays(state)) {
  let gap = 0;
  let d = addDays(date, -1);
  const floor = [...active].sort()[0];
  if (!floor || floor >= date) return 0;
  while (d >= floor && !active.has(d)) {
    if (!isProtected(state, d)) gap++;
    d = addDays(d, -1);
  }
  return gap;
}

/** Sequência individual de um hábito diário (dias não agendados ou protegidos não quebram). */
export function habitStreak(state, m, today, keys) {
  let cur = 0;
  let best = 0;
  const start = m.startDate || today;
  const from = start < addDays(today, -400) ? addDays(today, -400) : start;
  for (const d of rangeDays(from, today)) {
    if (!isScheduled(m, d)) continue;
    if (keys.has(completionKey(m, d))) {
      cur++;
      best = Math.max(best, cur);
    } else if (d === today || isProtected(state, d) || (m.skips || []).includes(d) || pausingPhase(state, m, d)) {
      continue;
    } else {
      cur = 0;
    }
  }
  return { current: cur, best };
}
