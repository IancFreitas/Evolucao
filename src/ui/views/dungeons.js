import * as E from '../../core/engine.js';
import { attrInfo } from '../../core/defaults.js';
import { AREAS, RANKS, areaRanks, dungeonDef, dungeonStatus, hunterRank } from '../../core/dungeons.js';
import { confirmDialog, esc, fmt, icon } from '../dom.js';
import { run, store } from '../app.js';

const cooldownHours = () => store.state.settings.rules.dungeonCooldownHours;

export function rankBadge(r, { big = false } = {}) {
  const letter = r >= 0 ? RANKS[r] : '—';
  return `<span class="rank-badge rank-${r >= 0 ? letter : 'none'} ${big ? 'big' : ''}" aria-label="Rank ${letter}">${letter}</span>`;
}

export function formatLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60e3));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}min` : `${m}min`;
}

function reqBars(progress) {
  return progress.reqs.map((r) => `<div class="mt-s"><div class="row between" style="font-size:13px"><span>${r.current >= r.target ? '✓' : '○'} ${esc(r.label)}</span>
    <span class="mono">${Math.min(r.current, r.target)}/${r.target}</span></div><div class="bar thin"><i style="--w:${Math.min(100, (r.current / r.target) * 100)}%"></i></div></div>`).join('');
}

function areaCard(c, area, ranks, now) {
  const a = attrInfo(area.key);
  const cleared = ranks[area.key];
  const current = Math.min(cleared + 1, RANKS.length - 1);
  const def = dungeonDef(area.key, current);
  const st = dungeonStatus(c.state, def, { level: c.d.level.level, attrLevels: c.d.attrLevels }, now);
  const ladder = RANKS.map((l, i) => `<span class="rung ${i <= cleared ? 'done' : ''} ${i === current && cleared < 5 ? 'cur' : ''}">${l}</span>`).join('');
  let body = '';
  const bossBox = `<div class="boss-box"><div class="hud" style="color:#ff7a8f">Chefe · prazo de ${def.hours}h</div><div>${esc(def.boss)}</div></div>`;
  switch (st.status) {
    case 'cleared':
      body = `<div class="notice ok mt">👑 <b>Área dominada.</b> Todas as dungeons de ${esc(a.name)} foram limpas.</div>`;
      break;
    case 'locked':
      body = `<div class="notice mt">🔒 ${esc(st.reason)}</div>`;
      break;
    case 'available':
      body = `<div class="tl-sub mt">Requisitos: ${def.days} dias com progresso em ${area.key}, ${area.key} no nível ${def.attrLevel}${def.streak ? `, ${def.streak} dias seguidos` : ''}.</div>
        ${bossBox}<div class="row wrap mt"><button class="btn sm primary" data-action="dg-enter" data-id="${def.id}">${icon('sword')} Entrar na dungeon</button>
        <span class="xp-tag">+${fmt(def.xp)} XP · ${area.key}+${def.attr}</span></div>`;
      break;
    case 'active':
      body = `${reqBars(st.progress)}${bossBox}<div class="row wrap mt"><button class="btn sm" disabled>Chefe bloqueado</button>
        <button class="btn sm ghost" data-action="dg-leave" data-id="${def.id}">Sair</button></div>`;
      break;
    case 'ready':
      body = `${reqBars(st.progress)}${bossBox}<div class="row wrap mt"><button class="btn sm primary pulse" data-action="dg-boss" data-id="${def.id}">🐉 Enfrentar o chefe</button>
        <button class="btn sm ghost" data-action="dg-leave" data-id="${def.id}">Sair</button></div>`;
      break;
    case 'boss':
      body = `<div class="boss-box active"><div class="hud" style="color:#ff7a8f">Desafio final em andamento · restam ${formatLeft(st.run.bossDeadline - now)}</div>
        <div style="font-size:15px;font-weight:600">${esc(def.boss)}</div></div>
        <div class="row wrap mt"><button class="btn sm ok" data-action="dg-win" data-id="${def.id}">${icon('check')} Vitória</button>
        <button class="btn sm danger" data-action="dg-fail" data-id="${def.id}">${icon('x')} Não consegui</button></div>`;
      break;
    case 'cooldown':
      body = `<div class="notice warn mt">⏳ <b>Portão fechado.</b> Reabre em <b>${formatLeft(st.cooldownUntil - now)}</b>.
        Seus requisitos continuam cumpridos: use o tempo para se preparar.</div>${reqBars(st.progress)}`;
      break;
    default:
  }
  const label = { cleared: 'Dominada', locked: 'Bloqueada', available: 'Disponível', active: 'Em exploração', ready: 'Chefe liberado', boss: 'Em batalha', cooldown: 'Portão fechado' }[st.status];
  return `<div class="panel dungeon dg-${st.status}" style="--c:${a.color}">
    <div class="row between"><div class="row"><span style="font-size:26px">${area.icon}</span><div><div class="hud" style="color:var(--c)">${area.key} · ${esc(a.name)}</div>
    <b style="font-size:16px">${esc(area.name)}${st.status === 'cleared' ? '' : ` · Rank ${def.rankLetter}`}</b></div></div>${rankBadge(cleared)}</div>
    <div class="row between mt-s"><div class="ladder">${ladder}</div><span class="chip">${label}</span></div>
    ${body}</div>`;
}

function render(c) {
  const now = E.clock.now();
  const ranks = areaRanks(c.state);
  const hr = hunterRank(c.state);
  const cleared = Object.values(c.state.dungeons).filter((r) => r.clearedAt).length;
  const next = hr + 1 < RANKS.length ? RANKS[hr + 1] : null;
  const towardNext = next ? Object.values(ranks).filter((r) => r >= hr + 1).length : 0;
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Portões detectados</div><h1>Dungeons</h1></div></div>
    <div class="panel hero" style="grid-template-columns:auto 1fr">
      ${rankBadge(hr, { big: true })}
      <div><div class="hud">Rank geral</div><div class="hero-name" style="font-size:22px">${hr >= 0 ? `Rank ${RANKS[hr]}` : 'Sem rank'}</div>
      <div class="tl-sub">${next ? `Para o Rank ${next}: ${towardNext}/4 áreas no Rank ${next} ou acima.` : 'Rank máximo alcançado.'} · ${cleared}/42 dungeons limpas</div>
      <details class="mt-s"><summary class="tl-sub" style="cursor:pointer">Como funciona</summary><p class="tl-sub">Cada área tem dungeons do Rank E ao S, em ordem.
      Ao entrar, cumpra os requisitos (só conta o que você registrar depois de entrar). Com eles completos, o chefe é liberado: um desafio real com prazo.
      Vitória dá XP, pontos de atributo e o rank da área. Se falhar ou o prazo acabar, o portão fecha por ${c.state.settings.rules.dungeonCooldownHours}h,
      mas os requisitos continuam cumpridos. O rank geral sobe quando 4 áreas alcançam o mesmo rank.</p></details></div>
    </div>
    <div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));align-items:start">
      ${AREAS.map((a) => areaCard(c, a, ranks, now)).join('')}
    </div>`;
}

