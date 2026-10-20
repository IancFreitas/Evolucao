// Valores padrão do sistema. Tudo aqui pode ser alterado pelo usuário em Ajustes.
import { addDays } from './dates.js';

export const SCHEMA_VERSION = 1;

export const ATTRIBUTES = [
  { key: 'STR', name: 'Força', desc: 'Musculação, desenvolvimento físico e resistência muscular.', color: '#ff4d6d' },
  { key: 'END', name: 'Resistência', desc: 'Cardio, condicionamento e consistência física.', color: '#ff9f43' },
  { key: 'INT', name: 'Inteligência', desc: 'Estudos, programação, leitura e conhecimento.', color: '#3d8bff' },
  { key: 'WIS', name: 'Sabedoria', desc: 'Reflexão, planejamento e decisões conscientes.', color: '#a66bff' },
  { key: 'DISC', name: 'Disciplina', desc: 'Cumprimento de hábitos, metas e compromissos.', color: '#22e3c4' },
  { key: 'CHA', name: 'Carisma', desc: 'Comunicação, relacionamentos e vida social.', color: '#ff5fd2' },
  { key: 'VIT', name: 'Vitalidade', desc: 'Sono, recuperação e autocuidado.', color: '#7ee35b' },
];
export const ATTR_KEYS = ATTRIBUTES.map((a) => a.key);
export const attrInfo = (key) => ATTRIBUTES.find((a) => a.key === key);

/**
 * Catálogo de atividades. Cada atividade define XP base, pontos de atributo
 * e um limite diário de registros livres (anti-exploração).
 */
export const DEFAULT_ACTIVITIES = [
  { key: 'treino', name: 'Treino planejado (musculação)', icon: '🏋️', xp: 40, attrs: { STR: 3, DISC: 1 }, dailyLimit: 2 },
  { key: 'cardio', name: 'Cardio / condicionamento', icon: '🏃', xp: 35, attrs: { END: 3, VIT: 1 }, dailyLimit: 2 },
  { key: 'estudo', name: 'Sessão de estudo', icon: '📚', xp: 30, attrs: { INT: 3, DISC: 1 }, dailyLimit: 3 },
  { key: 'programacao', name: 'Programação / prática técnica', icon: '💻', xp: 35, attrs: { INT: 3, WIS: 1 }, dailyLimit: 3 },
  { key: 'leitura', name: 'Leitura (20 min)', icon: '📖', xp: 20, attrs: { INT: 2, WIS: 1 }, dailyLimit: 3 },
  { key: 'reflexao', name: 'Reflexão / diário', icon: '🧭', xp: 15, attrs: { WIS: 3 }, dailyLimit: 1 },
  { key: 'planejamento', name: 'Planejamento do dia ou da semana', icon: '🗺️', xp: 20, attrs: { WIS: 2, DISC: 2 }, dailyLimit: 1 },
  { key: 'domestica', name: 'Tarefa doméstica planejada', icon: '🧹', xp: 15, attrs: { DISC: 2 }, dailyLimit: 3 },
  { key: 'trabalho', name: 'Tarefa importante do trabalho', icon: '💼', xp: 35, attrs: { DISC: 2, WIS: 1 }, dailyLimit: 3 },
  { key: 'financas', name: 'Organização financeira', icon: '💰', xp: 25, attrs: { WIS: 2, DISC: 1 }, dailyLimit: 1 },
  { key: 'social', name: 'Conexão social significativa', icon: '🤝', xp: 20, attrs: { CHA: 3 }, dailyLimit: 2 },
  { key: 'comunicacao', name: 'Prática de comunicação', icon: '🎙️', xp: 25, attrs: { CHA: 2, INT: 1 }, dailyLimit: 2 },
  { key: 'autocuidado', name: 'Autocuidado', icon: '🌿', xp: 20, attrs: { VIT: 3 }, dailyLimit: 2 },
  { key: 'sono', name: 'Meta de sono cumprida', icon: '🌙', xp: 20, attrs: { VIT: 3, DISC: 1 }, dailyLimit: 1 },
  { key: 'descanso', name: 'Descanso planejado', icon: '🛌', xp: 15, attrs: { VIT: 2, WIS: 1 }, dailyLimit: 1 },
  { key: 'passos', name: 'Meta de passos', icon: '🚶', xp: 15, attrs: { END: 2, VIT: 1 }, dailyLimit: 1 },
  { key: 'ingles', name: 'Prática de inglês', icon: '🇺🇸', xp: 20, attrs: { INT: 2, CHA: 1 }, dailyLimit: 2 },
  { key: 'espanhol', name: 'Prática de espanhol', icon: '🇪🇸', xp: 20, attrs: { INT: 2, CHA: 1 }, dailyLimit: 2 },
];

