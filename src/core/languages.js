// Idiomas sem cobrança: frase do dia e micro-práticas de poucos minutos.
// Nada aqui cria missões, prazos ou sequências: só registra a atividade do idioma quando você pratica.
import { diffDays } from './dates.js';

export const LANGUAGES = [
  { key: 'ingles', name: 'Inglês', flag: '🇺🇸', goal: 'treinar' },
  { key: 'espanhol', name: 'Espanhol', flag: '🇪🇸', goal: 'aprender' },
];

// Frases curtas do dia a dia, várias ligadas à casa e à rotina: dá para usar enquanto arruma tudo.
const PHRASES = {
  ingles: [
    ['I\'m tidying up the living room.', 'Estou arrumando a sala.'],
    ['Where did I put the keys?', 'Onde eu coloquei as chaves?'],
    ['This box goes to the bedroom.', 'Esta caixa vai para o quarto.'],
    ['I need to do the laundry today.', 'Preciso lavar a roupa hoje.'],
    ['Let\'s get rid of what we don\'t use.', 'Vamos nos livrar do que não usamos.'],
    ['The kitchen looks much better now.', 'A cozinha está muito melhor agora.'],
    ['Could you give me a hand?', 'Você pode me dar uma mão?'],
    ['I\'ll take care of it tomorrow.', 'Eu cuido disso amanhã.'],
    ['One step at a time.', 'Um passo de cada vez.'],
    ['I\'m running out of space.', 'Estou ficando sem espaço.'],
    ['It took longer than I expected.', 'Demorou mais do que eu esperava.'],
    ['I\'m proud of what I did today.', 'Tenho orgulho do que fiz hoje.'],
    ['Let me think about it.', 'Deixa eu pensar sobre isso.'],
    ['I\'m looking forward to the weekend.', 'Estou ansioso pelo fim de semana.'],
    ['What are you up to?', 'O que você está fazendo / aprontando?'],
    ['I\'ve been really busy lately.', 'Tenho andado muito ocupado ultimamente.'],
    ['That makes sense.', 'Isso faz sentido.'],
    ['I\'ll figure it out.', 'Eu vou dar um jeito.'],
    ['Let\'s keep it simple.', 'Vamos manter simples.'],
    ['I hung the picture on the wall.', 'Pendurei o quadro na parede.'],
    ['The drawer is stuck.', 'A gaveta está emperrada.'],
    ['I\'m taking a short break.', 'Estou fazendo uma pausa curta.'],
    ['Could you say that again, please?', 'Você pode repetir, por favor?'],
    ['How do you say this in English?', 'Como se diz isso em inglês?'],
    ['I\'m getting the hang of it.', 'Estou pegando o jeito.'],
    ['It\'s not perfect, but it\'s done.', 'Não está perfeito, mas está feito.'],
    ['I\'m going to vacuum the floor.', 'Vou passar o aspirador no chão.'],
    ['Everything has its place now.', 'Agora tudo tem o seu lugar.'],
    ['I feel more at home here.', 'Me sinto mais em casa aqui.'],
    ['Small progress is still progress.', 'Progresso pequeno ainda é progresso.'],
  ],
  espanhol: [
    ['Hola, ¿qué tal?', 'Oi, tudo bem?'],
    ['Estoy ordenando la casa.', 'Estou arrumando a casa.'],
    ['¿Dónde está la escoba?', 'Onde está a vassoura?'],
    ['Necesito lavar los platos.', 'Preciso lavar a louça.'],
    ['La cocina está limpia.', 'A cozinha está limpa.'],
    ['Voy a tender la ropa.', 'Vou estender a roupa.'],
    ['¿Me ayudas, por favor?', 'Você me ajuda, por favor?'],
    ['Poco a poco.', 'Pouco a pouco.'],
    ['Hoy estoy cansado, pero contento.', 'Hoje estou cansado, mas contente.'],
    ['Esta caja va al dormitorio.', 'Esta caixa vai para o quarto.'],
    ['Me gusta cómo quedó.', 'Gosto de como ficou.'],
    ['¿Cómo se dice esto en español?', 'Como se diz isso em espanhol?'],
    ['No entiendo, ¿puedes repetir?', 'Não entendo, pode repetir?'],
    ['Tengo que hacer la compra.', 'Tenho que fazer as compras do mercado.'],
    ['La ventana está abierta.', 'A janela está aberta.'],
    ['Apaga la luz, por favor.', 'Apague a luz, por favor.'],
    ['Ya casi termino.', 'Já estou quase terminando.'],
    ['¡Qué bien!', 'Que bom!'],
    ['Mañana sigo.', 'Amanhã eu continuo.'],
    ['Me llamo… y vivo en Brasil.', 'Eu me chamo… e moro no Brasil.'],
    ['Quiero aprender español.', 'Quero aprender espanhol.'],
    ['El sofá es muy cómodo.', 'O sofá é muito confortável.'],
    ['Voy a barrer el suelo.', 'Vou varrer o chão.'],
    ['Hace calor hoy.', 'Está calor hoje.'],
    ['Tengo hambre.', 'Estou com fome.'],
    ['¿Qué hora es?', 'Que horas são?'],
    ['Estoy aprendiendo, ten paciencia.', 'Estou aprendendo, tenha paciência.'],
    ['Todo tiene su lugar.', 'Tudo tem o seu lugar.'],
    ['¡Buen trabajo!', 'Bom trabalho!'],
    ['Nos vemos luego.', 'A gente se vê depois.'],
  ],
};

