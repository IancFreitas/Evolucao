import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/core/defaults.js';
import * as E from '../src/core/engine.js';
import { addDays, weekKey } from '../src/core/dates.js';
import { levelFromXp, totalXpForLevel, archetypeFor, classFor, DIFFICULTY } from '../src/core/levels.js';
import { buildPlan, storyHints, parseClaudeProfile } from '../src/core/personalize.js';
import { essentialsFor, isScheduled } from '../src/core/missions.js';
import { activePhases, isPhaseProtected, pausingPhase } from '../src/core/phases.js';
import { isProtected } from '../src/core/streaks.js';
import { suggestFromText } from '../src/core/dayreview.js';
import { migrate } from '../src/storage/migrations.js';

// Relógio controlado: 2026-10-14 (quarta-feira) às 10h.
let now = new Date(2026, 9, 14, 10).getTime();
E.clock.now = () => now;
const advance = (min) => { now += min * 60e3; };

function fresh(examples = false) {
  const s = createInitialState({ name: 'Teste', withExamples: examples, today: E.todayKey({ settings: { rules: { dayStartHour: 4 } } }) });
  return s;
}
const daily = (s, extra = {}) => E.saveMission(s, { type: 'daily', title: 'Estudar', activity: 'estudo', essential: true, days: [0, 1, 2, 3, 4, 5, 6], ...extra });

test('curva de nível é progressiva e alcançável', () => {
  const r = { levelBase: 100, levelExponent: 1.25 };
  assert.equal(levelFromXp(0, r).level, 1);
  assert.equal(levelFromXp(100, r).level, 2);
  const lvl10 = totalXpForLevel(10, r);
  assert.ok(lvl10 > 5000 && lvl10 < 9000, `nível 10 em ${lvl10} XP`);
  assert.ok(totalXpForLevel(50, r) < 300000);
});

test('missão diária não pontua duas vezes no mesmo dia', () => {
  const s = fresh();
  const m = daily(s);
  E.completeMission(s, m.id);
  assert.throws(() => E.completeMission(s, m.id), /já concluída/);
  const d = E.derive(s);
  // 30 XP da missão + 50 do bônus diário (única essencial)
  assert.equal(d.totalXp, 80);
});

test('desfazer remove XP e bônus', () => {
  const s = fresh();
  const m = daily(s);
  E.completeMission(s, m.id);
  E.undoMission(s, m.id);
  assert.equal(E.derive(s).totalXp, 0);
});

test('registro livre conclui a missão pendente e depois aplica retornos decrescentes', () => {
  const s = fresh();
  daily(s);
  const first = E.logActivity(s, 'estudo');
  assert.equal(first.kind, 'mission');
  assert.throws(() => E.logActivity(s, 'estudo'), /Aguarde/);
  advance(30);
  const second = E.logActivity(s, 'estudo');
  assert.equal(second.xp, 15); // 50%
  advance(30);
  assert.equal(E.logActivity(s, 'estudo').xp, 8); // 25%
  advance(30);
  assert.throws(() => E.logActivity(s, 'estudo'), /Limite diário/);
});

test('não permite registrar no futuro nem muito no passado', () => {
  const s = fresh();
  const today = E.todayKey(s);
  assert.throws(() => E.logActivity(s, 'leitura', { date: addDays(today, 1) }), /futuro/);
  assert.throws(() => E.logActivity(s, 'leitura', { date: addDays(today, -5) }), /retroativos/);
  assert.ok(E.logActivity(s, 'leitura', { date: addDays(today, -1) }));
});

test('dia difícil usa versão leve e bônus reduzido', () => {
  const s = fresh();
  const m = daily(s, { light: 'Revisar 10 min' });
  E.setDayStatus(s, E.todayKey(s), 'hard');
  const e = E.completeMission(s, m.id);
  assert.equal(e.xp, 18);
  assert.equal(E.derive(s).totalXp, 18 + 30);
});

test('sequência: dias protegidos e escudo não quebram, recorde é preservado', () => {
  const s = fresh();
  const t0 = E.todayKey(s);
  s.settings.rules.backdateDays = 7;
  for (const back of [6, 5, 4]) E.logActivity(s, 'leitura', { date: addDays(t0, -back) });
  E.setDayStatus(s, addDays(t0, -3), 'sick');
  E.logActivity(s, 'leitura', { date: addDays(t0, -2) });
  // -1 vazio: consumido pelo escudo semanal
  E.logActivity(s, 'leitura', { date: t0 });
  const d = E.derive(s);
  assert.equal(d.streak.current, 5);
  assert.equal(d.streak.best, 5);
});

