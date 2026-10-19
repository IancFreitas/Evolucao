// Dungeons: uma por área (atributo) e por rank (E → S).
// Para alcançar o chefe é preciso cumprir requisitos medidos pelos próprios registros,
// feitos DEPOIS de entrar na dungeon. O chefe é uma missão final com prazo; se falhar,
// o portão fecha por algumas horas (padrão 48h), mas os requisitos já cumpridos são mantidos.
import { EFFORT_KINDS } from './ledger.js';
import { addDays } from './dates.js';

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

// Requisitos e recompensas por rank (índice 0 = E).
export const RANK_TABLE = [
  { minLevel: 1, days: 3, attrLevel: 2, streak: 0, hours: 24, xp: 150, attr: 5 },
  { minLevel: 5, days: 6, attrLevel: 4, streak: 2, hours: 48, xp: 300, attr: 10 },
  { minLevel: 12, days: 10, attrLevel: 6, streak: 3, hours: 72, xp: 500, attr: 15 },
  { minLevel: 20, days: 15, attrLevel: 9, streak: 5, hours: 96, xp: 800, attr: 25 },
  { minLevel: 32, days: 22, attrLevel: 12, streak: 7, hours: 120, xp: 1200, attr: 40 },
  { minLevel: 45, days: 30, attrLevel: 16, streak: 10, hours: 168, xp: 2000, attr: 60 },
];

/** Uma dungeon por área, com o desafio final de cada rank. */
export const AREAS = [
  { key: 'STR', name: 'Forja de Ferro', icon: '⚒️', bosses: [
    'Complete um treino de força com todos os exercícios planejados.',
    'Faça um treino com mais carga ou repetições que a sua última sessão.',
    'Faça 3 treinos de força em até 3 dias de prazo, com boa técnica.',
    'Treino de 75 minutos registrando todas as cargas, sem pular exercícios.',
    'Bata um recorde pessoal em um exercício principal.',
    'Semana de elite: 5 treinos de força completos dentro do prazo.',
  ] },
  { key: 'END', name: 'Trilha dos Ventos', icon: '🌬️', bosses: [
    'Caminhe ou corra 30 minutos sem parar.',
    'Faça 40 minutos de cardio contínuo.',
    'Corra ou pedale 5 km (ou 45 minutos) de uma vez.',
    'Treino intervalado de 30 minutos seguido de 20 minutos contínuos.',
    'Complete 10 km de corrida ou 90 minutos de cardio.',
    'Faça 4 sessões de cardio no prazo, uma delas com 60 minutos ou mais.',
  ] },
  { key: 'INT', name: 'Biblioteca Arcana', icon: '📚', bosses: [
    'Estude 45 minutos focado, sem celular por perto.',
    'Sessão de 90 minutos em um tema e um resumo de 5 tópicos.',
    'Termine um módulo ou capítulo inteiro de um curso ou livro técnico.',
    'Construa um pequeno projeto aplicando o que você estudou.',
    'Ensine o conteúdo: escreva uma explicação de uma página para outra pessoa.',
    'Conclua um curso ou projeto que estava parado.',
  ] },
  { key: 'WIS', name: 'Templo do Oráculo', icon: '🔮', bosses: [
    'Escreva 10 minutos de diário sobre o seu dia.',
    'Planeje a semana inteira com as 3 prioridades principais.',
    'Faça uma revisão do mês: o que funcionou e o que vai mudar.',
    'Tome uma decisão importante com prós e contras por escrito.',
    'Siga durante um dia inteiro o plano feito na véspera.',
    'Defina metas para os próximos 3 meses com um plano de ação.',
  ] },
  { key: 'DISC', name: 'Fortaleza da Vontade', icon: '🏰', bosses: [
    'Cumpra todas as missões essenciais de hoje.',
    'Tenha 2 dias perfeitos seguidos (todas as essenciais).',
    'Acorde no horário planejado por 3 dias seguidos.',
    'Faça 4 dias perfeitos dentro do prazo.',
    'Passe o prazo inteiro sem adiar nenhuma missão.',
    'Tenha todos os dias do prazo com as missões essenciais completas.',
  ] },
  { key: 'CHA', name: 'Salão dos Ecos', icon: '🎭', bosses: [
    'Puxe uma conversa significativa com alguém hoje.',
    'Retome o contato com alguém com quem você não fala há meses.',
    'Organize um encontro com amigos ou família.',
    'Faça uma apresentação ou fale para um grupo.',
    'Dê um feedback difícil, com cuidado e respeito.',
    'Lidere uma iniciativa em grupo do começo ao fim.',
  ] },
  { key: 'VIT', name: 'Santuário da Aurora', icon: '🌅', bosses: [
    'Durma 7 horas ou mais esta noite.',
    'Durma 7 horas ou mais por 2 noites seguidas.',
    'Um dia inteiro de autocuidado: água, refeições e alongamento.',
    'Mantenha o horário de dormir consistente (±30 min) durante o prazo.',
    'Fique sem telas na última hora antes de dormir durante todo o prazo.',
    'Todas as noites do prazo com sono adequado e rotina de descanso.',
  ] },
];

