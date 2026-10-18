// Regras puras de missões: agenda, períodos, chaves de conclusão e XP.
import { weekday, weekKey } from './dates.js';
import { uid } from './defaults.js';

export const MISSION_TYPES = {
  daily: { label: 'Diárias', single: 'Diária', icon: '☀️', desc: 'Hábitos e compromissos do dia a dia.' },
  weekly: { label: 'Semanais', single: 'Semanal', icon: '📅', desc: 'Objetivos maiores da semana.' },
  main: { label: 'Principais', single: 'Principal', icon: '🧭', desc: 'Metas de longo prazo com progresso.' },
  special: { label: 'Especiais', single: 'Especial', icon: '✨', desc: 'Desafios opcionais.' },
  boss: { label: 'Boss Battles', single: 'Boss', icon: '🐉', desc: 'Grandes desafios divididos em etapas.' },
};

export const MAIN_MILESTONES = [25, 50, 75];
// Parte do XP de uma missão principal distribuída nos marcos (10% cada) e restante na conclusão.
export const MAIN_MILESTONE_SHARE = 0.1;
// Parte do XP de um boss distribuída entre as etapas; o restante vem ao derrotá-lo.
export const BOSS_STAGE_SHARE = 0.4;

export function periodKey(m, date) {
  if (m.type === 'daily') return date;
  if (m.type === 'weekly') return weekKey(date);
  return 'once';
}

export const completionKey = (m, date) => `m:${m.id}:${periodKey(m, date)}`;

export function isScheduled(m, date) {
  if (m.status === 'archived') return false;
  if (m.startDate && date < m.startDate) return false;
  if (m.type === 'daily') return (m.days || []).includes(weekday(date));
  return true;
}

export function isPostponed(m, date) {
  if (m.type === 'daily') return (m.skips || []).includes(date);
  return !!(m.postponedUntil && date < m.postponedUntil);
}

export function activityOf(state, m) {
  return state.settings.activities.find((a) => a.key === m.activity) || null;
}

export function missionXp(state, m) {
  if (m.xp != null && m.xp !== '') return Number(m.xp);
  if (m.type === 'daily') return activityOf(state, m)?.xp ?? 20;
  return state.settings.rules.missionTypeXp[m.type] ?? 50;
}

export function normalizeMission(input, today) {
  const type = MISSION_TYPES[input.type] ? input.type : 'daily';
  const m = {
    id: input.id || uid('m-'),
    type,
    title: String(input.title || 'Missão sem nome').slice(0, 120),
    description: String(input.description || '').slice(0, 600),
    activity: input.activity || null,
    xp: input.xp === '' || input.xp == null ? null : Math.max(0, Math.min(5000, Number(input.xp) || 0)),
    status: input.status || 'active',
    createdAt: input.createdAt || Date.now(),
    startDate: input.startDate || today,
  };
  if (type === 'daily') {
    m.essential = !!input.essential;
    m.days = Array.isArray(input.days) && input.days.length ? input.days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
    m.light = String(input.light || '').slice(0, 160);
    m.skips = input.skips || [];
  } else {
    m.dueDate = input.dueDate || null;
    m.postponedUntil = input.postponedUntil || null;
  }
  if (type === 'main') {
    const target = Math.max(0, Number(input.progress?.target) || 0);
    m.progress = {
      current: Math.min(target || Infinity, Math.max(0, Number(input.progress?.current) || 0)),
      target,
      unit: String(input.progress?.unit || 'etapas').slice(0, 30),
    };
  }
  if (type === 'boss') {
    m.stages = (input.stages || []).map((s) => ({ id: s.id || uid('s-'), title: String(s.title).slice(0, 120), done: !!s.done }));
  }
  if (input.completedAt) m.completedAt = input.completedAt;
  if (input.source) m.source = input.source;
  if (input.extId) m.extId = input.extId;
  return m;
}

/** Missões diárias que contam para o bônus do dia. */
export function essentialsFor(state, date) {
  return state.missions.filter(
    (m) => m.type === 'daily' && m.essential && m.status === 'active' && isScheduled(m, date) && !isPostponed(m, date),
  );
}
