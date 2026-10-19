// Curva de níveis, dificuldade, níveis de atributo, classes e benefícios.
import { ATTR_KEYS } from './defaults.js';

/**
 * Presets de dificuldade. `attrDivisor` controla a velocidade dos atributos:
 * nível do atributo = raiz(pontos / divisor) + 1.
 * Projeções com ~250 XP/dia (rotina consistente, sem dungeons):
 *   Casual:  nível 10 em ~1 mês,    nível 45 em ~2,5 anos
 *   Difícil: nível 10 em ~2 meses,  nível 45 em ~5 anos (≈3,5 anos num ritmo forte de 350 XP/dia)
 *   Monarca: nível 10 em ~3,5 meses, nível 45 em ~10 anos
 */
export const DIFFICULTY = {
  casual: { name: 'Casual', levelBase: 100, levelExponent: 1.25, attrDivisor: 4, desc: 'Progresso rápido, bom para criar o hábito.' },
  dificil: { name: 'Difícil', levelBase: 250, levelExponent: 1.2, attrDivisor: 8, desc: 'Cada nível é conquistado. Rank S exige anos de constância.' },
  monarca: { name: 'Monarca', levelBase: 350, levelExponent: 1.3, attrDivisor: 12, desc: 'Extremo. Uma jornada de uma década.' },
};

/** XP necessário para sair do nível `level` e chegar ao próximo. */
export function xpForLevel(level, rules) {
  return Math.max(10, Math.round(rules.levelBase * Math.pow(level, rules.levelExponent)));
}

/** XP total acumulado para alcançar o nível `level`. */
export function totalXpForLevel(level, rules) {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevel(l, rules);
  return sum;
}

export function levelFromXp(total, rules) {
  let level = 1;
  let rem = Math.max(0, total);
  while (level < 999 && rem >= xpForLevel(level, rules)) {
    rem -= xpForLevel(level, rules);
    level++;
  }
  const needed = xpForLevel(level, rules);
  return { level, into: rem, needed, progress: rem / needed };
}

/** Nível de atributo: cresce com a raiz quadrada dos pontos (rápido no início, cada vez mais lento). */
export function attrLevel(points, divisor = 4) {
  const p = Math.max(0, points);
  const level = Math.floor(Math.sqrt(p / divisor)) + 1;
  const cur = divisor * (level - 1) ** 2;
  const next = divisor * level ** 2;
  return { level, points: p, into: p - cur, needed: next - cur, progress: (p - cur) / (next - cur) };
}

export const THEMES = {
  azul: { name: 'Azul Elétrico', accent: '#3d8bff', accent2: '#8b5cf6' },
  ametista: { name: 'Ametista', accent: '#a66bff', accent2: '#ff5fd2' },
  aurora: { name: 'Aurora', accent: '#22e3c4', accent2: '#3d8bff' },
  carmesim: { name: 'Carmesim', accent: '#ff4d6d', accent2: '#a66bff' },
  ouro: { name: 'Ouro Arcano', accent: '#ffc857', accent2: '#ff7a59' },
  ascendente: { name: 'Ascendente', accent: '#e9f1ff', accent2: '#8b5cf6' },
};

/* ------------------------------------------------------------------ */
/* Classes: nascem dos atributos que você mais desenvolve.             */
/* ------------------------------------------------------------------ */

export const SINGLE_CLASSES = {
  STR: { name: 'Guerreiro', desc: 'Força acima de tudo.' },
  END: { name: 'Andarilho', desc: 'Fôlego que não acaba.' },
  INT: { name: 'Arcanista', desc: 'Conhecimento como arma.' },
  WIS: { name: 'Oráculo', desc: 'Clareza e decisões conscientes.' },
  DISC: { name: 'Sentinela', desc: 'Constância inabalável.' },
  CHA: { name: 'Bardo', desc: 'Conexão e comunicação.' },
  VIT: { name: 'Druida', desc: 'Equilíbrio do corpo e do descanso.' },
};