export const dungeonId = (area, rank) => `${area}-${RANKS[rank]}`;
export const areaInfo = (key) => AREAS.find((a) => a.key === key);

export function dungeonDef(area, rank) {
  const a = areaInfo(area);
  return { id: dungeonId(area, rank), area, rank, rankLetter: RANKS[rank], name: a.name, icon: a.icon, boss: a.bosses[rank], ...RANK_TABLE[rank] };
}

/** Maior rank limpo em cada área (-1 = nenhum). */
export function areaRanks(state) {
  const out = {};
  for (const a of AREAS) {
    let r = -1;
    for (let i = 0; i < RANKS.length; i++) if (state.dungeons?.[dungeonId(a.key, i)]?.clearedAt) r = i;
    out[a.key] = r;
  }
  return out;
}

/** Rank geral: o maior rank alcançado em pelo menos 4 das 7 áreas. */
export function hunterRank(state) {
  const ranks = Object.values(areaRanks(state));
  for (let r = RANKS.length - 1; r >= 0; r--) if (ranks.filter((x) => x >= r).length >= 4) return r;
  return -1;
}

/** Progresso dos requisitos, contando só esforço registrado depois de entrar. */
export function dungeonProgress(state, def, run, attrLevels) {
  const days = new Set();
  if (run?.enteredAt) {
    for (const e of state.log) {
      if (!EFFORT_KINDS.includes(e.kind) || !(e.attrs?.[def.area] > 0)) continue;
      if (e.ts >= run.enteredAt && e.date >= run.enteredDate) days.add(e.date);
    }
  }
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const d of [...days].sort()) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  const reqs = [
    { key: 'days', label: `Dias com progresso em ${def.area}`, current: days.size, target: def.days },
    { key: 'attr', label: `Atributo ${def.area} no nível ${def.attrLevel}`, current: attrLevels[def.area] || 1, target: def.attrLevel },
  ];
  if (def.streak) reqs.push({ key: 'streak', label: `${def.streak} dias seguidos em ${def.area}`, current: best, target: def.streak });
  return { reqs, done: reqs.every((r) => r.current >= r.target) };
}

/**
 * Estado de uma dungeon:
 * locked | available | active | ready | boss | cooldown | cleared
 */
export function dungeonStatus(state, def, { level, attrLevels }, now) {
  const run = state.dungeons?.[def.id];
  if (run?.clearedAt) return { status: 'cleared', run };
  const prevCleared = def.rank === 0 || state.dungeons?.[dungeonId(def.area, def.rank - 1)]?.clearedAt;
  if (!prevCleared) return { status: 'locked', reason: `Limpe antes o Rank ${RANKS[def.rank - 1]} desta área.` };
  if (level < def.minLevel) return { status: 'locked', reason: `Requer nível ${def.minLevel}.` };
  if (!run?.enteredAt) return { status: 'available', run };
  const progress = dungeonProgress(state, def, run, attrLevels);
  if (run.bossStartedAt && now <= run.bossDeadline) return { status: 'boss', run, progress };
  const cooldownUntil = run.bossStartedAt && now > run.bossDeadline ? run.bossDeadline + run.cooldownHours * 3600e3 : run.cooldownUntil;
  if (cooldownUntil && now < cooldownUntil) return { status: 'cooldown', run, progress, cooldownUntil };
  return { status: progress.done ? 'ready' : 'active', run, progress };
}
