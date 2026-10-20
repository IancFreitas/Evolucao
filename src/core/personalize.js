// Personalização: transforma o que a pessoa conta sobre a própria vida em um plano inicial
// (atividades, missões, metas, recompensas e configurações). Função pura e testável.
// Os atributos continuam começando do zero: nada aqui atribui pontos, só define o caminho.
import { addDays } from './dates.js';
import { ATTR_KEYS, uid } from './defaults.js';
import { DIFFICULTY } from './levels.js';
import { LANGUAGE_KEYS } from './languages.js';

export const PRIORITY_WEIGHT = { alta: 3, media: 2, baixa: 1 };
const AREA_ICON = { STR: '🏋️', END: '🏃', INT: '📚', WIS: '🧭', DISC: '🛡️', CHA: '🤝', VIT: '🌿' };
const AREA_ACTIVITY = { STR: 'treino', END: 'cardio', INT: 'estudo', WIS: 'reflexao', DISC: 'planejamento', CHA: 'social', VIT: 'autocuidado' };
const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const REWARD_TEMPLATES = {
  serie: { name: 'Episódio da série favorita', icon: '🎬', cost: 60, maxPerWeek: 4, cooldownDays: 0 },
  jogo: { name: 'Sessão de videogame (1h)', icon: '🎮', cost: 120, maxPerWeek: 3, cooldownDays: 0 },
  cafe: { name: 'Café ou lanche especial', icon: '☕', cost: 80, maxPerWeek: 2, cooldownDays: 0 },
  comida: { name: 'Refeição livre', icon: '🍔', cost: 200, maxPerWeek: 1, cooldownDays: 0 },
  passeio: { name: 'Passeio ou experiência', icon: '🏞️', cost: 300, maxPerWeek: 1, cooldownDays: 0 },
  livro: { name: 'Livro novo', icon: '📘', cost: 500, maxPerWeek: 1, cooldownDays: 30 },
  compra: { name: 'Compra planejada (item da lista)', icon: '🛍️', cost: 1200, maxPerWeek: 1, cooldownDays: 30 },
  descanso: { name: 'Tarde livre sem culpa', icon: '🛌', cost: 250, maxPerWeek: 1, cooldownDays: 0 },
};
export const REWARD_CHOICES = Object.fromEntries(Object.entries(REWARD_TEMPLATES).map(([k, v]) => [k, `${v.icon} ${v.name}`]));

const LIMITATION_WORDS = ['lesão', 'lesao', 'dor', 'joelho', 'coluna', 'lombar', 'hérnia', 'hernia', 'asma', 'cirurgia', 'gravidez', 'grávida', 'gravida', 'fisioterapia', 'cardíac', 'cardiac', 'pressão', 'pressao'];

/* ------------------------- Pistas a partir da história ------------------------- */

// [área, padrão, rótulo] — o primeiro padrão encontrado em cada área vira a sugestão (null = usa o trecho encontrado).
const HINTS = [
  ['STR', /muscula|academia|treino de for[cç]a|crossfit/i, 'musculação'],
  ['STR', /calistenia/i, 'calistenia'],
  ['END', /corrida|correr|maratona/i, 'corrida'],
  ['END', /ciclismo|bike|nata[cç][aã]o|futebol|v[oô]lei|basquete|jiu|muay|luta/i, null],
  ['INT', /ingl[eê]s|espanhol|franc[eê]s|alem[aã]o|japon[eê]s|italiano/i, null],
  ['INT', /programa|c[oó]digo|desenvolvedor|software/i, 'programação'],
  ['INT', /faculdade|universidade|gradua[cç][aã]o|vestibular|enem|concurso/i, 'estudos'],
  ['WIS', /ansiedade|ansioso|ansiosa/i, 'lidar com a ansiedade'],
  ['WIS', /terapia|medita|autoconhecimento/i, 'autoconhecimento'],
  ['WIS', /d[ií]vida|finan|dinheiro|investi/i, 'organizar as finanças'],
  ['DISC', /procrastin/i, 'parar de procrastinar'],
  ['DISC', /acordar cedo|rotina|disciplina|foco/i, 'manter a rotina'],
  ['CHA', /t[ií]mid/i, 'vencer a timidez'],
  ['CHA', /falar em p[uú]blico|apresenta/i, 'falar em público'],
  ['CHA', /amig|fam[ií]lia|namor|networking/i, 'fortalecer relações'],
  ['VIT', /ins[oô]nia|durmo mal|dormir mal|sono/i, 'dormir melhor'],
  ['VIT', /estresse|burnout|cansa/i, 'reduzir o estresse'],
  ['VIT', /alimenta[cç][aã]o|dieta|comer melhor/i, 'alimentação'],
];

