// Integração com o app Saúde do iPhone (Apple Health).
// Navegadores não acessam o HealthKit, então os dados chegam por dois caminhos sem servidor:
//   1. Atalho do iPhone → JSON (área de transferência ou link) com o resumo do dia;
//   2. Exportação do app Saúde (export.zip ou export.xml), lida em fluxo no próprio aparelho.
// Os dois caminhos geram os mesmos identificadores, então nunca há duplicidade entre eles.
import { addDays } from '../core/dates.js';

export const HEALTH_SOURCE = 'apple-saude';

/* ------------------------- Mapeamento de treinos ------------------------- */

const STRENGTH = ['strength', 'força', 'forca', 'musculação', 'musculacao', 'crosstraining', 'cross training', 'core', 'funcional'];
const MIND_BODY = ['yoga', 'ioga', 'pilates', 'mindandbody', 'mente e corpo', 'flexibility', 'flexibilidade', 'cooldown', 'alongamento', 'tai chi'];

/** Classifica um treino (nome do HealthKit ou nome localizado do Atalho). */
export function workoutActivity(type, activities) {
  const t = String(type || '').toLowerCase().replace(/^hkworkoutactivitytype/, '');
  const has = (k) => activities.some((a) => a.key === k);
  const pick = (...keys) => keys.find(has) || null;
  if (STRENGTH.some((w) => t.includes(w))) return pick('treino', 'cardio');
  if (MIND_BODY.some((w) => t.includes(w))) return pick('autocuidado', 'descanso');
  return pick('cardio', 'treino');
}

const WORKOUT_NAMES = {
  traditionalstrengthtraining: 'Musculação', functionalstrengthtraining: 'Treino funcional', running: 'Corrida', walking: 'Caminhada',
  cycling: 'Ciclismo', swimming: 'Natação', hiking: 'Trilha', yoga: 'Ioga', pilates: 'Pilates', highintensityintervaltraining: 'HIIT',
  elliptical: 'Elíptico', rowing: 'Remo', crosstraining: 'Cross training', dance: 'Dança', coretraining: 'Treino de core',
  mixedcardio: 'Cardio misto', stairclimbing: 'Escada', soccer: 'Futebol', tennis: 'Tênis', basketball: 'Basquete',
};
export function workoutName(type) {
  const k = String(type || '').replace(/^HKWorkoutActivityType/, '');
  return WORKOUT_NAMES[k.toLowerCase()] || k.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Treino';
}

/* --------------------------- Resumos → itens --------------------------- */

const num = (v) => {
  if (v == null || v === '') return null;
  let t = String(v).replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // "9.500" = nove mil e quinhentos
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmtHours = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/**
 * days: [{ date, sleepHours, steps, exerciseMinutes, mindfulMinutes, workouts: [{ type, minutes, start }] }]
 * Gera itens para a fila de confirmação somente quando as metas configuradas são atingidas.
 */
export function summariesToItems(days, h, activities) {
  const has = (k) => activities.some((a) => a.key === k);
  const first = (...keys) => keys.find(has) || null;
  const items = [];
  for (const d of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) continue;
    const base = { source: HEALTH_SOURCE, date: d.date };
    const workouts = (d.workouts || []).filter((w) => (num(w.minutes) || 0) >= h.minWorkoutMinutes);
    workouts.forEach((w, i) => {
      const act = workoutActivity(w.type, activities);
      if (!act) return;
      const start = String(w.start || '').replace(' ', 'T').slice(0, 16);
      items.push({
        ...base, activity: act, externalId: `saude:${start || `${d.date}#${i}`}:${slug(workoutName(w.type))}`,
        title: `Treino: ${workoutName(w.type)} (${Math.round(num(w.minutes))} min)`, detail: 'App Saúde · treino registrado',
      });
    });
    const sleep = num(d.sleepHours);
    if (sleep != null && sleep >= h.sleepGoal && first('sono', 'autocuidado')) {
      items.push({ ...base, activity: first('sono', 'autocuidado'), externalId: `saude:${d.date}:sono`, title: `Sono: ${fmtHours(sleep)}`, detail: `meta ${h.sleepGoal}h` });
    }
    const ex = num(d.exerciseMinutes);
    if (!workouts.length && ex != null && ex >= h.exerciseGoal && first('cardio', 'treino')) {
      items.push({ ...base, activity: first('cardio', 'treino'), externalId: `saude:${d.date}:exercicio`, title: `Exercício: ${Math.round(ex)} min`, detail: `meta ${h.exerciseGoal} min` });
    }
    const steps = num(d.steps);
    if (steps != null && steps >= h.stepsGoal && first('passos', 'cardio')) {
      items.push({ ...base, activity: first('passos', 'cardio'), externalId: `saude:${d.date}:passos`, title: `Passos: ${Math.round(steps).toLocaleString('pt-BR')}`, detail: `meta ${h.stepsGoal.toLocaleString('pt-BR')}` });
    }
    const mind = num(d.mindfulMinutes);
    if (mind != null && mind >= h.mindfulGoal && first('reflexao', 'autocuidado')) {
      items.push({ ...base, activity: first('reflexao', 'autocuidado'), externalId: `saude:${d.date}:mindful`, title: `Atenção plena: ${Math.round(mind)} min`, detail: `meta ${h.mindfulGoal} min` });
    }
  }
  return items;
}

