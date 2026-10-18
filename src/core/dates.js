// Utilitários de datas baseados em "chaves de dia" locais (YYYY-MM-DD).
// Todas as regras de evolução trabalham com essas chaves, nunca com horários soltos.

export const pad = (n) => String(n).padStart(2, '0');

/** Chave do dia local. `startHour` permite que madrugadas contem para o dia anterior. */
export function dayKey(date = new Date(), startHour = 0) {
  const d = new Date(date.getTime() - startHour * 3600e3);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converte a chave em Date ao meio-dia (evita problemas de horário de verão). */
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Diferença em dias: b - a. */
export function diffDays(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 864e5);
}

/** 0 = domingo ... 6 = sábado */
export const weekday = (key) => parseDay(key).getDay();

/** Segunda-feira da semana do dia. */
export function weekStart(key) {
  return addDays(key, -((weekday(key) + 6) % 7));
}

/** Semana ISO-8601, ex.: 2026-W42 */
export function weekKey(key) {
  const d = parseDay(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3); // quinta-feira da semana
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4, 12);
  jan4.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d - jan4) / (7 * 864e5));
  return `${year}-W${pad(week)}`;
}

export const monthKey = (key) => key.slice(0, 7);

export function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const weekdayName = (i) => WEEKDAYS[i];
export const monthName = (i) => MONTHS[i];

export function formatDay(key, { withWeekday = false } = {}) {
  const d = parseDay(key);
  const base = `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
  return withWeekday ? `${WEEKDAYS[d.getDay()]}, ${base}` : base;
}

export function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
