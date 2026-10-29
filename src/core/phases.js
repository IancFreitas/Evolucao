// Fases da vida: períodos (cirurgia, viagem, provas...) que pausam áreas, protegem a sequência
// e criam missões leves temporárias. Puro: sem DOM e sem armazenamento.
// Não importa missions.js (que importa este arquivo) para evitar ciclo.

export const PHASE_TYPES = {
  cirurgia: {
    label: 'Cirurgia / recuperação', icon: '🩹',
    desc: 'Pausa treino e cardio, protege a sequência e cria missões leves de cuidado.',
    pause: ['STR', 'END'], protect: true,
    missions: [
      { title: 'Repouso e orientação médica', activity: 'descanso', light: 'Descansar e seguir a orientação médica' },
      { title: 'Remédios no horário', activity: 'autocuidado', light: 'Tomar o remédio no horário' },
      { title: 'Beber água ao longo do dia', activity: 'autocuidado', light: 'Beber um copo de água agora' },
    ],
    note: 'Siga sempre a orientação da sua equipe médica.',
  },
  viagem: {
    label: 'Viagem', icon: '✈️',
    desc: 'Pausa treino e cardio e protege a sequência enquanto você viaja.',
    pause: ['STR', 'END'], protect: true, missions: [], note: '',
  },
  provas: {
    label: 'Semana cheia ou provas', icon: '📚',
    desc: 'Pausa cardio e social para abrir espaço e cria uma revisão curta.',
    pause: ['END', 'CHA'], protect: false,
    missions: [{ title: 'Revisar 25 minutos', activity: 'estudo', light: 'Revisar 10 minutos' }],
    note: '',
  },
  casa: {
    label: 'Arrumar a casa ou mudança', icon: '🏠',
    desc: 'Pausa treino e cardio e cria uma missão leve de arrumação.',
    pause: ['STR', 'END'], protect: false,
    missions: [{ title: 'Arrumar um canto da casa', activity: 'domestica', light: 'Arrumar só uma gaveta' }],
    note: '',
  },
  doenca: {
    label: 'Doença', icon: '🤒',
    desc: 'Pausa a maioria das áreas e protege a sequência até você melhorar.',
    pause: ['STR', 'END', 'INT', 'WIS', 'DISC', 'CHA'], protect: true,
    missions: [{ title: 'Descansar e se hidratar', activity: 'descanso', light: 'Beber água e descansar' }],
    note: '',
  },
  custom: {
    label: 'Personalizada', icon: '✏️',
    desc: 'Você escolhe quais áreas pausar e se a sequência fica protegida.',
    pause: [], protect: false, missions: [], note: '',
  },
};

const list = (state) => (Array.isArray(state.phases) ? state.phases : []);

/** Fases ativas na data: início já chegou e o fim (se houver) ainda não passou. */
export function activePhases(state, date) {
  return list(state).filter((p) => p.start <= date && (!p.end || date <= p.end));
}

/** Atributo principal da atividade da missão (maior valor em attrs); null se não houver. */
export function missionArea(state, m) {
  const act = state.settings.activities.find((a) => a.key === m.activity);
  let best = null;
  let max = -Infinity;
  for (const [k, v] of Object.entries(act?.attrs || {})) if (v > max) { best = k; max = v; }
  return best;
}

/** Fase ativa que pausa a missão (pela área); missões criadas por fase nunca são pausadas. */
export function pausingPhase(state, m, date) {
  if (m.phaseId) return null;
  const area = missionArea(state, m);
  if (!area) return null;
  return activePhases(state, date).find((p) => (p.pause || []).includes(area)) || null;
}

/** Alguma fase ativa protege o dia (como descanso/doença). */
export const isPhaseProtected = (state, date) => activePhases(state, date).some((p) => p.protect);