test('retomada após pausa gera bônus e conquista Fênix', () => {
  const s = fresh();
  const t0 = E.todayKey(s);
  s.settings.rules.backdateDays = 10;
  E.logActivity(s, 'leitura', { date: addDays(t0, -8) });
  const { events } = E.act(s, (st) => E.logActivity(st, 'leitura'));
  assert.ok(events.some((e) => e.type === 'comeback'));
  assert.ok(s.achievements.fenix);
});

test('conquistas são permanentes e geram moedas uma única vez', () => {
  const s = fresh();
  E.act(s, (st) => E.logActivity(st, 'leitura'));
  assert.ok(s.achievements.despertar);
  const coins = E.derive(s).coins;
  E.act(s, (st) => E.removeEntry(st, st.log.find((e) => e.kind === 'activity').id));
  assert.ok(s.achievements.despertar, 'conquista não é removida');
  E.evaluateAchievements(s);
  assert.equal(s.log.filter((e) => e.key === 'ach:despertar').length, 1);
  assert.ok(E.derive(s).coins < coins);
});

test('missão principal: marcos reconciliam com o progresso', () => {
  const s = fresh();
  const m = E.saveMission(s, { type: 'main', title: 'Curso', activity: 'estudo', xp: 300, progress: { current: 0, target: 4, unit: 'aulas' } });
  E.setMainProgress(s, m.id, 2); // 50% -> marcos 25 e 50
  assert.equal(E.derive(s).totalXp, 60);
  E.setMainProgress(s, m.id, 1); // volta para 25%
  assert.equal(E.derive(s).totalXp, 30);
  E.setMainProgress(s, m.id, 4); // conclui
  assert.equal(E.derive(s).totalXp, 300);
  assert.equal(m.status, 'completed');
});

test('boss exige todas as etapas e não duplica XP de etapa', () => {
  const s = fresh();
  const m = E.saveMission(s, { type: 'boss', title: 'Projeto', activity: 'programacao', xp: 500, stages: [{ title: 'A' }, { title: 'B' }] });
  assert.throws(() => E.completeMission(s, m.id), /etapas/);
  E.toggleBossStage(s, m.id, m.stages[0].id);
  E.toggleBossStage(s, m.id, m.stages[0].id);
  E.toggleBossStage(s, m.id, m.stages[0].id);
  E.toggleBossStage(s, m.id, m.stages[1].id);
  E.completeMission(s, m.id);
  assert.equal(E.derive(s).totalXp, 500);
});

test('missão semanal pode ser concluída uma vez por semana', () => {
  const s = fresh();
  const m = E.saveMission(s, { type: 'weekly', title: 'Revisão', activity: 'planejamento' });
  E.completeMission(s, m.id);
  assert.throws(() => E.completeMission(s, m.id), /já concluída/);
  assert.equal(s.log[0].key, `m:${m.id}:${weekKey(E.todayKey(s))}`);
});

test('loja: saldo, limite semanal e devolução', () => {
  const s = fresh();
  s.log.push({ id: 'x', key: 'adj', kind: 'adjust', date: E.todayKey(s), xp: 0, coins: 500, attrs: {}, ts: now });
  const it = E.buyReward(s, 'rw-jogo');
  assert.throws(() => E.buyReward(s, 'rw-jogo'), /Limite semanal/);
  assert.equal(E.derive(s).coins, 350);
  E.refundItem(s, it.id);
  assert.equal(E.derive(s).coins, 500);
});

test('importação passa pela fila de confirmação e não duplica', () => {
  const s = fresh();
  const items = [{ source: 'ics', externalId: 'evt1', date: E.todayKey(s), activity: 'cardio', title: 'Corrida' }];
  assert.equal(E.addPending(s, items), 1);
  assert.equal(E.addPending(s, items), 0);
  assert.equal(E.derive(s).totalXp, 0, 'nada pontua sem confirmação');
  E.confirmPending(s, s.pending[0].id);
  assert.equal(E.derive(s).totalXp, 35);
  assert.equal(E.addPending(s, items), 0);
});

test('classe nasce dos atributos desenvolvidos', () => {
  const pts = (o) => ({ STR: 0, END: 0, INT: 0, WIS: 0, DISC: 0, CHA: 0, VIT: 0, ...o });
  const lv = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.floor(Math.sqrt(v / 8)) + 1]));
  assert.equal(archetypeFor(pts({ INT: 20 }), lv(pts({ INT: 20 }))), null, 'sem classe antes do nível 3');
  assert.equal(archetypeFor(pts({ INT: 100 }), lv(pts({ INT: 100 }))).name, 'Arcanista');
  assert.equal(archetypeFor(pts({ INT: 100, WIS: 80 }), lv(pts({ INT: 100, WIS: 80 }))).name, 'Sábio');
  assert.equal(archetypeFor(pts({ WIS: 80, INT: 100 }), lv(pts({ WIS: 80, INT: 100 }))).name, 'Sábio', 'ordem não importa');
  const bal = pts({ STR: 200, END: 190, INT: 180, WIS: 170, DISC: 200, CHA: 160, VIT: 175 });
  assert.equal(archetypeFor(bal, lv(bal)).name, 'Harmonista');
  const c = classFor(25, pts({ STR: 300 }), lv(pts({ STR: 300 })));
  assert.equal(c.label, 'Guerreiro · Elite');
});

