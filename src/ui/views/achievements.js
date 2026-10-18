import * as E from '../../core/engine.js';
import { ACHIEVEMENTS, RARITY, achievementProgress } from '../../core/achievements.js';
import { CLASSES } from '../../core/levels.js';
import { dayKey, formatDay } from '../../core/dates.js';
import { esc, fmt } from '../dom.js';
import { run, ui } from '../app.js';

const FILTERS = { all: 'Todas', unlocked: 'Desbloqueadas', locked: 'Bloqueadas' };

function classesPanel(c) {
  return `<div class="panel"><div class="panel-title"><h2>Trilha de classes</h2><span class="chip accent">Atual: ${esc(c.d.cls.name)}</span></div>
    <div class="class-track">${CLASSES.map((cl, i) => `<div class="class-node ${i <= c.d.classIndex ? 'reached' : ''} ${i === c.d.classIndex ? 'current' : ''}"
      data-tip="${esc(cl.perkText.join(' · '))}"><span class="hud">${i <= c.d.classIndex ? 'Desbloqueada' : `Nv ${cl.minLevel}`}</span><b>${esc(cl.name)}</b><small>${esc(cl.reqText)}</small></div>`).join('')}</div>
    <div class="hud mt">Benefícios ativos</div>
    <div class="chips">${CLASSES.slice(0, c.d.classIndex + 1).flatMap((cl) => cl.perkText).map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>`;
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
