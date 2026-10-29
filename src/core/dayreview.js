// "Como foi seu dia?": humor e sugestões a partir do texto livre. Puro, não pontua nada:
// só sugere; quem confirma (e registra) é a pessoa, pela engine.
import { DEFAULT_ACTIVITIES } from './defaults.js';
import { hasKey } from './ledger.js';
import { completionKey, isPostponed, isScheduled } from './missions.js';

export const MOODS = {
  bom: { icon: '😄', label: 'Bom' },
  normal: { icon: '🙂', label: 'Normal' },
  cansativo: { icon: '😮‍💨', label: 'Cansativo', status: 'hard' },
  doente: { icon: '🤒', label: 'Doente', status: 'sick' },
};

// Palavras-chave (já sem acento) por atividade. Casam no começo da palavra.
const KEYWORDS = {
  domestica: ['louca', 'lavei', 'limpei', 'arrumei', 'faxina', 'varri', 'roupa', 'organizei'],
  estudo: ['estudei', 'aula', 'curso'],
  leitura: ['li', 'livro', 'leitura'],
  treino: ['academia', 'musculacao', 'treinei'],
  cardio: ['corri', 'caminhei', 'caminhada', 'bike', 'pedalei'],
  descanso: ['descansei', 'repouso', 'cochilo'],
  autocuidado: ['remedio', 'banho', 'medit'],
  sono: ['dormi bem', 'dormi cedo'],
  social: ['amigo', 'familia', 'conversei'],
  trabalho: ['trabalhei', 'reuniao'],
  programacao: ['programei', 'codigo'],
  planejamento: ['planejei'],
  financas: ['contas', 'financas'],
  reflexao: ['diario', 'refleti'],
  ingles: ['ingles'],
  espanhol: ['espanhol'],
  chines: ['chines', 'mandarim'],
};
// Palavras curtas que só valem inteiras ("li" não pode casar "livro" por engano, nem "linha").
const BUILTIN = new Set(DEFAULT_ACTIVITIES.map((a) => a.key));
const WHOLE_WORD = new Set(['li']);

const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Negação até 2 palavras antes, sem pontuação no meio: "não fui à academia", "nunca treinei", "sem estudar".
function matches(text, kw) {
  const k = escape(kw) + (WHOLE_WORD.has(kw) ? '($|[^a-z0-9])' : '');
  if (new RegExp(`(^|[^a-z0-9])(nao|nunca|sem)\\s+([a-z0-9]+\\s+){0,2}${k}`).test(text)) return false;
  return new RegExp(`(^|[^a-z0-9])${k}`).test(text);
}

/** Palavras significativas (5+ letras) do nome de uma atividade personalizada. */
const nameWords = (name) => normalize(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 5);

/**
 * Sugere missões ou atividades que combinam com o que a pessoa escreveu.
 * Retorna [{ kind:'mission', missionId, activity, title, icon } | { kind:'activity', activity, title, icon }].
 */
export function suggestFromText(state, text, date) {
  const t = normalize(text);
  if (!t.trim()) return [];
  const acts = state.settings.activities;
  const found = [];
  for (const a of acts) {
    // atividades do padrão usam o mapa; só as personalizadas casam pelo nome
    const kws = KEYWORDS[a.key] || (BUILTIN.has(a.key) ? [] : nameWords(a.name));
    if (kws.some((kw) => matches(t, kw))) found.push(a);
  }
  const out = [];
  const seen = new Set();
  for (const a of found) {
    if (seen.has(a.key)) continue;
    seen.add(a.key);
    // limite diário atingido: não sugere
    const used = state.log.filter(
      (e) => e.activity === a.key && e.date === date && (e.kind === 'activity' || (e.kind === 'mission' && e.missionType === 'daily')),
    ).length;
    if (used >= (a.dailyLimit ?? 3)) continue;
    const m = state.missions.find(
      (x) => x.type === 'daily' && x.activity === a.key && x.status === 'active' && isScheduled(x, date) &&
        !isPostponed(x, date) && !hasKey(state, completionKey(x, date)),
    );
    // sem missão pendente e área já registrada no dia: não sugere de novo (evita marcar duas vezes)
    if (!m && used > 0) continue;
    out.push(m
      ? { kind: 'mission', missionId: m.id, activity: a.key, title: m.title, icon: a.icon }
      : { kind: 'activity', activity: a.key, title: a.name, icon: a.icon });
  }
  return out;
}
