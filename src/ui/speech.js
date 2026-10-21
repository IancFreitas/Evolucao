// Leitura em voz alta pelo próprio aparelho (Web Speech API): funciona offline e sem servidor.
// Enquanto fala, destaca a palavra atual, o que ajuda quem tem dislexia a ligar som e escrita.

const VOICE_LANG = { ingles: 'en-US', espanhol: 'es-ES', chines: 'zh-CN', pt: 'pt-BR' };

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  const base = lang.split('-')[0];
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.replace('_', '-').startsWith(base)) || null;
}

/** Fala o texto de `el` (ou `text`) marcando cada palavra com a classe `.speaking`. */
export function speak({ text, lang, slow = false, el = null }) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const words = el ? [...el.querySelectorAll('[data-at]')] : [];
  const clear = () => words.forEach((w) => w.classList.remove('speaking'));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE_LANG[lang] || lang;
  const voice = pickVoice(u.lang);
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.9;
  u.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    clear();
    const w = words.filter((x) => Number(x.dataset.at) <= e.charIndex).pop();
    w?.classList.add('speaking');
  };
  u.onend = clear;
  u.onerror = clear;
  speechSynthesis.speak(u);
}

/** Quebra a frase em palavras com a posição de cada uma, para o destaque durante a fala. */
export function wordSpans(text, esc) {
  let out = '';
  const re = /\S+/g;
  let m;
  let last = 0;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index)) + `<span class="w" data-at="${m.index}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
