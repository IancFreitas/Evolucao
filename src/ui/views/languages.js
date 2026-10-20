import * as E from '../../core/engine.js';
import { LANGUAGES, PRACTICES, languageSummary, phraseOfDay } from '../../core/languages.js';
import { esc } from '../dom.js';
import { ctx, render as rerender, run, ui } from '../app.js';
import { canSpeak, speak, wordSpans } from '../speech.js';

// Pensada para dislexia: um idioma por vez, frase grande com áudio e destaque da palavra falada,
// tradução só quando pedir, práticas com ícone e nome curto, quase nada para ler.

function render(c) {
  const lang = LANGUAGES.find((l) => l.key === ui.tabs.languages) || LANGUAGES[0];
  const act = c.state.settings.activities.find((a) => a.key === lang.key);
  const phrase = phraseOfDay(lang.key, c.today);
  const sum = languageSummary(c.state, lang.key, c.today);
  const full = sum.today >= (act?.dailyLimit ?? 2);
  const showPt = ui.filters.langPt === `${lang.key}:${c.today}`;
  const audio = canSpeak();

  return `<div class="page-head"><div><h1>Idiomas</h1><p class="lead">Sem cobrança. 2 minutos já contam.</p></div></div>

    <div class="lang-switch" role="tablist">${LANGUAGES.map((l) => `<button role="tab" aria-selected="${l.key === lang.key}" class="${l.key === lang.key ? 'active' : ''}" data-action="lang-tab" data-lang="${l.key}">
      <span class="flag">${l.flag}</span>${l.name}</button>`).join('')}</div>

    <div class="panel mt lang-card">
      <div class="lang-label">Frase do dia</div>
      <p class="phrase" id="phrase" lang="${lang.key === 'ingles' ? 'en' : 'es'}">${wordSpans(phrase.text, esc)}</p>
      ${audio ? `<div class="row wrap"><button class="btn primary big" data-action="lang-say" data-lang="${lang.key}">🔊 Ouvir</button>
        <button class="btn big" data-action="lang-say" data-lang="${lang.key}" data-slow="1">🐢 Devagar</button></div>` : ''}
      ${showPt ? `<p class="phrase pt" id="phrase-pt" lang="pt-BR">${wordSpans(phrase.translation, esc)}</p>
          ${audio ? '<button class="btn sm" data-action="lang-say-pt">🔊 Ouvir em português</button>' : ''}`
        : `<button class="btn ghost mt-s" data-action="lang-pt" data-lang="${lang.key}">🇧🇷 Ver em português</button>`}
    </div>

    <div class="panel mt">
      <div class="lang-label">O que você fez? ${full ? '<span class="chip ok">feito por hoje ✓</span>' : sum.today ? '<span class="chip ok">já praticou hoje ✓</span>' : ''}</div>
      ${act ? `<div class="practice-grid">${PRACTICES.map((p) => `<button class="practice ${p.home ? 'home' : ''}" data-action="lang-practice" data-lang="${lang.key}" data-practice="${p.id}" ${full ? 'aria-disabled="true"' : ''}>
          <span class="ic">${p.icon}</span><span class="nm">${esc(p.label)}</span><span class="mn">${p.home ? '🏠 ' : ''}${p.minutes} min</span></button>`).join('')}</div>
        <p class="hint">🏠 = dá para fazer enquanto arruma a casa.</p>`
      : '<p>Esta atividade foi excluída. Recrie em Ajustes → Atividades.</p>'}
    </div>

    ${sum.totalDays ? `<div class="panel mt"><div class="lang-label">Seu caminho</div>
      <div class="lang-stats"><div><b>${sum.recentDays}</b><span>dias no último mês</span></div><div><b>${sum.totalDays}</b><span>dias no total</span></div>${sum.minutes ? `<div><b>${sum.minutes}</b><span>minutos</span></div>` : ''}</div></div>` : ''}`;
}

const actions = {
  'lang-tab': (el) => { ui.tabs.languages = el.dataset.lang; if (canSpeak()) speechSynthesis.cancel(); rerender(); },
  'lang-say': (el) => {
    const p = document.getElementById('phrase');
    speak({ text: p.textContent, lang: el.dataset.lang, slow: !!el.dataset.slow, el: p });
  },
  'lang-pt': (el) => { ui.filters.langPt = `${el.dataset.lang}:${ctx().today}`; rerender(); },
  'lang-say-pt': () => {
    const p = document.getElementById('phrase-pt');
    speak({ text: p.textContent, lang: 'pt', el: p });
  },
  'lang-practice': (el) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    run((s) => E.logLanguage(s, el.dataset.lang, el.dataset.practice), el);
  },
};

export default { id: 'languages', title: 'Idiomas', icon: 'languages', render, actions };