/** Sugere focos por área a partir do texto livre (a pessoa revisa antes de confirmar). */
export function storyHints(story = '') {
  const focus = {};
  for (const [area, re, label] of HINTS) {
    const m = re.exec(story);
    if (m && !focus[area]) focus[area] = label || m[0].toLowerCase();
  }
  return {
    focus,
    finance: /dinheiro|d[ií]vida|finan|investi|economizar|sal[aá]rio/i.test(story),
    limitation: LIMITATION_WORDS.some((w) => story.toLowerCase().includes(w)),
    home: /arruma|organizar a casa|casa nova|mudan[cç]a|reforma|faxina|destralh/i.test(story),
    dyslexia: /dislex/i.test(story),
    languages: [['ingles', /ingl[eê]s/i], ['espanhol', /espanhol/i], ['chines', /chin[eê]s|mandarim/i]].filter(([, re]) => re.test(story)).map(([k]) => k),
    light: /sem (muita )?cobran[cç]a|sem press[aã]o|cansad|sobrecarreg|muita coisa/i.test(story),
  };
}

/* ------------------------------ Plano ------------------------------ */

const cap = (s) => String(s || '').trim().replace(/^./, (c) => c.toUpperCase());
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
}

export function sleepGoalFrom(wake, sleep) {
  const w = minutesOf(wake);
  const s = minutesOf(sleep);
  if (w == null || s == null) return 7;
  const hours = ((w - s + 1440) % 1440) / 60;
  return Math.max(6, Math.min(9, Math.round(hours * 4) / 4));
}

/**
 * answers: { name, occupation, wake, sleep, dailyMinutes, trainingDays[], story,
 *            priorities{AREA: alta|media|baixa}, focus{AREA: texto}, goals[{title, area, months}],
 *            limitations, rewards[], difficulty }
 */