test('modo Difícil torna os níveis bem mais lentos', () => {
  const casual = totalXpForLevel(45, DIFFICULTY.casual);
  const dificil = totalXpForLevel(45, DIFFICULTY.dificil);
  const monarca = totalXpForLevel(45, DIFFICULTY.monarca);
  assert.ok(dificil > casual * 2 && monarca > dificil * 1.8, `${casual} < ${dificil} < ${monarca}`);
  const days = dificil / 250;
  assert.ok(days > 1500 && days < 2200, `Difícil: nível 45 em ${Math.round(days)} dias a 250 XP/dia`);
});

test('personalização gera plano a partir da vida contada', () => {
  const story = 'Sou dev, trabalho com software, quero voltar pra academia e melhorar meu inglês. Tenho dívidas e durmo mal.';
  const h = storyHints(story);
  assert.equal(h.focus.STR, 'musculação');
  assert.ok(h.finance);
  const plan = buildPlan({
    name: 'Ian', occupation: 'trabalho', wake: '06:30', sleep: '23:00', dailyMinutes: 60, trainingDays: [1, 3, 5], story,
    priorities: { STR: 'alta', INT: 'alta', VIT: 'alta', CHA: 'baixa' }, focus: { INT: 'inglês', STR: 'musculação' },
    goals: [{ title: 'Ser fluente em inglês', area: 'INT', months: 12 }, { title: 'Quitar dívidas', area: 'WIS', months: 8 }],
    limitations: 'dor no joelho', rewards: ['jogo', 'livro'], difficulty: 'monarca',
  }, '2026-10-19');
  assert.ok(plan.activities.some((a) => a.name === 'Inglês' && a.attrs.INT === 3));
  const titles = plan.missions.map((m) => m.title);
  assert.ok(titles.includes('Estudo focado: Inglês'));
  assert.ok(titles.includes('Organização financeira da semana'), 'finanças detectadas na história');
  assert.ok(!titles.some((t) => t.startsWith('Conexão')), 'prioridade baixa não gera diária');
  assert.equal(plan.missions.find((m) => m.type === 'boss').title, 'Ser fluente em inglês');
  assert.equal(plan.missions.filter((m) => m.type === 'daily' && m.essential).length, 4);
  assert.match(plan.missions.find((m) => m.title.startsWith('Treino')).description, /joelho/);
  assert.equal(plan.health.sleepGoal, 7.5);
  assert.equal(plan.rules.difficulty, 'monarca');
  assert.deepEqual(plan.rewards.map((r) => r.id), ['rw-jogo', 'rw-livro']);

  const s = fresh(true);
  const m0 = s.missions[0];
  E.completeMission(s, s.missions.find((m) => m.type === 'weekly').id);
  E.applyPersonalization(s, plan);
  assert.equal(s.settings.rules.levelBase, DIFFICULTY.monarca.levelBase);
  assert.ok(!s.missions.includes(m0) && !s.missions.some((m) => m.id === m0.id), 'missões de exemplo sem histórico saem');
  assert.equal(s.missions.filter((m) => m.status === 'archived').length, 1, 'missão com histórico fica pausada');
  assert.ok(E.derive(s).totalXp > 0, 'XP conquistado é mantido');
});

test('perfil vindo do Claude é validado', () => {
  const a = parseClaudeProfile('Aqui está: ```json\n{"ascension_profile":{"name":"Ian","priorities":{"STR":"alta","X":"alta"},"goals":[{"title":"Correr 10 km","area":"END","months":"4"}],"difficulty":"impossivel"}}\n```');
  assert.equal(a.name, 'Ian');
  assert.equal(a.priorities.STR, 'alta');
  assert.equal(a.goals[0].months, 4);
  assert.equal(a.difficulty, 'dificil');
  assert.throws(() => parseClaudeProfile('sem json'), /JSON/);
});

test('migração preenche campos ausentes de backups antigos', () => {
  const s = migrate({ version: 0, profile: { name: 'X' }, log: [] });
  assert.ok(s.settings.rules.levelBase);
  assert.ok(Array.isArray(s.missions));
  assert.ok(s.settings.notifications.daily);
  const old = migrate({ version: 1, profile: { name: 'Ian' }, settings: { rules: { levelBase: 100, levelExponent: 1.25 } }, log: [] });
  assert.equal(old.settings.rules.difficulty, 'dificil', 'curva original vira Difícil');
  assert.equal(old.settings.rules.attrDivisor, 8);
  const custom = migrate({ version: 1, settings: { rules: { levelBase: 150, levelExponent: 1.4 } }, log: [] });
  assert.equal(custom.settings.rules.difficulty, 'custom', 'curva personalizada é respeitada');
  assert.equal(custom.settings.rules.levelBase, 150);
});

