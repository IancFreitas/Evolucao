// Motor de evolução: única porta de entrada para alterar o progresso.
// Todas as funções recebem o estado (já clonado pela camada de armazenamento) e o alteram.
// Não há acesso a DOM nem a armazenamento aqui.
import { addDays, dayKey, diffDays, weekKey } from './dates.js';
import { ATTR_KEYS, DAY_STATUSES, DEFAULT_RULES, uid } from './defaults.js';
import { CLASSES, THEMES, attrLevel, classIndexFor, levelFromXp, perksFor } from './levels.js';
import { EFFORT_KINDS, RuleError, attrsFor, award, coinsFor, hasKey, revokeId, revokeKey } from './ledger.js';
import {
  BOSS_STAGE_SHARE, MAIN_MILESTONES, MAIN_MILESTONE_SHARE, activityOf, completionKey, essentialsFor,
  isScheduled, missionXp, normalizeMission,
} from './missions.js';
import { computeStreak, effortDays, inactiveGapBefore } from './streaks.js';
import { ACHIEVEMENTS, RARITY } from './achievements.js';

export { RuleError };

export const clock = { now: () => Date.now() };

export const todayKey = (state) => dayKey(new Date(clock.now()), state.settings.rules.dayStartHour);

/* ------------------------------------------------------------------ */
/* Derivações (nada disso é armazenado: tudo é recalculado do livro). */
/* ------------------------------------------------------------------ */

export function derive(state, today = todayKey(state)) {
  const rules = state.settings.rules;
  let totalXp = 0;
  let coins = 0;
  const attrPoints = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0]));
  const keys = new Set();
  for (const e of state.log) {
    totalXp += e.xp || 0;
    coins += e.coins || 0;
    for (const [k, v] of Object.entries(e.attrs || {})) if (k in attrPoints) attrPoints[k] += v;
    if (e.key) keys.add(e.key);
  }
  const level = levelFromXp(totalXp, rules);
  const attrs = Object.fromEntries(ATTR_KEYS.map((k) => [k, attrLevel(attrPoints[k])]));
  const attrLevels = Object.fromEntries(ATTR_KEYS.map((k) => [k, attrs[k].level]));
  const classIndex = classIndexFor(level.level, attrLevels);
  const perks = perksFor(classIndex);
  const active = effortDays(state);
  const streak = computeStreak(state, today, rules.shieldsPerWeek + perks.shieldsBonus, active);
  return { today, totalXp, coins, attrPoints, attrs, attrLevels, level, classIndex, cls: CLASSES[classIndex], perks, streak, keys, active };
}

export function computeStats(state, d = derive(state)) {
  const attrDaySets = Object.fromEntries(ATTR_KEYS.map((k) => [k, new Set()]));
  const activityDaySets = {};
  const restDays = new Set();
  const s = {
    totalXp: d.totalXp, level: d.level.level, bestStreak: d.streak.best,
    effortEntries: 0, perfectDays: 0, bossesDefeated: 0, mainCompleted: 0, weeklyCompleted: 0,
    specialCompleted: 0, missionsCompleted: 0, comebacks: 0,
    purchases: state.inventory.length, backups: state.meta?.backups || 0,
    minAttrLevel: Math.min(...ATTR_KEYS.map((k) => d.attrLevels[k])),
  };
  for (const e of state.log) {
    if (EFFORT_KINDS.includes(e.kind)) {
      s.effortEntries++;
      for (const [k, v] of Object.entries(e.attrs || {})) if (v > 0 && attrDaySets[k]) attrDaySets[k].add(e.date);
      if (e.activity) (activityDaySets[e.activity] ||= new Set()).add(e.date);
      if (e.activity === 'descanso') restDays.add(e.date);
    }
    if (e.kind === 'bonus') s.perfectDays++;
    if (e.kind === 'comeback') s.comebacks++;
    if (e.kind === 'mission') {
      s.missionsCompleted++;
      if (e.missionType === 'boss') s.bossesDefeated++;
      if (e.missionType === 'main') s.mainCompleted++;
      if (e.missionType === 'weekly') s.weeklyCompleted++;
      if (e.missionType === 'special') s.specialCompleted++;
    }
  }
  for (const [date, info] of Object.entries(state.days)) if (info.status === 'rest' && date <= d.today) restDays.add(date);
  s.attrDays = Object.fromEntries(ATTR_KEYS.map((k) => [k, attrDaySets[k].size]));
  s.activityDays = Object.fromEntries(Object.entries(activityDaySets).map(([k, v]) => [k, v.size]));
  s.restDays = restDays.size;
  return s;
}