export function buildPlan(answers, today) {
  const a = normalizeAnswers(answers);
  const hints = storyHints(`${a.story} ${a.limitations}`);
  const careful = !!a.limitations || hints.limitation;
  const weight = (k) => PRIORITY_WEIGHT[a.priorities[k]] || 2;
  const ranked = [...ATTR_KEYS].sort((x, y) => weight(y) - weight(x));
  const leve = a.pace === 'leve';
  const slots = Math.min(leve ? 2 : 5, a.dailyMinutes <= 20 ? 2 : a.dailyMinutes <= 45 ? 3 : a.dailyMinutes <= 90 ? 4 : 5);
  const essentials = new Set(ranked.filter((k) => weight(k) >= 2).slice(0, slots));
  const train = a.trainingDays.length ? a.trainingDays : [1, 3, 5];

  // Atividades personalizadas a partir dos focos
  const activities = [];
  const activityFor = {};
  for (const k of ATTR_KEYS) {
    const focus = a.focus[k];
    if (!focus || weight(k) < 2) { activityFor[k] = AREA_ACTIVITY[k]; continue; }
    const key = `foco-${slug(focus) || k.toLowerCase()}`;
    const attrs = { [k]: 3, DISC: k === 'DISC' ? 3 : 1 };
    activities.push({ key, name: cap(focus), icon: AREA_ICON[k], xp: 30, attrs, dailyLimit: 2 });
    activityFor[k] = key;
  }

  const note = careful ? `Respeite seus limites${a.limitations ? ` (${a.limitations})` : ''}. Em caso de dúvida, fale com um profissional de saúde.` : '';
  const daily = (k, title, days, light, extra = {}) => ({
    type: 'daily', title, activity: activityFor[k], essential: essentials.has(k), days, light,
    description: ['STR', 'END'].includes(k) ? note : '', startDate: today, ...extra,
  });
  const f = (k, fallback) => (a.focus[k] ? cap(a.focus[k]) : fallback);
  const missions = [];
  const want = (k) => weight(k) >= 2 || essentials.has(k);
  if (want('STR')) missions.push(daily('STR', `Treino de força: ${f('STR', 'sessão completa')}`, train, careful ? 'Mobilidade e alongamento por 15 min' : '15 min de exercícios com o peso do corpo'));
  if (want('END')) {
    const cardioDays = want('STR') ? ALL_DAYS.filter((d) => !train.includes(d) && d !== 0).slice(0, 3) : train;
    missions.push(daily('END', `Cardio: ${f('END', '30 minutos')}`, cardioDays.length ? cardioDays : [2, 4, 6], 'Caminhada leve de 10 min'));
  }
  if (want('INT')) missions.push(daily('INT', `Estudo focado: ${f('INT', 'sessão de 50 min')}`, a.occupation === 'trabalho' ? [1, 2, 3, 4, 5, 6] : WEEKDAYS, 'Revisar anotações por 10 min'));
  // Com leitura fácil (dislexia), ouvir conta como ler e falar conta como escrever.
  const easy = a.easyRead;
  if (weight('INT') >= 3) missions.push({ ...daily('INT', easy ? 'Ouvir ou ler por 20 minutos' : 'Ler por 20 minutos', ALL_DAYS, easy ? 'Ouvir 5 min de audiolivro ou podcast' : 'Ler 5 páginas'), activity: 'leitura', essential: false });
  if (want('WIS')) missions.push(daily('WIS', `Reflexão (10 min)${a.focus.WIS ? `: ${a.focus.WIS}` : ''}`, ALL_DAYS, easy ? 'Gravar 1 min de áudio sobre o dia' : 'Escrever 3 linhas sobre o dia'));
  if (want('DISC')) missions.push(daily('DISC', 'Planejar o dia (5 min)', ALL_DAYS, 'Escolher 1 prioridade do dia'));
  if (want('CHA')) missions.push(daily('CHA', `Social: ${a.focus.CHA || 'conversa de verdade com alguém'}`, [2, 4, 6], 'Mandar uma mensagem para alguém importante'));
  if (want('VIT')) missions.push({ ...daily('VIT', `Dormir até ${a.sleep || '23:00'}`, ALL_DAYS, 'Sem telas 30 min antes de dormir'), activity: 'sono' });
  // Arrumando a casa: conta como progresso, mas nunca como obrigação.
  if (hints.home) {
    missions.push({ ...daily('DISC', 'Arrumar um pouco da casa', ALL_DAYS, 'Organizar uma gaveta ou superfície (5 min)'), activity: 'domestica', essential: false });
  }

  // Semanais
  missions.push({ type: 'weekly', title: 'Revisão semanal e planejamento', activity: 'planejamento', description: 'O que funcionou, o que mudar, prioridades da próxima semana.' });
  if ((hints.finance && !leve) || weight('WIS') >= 3) missions.push({ type: 'weekly', title: 'Organização financeira da semana', activity: 'financas', xp: 80 });
  const weeklyByArea = {
    STR: `Semana completa de treinos (${train.length}x)`, END: 'Bater a meta semanal de cardio', INT: `Concluir um módulo de ${f('INT', 'estudo')}`,
    WIS: 'Uma decisão importante pensada por escrito', DISC: 'Semana sem adiar missões essenciais', CHA: 'Encontro com amigos ou família', VIT: '5 noites de sono adequado',
  };
  if (hints.home) missions.push({ type: 'weekly', title: 'Um cômodo ou canto da casa organizado', activity: 'domestica', xp: 100 });
  for (const k of ranked.filter((x) => weight(x) >= 3 && !leve)) {
    missions.push({ type: 'weekly', title: weeklyByArea[k], activity: activityFor[k], xp: 120 });
  }

  // Metas → missões principais; a primeira vira Boss
  a.goals.forEach((g, i) => {
    const due = addDays(today, Math.round((g.months || 6) * 30));
    const area = ATTR_KEYS.includes(g.area) ? g.area : 'DISC';
    if (i === 0) {
      missions.push({
        type: 'boss', title: g.title, activity: activityFor[area], dueDate: due, xp: 1000, description: 'Sua meta principal, dividida em etapas.',
        stages: ['Definir o plano e o primeiro passo', 'Primeiro marco (25%)', 'Metade do caminho', 'Reta final (75%)', 'Concluir e celebrar'].map((t) => ({ title: t })),
      });
    } else {
      missions.push({ type: 'main', title: g.title, activity: activityFor[area], dueDate: due, xp: 500, progress: { current: 0, target: 10, unit: 'etapas' } });
    }
  });

  const rewards = (a.rewards.length ? a.rewards : ['serie', 'cafe', 'passeio']).filter((k) => REWARD_TEMPLATES[k])
    .map((k) => ({ id: `rw-${k}`, desc: 'Escolhida por você na personalização.', ...REWARD_TEMPLATES[k] }));

  const sleepMin = minutesOf(a.sleep);
  return {
    activities,
    missions: missions.map((m) => ({ id: uid('m-'), ...m })),
    rewards,
    health: { sleepGoal: sleepGoalFrom(a.wake, a.sleep) },
    languages: a.languages,
    easyRead: a.easyRead,
    rules: { difficulty: DIFFICULTY[a.difficulty] ? a.difficulty : 'dificil', dayStartHour: sleepMin != null && sleepMin < 360 ? Math.min(8, Math.floor(sleepMin / 60) + 2) : 4 },
    profile: {
      name: a.name, occupation: a.occupation, story: a.story, limitations: a.limitations, focus: a.focus,
      priorities: a.priorities, goals: a.goals, wake: a.wake, sleep: a.sleep, dailyMinutes: a.dailyMinutes,
      pace: a.pace, languages: a.languages, easyRead: a.easyRead,
    },
  };
}