/**
 * Micro-práticas de 2 a 10 minutos. As marcadas com `home` combinam com arrumar a casa:
 * você não precisa separar um tempo extra para elas.
 */
export const PRACTICES = [
  { id: 'frase', icon: '🗣️', label: 'Repeti a frase do dia em voz alta', minutes: 2 },
  { id: 'narrar', icon: '🧹', label: 'Narrei o que eu fazia enquanto arrumava a casa', minutes: 5, home: true },
  { id: 'ouvir', icon: '🎧', label: 'Ouvi música ou podcast arrumando a casa', minutes: 10, home: true },
  { id: 'rotular', icon: '🏷️', label: 'Falei o nome de 5 objetos da casa', minutes: 2, home: true },
  { id: 'app', icon: '📱', label: 'Fiz uma lição curta (Duolingo ou similar)', minutes: 5 },
  { id: 'escrever', icon: '✍️', label: 'Escrevi uma frase minha sobre o dia', minutes: 3 },
  { id: 'assistir', icon: '🎬', label: 'Vi um vídeo ou série no idioma', minutes: 10 },
];

export const practiceInfo = (id) => PRACTICES.find((p) => p.id === id);

export function phrases(lang) {
  return PHRASES[lang] || [];
}

/** Frase do dia: muda a cada dia e é igual em qualquer aparelho. Cada idioma anda num passo diferente. */
export function phraseOfDay(lang, date) {
  const list = phrases(lang);
  if (!list.length) return null;
  const offset = lang === 'espanhol' ? 7 : 0;
  const n = diffDays('2026-01-01', date) + offset;
  const [text, translation] = list[((n % list.length) + list.length) % list.length];
  return { text, translation };
}

/** Resumo gentil: só conta o que você fez, nunca o que faltou. */
export function languageSummary(state, lang, today, windowDays = 30) {
  const entries = state.log.filter((e) => e.activity === lang && (e.kind === 'activity' || e.kind === 'mission'));
  const recent = entries.filter((e) => diffDays(e.date, today) < windowDays && e.date <= today);
  const days = new Set(entries.map((e) => e.date));
  return {
    today: entries.filter((e) => e.date === today).length,
    recentDays: new Set(recent.map((e) => e.date)).size,
    totalDays: days.size,
    minutes: entries.reduce((sum, e) => sum + (practiceInfo(e.practice)?.minutes || 0), 0),
  };
}