export function unlockedTitles(state) {
  return ACHIEVEMENTS.filter((a) => a.title && state.achievements[a.id]).map((a) => a.title);
}

/* ------------------------------------------------------------------ */
/* Execução de ações com detecção de eventos (subida de nível etc.).  */
/* ------------------------------------------------------------------ */

export function act(state, mutator) {
  const today = todayKey(state);
  const before = derive(state, today);
  const result = mutator(state, today);
  const unlocked = evaluateAchievements(state, today);
  const after = derive(state, today);
  const events = [];
  const dxp = after.totalXp - before.totalXp;
  if (dxp) events.push({ type: 'xp', amount: dxp });
  const dcoins = after.coins - before.coins;
  if (dcoins) events.push({ type: 'coins', amount: dcoins });
  if (after.level.level > before.level.level) events.push({ type: 'levelUp', level: after.level.level });
  if (after.classIndex > before.classIndex) events.push({ type: 'classUp', cls: after.cls });
  for (const k of ATTR_KEYS) {
    if (after.attrLevels[k] > before.attrLevels[k]) events.push({ type: 'attrUp', attr: k, level: after.attrLevels[k] });
  }
  for (const key of after.keys) {
    if (before.keys.has(key)) continue;
    if (key.startsWith('bonus:')) events.push({ type: 'bonus' });
    if (key.startsWith('comeback:')) events.push({ type: 'comeback' });
  }
  for (const a of unlocked) events.push({ type: 'achievement', achievement: a });
  return { result, events };
}

export function evaluateAchievements(state, today = todayKey(state)) {
  const stats = computeStats(state, derive(state, today));
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if ((a.metric(stats) || 0) >= a.target) {
      state.achievements[a.id] = { at: clock.now() };
      award(state, {
        key: `ach:${a.id}`, kind: 'achievement', date: today, title: `Conquista: ${a.name}`,
        coins: RARITY[a.rarity].coins, source: 'system', ts: clock.now(),
      });
      unlocked.push(a);
    }
  }
  return unlocked;
}

/* ------------------------------------------------------------------ */
/* Validações                                                          */
/* ------------------------------------------------------------------ */

function checkDate(state, date, today, windowDays = state.settings.rules.backdateDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RuleError('Data inválida.');
  if (date > today) throw new RuleError('Não é possível registrar progresso no futuro.');
  if (diffDays(date, today) > windowDays) {
    throw new RuleError(`Registros retroativos são permitidos só até ${windowDays} dia(s) atrás.`);
  }
}

const getMission = (state, id) => {
  const m = state.missions.find((x) => x.id === id);
  if (!m) throw new RuleError('Missão não encontrada.');
  return m;
};

const perksOf = (state) => derive(state).perks;
const isLightDay = (state, date) => state.days[date]?.status === 'hard';

/* ------------------------------------------------------------------ */
/* Missões                                                             */
/* ------------------------------------------------------------------ */