/* ------------------------- Dados vindos do Atalho ------------------------- */

/** Aceita um objeto de um dia, { days: [...] } ou uma lista. `date` ausente = hoje. */
export function parseHealthPayload(input, today) {
  let obj = input;
  if (typeof input === 'string') {
    const text = input.trim();
    try { obj = JSON.parse(text); } catch {
      try { obj = JSON.parse(decodeBase64(text)); } catch { throw new Error('Os dados do Saúde não estão em um formato reconhecido (JSON).'); }
    }
  }
  const list = Array.isArray(obj) ? obj : Array.isArray(obj?.days) ? obj.days : [obj];
  const days = list.filter((d) => d && typeof d === 'object').map((d) => ({
    date: normDate(d.date || d.data) || today,
    sleepHours: sleepToHours(d),
    steps: num(d.steps ?? d.passos),
    exerciseMinutes: num(d.exerciseMinutes ?? d.exercicio),
    mindfulMinutes: toMinutes(num(d.mindfulMinutes ?? d.atencaoPlena), 600),
    workouts: (Array.isArray(d.workouts ?? d.treinos) ? (d.workouts ?? d.treinos) : [])
      .map((w) => ({ type: w.type ?? w.tipo, minutes: toMinutes(num(w.minutes ?? w.minutos ?? w.duration), 600), start: w.start ?? w.inicio })),
  }));
  if (!days.length) throw new Error('Nenhum dia encontrado nos dados do Saúde.');
  return days;
}

/**
 * O Atalho pode entregar durações em horas, minutos ou segundos conforme a versão do iOS.
 * Valores grandes demais para a unidade declarada são convertidos (ex.: "sleepHours": 450 = 450 min).
 */
function sleepToHours(d) {
  if (num(d.sleepSeconds) != null) return num(d.sleepSeconds) / 3600;
  if (num(d.sleepMinutes) != null) return num(d.sleepMinutes) / 60;
  const h = num(d.sleepHours ?? d.sono);
  if (h == null) return null;
  return h > 1440 ? h / 3600 : h > 24 ? h / 60 : h;
}

function toMinutes(v, secondsAbove) {
  return v != null && v > secondsAbove ? v / 60 : v;
}