const actions = {
  'dg-enter': (el) => run((s) => E.enterDungeon(s, el.dataset.id), null, { quiet: true }),
  'dg-leave': async (el) => {
    if (await confirmDialog('Sair da dungeon? Os requisitos voltam a zero, mas você pode entrar de novo quando quiser.', { ok: 'Sair' })) {
      run((s) => E.abandonDungeon(s, el.dataset.id), null, { quiet: true });
    }
  },
  'dg-boss': async (el) => {
    const [area, letter] = el.dataset.id.split('-');
    const def = dungeonDef(area, RANKS.indexOf(letter));
    const ok = await confirmDialog(`<b>Desafio final: ${esc(def.name)} · Rank ${def.rankLetter}</b><br><br>${esc(def.boss)}<br><br>
      Você terá <b>${def.hours}h</b> a partir de agora. Se não conseguir, o portão fecha por ${cooldownHours()}h (seus requisitos são mantidos).`, { ok: 'Começar' });
    if (ok) run((s) => E.startBoss(s, def.id), null, { quiet: true });
  },
  'dg-win': async (el) => {
    if (await confirmDialog('Você concluiu o desafio final de verdade? Seja honesto com o Sistema: ele só funciona assim.', { ok: 'Sim, concluí' })) {
      run((s) => E.resolveBoss(s, el.dataset.id, true), el);
    }
  },
  'dg-fail': async (el) => {
    if (await confirmDialog('Registrar que não foi desta vez? O portão fecha por um tempo, mas nada do que você conquistou é perdido.', { ok: 'Registrar' })) {
      run((s) => E.resolveBoss(s, el.dataset.id, false), null, { quiet: true });
    }
  },
};

export default {
  id: 'dungeons', title: 'Dungeons', icon: 'dungeon', render, actions,
  badge: (c) => {
    const now = E.clock.now();
    let n = 0;
    for (const a of AREAS) {
      const r = areaRanks(c.state)[a.key];
      if (r >= RANKS.length - 1) continue;
      const st = dungeonStatus(c.state, dungeonDef(a.key, r + 1), { level: c.d.level.level, attrLevels: c.d.attrLevels }, now).status;
      if (st === 'ready' || st === 'boss') n++;
    }
    return n || null;
  },
};