export function completeMission(state, id, { date, light = false } = {}, today = todayKey(state)) {
  const m = getMission(state, id);
  date ||= today;
  if (m.status === 'archived') throw new RuleError('Missão pausada. Reative-a para concluir.');
  checkDate(state, date, today);
  if (m.type === 'daily' && !isScheduled(m, date)) throw new RuleError('Esta missão não está agendada para este dia.');
  const key = completionKey(m, date);
  if (hasKey(state, key)) throw new RuleError('Missão já concluída neste período.');
  if (m.type === 'boss' && m.stages?.length && m.stages.some((s) => !s.done)) {
    throw new RuleError('Conclua todas as etapas antes de enfrentar o chefe.');
  }
  const rules = state.settings.rules;
  const act = activityOf(state, m);
  const base = missionXp(state, m);
  let xp = base;
  if (m.type === 'boss' && m.stages?.length) xp = Math.round(base * (1 - BOSS_STAGE_SHARE));
  if (m.type === 'main' && m.progress?.target) {
    m.progress.current = m.progress.target;
    reconcileMain(state, m, today);
    xp = Math.round(base * (1 - MAIN_MILESTONE_SHARE * MAIN_MILESTONES.length));
  }
  const useLight = m.type === 'daily' && (light || (isLightDay(state, date) && m.light));
  if (useLight) xp = Math.round(xp * rules.lightFactor);
  const entry = award(state, {
    key, kind: 'mission', missionId: m.id, missionType: m.type,
    title: useLight ? `${m.title} (versão leve)` : m.title,
    activity: m.activity, date, xp, coins: coinsFor(xp, rules, perksOf(state)),
    attrs: attrsFor(act?.attrs || { DISC: 1 }, xp, act?.xp || 40), light: useLight,
    ts: clock.now(), backdated: date !== today,
  });
  if (m.type !== 'daily' && m.type !== 'weekly') {
    m.status = 'completed';
    m.completedAt = clock.now();
  }
  if (m.type === 'daily') reconcileDailyBonus(state, date);
  checkComeback(state, date, today);
  return entry;
}

export function undoMission(state, id, { date } = {}, today = todayKey(state)) {
  const m = getMission(state, id);
  date ||= today;
  const removed = revokeKey(state, completionKey(m, date));
  if (!removed) throw new RuleError('Não há conclusão para desfazer.');
  if (m.status === 'completed') {
    m.status = 'active';
    delete m.completedAt;
  }
  if (m.type === 'main' && m.progress?.target && m.progress.current >= m.progress.target) {
    m.progress.current = Math.max(0, m.progress.target - 1);
    reconcileMain(state, m, today);
  }
  if (m.type === 'daily') reconcileDailyBonus(state, date);
  return removed;
}

export function saveMission(state, input, today = todayKey(state)) {
  const existing = input.id && state.missions.find((m) => m.id === input.id);
  if (existing) {
    const merged = normalizeMission({ ...existing, ...input, progress: input.progress ? { ...existing.progress, ...input.progress } : existing.progress }, today);
    if (existing.type === 'boss' && input.stages) {
      // preserva o estado das etapas existentes com o mesmo título
      merged.stages = input.stages.map((s) => {
        const old = existing.stages?.find((o) => o.id === s.id || o.title === s.title);
        return old ? { ...old, title: s.title } : { id: uid('s-'), title: s.title, done: false };
      });
      // etapas removidas devolvem o XP parcial
      for (const old of existing.stages || []) {
        if (!merged.stages.some((s) => s.id === old.id)) revokeKey(state, `boss:${existing.id}:${old.id}`);
      }
    }
    Object.assign(existing, merged);
    if (existing.type === 'main') reconcileMain(state, existing, today);
    return existing;
  }
  const m = normalizeMission(input, today);
  state.missions.push(m);
  return m;
}

/** Excluir uma missão não apaga o XP já conquistado com ela: o histórico é preservado. */
export function deleteMission(state, id, today = todayKey(state)) {
  const i = state.missions.findIndex((m) => m.id === id);
  if (i < 0) throw new RuleError('Missão não encontrada.');
  const [m] = state.missions.splice(i, 1);
  if (m.type === 'daily') reconcileDailyBonus(state, today);
  return m;
}

export function toggleArchive(state, id, today = todayKey(state)) {
  const m = getMission(state, id);
  if (m.status === 'completed') throw new RuleError('Missões concluídas não podem ser pausadas.');
  m.status = m.status === 'archived' ? 'active' : 'archived';
  if (m.type === 'daily') reconcileDailyBonus(state, today);
  return m;
}

