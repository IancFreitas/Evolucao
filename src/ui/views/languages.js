import * as E from '../../core/engine.js';
import { LANGUAGES, PRACTICES, languageSummary, phraseOfDay } from '../../core/languages.js';
import { esc } from '../dom.js';
import { run } from '../app.js';

function card(c, lang) {
  const act = c.state.settings.activities.find((a) => a.key === lang.key);
  const phrase = phraseOfDay(lang.key, c.today);
  const sum = languageSummary(c.state, lang.key, c.today);
  const limit = act?.dailyLimit ?? 2;
  const full = sum.today >= limit;
  const stats = sum.totalDays
    ? `<span class="chip">${sum.recentDays} dia(s) nos últimos 30</span><span class="chip">${sum.totalDays} no total</span>${sum.minutes ? `<span class="chip">~${sum.minutes} min</span>` : ''}`
    : '<span class="chip">Comece quando quiser</span>';
  return `<div class="panel"><div class="panel-title"><h2>${lang.flag} ${lang.name}</h2>${full ? '<span class="chip ok">feito por hoje ✓</span>' : sum.today ? '<span class="chip ok">praticou hoje</span>' : ''}</div>
    <div class="box"><div class="hud">Frase do dia</div>
      <div style="font-size:19px;font-weight:600;margin:6px 0">${esc(phrase.text)}</div>
      <details><summary class="muted" style="font-size:13px">Ver tradução</summary><div class="mt-s">${esc(phrase.translation)}</div></details></div>
    <div class="chips">${stats}</div>
    ${act ? `<div class="list">${PRACTICES.map((p) => `<button class="mission" style="text-align:left;cursor:pointer" data-action="lang-practice" data-lang="${lang.key}" data-practice="${p.id}" ${full ? 'aria-disabled="true"' : ''}>
        <span style="font-size:22px">${p.icon}</span><div style="min-width:0"><div class="m-title">${esc(p.label)}</div>
        <div class="m-meta"><span>~${p.minutes} min</span>${p.home ? '<span class="chip accent">junto com a casa</span>' : ''}</div></div></button>`).join('')}</div>`
    : '<p class="muted">A atividade deste idioma foi excluída. Recrie-a em Ajustes → Atividades para registrar.</p>'}
  </div>`;
}

function render(c) {
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Idiomas, sem cobrança</div><h1>Idiomas</h1></div></div>
    <div class="panel"><p class="muted" style="margin:0;font-size:14px">Dois minutos já contam. Aqui não há missão obrigatória, prazo nem sequência para quebrar:
      só registre quando praticar. Cada prática vale XP, Inteligência e Carisma (até 2 registros por idioma por dia).
      As práticas marcadas <span class="chip accent">junto com a casa</span> cabem enquanto você arruma tudo.</p></div>
    <div class="grid g2 mt">${LANGUAGES.map((l) => card(c, l)).join('')}</div>`;
}

const actions = {
  'lang-practice': (el) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    run((s) => E.logLanguage(s, el.dataset.lang, el.dataset.practice), el);
  },
};

export default { id: 'languages', title: 'Idiomas', icon: 'languages', render, actions };