import { csvToItems, icsToItems, jsonToItems } from '../src/services/integrations.js';
import { DEFAULT_ACTIVITIES } from '../src/core/defaults.js';
import { readFileSync } from 'node:fs';

test('importadores reconhecem CSV, ICS e JSON', () => {
  const csv = csvToItems(readFileSync('docs/exemplos/atividades.csv', 'utf8'), DEFAULT_ACTIVITIES, 'atividade-fisica');
  assert.deepEqual(csv.items.map((i) => i.activity), ['cardio', 'treino', 'estudo']);
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1\r\nDTSTART:20261017T070000\r\nSUMMARY:Academia\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:x2\r\nDTSTART;VALUE=DATE:20261101\r\nSUMMARY:Prova de cálculo\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const r = icsToItems(ics, DEFAULT_ACTIVITIES, '2026-10-18');
  assert.equal(r.pending[0].activity, 'treino');
  assert.equal(r.future[0].activity, 'estudo');
  const j = jsonToItems(readFileSync('docs/exemplos/central.json', 'utf8'), DEFAULT_ACTIVITIES);
  assert.equal(j.length, 2);
});

import { parseHealthExport, parseHealthPayload, summariesToItems, healthFromHash } from '../src/services/health.js';
import { DEFAULT_HEALTH } from '../src/core/defaults.js';
import { openAsBlob } from 'node:fs';

test('exportação do Saúde (xml e zip): sem contagem dupla, só a janela recente', async () => {
  for (const f of ['export.xml', 'export.zip']) {
    const days = await parseHealthExport(await openAsBlob(`tests/fixtures/${f}`), { today: '2026-10-18', windowDays: 30 });
    const d17 = days.find((d) => d.date === '2026-10-17');
    const d18 = days.find((d) => d.date === '2026-10-18');
    assert.equal(d17.steps, 9200, `${f}: maior fonte do dia, não a soma`);
    assert.equal(d18.sleepHours, 7.5, `${f}: "Na cama" não conta`);
    assert.equal(d18.mindfulMinutes, 10);
    assert.equal(d17.workouts[0].type, 'HKWorkoutActivityTypeRunning');
    assert.ok(!days.some((d) => d.date < '2026-09-18'));
    const items = summariesToItems(days, DEFAULT_HEALTH, DEFAULT_ACTIVITIES);
    const ids = items.map((i) => `${i.date}:${i.activity}`);
    assert.deepEqual(ids.sort(), ['2026-10-16:cardio', '2026-10-17:cardio', '2026-10-17:passos', '2026-10-18:reflexao', '2026-10-18:sono', '2026-10-18:treino']);
  }
});

test('dados do Atalho: unidades flexíveis, link e confirmação automática', () => {
  const days = parseHealthPayload('{"date":"18/10/2026","sleepHours":"450","steps":"9.500","mindfulMinutes":"3"}', '2026-10-18');
  assert.equal(days[0].date, '2026-10-18');
  assert.equal(days[0].sleepHours, 7.5);
  assert.equal(days[0].steps, 9500);
  const json = JSON.stringify({ steps: 12000 });
  assert.equal(healthFromHash(`#/saude?j=${encodeURIComponent(json)}`), json);
  assert.equal(healthFromHash(`#/saude?d=${Buffer.from(json).toString('base64url')}`), json);
  const s = fresh();
  s.settings.health = { ...DEFAULT_HEALTH };
  const items = summariesToItems(parseHealthPayload(json, E.todayKey(s)), s.settings.health, s.settings.activities);
  const r = E.importItems(s, items, { autoConfirm: true });
  assert.deepEqual(r, { added: 1, confirmed: 1, pending: 0 });
  assert.equal(E.importItems(s, items, { autoConfirm: true }).added, 0, 'reimportar não duplica');
});

import { dungeonDef, dungeonStatus, hunterRank } from '../src/core/dungeons.js';

const dgStatus = (s, area, rank) => {
  const d = E.derive(s);
  return dungeonStatus(s, dungeonDef(area, rank), { level: d.level.level, attrLevels: d.attrLevels }, E.clock.now()).status;
};