/** Adiar: diárias pulam o dia sem penalidade; demais missões recebem nova data. */
export function postponeMission(state, id, { until } = {}, today = todayKey(state)) {
  const m = getMission(state, id);
  if (m.type === 'daily') {
    const date = until || today;
    if (hasKey(state, completionKey(m, date))) throw new RuleError('Esta missão já foi concluída hoje.');
    m.skips = [...new Set([...(m.skips || []), date])].filter((d) => diffDays(d, today) < 60);
    reconcileDailyBonus(state, date);
  } else {
    const target = until || addDays(m.dueDate && m.dueDate > today ? m.dueDate : today, 7);
    if (target <= today) throw new RuleError('Escolha uma data futura para adiar.');
    m.postponedUntil = m.type === 'weekly' ? target : null;
    m.dueDate = target;
  }
  return m;
}

export function resumeMission(state, id, today = todayKey(state)) {
  const m = getMission(state, id);
  if (m.type === 'daily') {
    m.skips = (m.skips || []).filter((d) => d !== today);
    reconcileDailyBonus(state, today);
  } else m.postponedUntil = null;
  return m;
}

export function setMainProgress(state, id, value, today = todayKey(state)) {
  const m = getMission(state, id);
  if (m.type !== 'main' || !m.progress?.target) throw new RuleError('Esta missão não tem progresso numérico.');
  const v = Math.max(0, Math.min(m.progress.target, Math.round(Number(value) || 0)));
  const doneKey = completionKey(m, today);
  if (v >= m.progress.target) {
    if (!hasKey(state, doneKey)) return completeMission(state, id, {}, today);
    return null;
  }
  if (hasKey(state, doneKey)) {
    revokeKey(state, doneKey);
    m.status = 'active';
    delete m.completedAt;
  }
  m.progress.current = v;
  reconcileMain(state, m, today);
  return m;
}

/** Marcos de 25/50/75%: existem se e somente se o progresso atual os alcança. */
function reconcileMain(state, m, today) {
  if (!m.progress?.target) return;
  const pct = (m.progress.current / m.progress.target) * 100;
  const act = activityOf(state, m);
  const xp = Math.round(missionXp(state, m) * MAIN_MILESTONE_SHARE);
  for (const ms of MAIN_MILESTONES) {
    const key = `main:${m.id}:${ms}`;
    if (pct >= ms && !hasKey(state, key)) {
      award(state, {
        key, kind: 'milestone', missionId: m.id, missionType: 'main', title: `${m.title}: marco de ${ms}%`,
        activity: m.activity, date: today, xp, coins: coinsFor(xp, state.settings.rules, perksOf(state)),
        attrs: attrsFor(act?.attrs || { DISC: 1 }, xp, act?.xp || 40), ts: clock.now(),
      });
    } else if (pct < ms) revokeKey(state, key);
  }
}

export function toggleBossStage(state, id, stageId, today = todayKey(state)) {
  const m = getMission(state, id);
  const stage = m.stages?.find((s) => s.id === stageId);
  if (!stage) throw new RuleError('Etapa não encontrada.');
  const key = `boss:${m.id}:${stage.id}`;
  stage.done = !stage.done;
  if (stage.done) {
    const act = activityOf(state, m);
    const xp = Math.round((missionXp(state, m) * BOSS_STAGE_SHARE) / m.stages.length);
    award(state, {
      key, kind: 'stage', missionId: m.id, missionType: 'boss', title: `${m.title}: ${stage.title}`,
      activity: m.activity, date: today, xp, coins: coinsFor(xp, state.settings.rules, perksOf(state)),
      attrs: attrsFor(act?.attrs || { DISC: 1 }, xp, act?.xp || 40), ts: clock.now(),
    });
    checkComeback(state, today, today);
  } else {
    revokeKey(state, key);
    const doneKey = completionKey(m, today);
    if (hasKey(state, doneKey)) {
      revokeKey(state, doneKey);
      m.status = 'active';
      delete m.completedAt;
    }
  }
  return stage;
}

/* ------------------------------------------------------------------ */
/* Registro livre de atividades (com anti-exploração).                 */
/* ------------------------------------------------------------------ */