export const DEFAULT_RULES = {
  // Dificuldade (preset de levels.js) e a curva correspondente:
  // XP para sair do nível N = levelBase * N ^ levelExponent; nível de atributo = raiz(pontos / attrDivisor) + 1
  difficulty: 'dificil',
  levelBase: 250,
  levelExponent: 1.2,
  attrDivisor: 8,
  // Bônus por completar todas as missões essenciais do dia
  dailyBonus: 50,
  // Fator aplicado às versões leves das missões e ao bônus em dias difíceis
  lightFactor: 0.6,
  // Moedas por XP ganho
  coinRate: 0.1,
  // Retornos decrescentes para registros livres repetidos da mesma atividade no dia
  diminishing: [1, 0.5, 0.25],
  // Intervalo mínimo entre registros livres da mesma atividade (minutos)
  cooldownMinutes: 20,
  // Quantos dias para trás é permitido registrar (esquecimentos)
  backdateDays: 2,
  // Janela para confirmar registros importados de integrações (dias)
  importWindowDays: 30,
  // Horas que o portão de uma dungeon fica fechado após falhar no chefe
  dungeonCooldownHours: 48,
  // XP padrão por tipo de missão (diárias usam o XP da atividade)
  missionTypeXp: { daily: 0, weekly: 100, main: 300, special: 80, boss: 500 },
  // Bônus de retomada após pausa não planejada
  comebackBonus: 25,
  comebackGapDays: 3,
  // Escudos de sequência (dias perdidos que não quebram a sequência)
  shieldsPerWeek: 1,
  // Hora em que o "dia" vira (madrugada conta para o dia anterior)
  dayStartHour: 4,
};

export const DEFAULT_NOTIFICATIONS = {
  enabled: false,
  daily: { on: true, time: '08:00' },
  weekly: { on: true, day: 0, time: '19:00' },
  goal: true,
  levelUp: true,
  achievement: true,
  attribute: true,
  backup: true,
};

export const DEFAULT_BACKUP = {
  // lembrar de salvar no iCloud a cada N dias (0 = nunca lembrar)
  reminderDays: 7,
  // senha opcional, guardada só neste aparelho, usada para criptografar os backups
  password: '',
};

// Metas usadas para transformar dados do app Saúde em registros (nada pontua abaixo da meta).
export const DEFAULT_HEALTH = {
  sleepGoal: 7,
  stepsGoal: 8000,
  exerciseGoal: 30,
  mindfulGoal: 5,
  minWorkoutMinutes: 15,
  // false = dados do Saúde também passam pela fila de confirmação
  autoConfirm: false,
  lastImport: null,
};

export const DAY_STATUSES = {
  normal: { label: 'Normal', icon: '⚔️', desc: 'Dia comum, missões completas.' },
  hard: { label: 'Dia difícil', icon: '🌧️', desc: 'Missões leves no lugar das completas. Nada é perdido.' },
  rest: { label: 'Descanso planejado', icon: '🛌', desc: 'Recuperação faz parte do progresso. Sequência protegida.' },
  sick: { label: 'Doente', icon: '🤒', desc: 'Prioridade é se recuperar. Sequência protegida, sem cobranças.' },
  unexpected: { label: 'Imprevisto', icon: '🌪️', desc: 'A vida acontece. Sequência protegida.' },
};
export const PROTECTED_STATUSES = ['rest', 'sick', 'unexpected'];

