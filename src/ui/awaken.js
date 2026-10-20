// "Despertar": entrevista inicial que personaliza o Sistema a partir da vida da pessoa.
import * as E from '../core/engine.js';
import { ATTRIBUTES, createInitialState } from '../core/defaults.js';
import { weekdayName } from '../core/dates.js';
import { DIFFICULTY, totalXpForLevel } from '../core/levels.js';
import { REWARD_CHOICES, buildPlan, parseClaudeProfile, storyHints } from '../core/personalize.js';
import { LANGUAGES } from '../core/languages.js';
import { closeModal, esc, icon, logo, openModal, toast } from './dom.js';
import { navigate, render, run, store } from './app.js';

const STEPS = ['Início', 'Sua história', 'Rotina', 'Áreas da vida', 'Metas', 'Ritmo e recompensas', 'Dificuldade'];
const DRAFT_KEY = 'system-ascension:awaken-draft';

export const wizard = { active: false, step: 0, answers: {}, mode: 'new' };

const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: wizard.step, answers: wizard.answers })); } catch { /* opcional */ } };
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* opcional */ } };

/** Prepara a entrevista (sem desenhar). Rascunhos salvos são retomados de onde pararam. */
export function prepareWizard(mode = 'new') {
  const draft = loadDraft();
  wizard.active = true;
  wizard.mode = mode;
  wizard.step = draft?.step || 0;
  wizard.answers = draft?.answers || (mode === 'existing' ? prefillFromState() : {});
}

export function startWizard(mode = 'new') {
  prepareWizard(mode);
  render();
  window.scrollTo({ top: 0 });
}

function prefillFromState() {
  const s = store.state;
  return { name: s.profile.name, ...(s.profile.life || {}), difficulty: s.settings.rules.difficulty };
}

const FOCUS_EXAMPLES = {
  STR: 'ex.: musculação, calistenia', END: 'ex.: corrida, bike, futebol', INT: 'ex.: inglês, programação, faculdade',
  WIS: 'ex.: diário, terapia, finanças', DISC: 'ex.: acordar cedo, parar de procrastinar', CHA: 'ex.: falar em público, amizades',
  VIT: 'ex.: dormir melhor, alimentação',
};

export const CLAUDE_PROMPT = `Você vai me ajudar a personalizar meu app System Ascension, um RPG de evolução pessoal.
PRIMEIRO use o que você já sabe sobre mim: sua memória e nossas conversas anteriores (se tiver acesso, procure nelas).
Me mostre em poucas linhas curtas o que já sabe. Depois pergunte SÓ o que faltar, com frases curtas e simples,
no máximo duas perguntas por vez, sobre toda a minha vida: rotina, trabalho e estudos, treino e saúde, sono,
relacionamentos, finanças, hábitos que quero criar ou abandonar, sonhos, metas e limitações físicas.
Quando tiver informação suficiente, responda APENAS com um bloco JSON neste formato:
{"ascension_profile":{
 "name":"meu nome","occupation":"estudante|trabalho|ambos|outro","wake":"06:30","sleep":"23:00",
 "dailyMinutes":60,"trainingDays":[1,3,5],
 "story":"resumo da minha vida em até 1500 caracteres",
 "priorities":{"STR":"alta|media|baixa","END":"...","INT":"...","WIS":"...","DISC":"...","CHA":"...","VIT":"..."},
 "focus":{"STR":"o que desenvolver em força","END":"cardio","INT":"estudos","WIS":"reflexão/planejamento","DISC":"hábitos","CHA":"relações","VIT":"sono/autocuidado"},
 "goals":[{"title":"meta grande","area":"INT","months":12}],
 "limitations":"limitações físicas ou de saúde, se houver",
 "rewards":["serie","jogo","cafe","comida","passeio","livro","compra","descanso"],
 "pace":"leve|normal","languages":["ingles","espanhol","chines"],"easyRead":false,
 "difficulty":"casual|dificil|monarca"}}
Áreas: STR força/musculação, END cardio/condicionamento, INT estudos/programação/leitura, WIS reflexão/planejamento/finanças,
DISC hábitos e compromissos, CHA comunicação/relacionamentos, VIT sono/recuperação/autocuidado.
pace "leve" = fase corrida ou cansativa, quero pouca cobrança. languages: só os idiomas que eu quero praticar.
easyRead true se eu tiver dislexia ou preferir letras maiores. Se eu não souber algo, use um valor razoável e me diga.
trainingDays: 0=domingo ... 6=sábado. Até 3 metas, a primeira é a mais importante. Escolha só recompensas que eu mencionar gostar.`;