export function logActivity(state, activityKey, opts = {}, today = todayKey(state)) {
  const rules = state.settings.rules;
  const act = state.settings.activities.find((a) => a.key === activityKey);
  if (!act) throw new RuleError('Atividade não encontrada.');
  const source = opts.source || 'manual';
  const date = opts.date || today;
  checkDate(state, date, today, source === 'manual' ? rules.backdateDays : rules.importWindowDays);

  const extKey = opts.externalId ? `ext:${source}:${opts.externalId}` : null;
  if (extKey && hasKey(state, extKey)) throw new RuleError('Este registro já foi importado.');

  // Se houver uma missão diária pendente para esta atividade, o registro a conclui.
  if (!opts.noMissionMatch && diffDays(date, today) <= rules.backdateDays) {
    const mission = state.missions.find(
      (m) => m.type === 'daily' && m.activity === activityKey && m.status === 'active' &&
        isScheduled(m, date) && !hasKey(state, completionKey(m, date)),
    );
    if (mission) {
      const entry = completeMission(state, mission.id, { date }, today);
      if (extKey) entry.extKey = extKey;
      if (source !== 'manual') entry.source = source;
      if (opts.note) entry.note = String(opts.note).slice(0, 300);
      return entry;
    }
  }

  const sameDay = state.log.filter(
    (e) => e.activity === activityKey && e.date === date && (e.kind === 'activity' || (e.kind === 'mission' && e.missionType === 'daily')),
  );
  const limit = act.dailyLimit ?? 3;
  const factor = rules.diminishing[sameDay.length] ?? 0;
  if (sameDay.length >= limit || factor <= 0) {
    throw new RuleError(`Limite diário de "${act.name}" atingido (${limit}x). Isso evita pontuação repetitiva.`);
  }
  if (source === 'manual' && sameDay.length) {
    const last = Math.max(...sameDay.map((e) => e.ts));
    const wait = rules.cooldownMinutes * 60e3 - (clock.now() - last);
    if (wait > 0) throw new RuleError(`Aguarde ${Math.ceil(wait / 60e3)} min para registrar "${act.name}" novamente.`);
  }
  const xp = Math.round(act.xp * factor);
  const entry = award(state, {
    key: extKey || `act:${activityKey}:${date}:${uid()}`, kind: 'activity', activity: activityKey,
    title: act.name + (factor < 1 ? ` (repetição ${Math.round(factor * 100)}%)` : ''), date, xp,
    coins: coinsFor(xp, rules, perksOf(state)), attrs: attrsFor(act.attrs, xp, act.xp), source,
    note: opts.note ? String(opts.note).slice(0, 300) : undefined, ts: clock.now(), backdated: date !== today,
  });
  checkComeback(state, date, today);
  return entry;
}

/** Remove uma entrada de esforço do histórico (correção de erro). */
export function removeEntry(state, entryId, today = todayKey(state)) {
  const e = state.log.find((x) => x.id === entryId);
  if (!e) throw new RuleError('Registro não encontrado.');
  if (!['activity', 'mission'].includes(e.kind)) {
    throw new RuleError('Este registro é automático. Desfaça a ação de origem (missão, etapa ou compra).');
  }
  if (e.kind === 'mission') {
    const m = state.missions.find((x) => x.id === e.missionId);
    if (m) return undoMission(state, m.id, { date: e.date }, today);
  }
  revokeId(state, entryId);
  return e;
}

/* ------------------------------------------------------------------ */
/* Bônus diário, retomada e estado do dia.                             */
/* ------------------------------------------------------------------ */

export function reconcileDailyBonus(state, date) {
  const rules = state.settings.rules;
  const key = `bonus:${date}`;
  const ess = essentialsFor(state, date);
  const allDone = ess.length > 0 && ess.every((m) => hasKey(state, completionKey(m, date)));
  if (allDone && !hasKey(state, key)) {
    const xp = Math.round(rules.dailyBonus * (isLightDay(state, date) ? rules.lightFactor : 1));
    award(state, {
      key, kind: 'bonus', date, title: 'Bônus: missões essenciais do dia completas', xp,
      coins: coinsFor(xp, rules, perksOf(state)), attrs: { DISC: 2 }, source: 'system', ts: clock.now(),
    });
  } else if (!allDone) revokeKey(state, key);
}

