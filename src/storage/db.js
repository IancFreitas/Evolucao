// Armazenamento local persistente: IndexedDB (com fallback para localStorage).
// Os dados nunca saem do dispositivo, a menos que você exporte um backup.
const DB_NAME = 'system-ascension';
const STORE = 'kv';
const STATE_KEY = 'state';
const SNAPSHOT_PREFIX = 'snap:';
const MAX_SNAPSHOTS = 7;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const ls = {
  get: (k) => {
    try { const v = localStorage.getItem(`${DB_NAME}:${k}`); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
  },
  set: (k, v) => { try { localStorage.setItem(`${DB_NAME}:${k}`, JSON.stringify(v)); } catch { /* cota cheia */ } },
  del: (k) => { try { localStorage.removeItem(`${DB_NAME}:${k}`); } catch { /* ignore */ } },
  keys: () => {
    try { return Object.keys(localStorage).filter((k) => k.startsWith(`${DB_NAME}:`)).map((k) => k.slice(DB_NAME.length + 1)); } catch { return []; }
  },
};

export async function get(key) {
  try { return await tx('readonly', (s) => s.get(key)); } catch { return ls.get(key); }
}
export async function set(key, value) {
  try { await tx('readwrite', (s) => s.put(value, key)); } catch { ls.set(key, value); }
}
export async function del(key) {
  try { await tx('readwrite', (s) => s.delete(key)); } catch { ls.del(key); }
}
export async function keys() {
  try { return await tx('readonly', (s) => s.getAllKeys()); } catch { return ls.keys(); }
}

export const loadState = () => get(STATE_KEY);

let pending = null;
let timer = null;
/** Salvamento com pequeno atraso para agrupar alterações; `flush` força a gravação. */
export function saveState(state) {
  pending = state;
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export async function flush() {
  clearTimeout(timer);
  if (!pending) return;
  const s = pending;
  pending = null;
  await set(STATE_KEY, s);
  await snapshot(s);
}

/** Mantém uma cópia por dia dos últimos 7 dias para recuperação. */
async function snapshot(state) {
  const d = new Date();
  const key = `${SNAPSHOT_PREFIX}${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await set(key, state);
  const snaps = (await keys()).filter((k) => String(k).startsWith(SNAPSHOT_PREFIX)).sort();
  for (const old of snaps.slice(0, Math.max(0, snaps.length - MAX_SNAPSHOTS))) await del(old);
}

export async function listSnapshots() {
  return (await keys()).filter((k) => String(k).startsWith(SNAPSHOT_PREFIX)).sort().reverse()
    .map((k) => ({ key: k, date: String(k).slice(SNAPSHOT_PREFIX.length) }));
}

export async function wipeAll() {
  for (const k of await keys()) await del(k);
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ignore */ }
  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
