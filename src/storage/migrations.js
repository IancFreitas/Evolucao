// Migrações de esquema: garantem que dados antigos ou importados tenham todos os campos atuais.
import {
  DEFAULT_ACTIVITIES, DEFAULT_BACKUP, DEFAULT_HEALTH, DEFAULT_NOTIFICATIONS, DEFAULT_REWARDS, DEFAULT_RULES, SCHEMA_VERSION,
} from '../core/defaults.js';

// Atividades que já existiam na primeira versão; as demais do padrão são adicionadas por migração.
const V1_ACTIVITY_KEYS = ['treino', 'cardio', 'estudo', 'programacao', 'leitura', 'reflexao', 'planejamento', 'domestica',
  'trabalho', 'financas', 'social', 'comunicacao', 'autocuidado', 'sono', 'descanso'];

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
  s.profile = fill(isObj(s.profile) ? s.profile : {}, { name: 'Jogador', activeTitle: null, theme: 'azul', onboarded: true, easyRead: false, languages: [] });
  s.settings = isObj(s.settings) ? s.settings : {};
  const hadDifficulty = isObj(s.settings.rules) && 'difficulty' in s.settings.rules;
  const r0 = isObj(s.settings.rules) ? s.settings.rules : {};
  // Versões anteriores não tinham dificuldade: quem usava a curva original passa ao modo Difícil;
  // quem tinha personalizado a curva mantém os próprios valores.
  if (!hadDifficulty && 'levelBase' in r0) {
    const original = r0.levelBase === 100 && r0.levelExponent === 1.25;
    r0.difficulty = original ? 'dificil' : 'custom';
    if (original) Object.assign(r0, { levelBase: DEFAULT_RULES.levelBase, levelExponent: DEFAULT_RULES.levelExponent, attrDivisor: DEFAULT_RULES.attrDivisor });
    else r0.attrDivisor = 4;
  }
  s.settings.rules = fill(r0, DEFAULT_RULES);
  s.settings.notifications = fill(isObj(s.settings.notifications) ? s.settings.notifications : {}, DEFAULT_NOTIFICATIONS);
  s.settings.backup = fill(isObj(s.settings.backup) ? s.settings.backup : {}, DEFAULT_BACKUP);
  s.settings.health = fill(isObj(s.settings.health) ? s.settings.health : {}, DEFAULT_HEALTH);
  if (!Array.isArray(s.settings.activities) || !s.settings.activities.length) s.settings.activities = structuredClone(DEFAULT_ACTIVITIES);
  for (const k of ['missions', 'log', 'inventory', 'pending', 'inbox']) if (!Array.isArray(s[k])) s[k] = [];
  if (!Array.isArray(s.rewards)) s.rewards = structuredClone(DEFAULT_REWARDS);
  for (const k of ['days', 'achievements', 'dungeons']) if (!isObj(s[k])) s[k] = {};
  s.meta = fill(isObj(s.meta) ? s.meta : {}, { backups: 0, lastBackupAt: null, lastNotified: {}, addedActivities: [] });
  // Atividades novas do padrão são adicionadas uma única vez (se você excluir, não voltam).
  for (const a of DEFAULT_ACTIVITIES) {
    if (s.meta.addedActivities.includes(a.key) || V1_ACTIVITY_KEYS.includes(a.key)) continue;
    if (!s.settings.activities.some((x) => x.key === a.key)) s.settings.activities.push(structuredClone(a));
    s.meta.addedActivities.push(a.key);
  }
  s.createdAt ||= Date.now();
  // Entradas sem campos obrigatórios são descartadas para manter o livro consistente.
  s.log = s.log.filter((e) => isObj(e) && typeof e.date === 'string' && typeof e.id === 'string')
    .map((e) => ({ xp: 0, coins: 0, attrs: {}, ts: Date.now(), ...e }));
  s.version = SCHEMA_VERSION;
  return s;
}
