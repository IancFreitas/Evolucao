// Livro-razão de progresso. Todo XP, moeda e ponto de atributo vem de uma entrada aqui.
// Cada entrada tem uma `key` única: é ela que impede pontuação duplicada.
import { uid } from './defaults.js';

export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuleError';
  }
}

/** Tipos de entrada que representam esforço real (contam para sequência e consistência). */
export const EFFORT_KINDS = ['mission', 'activity', 'stage', 'milestone'];

export const hasKey = (state, key) => state.log.some((e) => e.key === key);
export const findByKey = (state, key) => state.log.find((e) => e.key === key);

export function award(state, entry) {
  if (entry.key && hasKey(state, entry.key)) return null;
  const e = {
    id: uid('e-'),
    ts: Date.now(),
    xp: 0,
    coins: 0,
    attrs: {},
    source: 'manual',
    ...entry,
  };
  state.log.push(e);
  return e;
}

export function revokeKey(state, key) {
  const i = state.log.findIndex((e) => e.key === key);
  return i < 0 ? null : state.log.splice(i, 1)[0];
}

export function revokeId(state, id) {
  const i = state.log.findIndex((e) => e.id === id);
  return i < 0 ? null : state.log.splice(i, 1)[0];
}

export function coinsFor(xp, rules, perks) {
  return Math.round(xp * rules.coinRate * (1 + (perks?.coinBonus || 0)));
}

/** Pontos de atributo proporcionais ao XP em relação ao XP base da atividade. */
export function attrsFor(weights = {}, xp, baseXp) {
  const factor = xp / Math.max(1, baseXp);
  const out = {};
  for (const [k, w] of Object.entries(weights)) {
    if (w > 0 && xp > 0) out[k] = Math.max(1, Math.round(w * factor));
  }
  return out;
}