/* ------------------------------ Passos ------------------------------ */

function stepBody(step, a) {
  switch (step) {
    case 0:
      return `<div class="row">${logo()}<span class="typing">[ SISTEMA ] ${wizard.mode === 'new' ? 'Um novo jogador foi detectado.' : 'Recalibrando o Sistema.'}</span></div>
        <h1>Antes de despertar, o Sistema precisa conhecer você</h1>
        <p class="muted">Você vai contar sobre a sua vida: rotina, estudos, trabalho, corpo, relações, sonhos e limites. Com isso o Sistema cria
        missões, metas, dungeons e recompensas feitas para você. Leva uns 5 minutos. Tudo fica salvo só neste aparelho.</p>
        <label class="field">Nome do personagem<input name="name" required maxlength="40" value="${esc(a.name || '')}" placeholder="Seu nome ou apelido" autocomplete="nickname"></label>`;
    case 1:
      return `<h2 class="wz-h">Conte sua história</h2>
        <p class="muted">Escreva com as suas palavras. Quanto mais você contar, mais personalizado fica.
        🎤 Prefere falar? Toque no microfone do teclado e dite. Algumas ideias:</p>
        <ul class="tl-sub" style="margin-top:0">
          <li>Como é o seu dia hoje, do acordar ao dormir? Estuda, trabalha, os dois?</li>
          <li>Como está o seu corpo: treina, pratica esporte, como anda o sono?</li>
          <li>O que você quer aprender ou construir? Quais são os seus sonhos?</li>
          <li>Como estão amizades, família, relacionamento, finanças?</li>
          <li>O que te atrapalha (procrastinação, ansiedade, falta de tempo)?</li>
        </ul>
        <label class="field">Sua vida<textarea name="story" rows="9" minlength="60" required placeholder="Ex.: Tenho 24 anos, trabalho como dev das 9h às 18h...">${esc(a.story || '')}</textarea></label>
        <div class="notice mt"><b>Prefere conversar?</b> O Claude pode te entrevistar e montar o perfil completo para você colar aqui.
          <div class="row wrap mt-s"><button type="button" class="btn sm" data-action="awaken-copy-prompt">${icon('upload')} Copiar roteiro para o Claude</button>
          <button type="button" class="btn sm ghost" data-action="awaken-paste">Colar perfil do Claude</button></div>
          <div class="tl-sub mt-s">Ao usar o Claude, o que você contar fica na sua conversa com ele. No app, os dados ficam só no aparelho.</div></div>`;
    case 2: {
      const days = a.trainingDays || [1, 3, 5];
      return `<h2 class="wz-h">Sua rotina</h2>
        <div class="form-grid">
          <label class="field">Ocupação<select name="occupation">${[['estudante', 'Estudo'], ['trabalho', 'Trabalho'], ['ambos', 'Estudo e trabalho'], ['outro', 'Outro']].map(([v, l]) => `<option value="${v}" ${a.occupation === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Tempo livre por dia para evoluir<select name="dailyMinutes">${[15, 30, 45, 60, 90, 120, 180].map((m) => `<option value="${m}" ${Number(a.dailyMinutes || 60) === m ? 'selected' : ''}>${m < 60 ? `${m} min` : `${m / 60}h`}</option>`).join('')}</select></label>
          <label class="field">Costumo acordar às<input type="time" name="wake" value="${esc(a.wake || '07:00')}"></label>
          <label class="field">Quero dormir às<input type="time" name="sleep" value="${esc(a.sleep || '23:00')}"></label>
          <div class="field full">Dias em que consigo treinar<div class="days-pick">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="trainingDays[]" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${weekdayName(d)}</span></label>`).join('')}</div></div>
        </div>`;
    }
    case 3: {
      const hints = storyHints(a.story || '');
      return `<h2 class="wz-h">Áreas da sua vida</h2>
        <p class="muted">Defina a prioridade de cada área agora e o que você quer desenvolver nela. ${Object.keys(hints.focus).length ? 'Sugestões tiradas da sua história já estão preenchidas.' : ''}
        Seus atributos começam do zero de qualquer forma: só sobem com o que você fizer.</p>
        <div class="stack">${ATTRIBUTES.map((t) => {
          const prio = a.priorities?.[t.key] || (hints.focus[t.key] ? 'alta' : 'media');
          const focus = a.focus?.[t.key] ?? hints.focus[t.key] ?? '';
          return `<div class="wz-area" style="--c:${t.color}"><div><b style="color:var(--c)">${t.key}</b> ${esc(t.name)}<div class="tl-sub">${esc(t.desc)}</div></div>
            <div class="form-grid"><label class="field">Prioridade<select name="prio_${t.key}">${[['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']].map(([v, l]) => `<option value="${v}" ${prio === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field">O que desenvolver<input name="focus_${t.key}" maxlength="60" value="${esc(focus)}" placeholder="${esc(FOCUS_EXAMPLES[t.key])}"></label></div></div>`;
        }).join('')}</div>`;
    }
    case 4: {
      const goals = a.goals || [];
      return `<h2 class="wz-h">Suas metas</h2>
        <p class="muted">Até 3 metas grandes. A primeira vira o seu <b>Boss</b> principal; as outras, missões principais com progresso.</p>
        <div class="stack">${[0, 1, 2].map((i) => `<div class="form-grid wz-goal">
          <label class="field full">Meta ${i + 1}${i === 0 ? ' (a mais importante)' : ''}<input name="goal_title_${i}" maxlength="120" value="${esc(goals[i]?.title || '')}" placeholder="${['Ex.: Ser fluente em inglês', 'Ex.: Correr 10 km', 'Ex.: Quitar minhas dívidas'][i]}" ${i === 0 ? 'required' : ''}></label>
          <label class="field">Área<select name="goal_area_${i}">${ATTRIBUTES.map((t) => `<option value="${t.key}" ${goals[i]?.area === t.key ? 'selected' : ''}>${t.key} · ${esc(t.name)}</option>`).join('')}</select></label>
          <label class="field">Prazo<select name="goal_months_${i}">${[1, 3, 6, 12, 24, 36].map((m) => `<option value="${m}" ${Number(goals[i]?.months || 6) === m ? 'selected' : ''}>${m < 12 ? `${m} mês(es)` : `${m / 12} ano(s)`}</option>`).join('')}</select></label></div>`).join('')}</div>`;
    }
    case 5: {
      const hints = storyHints(a.story || '');
      const pace = a.pace || (hints.light || hints.home ? 'leve' : 'normal');
      const langs = a.languages || hints.languages;
      const easy = a.easyRead ?? hints.dyslexia;
      return `<h2 class="wz-h">Ritmo e recompensas</h2>
        <div class="field">Como está a sua fase agora?<div class="day-status">${[['leve', '🌱 Leve, sem cobrança', 'Muita coisa acontecendo. No máximo 2 missões essenciais por dia.'], ['normal', '⚔️ Normal', 'Tenho tempo e energia para uma rotina completa.']].map(([v, l, d]) => `<label class="ds" style="cursor:pointer"><input type="radio" name="pace" value="${v}" ${pace === v ? 'checked' : ''} class="sr"><b>${l}</b><small>${d}</small></label>`).join('')}</div></div>
        <div class="field mt">Idiomas que quero praticar (opcional)<div class="chips">${LANGUAGES.map((l) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="languages[]" value="${l.key}" ${langs.includes(l.key) ? 'checked' : ''}> ${l.flag} ${l.name}</label>`).join('')}</div></div>
        <label class="check"><input type="checkbox" name="easyRead" value="true" ${easy ? 'checked' : ''}> 📖 Leitura fácil (dislexia): letras maiores e mais espaçadas</label>
        <label class="field mt">Limitações físicas ou de saúde (opcional)
        <textarea name="limitations" rows="3" maxlength="400" placeholder="Ex.: dor no joelho, asma. As missões físicas vão sugerir versões mais seguras.">${esc(a.limitations || '')}</textarea></label>
        <div class="tl-sub">O Sistema não substitui orientação profissional: em caso de dúvida, procure um profissional de saúde.</div>
        <div class="field mt">O que te motiva como recompensa?<div class="chips">${Object.entries(REWARD_CHOICES).map(([k, l]) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="rewards[]" value="${k}" ${(a.rewards || ['serie', 'cafe', 'passeio']).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>`;
    }
    case 6: {
      const plan = buildPlan(a, E.todayKey(store.state || { settings: { rules: { dayStartHour: 4 } } }));
      const dailies = plan.missions.filter((m) => m.type === 'daily');
      const boss = plan.missions.find((m) => m.type === 'boss');
      const diff = a.difficulty || 'dificil';
      return `<h2 class="wz-h">Escolha a dificuldade</h2>
        <div class="day-status">${Object.entries(DIFFICULTY).map(([k, d]) => `<label class="ds" style="cursor:pointer"><input type="radio" name="difficulty" value="${k}" ${diff === k ? 'checked' : ''} class="sr">
          <b>${esc(d.name)}${k === 'dificil' ? ' (recomendado)' : ''}</b><small>${esc(d.desc)}<br>Nível 45 em ~${(totalXpForLevel(45, d) / 250 / 365).toFixed(1).replace('.', ',')} anos de rotina constante</small></label>`).join('')}</div>
        <div class="panel flat mt" style="box-shadow:none;border:1px solid var(--line)">
          <div class="hud">O Sistema vai criar para você</div>
          <p style="margin:6px 0"><b>${dailies.length}</b> missões diárias (${dailies.filter((m) => m.essential).length} essenciais), <b>${plan.missions.filter((m) => m.type === 'weekly').length}</b> semanais,
          <b>${plan.missions.filter((m) => m.type === 'main').length}</b> principais${boss ? ', <b>1 Boss</b>' : ''}, <b>${plan.activities.length}</b> atividades sob medida e <b>${plan.rewards.length}</b> recompensas.</p>
          <ul class="tl-sub" style="margin:0">${dailies.map((m) => `<li>${m.essential ? '★ ' : ''}${esc(m.title)}</li>`).join('')}${boss ? `<li>🐉 Boss: ${esc(boss.title)}</li>` : ''}</ul>
          <div class="tl-sub mt-s">Meta de sono: ${String(plan.health.sleepGoal).replace('.', ',')}h. Tudo pode ser editado depois.</div>
        </div>
        ${wizard.mode === 'existing' ? `<label class="check mt"><input type="checkbox" name="replace" checked> Substituir minhas missões atuais (o XP e o histórico são mantidos; missões com histórico ficam pausadas)</label>` : ''}`;
    }
    default:
      return '';
  }
}

export function renderWizard() {
  const a = wizard.answers;
  const last = wizard.step === STEPS.length - 1;
  return `<div class="onboard"><form class="panel wizard" data-form="awaken-step" novalidate>
    <div class="row between"><span class="hud">Despertar · ${wizard.step + 1}/${STEPS.length} · ${STEPS[wizard.step]}</span>
      ${wizard.mode === 'existing' ? `<button type="button" class="btn sm ghost" data-action="awaken-cancel">Cancelar</button>` : ''}</div>
    <div class="bar thin mt-s"><i style="--w:${((wizard.step + 1) / STEPS.length) * 100}%"></i></div>
    <div class="stack mt">${stepBody(wizard.step, a)}</div>
    <div class="row between mt">
      ${wizard.step > 0 ? `<button type="button" class="btn ghost" data-action="awaken-back">Voltar</button>` : (wizard.mode === 'new' ? `<button type="button" class="btn ghost" data-action="onboard-import">${icon('upload')} Restaurar backup</button>` : '<span></span>')}
      <button class="btn primary">${last ? `${icon('sword')} Despertar` : 'Continuar'}</button>
    </div></form></div>`;
}

/* ------------------------------ Eventos ------------------------------ */

function collect(step, data) {
  const a = wizard.answers;
  if (step === 0) a.name = data.name;
  if (step === 1) a.story = data.story;
  if (step === 2) Object.assign(a, { occupation: data.occupation, dailyMinutes: Number(data.dailyMinutes), wake: data.wake, sleep: data.sleep, trainingDays: (data.trainingDays || []).map(Number) });
  if (step === 3) {
    a.priorities = Object.fromEntries(ATTRIBUTES.map((t) => [t.key, data[`prio_${t.key}`]]));
    a.focus = Object.fromEntries(ATTRIBUTES.map((t) => [t.key, data[`focus_${t.key}`] || '']));
  }
  if (step === 4) a.goals = [0, 1, 2].map((i) => ({ title: data[`goal_title_${i}`], area: data[`goal_area_${i}`], months: Number(data[`goal_months_${i}`]) })).filter((g) => g.title?.trim());
  if (step === 5) Object.assign(a, { limitations: data.limitations, rewards: data.rewards || [], pace: data.pace || 'normal', languages: data.languages || [], easyRead: data.easyRead === 'true' });
  if (step === 6) a.difficulty = data.difficulty;
}

function validate(step) {
  const a = wizard.answers;
  if (step === 0 && !a.name?.trim()) return 'Diga como o Sistema deve te chamar.';
  if (step === 1 && (a.story || '').trim().length < 60) return 'Conte um pouco mais sobre a sua vida (pelo menos algumas frases). É isso que personaliza o Sistema.';
  if (step === 4 && !a.goals?.length) return 'Defina pelo menos uma meta: ela será o seu primeiro Boss.';
  return null;
}

function finish() {
  const today = E.todayKey(store.state || { settings: { rules: { dayStartHour: 4 } } });
  const plan = buildPlan(wizard.answers, today);
  const replace = wizard.mode === 'new' || wizard.replace !== false;
  if (wizard.mode === 'new') store.set(createInitialState({ name: plan.profile.name, withExamples: false, today }));
  const res = run((s) => E.applyPersonalization(s, plan, { replace }), null, { quiet: true });
  if (!res) return;
  wizard.active = false;
  clearDraft();
  navigate('status');
  toast(`[ SISTEMA ] Despertar concluído. ${res.missions} missões criadas para a sua vida. Boa jornada, ${esc(plan.profile.name)}.`, 'gold', 6000);
}

export const awakenActions = {
  'awaken-start': () => startWizard('existing'),
  'awaken-back': () => { wizard.step = Math.max(0, wizard.step - 1); saveDraft(); render(); window.scrollTo({ top: 0 }); },
  'awaken-cancel': () => { wizard.active = false; render(); },
  'awaken-copy-prompt': async () => {
    try { await navigator.clipboard.writeText(CLAUDE_PROMPT); toast('Roteiro copiado. Cole numa conversa nova com o Claude, responda as perguntas e traga o JSON de volta.', '', 6000); } catch {
      openModal('Roteiro para o Claude', `<textarea rows="12" readonly style="font-size:12px">${esc(CLAUDE_PROMPT)}</textarea><p class="tl-sub">Selecione e copie o texto acima.</p>`);
    }
  },
  'awaken-paste': async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* sem permissão */ }
    if (text.includes('ascension_profile')) { applyClaude(text); return; }
    openModal('Colar perfil do Claude', `<form data-form="awaken-claude"><label class="field">JSON gerado pelo Claude<textarea name="json" rows="8" placeholder='{"ascension_profile":{...}}'></textarea></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">Usar perfil</button></div></form>`);
  },
};

function applyClaude(text) {
  try {
    const profile = parseClaudeProfile(text);
    wizard.answers = { ...wizard.answers, ...profile, name: wizard.answers.name || profile.name };
    wizard.step = STEPS.length - 1;
    closeModal();
    saveDraft();
    render();
    toast('Perfil do Claude carregado. Revise e escolha a dificuldade.', 'gold');
  } catch (err) { toast(esc(err.message), 'err', 5000); }
}

export const awakenForms = {
  'awaken-step': (data) => {
    collect(wizard.step, data);
    if (wizard.step === STEPS.length - 1) wizard.replace = wizard.mode === 'existing' ? !!data.replace : true;
    const err = validate(wizard.step);
    if (err) { toast(esc(err), 'err', 4500); return; }
    saveDraft();
    if (wizard.step === STEPS.length - 1) { finish(); return; }
    wizard.step++;
    saveDraft();
    render();
    window.scrollTo({ top: 0 });
  },
  'awaken-claude': (data) => applyClaude(data.json),
};
