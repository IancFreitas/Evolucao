import * as E from '../../core/engine.js';
import { ACHIEVEMENTS, RARITY, achievementProgress } from '../../core/achievements.js';
import { BALANCED_CLASS, CLASS_MIN_ATTR_LEVEL, PAIR_CLASSES, SINGLE_CLASSES, TIERS } from '../../core/levels.js';
import { ATTR_KEYS, attrInfo } from '../../core/defaults.js';
import { dayKey, formatDay } from '../../core/dates.js';
import { esc, fmt } from '../dom.js';
import { run, ui } from '../app.js';

const FILTERS = { all: 'Todas', unlocked: 'Desbloqueadas', locked: 'Bloqueadas' };

function classesPanel(c) {
  const { cls, attrPoints } = c.d;
  const sorted = [...ATTR_KEYS].sort((x, y) => attrPoints[y] - attrPoints[x]);
  const [a1, a2] = sorted;
  const pairName = PAIR_CLASSES[`${a1}+${a2}`]?.name;
  const near = cls.archetype
    ? (cls.archetype.attrs.length === 1
      ? `Se ${attrInfo(a2).name} chegar a 70% de ${attrInfo(a1).name}, você vira <b>${esc(pairName)}</b>.`
      : `Se ${attrInfo(a1).name} se distanciar de ${attrInfo(a2).name}, você volta a ser <b>${esc(SINGLE_CLASSES[a1].name)}</b>. Equilibrando tudo: <b>${BALANCED_CLASS.name}</b>.`)
    : `Desenvolva um atributo até o nível ${CLASS_MIN_ATTR_LEVEL} para despertar sua classe.${attrPoints[a1] > 0 ? ` Hoje você está a caminho de <b>${esc(SINGLE_CLASSES[a1].name)}</b>.` : ''}`;
  return `<div class="panel"><div class="panel-title"><h2>Classe</h2><span class="chip accent">${esc(cls.label)}</span></div>
    <p style="margin:0">${cls.archetype ? `<b>${esc(cls.name)}</b>: ${esc(cls.archetype.desc)}` : '<b>Sem classe ainda.</b>'}</p>
    <p class="tl-sub">Sua classe nasce dos atributos que você mais desenvolve e muda junto com eles. ${near}</p>
    <div class="hud mt">Graus (pelo nível)</div>
    <div class="class-track">${TIERS.map((t, i) => `<div class="class-node ${i <= cls.tierIndex ? 'reached' : ''} ${i === cls.tierIndex ? 'current' : ''}"
      data-tip="${esc(t.perkText.join(' · '))}"><span class="hud">Nv ${t.minLevel}</span><b>${esc(t.name)}</b></div>`).join('')}</div>
    <details class="box mt"><summary>Todas as classes possíveis</summary>
      <div class="chips mt-s">${Object.entries(SINGLE_CLASSES).map(([k, v]) => `<span class="chip" data-tip="${esc(v.desc)}">${k} · ${esc(v.name)}</span>`).join('')}</div>
      <div class="chips">${[...new Set(Object.entries(PAIR_CLASSES).map(([k, v]) => `${k.split('+').sort().join('+')}|${v.name}|${v.desc}`))].map((x) => { const [k, n, d] = x.split('|'); return `<span class="chip" data-tip="${esc(d)}">${k} · ${esc(n)}</span>`; }).join('')}
      <span class="chip gold" data-tip="${esc(BALANCED_CLASS.desc)}">Tudo · ${BALANCED_CLASS.name}</span></div></details>
    <div class="hud mt">Benefícios ativos</div>
    <div class="chips">${TIERS.slice(0, cls.tierIndex + 1).flatMap((t) => t.perkText).map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>`;
}

function titlesPanel(c) {
  const titles = E.unlockedTitles(c.state);
  const active = c.state.profile.activeTitle;
  return `<div class="panel"><div class="panel-title"><h2>Títulos</h2><span class="muted" style="font-size:13px">${titles.length} desbloqueado(s)</span></div>
    <div class="chips">
      <button class="chip ${!active ? 'accent' : ''}" data-action="set-title" data-title="" style="cursor:pointer">Desperto (padrão)</button>
      ${titles.map((t) => `<button class="chip ${t === active ? 'accent' : ''}" data-action="set-title" data-title="${esc(t)}" style="cursor:pointer">« ${esc(t)} »</button>`).join('')}
    </div>
    ${titles.length ? '' : '<p class="muted" style="font-size:13px">Títulos são concedidos por conquistas raras, como 30 dias de estudo (Arquiteto do Conhecimento).</p>'}</div>`;
}

function render(c) {
  const filter = ui.tabs.achFilter || 'all';
  const stats = E.computeStats(c.state, c.d);
  const unlockedN = ACHIEVEMENTS.filter((a) => c.state.achievements[a.id]).length;
  let list = ACHIEVEMENTS;
  if (filter === 'unlocked') list = list.filter((a) => c.state.achievements[a.id]);
  if (filter === 'locked') list = list.filter((a) => !c.state.achievements[a.id]);
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Registro de feitos</div><h1>Conquistas</h1></div>
    <span class="chip gold">${unlockedN}/${ACHIEVEMENTS.length} desbloqueadas</span></div>
    <div class="grid g2">${classesPanel(c)}${titlesPanel(c)}</div>
    <div class="panel mt"><div class="panel-title"><h2>Medalhas e conquistas</h2>
      <div class="tabs" style="margin:0">${Object.entries(FILTERS).map(([k, v]) => `<button class="tab ${k === filter ? 'active' : ''}" data-action="set-tab" data-view="achFilter" data-tab="${k}">${v}</button>`).join('')}</div></div>
      <div class="badges">${list.map((a) => {
        const un = c.state.achievements[a.id];
        const p = achievementProgress(a, stats);
        return `<div class="badge r-${a.rarity} ${un ? '' : 'locked'}"><span class="rar">${RARITY[a.rarity].label}</span>
          <div class="ic">${a.icon}</div><h4>${esc(a.name)}</h4><p>${esc(a.desc)}</p>
          ${a.title ? `<div class="tl-sub">Título: « ${esc(a.title)} »</div>` : ''}
          ${un ? `<div class="hud" style="color:var(--rc)">✓ ${formatDay(dayKey(new Date(un.at)))} · +${RARITY[a.rarity].coins} ◈</div>`
            : `<div class="bar thin mt-s"><i style="--w:${(p.ratio * 100).toFixed(1)}%"></i></div><div class="xp-meta"><span>${fmt(p.current)}/${fmt(p.target)}</span><span>+${RARITY[a.rarity].coins} ◈</span></div>`}
        </div>`;
      }).join('')}</div>
      <p class="muted mt" style="font-size:13px">Conquistas são permanentes: uma sequência interrompida nunca apaga o que você já alcançou.</p>
    </div>`;
}

const actions = {
  'set-title': (el) => run((s) => E.updateProfile(s, { activeTitle: el.dataset.title || null }), null, { quiet: true }),
};

export default { id: 'achievements', title: 'Conquistas', short: 'Feitos', icon: 'achievements', render, actions };