function checkComeback(state, date, today) {
  const rules = state.settings.rules;
  if (date !== today || hasKey(state, `comeback:${date}`)) return;
  const effortToday = state.log.filter((e) => e.date === date && EFFORT_KINDS.includes(e.kind) && e.xp > 0).length;
  if (effortToday !== 1) return;
  if (inactiveGapBefore(state, date) >= rules.comebackGapDays) {
    const xp = rules.comebackBonus;
    award(state, {
      key: `comeback:${date}`, kind: 'comeback', date, title: 'Bônus de retomada: bem-vindo de volta', xp,
      coins: coinsFor(xp, rules, perksOf(state)), attrs: { DISC: 1 }, source: 'system', ts: clock.now(),
    });
  }
}

export function setDayStatus(state, date, status, note = '', today = todayKey(state)) {
  if (!DAY_STATUSES[status]) throw new RuleError('Estado de dia inválido.');
  if (diffDays(date, today) > state.settings.rules.backdateDays) throw new RuleError('Data muito antiga para alterar.');
  if (diffDays(today, date) > 30) throw new RuleError('Planeje no máximo 30 dias à frente.');
  if (status === 'normal') delete state.days[date];
  else state.days[date] = { status, note: String(note).slice(0, 200), at: clock.now() };
  reconcileDailyBonus(state, date);
  return state.days[date] || null;
}

/* ------------------------------------------------------------------ */
/* Loja e inventário.                                                  */
/* ------------------------------------------------------------------ */

export function saveReward(state, input) {
  const r = {
    id: input.id || uid('rw-'),
    name: String(input.name || 'Recompensa').slice(0, 80),
    icon: String(input.icon || '🎁').slice(0, 4),
    desc: String(input.desc || '').slice(0, 200),
    cost: Math.max(1, Math.min(100000, Math.round(Number(input.cost) || 50))),
    maxPerWeek: Math.max(0, Math.round(Number(input.maxPerWeek) || 0)),
    cooldownDays: Math.max(0, Math.round(Number(input.cooldownDays) || 0)),
  };
  const i = state.rewards.findIndex((x) => x.id === r.id);
  if (i >= 0) state.rewards[i] = r;
  else state.rewards.push(r);
  return r;
}

export function deleteReward(state, id) {
  state.rewards = state.rewards.filter((r) => r.id !== id);
}

export function rewardAvailability(state, reward, today = todayKey(state), coins = derive(state, today).coins) {
  const bought = state.inventory.filter((i) => i.rewardId === reward.id);
  const thisWeek = bought.filter((i) => weekKey(i.date) === weekKey(today)).length;
  if (reward.maxPerWeek && thisWeek >= reward.maxPerWeek) {
    return { ok: false, reason: `Limite semanal (${reward.maxPerWeek}x) atingido. Equilíbrio também é progresso.` };
  }
  if (reward.cooldownDays && bought.length) {
    const last = bought.map((i) => i.date).sort().pop();
    const left = reward.cooldownDays - diffDays(last, today);
    if (left > 0) return { ok: false, reason: `Disponível novamente em ${left} dia(s).` };
  }
  if (coins < reward.cost) return { ok: false, reason: `Faltam ${reward.cost - coins} moedas.` };
  return { ok: true };
}

export function buyReward(state, rewardId, today = todayKey(state)) {
  const r = state.rewards.find((x) => x.id === rewardId);
  if (!r) throw new RuleError('Recompensa não encontrada.');
  const av = rewardAvailability(state, r, today);
  if (!av.ok) throw new RuleError(av.reason);
  const item = { id: uid('it-'), rewardId: r.id, name: r.name, icon: r.icon, cost: r.cost, date: today, boughtAt: clock.now(), usedAt: null };
  state.inventory.push(item);
  award(state, { key: `buy:${item.id}`, kind: 'purchase', date: today, title: `Loja: ${r.name}`, coins: -r.cost, source: 'system', ts: clock.now() });
  return item;
}