test('dungeon: requisitos só contam depois de entrar; falha fecha o portão por 48h', () => {
  const s = fresh();
  s.settings.rules.backdateDays = 7;
  const t0 = E.todayKey(s);
  E.logActivity(s, 'estudo', { date: addDays(t0, -3) }); // antes de entrar: não conta
  assert.equal(dgStatus(s, 'INT', 0), 'available');
  assert.equal(dgStatus(s, 'INT', 1), 'locked');
  E.enterDungeon(s, 'INT-E');
  assert.throws(() => E.startBoss(s, 'INT-E'), /requisitos/);
  for (let i = 0; i < 3; i++) { E.logActivity(s, 'estudo'); now += 864e5; }
  assert.equal(dgStatus(s, 'INT', 0), 'ready');
  E.startBoss(s, 'INT-E');
  E.resolveBoss(s, 'INT-E', false);
  assert.equal(dgStatus(s, 'INT', 0), 'cooldown');
  assert.throws(() => E.startBoss(s, 'INT-E'), /portão/);
  now += 47 * 3600e3;
  assert.equal(dgStatus(s, 'INT', 0), 'cooldown');
  now += 2 * 3600e3;
  assert.equal(dgStatus(s, 'INT', 0), 'ready', 'requisitos mantidos após a espera');
  const xp = E.derive(s).totalXp;
  E.startBoss(s, 'INT-E');
  const { events } = E.act(s, (st) => E.resolveBoss(st, 'INT-E', true));
  assert.equal(E.derive(s).totalXp - xp, 150);
  assert.ok(events.some((e) => e.type === 'achievement' && e.achievement.id === 'dg-1'));
  assert.equal(dgStatus(s, 'INT', 0), 'cleared');
  assert.equal(dgStatus(s, 'INT', 1), 'locked', 'Rank D exige nível 5');
});

test('dungeon: prazo do chefe esgotado conta como derrota', () => {
  const s = fresh();
  s.dungeons['VIT-E'] = { enteredAt: now - 864e5, enteredDate: addDays(E.todayKey(s), -1), attempts: 1, failures: 0,
    bossStartedAt: now - 30 * 3600e3, bossDeadline: now - 6 * 3600e3, cooldownHours: 48 };
  assert.equal(dgStatus(s, 'VIT', 0), 'cooldown');
  assert.deepEqual(E.expireDungeons(s), ['VIT-E']);
  assert.equal(s.dungeons['VIT-E'].failures, 1);
  assert.equal(s.dungeons['VIT-E'].cooldownUntil, now + 42 * 3600e3);
});

test('rank geral exige 4 áreas no rank', () => {
  const s = fresh();
  for (const a of ['STR', 'END', 'INT']) s.dungeons[`${a}-E`] = { clearedAt: now };
  assert.equal(hunterRank(s), -1);
  s.dungeons['VIT-E'] = { clearedAt: now };
  assert.equal(hunterRank(s), 0);
});

test('idiomas: prática registra XP sem criar missões e respeita o limite diário', async () => {
  const { phraseOfDay, languageSummary } = await import('../src/core/languages.js');
  const s = fresh();
  const today = E.todayKey(s);
  const missions = s.missions.length;
  assert.throws(() => E.logLanguage(s, 'espanhol', 'ouvir'), E.RuleError);
  E.toggleLanguage(s, 'espanhol', true);
  const { result } = E.act(s, (st) => E.logLanguage(st, 'espanhol', 'ouvir'));
  assert.equal(result.activity, 'espanhol');
  assert.equal(result.practice, 'ouvir');
  assert.ok(result.xp > 0 && result.attrs.INT > 0 && result.attrs.CHA > 0);
  assert.equal(s.missions.length, missions);
  assert.ok(s.achievements['idioma-1']);
  advance(30);
  E.logLanguage(s, 'espanhol', 'frase');
  advance(30);
  assert.throws(() => E.logLanguage(s, 'espanhol', 'app'), E.RuleError);
  assert.throws(() => E.logLanguage(s, 'frances', 'app'), E.RuleError);
  const sum = languageSummary(s, 'espanhol', today);
  assert.equal(sum.today, 2);
  assert.equal(sum.recentDays, 1);
  assert.equal(sum.minutes, 12);
  assert.notDeepEqual(phraseOfDay('ingles', today), phraseOfDay('ingles', addDays(today, 1)));
});

test('idiomas só aparecem para quem escolhe, e o chinês tem pinyin', async () => {
  const { enabledLanguages, phraseOfDay } = await import('../src/core/languages.js');
  const s = fresh();
  assert.equal(enabledLanguages(s).length, 0);
  assert.ok(!s.settings.activities.some((a) => ['ingles', 'espanhol', 'chines'].includes(a.key)));
  E.toggleLanguage(s, 'chines', true);
  E.toggleLanguage(s, 'chines', true);
  assert.deepEqual(s.profile.languages, ['chines']);
  assert.equal(s.settings.activities.filter((a) => a.key === 'chines').length, 1);
  const p = phraseOfDay('chines', E.todayKey(s));
  assert.ok(p.words.length && p.words.every(([hz, py]) => hz && py));
  assert.equal(p.text, p.words.map((w) => w[0]).join(''));
  E.toggleLanguage(s, 'chines', false);
  assert.deepEqual(s.profile.languages, []);
  assert.deepEqual(migrate(fresh()).profile.languages, []);
});

