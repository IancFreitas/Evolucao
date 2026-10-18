// Migrações de esquema: garantem que dados antigos ou importados tenham todos os campos atuais.
import {
  DEFAULT_ACTIVITIES, DEFAULT_NOTIFICATIONS, DEFAULT_REWARDS, DEFAULT_RULES, SCHEMA_VERSION,
} from '../core/defaults.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function fill(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (target[k] === undefined) target[k] = structuredClone(v);
    else if (isObj(v) && isObj(target[k])) fill(target[k], v);
  }
  return target;
}

export function migrate(raw) {
  if (!isObj(raw)) throw new Error('Dados inválidos.');
  const s = structuredClone(raw);
  s.profile = fill(isObj(s.profile) ? s.profile : {}, { name: 'Jogador', activeTitle: null, theme: 'azul', onboarded: true });
  s.settings = isObj(s.settings) ? s.settings : {};
  s.settings.rules = fill(isObj(s.settings.rules) ? s.settings.rules : {}, DEFAULT_RULES);
  s.settings.notifications = fill(isObj(s.settings.notifications) ? s.settings.notifications : {}, DEFAULT_NOTIFICATIONS);
  if (!Array.isArray(s.settings.activities) || !s.settings.activities.length) s.settings.activities = structuredClone(DEFAULT_ACTIVITIES);
  for (const k of ['missions', 'log', 'inventory', 'pending', 'inbox']) if (!Array.isArray(s[k])) s[k] = [];
  if (!Array.isArray(s.rewards)) s.rewards = structuredClone(DEFAULT_REWARDS);
  for (const k of ['days', 'achievements']) if (!isObj(s[k])) s[k] = {};
  s.meta = fill(isObj(s.meta) ? s.meta : {}, { backups: 0, lastNotified: {} });
  s.createdAt ||= Date.now();
  // Entradas sem campos obrigatórios são descartadas para manter o livro consistente.
  s.log = s.log.filter((e) => isObj(e) && typeof e.date === 'string' && typeof e.id === 'string')
    .map((e) => ({ xp: 0, coins: 0, attrs: {}, ts: Date.now(), ...e }));
  s.version = SCHEMA_VERSION;
  return s;
}