const PAIR_LIST = [
  ['STR', 'END', 'Gladiador', 'Força com resistência de arena.'],
  ['STR', 'INT', 'Cavaleiro Rúnico', 'Corpo forte e mente afiada.'],
  ['STR', 'WIS', 'Monge', 'Força guiada pela consciência.'],
  ['STR', 'DISC', 'Paladino', 'Força a serviço da disciplina.'],
  ['STR', 'CHA', 'Campeão', 'Força que inspira os outros.'],
  ['STR', 'VIT', 'Titã', 'Força sustentada por boa recuperação.'],
  ['END', 'INT', 'Explorador', 'Fôlego para ir longe, curiosidade para descobrir.'],
  ['END', 'WIS', 'Peregrino', 'Caminhadas longas e reflexão.'],
  ['END', 'DISC', 'Patrulheiro', 'Constância em movimento.'],
  ['END', 'CHA', 'Mensageiro', 'Energia que leva pessoas junto.'],
  ['END', 'VIT', 'Nômade', 'Movimento e recuperação em harmonia.'],
  ['INT', 'WIS', 'Sábio', 'Conhecimento transformado em sabedoria.'],
  ['INT', 'DISC', 'Artífice', 'Estudo constante que vira construção.'],
  ['INT', 'CHA', 'Estrategista', 'Ideias que convencem e movem pessoas.'],
  ['INT', 'VIT', 'Alquimista', 'Mente afiada em um corpo cuidado.'],
  ['WIS', 'DISC', 'Asceta', 'Autodomínio e propósito.'],
  ['WIS', 'CHA', 'Conselheiro', 'Escuta, clareza e boas palavras.'],
  ['WIS', 'VIT', 'Xamã', 'Mente serena, corpo restaurado.'],
  ['DISC', 'CHA', 'Comandante', 'Lidera pelo exemplo.'],
  ['DISC', 'VIT', 'Guardião', 'Rotina que protege a saúde.'],
  ['CHA', 'VIT', 'Curandeiro', 'Cuida de si e dos outros.'],
];
export const PAIR_CLASSES = Object.fromEntries(PAIR_LIST.flatMap(([a, b, name, desc]) => [[`${a}+${b}`, { name, desc }], [`${b}+${a}`, { name, desc }]]));
export const BALANCED_CLASS = { name: 'Harmonista', desc: 'Todas as áreas em equilíbrio. A classe mais rara.' };

// Uma classe só aparece quando algum atributo chega a este nível.
export const CLASS_MIN_ATTR_LEVEL = 3;

/**
 * Define a classe pelo perfil de atributos:
 * - Harmonista: todos os atributos com pelo menos 75% dos pontos do maior (e nível ≥ 4);
 * - Híbrida: o 2º atributo tem ao menos 70% dos pontos do 1º;
 * - Pura: um atributo domina.
 */
export function archetypeFor(attrPoints, attrLevels) {
  const sorted = [...ATTR_KEYS].sort((a, b) => (attrPoints[b] || 0) - (attrPoints[a] || 0));
  const [first, second] = sorted;
  const top = attrPoints[first] || 0;
  if ((attrLevels[first] || 1) < CLASS_MIN_ATTR_LEVEL) return null;
  const min = Math.min(...ATTR_KEYS.map((k) => attrPoints[k] || 0));
  if (min >= top * 0.75 && Math.min(...ATTR_KEYS.map((k) => attrLevels[k] || 1)) >= 4) {
    return { key: 'BAL', attrs: [...ATTR_KEYS], ...BALANCED_CLASS };
  }
  if ((attrPoints[second] || 0) >= top * 0.7 && (attrLevels[second] || 1) >= CLASS_MIN_ATTR_LEVEL) {
    return { key: `${first}+${second}`, attrs: [first, second], ...PAIR_CLASSES[`${first}+${second}`] };
  }
  return { key: first, attrs: [first], ...SINGLE_CLASSES[first] };
}

/** Tiers: o nível do personagem define o grau da classe e os benefícios. */
export const TIERS = [
  { minLevel: 1, name: 'Iniciante', perks: { theme: 'azul' }, perkText: ['Acesso ao Sistema', 'Tema Azul Elétrico'] },
  { minLevel: 10, name: 'Desperto', perks: { theme: 'ametista', shieldsBonus: 1 }, perkText: ['+1 escudo de sequência por semana', 'Tema Ametista'] },
  { minLevel: 20, name: 'Elite', perks: { theme: 'aurora', coinBonus: 0.05 }, perkText: ['+5% de moedas', 'Tema Aurora'] },
  { minLevel: 30, name: 'Mestre', perks: { theme: 'carmesim', coinBonus: 0.05, shieldsBonus: 1 }, perkText: ['+5% de moedas (total 10%)', '+1 escudo semanal', 'Tema Carmesim'] },
  { minLevel: 40, name: 'Lenda', perks: { theme: 'ouro', coinBonus: 0.05 }, perkText: ['+5% de moedas (total 15%)', 'Tema Ouro Arcano'] },
  { minLevel: 50, name: 'Ascendente', perks: { theme: 'ascendente', coinBonus: 0.05, shieldsBonus: 1 }, perkText: ['+5% de moedas (total 20%)', '+1 escudo semanal', 'Tema Ascendente'] },
];

export function tierIndexFor(level) {
  let idx = 0;
  TIERS.forEach((t, i) => { if (level >= t.minLevel) idx = i; });
  return idx;
}

export function classFor(level, attrPoints, attrLevels) {
  const archetype = archetypeFor(attrPoints, attrLevels);
  const tierIndex = tierIndexFor(level);
  const tier = TIERS[tierIndex];
  const name = archetype ? archetype.name : 'Sem classe';
  return { name, archetype, tierIndex, tier, label: `${name} · ${tier.name}` };
}

export function perksFor(tierIndex) {
  const perks = { coinBonus: 0, shieldsBonus: 0, themes: [] };
  for (let i = 0; i <= tierIndex; i++) {
    const p = TIERS[i].perks;
    perks.coinBonus += p.coinBonus || 0;
    perks.shieldsBonus += p.shieldsBonus || 0;
    if (p.theme) perks.themes.push(p.theme);
  }
  return perks;
}
