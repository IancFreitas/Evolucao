// Integrações por arquivo (sem servidor): calendário (.ics), tarefas/atividade física/estudos (.csv)
// e eventos JSON da "Central de Inteligência Pessoal". Tudo vira itens PENDENTES que só pontuam
// após a sua confirmação.
import { dayKey } from '../core/dates.js';

const KEYWORDS = [
  ['treino', ['academia', 'treino', 'musculação', 'musculacao', 'gym', 'weight', 'strength', 'crossfit', 'força']],
  ['cardio', ['corrida', 'correr', 'run', 'bike', 'ciclismo', 'ride', 'natação', 'natacao', 'swim', 'cardio', 'caminhada', 'walk', 'hike', 'trilha']],
  ['programacao', ['código', 'codigo', 'programar', 'programação', 'programacao', 'coding', 'dev', 'deploy', 'hackathon', 'commit']],
  ['estudo', ['estudo', 'estudar', 'aula', 'curso', 'prova', 'study', 'lecture', 'class', 'flashcard', 'anki']],
  ['leitura', ['leitura', 'ler ', 'livro', 'read', 'book', 'kindle']],
  ['planejamento', ['planejamento', 'planejar', 'revisão semanal', 'revisao semanal', 'planning', 'review']],
  ['financas', ['finanças', 'financas', 'orçamento', 'orcamento', 'contas', 'investimento', 'budget']],
  ['trabalho', ['reunião', 'reuniao', 'trabalho', 'cliente', 'entrega', 'meeting', 'sprint', 'work']],
  ['comunicacao', ['apresentação', 'apresentacao', 'palestra', 'podcast', 'escrever', 'post']],
  ['social', ['amigos', 'família', 'familia', 'encontro', 'jantar', 'almoço com', 'aniversário', 'aniversario', 'party']],
  ['autocuidado', ['médico', 'medico', 'terapia', 'massagem', 'skincare', 'meditação', 'meditacao', 'yoga', 'alongamento']],
  ['sono', ['sono', 'dormir', 'sleep']],
  ['domestica', ['limpeza', 'faxina', 'mercado', 'lavar', 'louça', 'casa']],
  ['reflexao', ['diário', 'diario', 'journal', 'reflexão', 'reflexao']],
];

export function guessActivity(text, activities) {
  const t = ` ${String(text).toLowerCase()} `;
  const keys = new Set(activities.map((a) => a.key));
  for (const [key, words] of KEYWORDS) if (keys.has(key) && words.some((w) => t.includes(w))) return key;
  for (const a of activities) if (t.includes(a.name.toLowerCase())) return a.key;
  return null;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* ------------------------------ ICS ------------------------------ */

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseIcsDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v || '');
  if (!m) return null;
  const [, y, mo, d, h = '12', mi = '00', s = '00', z] = m;
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return dayKey(date);
}

const icsUnescape = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');

export function parseIcs(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text).split('\n')) {
    if (line.startsWith('BEGIN:VEVENT')) cur = {};
    else if (line.startsWith('END:VEVENT')) {
      if (cur?.date) events.push(cur);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const name = line.slice(0, idx).split(';')[0].toUpperCase();
      const value = line.slice(idx + 1).trim();
      if (name === 'UID') cur.uid = value;
      else if (name === 'SUMMARY') cur.title = icsUnescape(value);
      else if (name === 'DESCRIPTION') cur.detail = icsUnescape(value).slice(0, 200);
      else if (name === 'DTSTART') cur.date = parseIcsDate(value);
    }
  }
  return events;
}

/** Eventos passados viram pendências; futuros podem virar missões. */
export function icsToItems(text, activities, today) {
  const events = parseIcs(text);
  const pending = [];
  const future = [];
  for (const ev of events) {
    const item = {
      source: 'calendario', externalId: `${ev.uid || hash(ev.title + ev.date)}@${ev.date}`, date: ev.date,
      title: ev.title || 'Evento', detail: ev.detail || '', activity: guessActivity(`${ev.title} ${ev.detail || ''}`, activities),
    };
    if (ev.date <= today) pending.push(item);
    else future.push(item);
  }
  return { pending, future, total: events.length };
}

export function missionsToIcs(missions) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//System Ascension//PT-BR', 'CALSCALE:GREGORIAN'];
  for (const m of missions) {
    if (!m.dueDate || m.status !== 'active') continue;
    const d = m.dueDate.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${m.id}@system-ascension`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${m.title.replace(/([,;\\])/g, '\\$1')}`, `DESCRIPTION:Missão ${m.type} do System Ascension`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* ------------------------------ CSV ------------------------------ */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head = [], ...body] = rows.filter((r) => r.some((x) => x.trim()));
  const cols = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] || '').trim()])));
}

const pick = (row, names) => {
  for (const n of names) if (row[n]) return row[n];
  return '';
};

function toDayKey(v) {
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

/**
 * CSV genérico (tarefas, Strava, Google Fit, apps de estudo...).
 * Colunas reconhecidas: data/date, titulo/title/name, tipo/type/categoria, atividade, id, concluida/completed.
 */
export function csvToItems(text, activities, source = 'csv') {
  const items = [];
  let skipped = 0;
  for (const row of parseCsv(text)) {
    const date = toDayKey(pick(row, ['data', 'date', 'activity date', 'completed', 'completed at', 'concluida em', 'dia', 'start time']));
    const title = pick(row, ['titulo', 'título', 'title', 'name', 'nome', 'activity name', 'content', 'tarefa', 'task']);
    const type = pick(row, ['atividade', 'activity', 'tipo', 'type', 'activity type', 'categoria', 'category', 'project', 'projeto']);
    const done = pick(row, ['concluida', 'concluída', 'completed', 'done', 'status']).toLowerCase();
    if (!date || !title || ['false', 'não', 'nao', 'no', '0', 'pendente', 'open'].includes(done)) { skipped++; continue; }
    const direct = activities.find((a) => a.key === type.toLowerCase());
    items.push({
      source, externalId: pick(row, ['id', 'activity id', 'task id']) || hash(`${date}|${title}|${type}`), date, title,
      detail: [type, pick(row, ['duracao', 'duração', 'duration', 'elapsed time', 'moving time'])].filter(Boolean).join(' · '),
      activity: direct?.key || guessActivity(`${title} ${type}`, activities),
    });
  }
  return { items, skipped };
}

/* -------------------- Central de Inteligência (JSON) -------------------- */

/**
 * Formato aceito:
 * { "source": "central", "events": [{ "id": "...", "date": "AAAA-MM-DD", "activity": "estudo", "title": "...", "detail": "..." }] }
 */
export function jsonToItems(text, activities) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('JSON inválido.'); }
  const list = Array.isArray(obj) ? obj : obj.events;
  if (!Array.isArray(list)) throw new Error('Esperado um objeto com a lista "events".');
  const source = String(obj.source || 'central').slice(0, 40);
  return list.filter((e) => e && e.date && (e.title || e.activity)).map((e) => ({
    source, externalId: String(e.id || hash(JSON.stringify(e))), date: toDayKey(e.date), title: e.title || e.activity,
    detail: e.detail || '', activity: activities.some((a) => a.key === e.activity) ? e.activity : guessActivity(`${e.title} ${e.activity}`, activities),
  })).filter((e) => e.date);
}