function normDate(v) {
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v));
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function decodeBase64(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Link do Atalho: #/saude?d=<base64> ou #/saude?j=<json codificado>. O fragmento (#) nunca vai para o servidor. */
export function healthFromHash(hash) {
  const m = /^#\/saude\?(.*)$/.exec(hash || '');
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  if (params.get('j')) return params.get('j');
  if (params.get('d')) return decodeBase64(params.get('d'));
  return null;
}

/* ------------------------ Exportação do app Saúde ------------------------ */

const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';
const STEPS_TYPE = 'HKQuantityTypeIdentifierStepCount';
const EXERCISE_TYPE = 'HKQuantityTypeIdentifierAppleExerciseTime';
const MINDFUL_TYPE = 'HKCategoryTypeIdentifierMindfulSession';

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};
// "2026-10-18 07:00:12 -0300" → milissegundos
const ts = (v) => (v ? Date.parse(v.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2')) : NaN);

/**
 * Lê export.xml (ou export.zip) em fluxo, sem carregar o arquivo inteiro na memória.
 * Considera apenas os últimos `windowDays` dias. Para evitar contagem dupla (iPhone + Watch),
 * passos, sono, exercício e atenção plena usam a fonte com maior total no dia.
 */
export async function parseHealthExport(file, { today, windowDays = 30, onProgress } = {}) {
  const from = addDays(today, -windowDays);
  const perSource = { sleep: new Map(), steps: new Map(), exercise: new Map(), mindful: new Map() };
  const workouts = new Map();
  const add = (bucket, date, source, value) => {
    const key = `${date}|${source}`;
    perSource[bucket].set(key, (perSource[bucket].get(key) || 0) + value);
  };
  const handle = (tag) => {
    if (tag.startsWith('<Workout ')) {
      const start = attr(tag, 'startDate');
      const date = start?.slice(0, 10);
      if (!date || date < from || date > today) return;
      const unit = attr(tag, 'durationUnit') || 'min';
      let minutes = Number(attr(tag, 'duration'));
      if (!Number.isFinite(minutes)) minutes = (ts(attr(tag, 'endDate')) - ts(start)) / 60e3;
      if (unit === 's' || unit === 'sec') minutes /= 60;
      if (unit === 'hr' || unit === 'h') minutes *= 60;
      if (!workouts.has(date)) workouts.set(date, []);
      workouts.get(date).push({ type: attr(tag, 'workoutActivityType'), minutes, start: start.slice(0, 16) });
      return;
    }
    const type = attr(tag, 'type');
    if (type !== SLEEP_TYPE && type !== STEPS_TYPE && type !== EXERCISE_TYPE && type !== MINDFUL_TYPE) return;
    const end = attr(tag, 'endDate');
    const date = (type === SLEEP_TYPE ? end : attr(tag, 'startDate'))?.slice(0, 10);
    if (!date || date < from || date > today) return;
    const source = attr(tag, 'sourceName') || '?';
    if (type === STEPS_TYPE) add('steps', date, source, Number(attr(tag, 'value')) || 0);
    else if (type === EXERCISE_TYPE) add('exercise', date, source, Number(attr(tag, 'value')) || 0);
    else {
      const minutes = (ts(end) - ts(attr(tag, 'startDate'))) / 60e3;
      if (!(minutes > 0)) return;
      if (type === MINDFUL_TYPE) add('mindful', date, source, minutes);
      else if (/Asleep/.test(attr(tag, 'value') || '')) add('sleep', date, source, minutes);
    }
  };

  const stream = await openExportStream(file);
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let read = 0;
  const re = /<(?:Workout|Record)\s[^>]*>/g;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    read += value.length;
    let last = 0;
    re.lastIndex = 0;
    for (let m; (m = re.exec(buf));) {
      handle(m[0]);
      last = re.lastIndex;
    }
    // mantém só o trecho que pode conter uma tag incompleta
    const cut = Math.max(last, buf.lastIndexOf('>') + 1);
    buf = buf.slice(cut);
    onProgress?.(read);
  }

  const best = (bucket) => {
    const out = new Map();
    for (const [key, v] of perSource[bucket]) {
      const date = key.split('|')[0];
      out.set(date, Math.max(out.get(date) || 0, v));
    }
    return out;
  };
  const sleep = best('sleep');
  const steps = best('steps');
  const exercise = best('exercise');
  const mindful = best('mindful');
  const dates = new Set([...sleep.keys(), ...steps.keys(), ...exercise.keys(), ...mindful.keys(), ...workouts.keys()]);
  return [...dates].sort().map((date) => ({
    date,
    sleepHours: sleep.has(date) ? sleep.get(date) / 60 : null,
    steps: steps.get(date) ?? null,
    exerciseMinutes: exercise.get(date) ?? null,
    mindfulMinutes: mindful.get(date) ?? null,
    workouts: workouts.get(date) || [],
  }));
}

/** Abre o export.xml diretamente ou de dentro do export.zip (via DecompressionStream). */
async function openExportStream(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (!isZip) return file.stream();
  const entry = await findZipEntry(file, (name) => /(^|\/)export\.xml$/i.test(name));
  if (!entry) throw new Error('export.xml não encontrado dentro do arquivo .zip.');
  const local = new DataView(await file.slice(entry.offset, entry.offset + 30).arrayBuffer());
  const dataStart = entry.offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const data = file.slice(dataStart, dataStart + entry.size).stream();
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error('Compressão do .zip não suportada. Descompacte e envie o export.xml.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não abre .zip. Descompacte no app Arquivos e envie o export.xml.');
  return data.pipeThrough(new DecompressionStream('deflate-raw'));
}

async function findZipEntry(file, match) {
  const tailSize = Math.min(file.size, 66000);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Arquivo .zip inválido.');
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff && eocd >= 20 && tail.getUint32(eocd - 20, true) === 0x07064b50) {
    // ZIP64: o diretório central fica descrito em outro registro
    const z64 = Number(tail.getBigUint64(eocd - 12, true));
    const rec = new DataView(await file.slice(z64, z64 + 56).arrayBuffer());
    cdSize = Number(rec.getBigUint64(40, true));
    cdOffset = Number(rec.getBigUint64(48, true));
  }
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50;) {
    const method = cd.getUint16(p + 10, true);
    let size = cd.getUint32(p + 20, true);
    const usize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let offset = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // campos ZIP64 no "extra" quando os valores de 32 bits estouram
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen;) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (usize === 0xffffffff) q += 8;
        if (size === 0xffffffff) { size = Number(cd.getBigUint64(q, true)); q += 8; }
        if (offset === 0xffffffff) offset = Number(cd.getBigUint64(q, true));
      }
      e += 4 + len;
    }
    if (match(name)) return { name, method, size, offset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