test('leitura fácil vem desligada e cada pessoa liga a sua', () => {
  const s = fresh();
  assert.equal(s.profile.easyRead, false);
  const old = fresh();
  delete old.profile.easyRead;
  assert.equal(migrate(old).profile.easyRead, false);
  E.updateProfile(s, { easyRead: true });
  assert.equal(migrate(s).profile.easyRead, true);
});

test('personalização entende fase leve, casa, idiomas e leitura fácil', () => {
  const story = 'Estou arrumando a casa e tenho feito muita coisa. Tenho dislexia. Quero treinar inglês e aprender espanhol e chinês, sem muita cobrança.';
  const h = storyHints(story);
  assert.ok(h.home && h.dyslexia && h.light);
  assert.deepEqual(h.languages, ['ingles', 'espanhol', 'chines']);
  const base = { name: 'Ian', story, dailyMinutes: 180, goals: [{ title: 'Organizar a casa', area: 'DISC', months: 1 }],
    priorities: { STR: 'alta', END: 'alta', INT: 'alta', WIS: 'alta', DISC: 'alta', CHA: 'alta', VIT: 'alta' } };
  const leve = buildPlan({ ...base, pace: 'leve', languages: ['ingles', 'chines', 'klingon'], easyRead: true }, '2026-10-14');
  const normal = buildPlan(base, '2026-10-14');
  const essentials = (p) => p.missions.filter((m) => m.type === 'daily' && m.essential).length;
  assert.ok(essentials(leve) <= 2 && essentials(normal) > 2);
  assert.ok(leve.missions.filter((m) => m.type === 'weekly').length < normal.missions.filter((m) => m.type === 'weekly').length);
  assert.ok(leve.missions.some((m) => m.activity === 'domestica' && !m.essential));
  assert.deepEqual(leve.languages, ['ingles', 'chines']);
  const s = fresh();
  E.applyPersonalization(s, leve);
  assert.deepEqual(s.profile.languages, ['ingles', 'chines']);
  assert.equal(s.profile.easyRead, true);
  assert.ok(s.settings.activities.some((a) => a.key === 'chines'));
  E.applyPersonalization(s, normal, { replace: true });
  assert.deepEqual(s.profile.languages, []);
});

/* ---------------- Fases e "Como foi seu dia?" ---------------- */

test('fase de cirurgia pausa treino e cardio, não pausa estudo; essentialsFor exclui a pausada', () => {
  const s = fresh();
  const treino = daily(s, { title: 'Treino', activity: 'treino' });
  const estudo = daily(s);
  const today = E.todayKey(s);
  assert.equal(essentialsFor(s, today).length, 2);
  const ph = E.savePhase(s, { type: 'cirurgia', start: today, end: addDays(today, 10) });
  assert.deepEqual(ph.pause, ['STR', 'END']);
  assert.equal(pausingPhase(s, treino, today).id, ph.id);
  assert.equal(pausingPhase(s, estudo, today), null);
  assert.deepEqual(essentialsFor(s, today).map((m) => m.id), [estudo.id]);
  // concluir mesmo pausada é permitido
  assert.equal(E.completeMission(s, treino.id).kind, 'mission');
  // registro livre ignora a missão pausada
  advance(30);
  const free = E.logActivity(s, 'treino');
  assert.equal(free.kind, 'activity');
});

test('fase com protect protege o dia; sem protect não', () => {
  const s = fresh();
  const today = E.todayKey(s);
  E.savePhase(s, { type: 'viagem', start: today, end: addDays(today, 3) });
  E.savePhase(s, { type: 'provas', start: addDays(today, 10), end: null });
  assert.equal(isProtected(s, today), true);
  assert.equal(isProtected(s, addDays(today, 3)), true);
  assert.equal(isProtected(s, addDays(today, 4)), false);
  assert.equal(isProtected(s, addDays(today, 11)), false);
});

test('missões temporárias só aparecem no período e somem após endPhase', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const ph = E.savePhase(s, { type: 'cirurgia', start: addDays(today, -2), end: addDays(today, 5) });
  const temp = s.missions.filter((m) => m.phaseId === ph.id);
  assert.equal(temp.length, 3);
  assert.ok(temp.every((m) => !m.essential && m.type === 'daily' && m.light && m.endDate === addDays(today, 5)));
  assert.equal(isScheduled(temp[0], today), true);
  assert.equal(isScheduled(temp[0], addDays(today, 6)), false);
  E.endPhase(s, ph.id, today);
  assert.equal(ph.end, addDays(today, -1));
  assert.equal(isScheduled(temp[0], today), false);
  assert.equal(isScheduled(temp[0], addDays(today, -1)), true);
  assert.equal(activePhases(s, today).length, 0);
});

