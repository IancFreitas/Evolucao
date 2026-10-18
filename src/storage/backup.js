// Exportação e importação de backups (JSON simples ou criptografado com senha via AES-GCM).
import { migrate } from './migrations.js';

const APP = 'system-ascension';

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function buildBackup(state, password = '') {
  const payload = { app: APP, version: state.version, exportedAt: new Date().toISOString() };
  if (!password) return JSON.stringify({ ...payload, data: state }, null, 2);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(state)));
  return JSON.stringify({ ...payload, encrypted: true, salt: b64(salt), iv: b64(iv), data: bytesToB64(new Uint8Array(cipher)) });
}

export function isEncrypted(text) {
  try { return !!JSON.parse(text).encrypted; } catch { return false; }
}

export async function parseBackup(text, password = '') {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Arquivo não é um JSON válido.'); }
  if (obj.app !== APP) throw new Error('Este arquivo não é um backup do System Ascension.');
  let data = obj.data;
  if (obj.encrypted) {
    if (!password) throw new Error('Este backup é protegido por senha.');
    try {
      const key = await deriveKey(password, unb64(obj.salt));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.data));
      data = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      throw new Error('Senha incorreta ou arquivo corrompido.');
    }
  }
  return migrate(data);
}

export function logToCsv(state) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['data', 'hora', 'tipo', 'titulo', 'atividade', 'xp', 'moedas', 'atributos', 'origem', 'nota'];
  const rows = [...state.log].sort((a, b) => a.ts - b.ts).map((e) => [
    e.date, new Date(e.ts).toTimeString().slice(0, 5), e.kind, e.title, e.activity, e.xp, e.coins,
    Object.entries(e.attrs || {}).map(([k, v]) => `${k}+${v}`).join(' '), e.source, e.note,
  ].map(esc).join(','));
  return [head.join(','), ...rows].join('\n');
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