export function useItem(state, itemId) {
  const it = state.inventory.find((i) => i.id === itemId);
  if (!it) throw new RuleError('Item não encontrado.');
  if (it.usedAt) throw new RuleError('Esta recompensa já foi usada.');
  it.usedAt = clock.now();
  return it;
}

export function refundItem(state, itemId) {
  const it = state.inventory.find((i) => i.id === itemId);
  if (!it) throw new RuleError('Item não encontrado.');
  if (it.usedAt) throw new RuleError('Recompensas já usadas não podem ser devolvidas.');
  revokeKey(state, `buy:${it.id}`);
  state.inventory = state.inventory.filter((i) => i.id !== itemId);
  return it;
}

/* ------------------------------------------------------------------ */
/* Integrações: fila de confirmação.                                   */
/* ------------------------------------------------------------------ */

/** Itens importados entram numa fila: só geram progresso após confirmação. */
export function addPending(state, items) {
  let added = 0;
  for (const raw of items) {
    if (!raw.externalId || !raw.source) continue;
    const dup = state.pending.some((p) => p.source === raw.source && p.externalId === raw.externalId) ||
      hasKey(state, `ext:${raw.source}:${raw.externalId}`) ||
      state.log.some((e) => e.extKey === `ext:${raw.source}:${raw.externalId}`);
    if (dup) continue;
    state.pending.push({
      id: uid('p-'), source: String(raw.source).slice(0, 40), externalId: String(raw.externalId).slice(0, 120),
      date: raw.date, activity: raw.activity || null, title: String(raw.title || 'Registro importado').slice(0, 140),
      detail: raw.detail ? String(raw.detail).slice(0, 200) : '', kind: raw.kind || 'activity', addedAt: clock.now(),
    });
    added++;
  }
  return added;
}

export function confirmPending(state, id, activityOverride, today = todayKey(state)) {
  const p = state.pending.find((x) => x.id === id);
  if (!p) throw new RuleError('Item pendente não encontrado.');
  const activity = activityOverride || p.activity;
  if (!activity) throw new RuleError('Escolha uma atividade para este registro.');
  const entry = logActivity(state, activity, { date: p.date, source: p.source, externalId: p.externalId, note: p.title }, today);
  state.pending = state.pending.filter((x) => x.id !== id);
  return entry;
}

/**
 * Importa itens e, se `autoConfirm`, já confirma os novos (fontes confiáveis como o app Saúde).
 * Itens que esbarram em limites diários continuam pendentes.
 */
export function importItems(state, items, { autoConfirm = false } = {}, today = todayKey(state)) {
  const before = new Set(state.pending.map((p) => p.id));
  const added = addPending(state, items);
  let confirmed = 0;
  if (autoConfirm) {
    for (const p of state.pending.filter((x) => !before.has(x.id) && x.activity)) {
      try { confirmPending(state, p.id, null, today); confirmed++; } catch { /* fica na fila */ }
    }
  }
  return { added, confirmed, pending: added - confirmed };
}

export function updateHealthSettings(state, patch) {
  const h = state.settings.health;
  const n = (v, min, max, d) => (Number.isFinite(Number(v)) && v !== '' ? Math.max(min, Math.min(max, Number(v))) : d);
  h.sleepGoal = n(patch.sleepGoal ?? h.sleepGoal, 3, 12, 7);
  h.stepsGoal = Math.round(n(patch.stepsGoal ?? h.stepsGoal, 500, 50000, 8000));
  h.exerciseGoal = Math.round(n(patch.exerciseGoal ?? h.exerciseGoal, 5, 300, 30));
  h.mindfulGoal = Math.round(n(patch.mindfulGoal ?? h.mindfulGoal, 1, 120, 5));
  h.minWorkoutMinutes = Math.round(n(patch.minWorkoutMinutes ?? h.minWorkoutMinutes, 1, 300, 15));
  if (patch.autoConfirm !== undefined) h.autoConfirm = !!patch.autoConfirm;
  return h;
}

export function rejectPending(state, id) {
  state.pending = state.pending.filter((x) => x.id !== id);
}

/* ------------------------------------------------------------------ */
/* Perfil e regras.                                                    */
/* ------------------------------------------------------------------ */

