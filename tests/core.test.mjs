import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/core/defaults.js';
import * as E from '../src/core/engine.js';
import { addDays, weekKey } from '../src/core/dates.js';
import { levelFromXp, totalXpForLevel, classIndexFor } from '../src/core/levels.js';
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

test('classes exigem nível e equilíbrio', () => {
  const low = { STR: 1, END: 1, INT: 1, WIS: 1, DISC: 1, CHA: 1, VIT: 1 };
  assert.equal(classIndexFor(4, low), 0);
  assert.equal(classIndexFor(12, low), 1);
  assert.equal(classIndexFor(12, { ...low, INT: 5, DISC: 5 }), 2);
});

test('migração preenche campos ausentes de backups antigos', () => {
  const s = migrate({ version: 0, profile: { name: 'X' }, log: [] });
  assert.ok(s.settings.rules.levelBase);
  assert.ok(Array.isArray(s.missions));
  assert.ok(s.settings.notifications.daily);
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
