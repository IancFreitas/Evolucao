// Curva de níveis, níveis de atributo, classes e benefícios.
import { ATTR_KEYS } from './defaults.js';

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

/** Nível de atributo: cresce com a raiz quadrada dos pontos (rápido no início, estável depois). */
export function attrLevel(points) {
  const p = Math.max(0, points);
  const level = Math.floor(Math.sqrt(p / 4)) + 1;
  const cur = 4 * (level - 1) ** 2;
  const next = 4 * level ** 2;
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

const countAtLeast = (attrLevels, min) => ATTR_KEYS.filter((k) => (attrLevels[k] || 1) >= min).length;

/**
 * Classes: exigem nível do personagem e um mínimo de equilíbrio nos atributos.
 * Benefícios são cumulativos.
 */
export const CLASSES = [
  {
    id: 'aprendiz', name: 'Aprendiz', minLevel: 1, reqText: 'Início da jornada',
    req: () => true,
    perks: { theme: 'azul' }, perkText: ['Acesso ao Sistema', 'Tema Azul Elétrico'],
  },
  {
    id: 'explorador', name: 'Explorador', minLevel: 5, reqText: 'Nível 5',
    req: () => true,
    perks: { theme: 'ametista', shieldsBonus: 1 }, perkText: ['+1 escudo de sequência por semana', 'Tema Ametista'],
  },
  {
    id: 'estrategista', name: 'Estrategista', minLevel: 12, reqText: 'Nível 12 e 2 atributos no nível 5',
    req: (al) => countAtLeast(al, 5) >= 2,
    perks: { theme: 'aurora', coinBonus: 0.05 }, perkText: ['+5% de moedas', 'Tema Aurora', 'Moldura de Estrategista'],
  },
  {
    id: 'especialista', name: 'Especialista', minLevel: 20, reqText: 'Nível 20 e um atributo no nível 10',
    req: (al) => countAtLeast(al, 10) >= 1,
    perks: { theme: 'carmesim', coinBonus: 0.05, shieldsBonus: 1 }, perkText: ['+5% de moedas (total 10%)', '+1 escudo semanal', 'Tema Carmesim'],
  },
  {
    id: 'mestre', name: 'Mestre', minLevel: 32, reqText: 'Nível 32 e 4 atributos no nível 8',
    req: (al) => countAtLeast(al, 8) >= 4,
    perks: { theme: 'ouro', coinBonus: 0.05 }, perkText: ['+5% de moedas (total 15%)', 'Tema Ouro Arcano', 'Aura dourada'],
  },
  {
    id: 'ascendente', name: 'Ascendente', minLevel: 45, reqText: 'Nível 45 e todos os atributos no nível 8',
    req: (al) => countAtLeast(al, 8) >= ATTR_KEYS.length,
    perks: { theme: 'ascendente', coinBonus: 0.05, shieldsBonus: 1 }, perkText: ['+5% de moedas (total 20%)', '+1 escudo semanal', 'Tema Ascendente animado'],
  },
];

/** Retorna o índice da classe atual (as classes são desbloqueadas em ordem). */
export function classIndexFor(level, attrLevels) {
  let idx = 0;
  for (let i = 1; i < CLASSES.length; i++) {
    const c = CLASSES[i];
    if (level >= c.minLevel && c.req(attrLevels)) idx = i;
    else break;
  }
  return idx;
}

export function perksFor(classIndex) {
  const perks = { coinBonus: 0, shieldsBonus: 0, themes: [] };
  for (let i = 0; i <= classIndex; i++) {
    const p = CLASSES[i].perks;
    perks.coinBonus += p.coinBonus || 0;
    perks.shieldsBonus += p.shieldsBonus || 0;
    if (p.theme) perks.themes.push(p.theme);
  }
  return perks;
}