export function updateProfile(state, patch) {
  const p = state.profile;
  if (patch.name != null) p.name = String(patch.name).trim().slice(0, 40) || 'Jogador';
  if (patch.activeTitle !== undefined) {
    if (patch.activeTitle && !unlockedTitles(state).includes(patch.activeTitle)) throw new RuleError('Título ainda não desbloqueado.');
    p.activeTitle = patch.activeTitle || null;
  }
  if (patch.theme) {
    if (!THEMES[patch.theme]) throw new RuleError('Tema inválido.');
    if (!derive(state).perks.themes.includes(patch.theme)) throw new RuleError('Tema bloqueado: evolua de classe para liberar.');
    p.theme = patch.theme;
  }
  return p;
}

const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function updateRules(state, patch) {
  const r = state.settings.rules;
  const d = DEFAULT_RULES;
  r.levelBase = clampNum(patch.levelBase ?? r.levelBase, 20, 2000, d.levelBase);
  r.levelExponent = clampNum(patch.levelExponent ?? r.levelExponent, 1, 2.5, d.levelExponent);
  r.dailyBonus = clampNum(patch.dailyBonus ?? r.dailyBonus, 0, 1000, d.dailyBonus);
  r.lightFactor = clampNum(patch.lightFactor ?? r.lightFactor, 0.1, 1, d.lightFactor);
  r.coinRate = clampNum(patch.coinRate ?? r.coinRate, 0, 2, d.coinRate);
  r.cooldownMinutes = clampNum(patch.cooldownMinutes ?? r.cooldownMinutes, 0, 1440, d.cooldownMinutes);
  r.backdateDays = Math.round(clampNum(patch.backdateDays ?? r.backdateDays, 0, 7, d.backdateDays));
  r.comebackBonus = clampNum(patch.comebackBonus ?? r.comebackBonus, 0, 500, d.comebackBonus);
  r.comebackGapDays = Math.round(clampNum(patch.comebackGapDays ?? r.comebackGapDays, 1, 60, d.comebackGapDays));
  r.shieldsPerWeek = Math.round(clampNum(patch.shieldsPerWeek ?? r.shieldsPerWeek, 0, 7, d.shieldsPerWeek));
  r.dayStartHour = Math.round(clampNum(patch.dayStartHour ?? r.dayStartHour, 0, 8, d.dayStartHour));
  if (patch.diminishing != null) {
    const arr = (Array.isArray(patch.diminishing) ? patch.diminishing : String(patch.diminishing).split(/[,;\s]+/))
      .map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 1);
    r.diminishing = arr.length ? arr : [1];
  }
  for (const t of Object.keys(d.missionTypeXp)) {
    if (patch.missionTypeXp?.[t] != null) r.missionTypeXp[t] = clampNum(patch.missionTypeXp[t], 0, 5000, d.missionTypeXp[t]);
  }
  return r;
}

export function saveActivity(state, input) {
  const key = String(input.key || input.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  if (!key) throw new RuleError('Informe um nome para a atividade.');
  const attrs = {};
  for (const k of ATTR_KEYS) {
    const v = Math.round(Number(input.attrs?.[k]) || 0);
    if (v > 0) attrs[k] = Math.min(10, v);
  }
  if (!Object.keys(attrs).length) throw new RuleError('A atividade precisa desenvolver ao menos um atributo.');
  const a = {
    key,
    name: String(input.name || key).slice(0, 60),
    icon: String(input.icon || '⭐').slice(0, 4),
    xp: Math.round(clampNum(input.xp, 1, 1000, 20)),
    attrs,
    dailyLimit: Math.round(clampNum(input.dailyLimit, 1, 10, 3)),
  };
  const i = state.settings.activities.findIndex((x) => x.key === (input.originalKey || key));
  if (i >= 0) state.settings.activities[i] = a;
  else state.settings.activities.push(a);
  return a;
}

export function deleteActivity(state, key) {
  if (state.settings.activities.length <= 1) throw new RuleError('Mantenha ao menos uma atividade.');
  state.settings.activities = state.settings.activities.filter((a) => a.key !== key);
}