test('endPhase em fase futura remove a fase; deletePhase arquiva missões com histórico', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const fut = E.savePhase(s, { type: 'cirurgia', start: addDays(today, 5), end: null });
  assert.equal(s.missions.length, 3);
  E.endPhase(s, fut.id, today);
  assert.equal(s.phases.length, 0);
  assert.equal(s.missions.length, 0);
  const ph = E.savePhase(s, { type: 'cirurgia', start: today, end: null });
  const agua = s.missions.find((m) => m.title.startsWith('Beber água'));
  E.completeMission(s, agua.id);
  const xp = E.derive(s).totalXp;
  E.deletePhase(s, ph.id);
  assert.equal(s.phases.length, 0);
  assert.equal(s.missions.length, 1);
  assert.equal(s.missions[0].status, 'archived');
  assert.equal(E.derive(s).totalXp, xp);
});

test('fase futura não afeta hoje; validações da fase', () => {
  const s = fresh();
  const treino = daily(s, { title: 'Treino', activity: 'treino' });
  const today = E.todayKey(s);
  E.savePhase(s, { type: 'cirurgia', start: addDays(today, 7), end: addDays(today, 20) });
  assert.equal(pausingPhase(s, treino, today), null);
  assert.equal(isPhaseProtected(s, today), false);
  assert.ok(pausingPhase(s, treino, addDays(today, 8)));
  assert.throws(() => E.savePhase(s, { type: 'x', start: today }), /Tipo/);
  assert.throws(() => E.savePhase(s, { type: 'viagem', start: addDays(today, 400) }), /365/);
  assert.throws(() => E.savePhase(s, { type: 'viagem', start: today, end: addDays(today, -1) }), /antes do início/);
  const c = E.savePhase(s, { type: 'custom', title: 'Prova', start: today, pause: ['INT'] });
  assert.deepEqual(c.pause, ['INT']);
  assert.throws(() => E.savePhase(s, { type: 'custom', start: today, pause: ['XX'] }), /inválida/);
  // edição ajusta datas das missões da fase
  const cir = E.savePhase(s, { type: 'cirurgia', start: today, end: null });
  E.savePhase(s, { id: cir.id, end: addDays(today, 4) });
  assert.ok(s.missions.filter((m) => m.phaseId === cir.id).every((m) => m.endDate === addDays(today, 4)));
});

test('bônus diário: essenciais todas pausadas não dão bônus de graça', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const treino = daily(s, { title: 'Treino', activity: 'treino' });
  E.savePhase(s, { type: 'cirurgia', start: today, end: null });
  E.reconcileDailyBonus(s, today);
  assert.equal(E.derive(s).totalXp, 0);
  E.completeMission(s, treino.id);
  assert.equal(E.derive(s).totalXp, 40); // só a missão, sem bônus
});

test('saveDayReview: cansativo marca dia difícil, doente marca doente e não dá XP', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const xp = E.derive(s).totalXp;
  E.saveDayReview(s, today, { mood: 'cansativo', text: 'Dia puxado' });
  assert.equal(s.days[today].status, 'hard');
  assert.equal(s.journal[today].mood, 'cansativo');
  E.saveDayReview(s, today, { mood: 'doente', text: 'piorei' });
  assert.equal(s.days[today].status, 'sick');
  E.setDayStatus(s, today, 'rest');
  E.saveDayReview(s, today, { mood: 'cansativo' });
  assert.equal(s.days[today].status, 'rest');
  assert.equal(E.derive(s).totalXp, xp);
  assert.throws(() => E.saveDayReview(s, addDays(today, 1), { mood: 'bom' }), /futuro/);
  assert.throws(() => E.saveDayReview(s, today, { mood: 'feliz' }), /Humor/);
  assert.equal(E.saveDayReview(s, today, { text: 'x'.repeat(2000) }).text.length, 1000);
});