export function normalizeAnswers(x = {}) {
  const str = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  const priorities = {};
  const focus = {};
  for (const k of ATTR_KEYS) {
    priorities[k] = PRIORITY_WEIGHT[x.priorities?.[k]] ? x.priorities[k] : 'media';
    focus[k] = str(x.focus?.[k], 60);
  }
  return {
    name: str(x.name, 40) || 'Jogador',
    occupation: ['estudante', 'trabalho', 'ambos', 'outro'].includes(x.occupation) ? x.occupation : 'outro',
    wake: /^\d{1,2}:\d{2}$/.test(x.wake || '') ? x.wake : '07:00',
    sleep: /^\d{1,2}:\d{2}$/.test(x.sleep || '') ? x.sleep : '23:00',
    dailyMinutes: Math.max(10, Math.min(480, Number(x.dailyMinutes) || 60)),
    trainingDays: (Array.isArray(x.trainingDays) ? x.trainingDays : []).map(Number).filter((d) => d >= 0 && d <= 6),
    story: str(x.story, 8000),
    priorities,
    focus,
    goals: (Array.isArray(x.goals) ? x.goals : []).filter((g) => g && str(g.title)).slice(0, 5)
      .map((g) => ({ title: str(g.title, 120), area: ATTR_KEYS.includes(g.area) ? g.area : 'DISC', months: Math.max(1, Math.min(60, Number(g.months) || 6)) })),
    limitations: str(x.limitations, 400),
    rewards: (Array.isArray(x.rewards) ? x.rewards : []).filter((k) => REWARD_TEMPLATES[k]),
    difficulty: DIFFICULTY[x.difficulty] ? x.difficulty : 'dificil',
    // Ritmo: "leve" = fase corrida, no máximo 2 missões essenciais e nenhuma semanal extra.
    pace: x.pace === 'leve' ? 'leve' : 'normal',
    languages: (Array.isArray(x.languages) ? x.languages : []).filter((k) => LANGUAGE_KEYS.includes(k)),
    easyRead: x.easyRead === true || x.easyRead === 'true',
  };
}

/** Perfil gerado pelo Claude: aceita o mesmo formato das respostas, dentro de "ascension_profile". */
export function parseClaudeProfile(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Não encontrei um JSON no texto colado.');
  let obj;
  try { obj = JSON.parse(match[0]); } catch { throw new Error('O JSON colado está incompleto. Peça ao Claude para enviar de novo, só o bloco JSON.'); }
  const answers = obj.ascension_profile && typeof obj.ascension_profile === 'object' ? obj.ascension_profile : obj;
  return normalizeAnswers(answers);
}