export const DEFAULT_REWARDS = [
  { id: 'rw-serie', name: 'Episódio da série favorita', icon: '🎬', cost: 40, maxPerWeek: 4, cooldownDays: 0, desc: 'Sem culpa, depois das missões.' },
  { id: 'rw-cafe', name: 'Café ou lanche especial', icon: '☕', cost: 60, maxPerWeek: 2, cooldownDays: 0, desc: 'Um pequeno prazer.' },
  { id: 'rw-jogo', name: 'Tarde livre de jogos', icon: '🎮', cost: 150, maxPerWeek: 1, cooldownDays: 0, desc: 'Lazer completo e planejado.' },
  { id: 'rw-passeio', name: 'Passeio ou experiência ao ar livre', icon: '🏞️', cost: 200, maxPerWeek: 1, cooldownDays: 0, desc: 'Natureza, parque ou um lugar novo.' },
  { id: 'rw-livro', name: 'Livro novo', icon: '📘', cost: 400, maxPerWeek: 1, cooldownDays: 30, desc: 'Investimento em conhecimento.' },
];

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createInitialState({ name = 'Jogador', withExamples = true, today } = {}) {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    profile: { name, activeTitle: null, theme: 'azul', onboarded: true, easyRead: true },
    settings: {
      rules: structuredClone(DEFAULT_RULES),
      activities: structuredClone(DEFAULT_ACTIVITIES),
      notifications: structuredClone(DEFAULT_NOTIFICATIONS),
      health: structuredClone(DEFAULT_HEALTH),
      backup: structuredClone(DEFAULT_BACKUP),
    },
    missions: withExamples ? exampleMissions(today) : [],
    log: [],
    days: {},
    achievements: {},
    rewards: structuredClone(DEFAULT_REWARDS),
    inventory: [],
    pending: [],
    inbox: [],
    dungeons: {},
    meta: { backups: 0, lastBackupAt: null, lastNotified: {}, addedActivities: ['passos'] },
  };
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function exampleMissions(today) {
  const base = { description: '', status: 'active', createdAt: Date.now(), startDate: today, xp: null };
  return [
    { ...base, id: uid('m-'), type: 'daily', title: 'Treino planejado', activity: 'treino', essential: true, days: [1, 3, 5], light: 'Caminhada leve ou alongamento de 15 min' },
    { ...base, id: uid('m-'), type: 'daily', title: 'Sessão de estudo', activity: 'estudo', essential: true, days: [1, 2, 3, 4, 5], light: 'Revisar anotações por 10 min' },
    { ...base, id: uid('m-'), type: 'daily', title: 'Ler por 20 minutos', activity: 'leitura', essential: true, days: ALL_DAYS, light: 'Ler 5 páginas' },
    { ...base, id: uid('m-'), type: 'daily', title: 'Tarefa doméstica planejada', activity: 'domestica', essential: false, days: ALL_DAYS, light: 'Organizar um único espaço' },
    { ...base, id: uid('m-'), type: 'daily', title: 'Momento de autocuidado', activity: 'autocuidado', essential: false, days: ALL_DAYS, light: 'Beber água e respirar fundo por 2 min' },
    { ...base, id: uid('m-'), type: 'weekly', title: 'Revisão semanal e planejamento', activity: 'planejamento', description: 'Revisar a semana, definir prioridades da próxima.' },
    { ...base, id: uid('m-'), type: 'weekly', title: 'Organização financeira da semana', activity: 'financas', xp: 80 },
    { ...base, id: uid('m-'), type: 'weekly', title: 'Evolução técnica: concluir 1 módulo', activity: 'programacao', xp: 120 },
    { ...base, id: uid('m-'), type: 'main', title: 'Concluir um curso', activity: 'estudo', description: 'Escolha um curso e acompanhe as aulas.', progress: { current: 0, target: 20, unit: 'aulas' }, dueDate: addDays(today, 90) },
    { ...base, id: uid('m-'), type: 'special', title: 'Uma semana sem telas após 22h', activity: 'descanso', description: 'Desafio opcional de higiene do sono.', dueDate: addDays(today, 14) },
    {
      ...base, id: uid('m-'), type: 'boss', title: 'Finalizar projeto pessoal', activity: 'programacao',
      description: 'Divida o projeto em etapas e derrote o chefe.', dueDate: addDays(today, 60),
      stages: [
        { id: uid('s-'), title: 'Definir escopo e requisitos', done: false },
        { id: uid('s-'), title: 'Construir a primeira versão', done: false },
        { id: uid('s-'), title: 'Testar e corrigir', done: false },
        { id: uid('s-'), title: 'Publicar / entregar', done: false },
      ],
    },
  ];
}