test('suggestFromText sugere a missão ou a atividade certa, sem duplicar', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const casa = daily(s, { title: 'Arrumar a casa', activity: 'domestica', essential: false });
  const r = suggestFromText(s, 'Hoje lavei a louça e arrumei o quarto, depois caminhei no parque. Li um pouco.', today);
  assert.deepEqual(r.filter((x) => x.kind === 'mission').map((x) => x.missionId), [casa.id]);
  assert.equal(r.filter((x) => x.activity === 'domestica').length, 1);
  assert.ok(r.some((x) => x.kind === 'activity' && x.activity === 'cardio'));
  assert.ok(r.some((x) => x.activity === 'leitura'));
  assert.equal(suggestFromText(s, 'livro livro', today).length, 1);
  assert.equal(suggestFromText(s, 'linha de ônibus', today).length, 0);
  // nada pontua e missão concluída deixa de ser sugerida
  E.completeMission(s, casa.id);
  assert.ok(suggestFromText(s, 'lavei a louça', today).every((x) => x.kind === 'activity'));
  // atividade personalizada pelo nome
  s.settings.activities.push({ key: 'canal', name: 'Pesquisa e roteiro do canal', icon: '🎬', xp: 20, attrs: { INT: 2 }, dailyLimit: 2 });
  assert.equal(suggestFromText(s, 'fiz o roteiro do vídeo', today)[0].activity, 'canal');
});

test('migração preenche phases e journal em backup antigo', () => {
  const old = migrate({ version: 1, profile: { name: 'Ian' }, log: [] });
  assert.deepEqual(old.phases, []);
  assert.deepEqual(old.journal, {});
  assert.deepEqual(createInitialState({ today: '2026-10-14' }).phases, []);
});

test('fase nunca tira bônus diário já ganho (criar ou encerrar no mesmo dia)', () => {
  const s = fresh();
  const treino = daily(s, { title: 'Treino', activity: 'treino' });
  const today = E.todayKey(s);
  E.completeMission(s, treino.id);
  const xp = () => s.log.reduce((a, e) => a + e.xp, 0);
  const before = xp();
  assert.ok(s.log.some((e) => e.kind === 'bonus'));
  const ph = E.savePhase(s, { type: 'cirurgia', start: addDays(today, -2), end: null });
  assert.equal(xp(), before);
  E.endPhase(s, ph.id);
  assert.equal(xp(), before);
  // desfazer a missão continua removendo o bônus (R3)
  E.undoMission(s, treino.id);
  assert.ok(!s.log.some((e) => e.kind === 'bonus'));
});

test('fase: início a 91 dias atrás é rejeitado, a 90 é aceito', () => {
  const s = fresh();
  const today = E.todayKey(s);
  assert.throws(() => E.savePhase(s, { type: 'cirurgia', start: addDays(today, -91) }), /90 dias/);
  const ph = E.savePhase(s, { type: 'cirurgia', start: addDays(today, -90) });
  assert.equal(ph.start, addDays(today, -90));
  // editar sem mudar o início continua permitido mesmo depois de o prazo passar
  assert.ok(E.savePhase(s, { id: ph.id, title: 'Outro nome' }, addDays(today, 5)));
});

test('excluir fase com missão concluída arquiva com endDate = ontem e não reaparece', () => {
  const s = fresh();
  const today = E.todayKey(s);
  const ph = E.savePhase(s, { type: 'cirurgia', start: addDays(today, -2), end: null });
  const m = s.missions.find((x) => x.phaseId === ph.id);
  E.completeMission(s, m.id);
  const xp = () => s.log.reduce((a, e) => a + e.xp, 0);
  const before = xp();
  const entries = s.log.length;
  E.deletePhase(s, ph.id);
  const arq = s.missions.find((x) => x.id === m.id);
  assert.equal(arq.status, 'archived');
  assert.equal(arq.endDate, addDays(today, -1));
  assert.equal(xp(), before);
  assert.equal(s.log.length, entries);
  arq.status = 'active';
  assert.equal(isScheduled(arq, today), false);
});

test('suggestFromText ignora negação e não repete área já registrada no dia', () => {
  const s = fresh();
  const today = E.todayKey(s);
  assert.deepEqual(suggestFromText(s, 'não fui à academia, nao treinei', today), []);
  const m = E.saveMission(s, { type: 'daily', title: 'Louça', activity: 'domestica' });
  assert.deepEqual(suggestFromText(s, 'lavei a louça', today).map((x) => x.kind), ['mission']);
  E.completeMission(s, m.id);
  assert.deepEqual(suggestFromText(s, 'lavei a louça', today), []);
});

test('migração descarta fases e diário malformados sem travar', () => {
  const r = migrate({ phases: [null, 'x', {}, { id: 'a', start: 'ontem' }, { id: 'b', start: '2026-10-01', pause: 'STR' }], journal: { '2026-10-01': null, '2026-10-02': 'oi', '2026-10-03': { text: 5 } } });
  assert.deepEqual(r.phases.map((p) => p.id), ['b']);
  assert.deepEqual(r.phases[0].pause, []);
  assert.deepEqual(Object.keys(r.journal), ['2026-10-03']);
  assert.equal(r.journal['2026-10-03'].text, '');
  assert.deepEqual(migrate({ phases: { a: 1 }, journal: [1] }).phases, []);
  assert.equal(activePhases(r, '2026-10-05').length, 1);
});
