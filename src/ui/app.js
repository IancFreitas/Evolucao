// Casca da aplicação: estado, navegação, delegação de eventos e feedback de progresso.
import * as E from '../core/engine.js';
import { ATTRIBUTES, attrInfo, createInitialState, uid } from '../core/defaults.js';
import { THEMES } from '../core/levels.js';
import { essentialsFor, completionKey } from '../core/missions.js';
import { flush, loadState, requestPersistence, saveState } from '../storage/db.js';
import { migrate } from '../storage/migrations.js';
import { parseBackup, isEncrypted } from '../storage/backup.js';
import { healthFromHash } from '../services/health.js';
import { importHealthText } from './health.js';
import { dueReminders, registerPeriodicSync, systemNotify } from '../services/notifications.js';
import { closeModal, esc, floatXp, fmt, icon, initTooltips, logo, modalOpen, pickFile, promptDialog, readFile, toast } from './dom.js';

import statusView from './views/status.js';
import missionsView from './views/missions.js';
import logView from './views/log.js';
import analyticsView from './views/analytics.js';
import achievementsView from './views/achievements.js';
import shopView from './views/shop.js';
import historyView from './views/history.js';
import settingsView from './views/settings.js';

const VIEWS = [statusView, missionsView, logView, analyticsView, achievementsView, shopView, historyView, settingsView];
const MOBILE_NAV = ['status', 'missions', 'log', 'analytics'];

/* ------------------------------ Store ------------------------------ */

export const store = {
  state: null,
  listeners: new Set(),
  set(s) {
    this.state = s;
    saveState(s);
    this.listeners.forEach((l) => l());
  },
  /** Aplica uma alteração num rascunho; erros descartam o rascunho. */
  mutate(fn) {
    const draft = structuredClone(this.state);
    const result = fn(draft);
    this.set(draft);
    return result;
  },
};

export const ui = { view: 'status', tabs: {}, filters: {}, hidden: {}, moreOpen: false, installPrompt: null };

export function ctx() {
  const state = store.state;
  if (!state) return null;
  const today = E.todayKey(state);
  const d = E.derive(state, today);
  return { state, today, d, ui };
}

/* ------------------------- Ações com feedback ------------------------- */

/**
 * Executa uma ação do motor e mostra feedback (XP flutuante, subida de nível etc.).
 * `origin` é o elemento clicado, para posicionar a animação.
 */
export function run(mutator, origin = null, { quiet = false } = {}) {
  let out;
  try {
    out = store.mutate((s) => E.act(s, mutator));
  } catch (err) {
    if (err instanceof E.RuleError) toast(esc(err.message), 'err', 4200);
    else { console.error(err); toast('Algo deu errado. Seus dados estão seguros.', 'err'); }
    return null;
  }
  handleEvents(out.events, out.result, origin, quiet);
  return out.result;
}

function handleEvents(events, result, origin, quiet) {
  const notif = store.state.settings.notifications;
  const inbox = [];
  const xp = events.find((e) => e.type === 'xp')?.amount || 0;
  const coins = events.filter((e) => e.type === 'coins').reduce((s, e) => s + e.amount, 0);
  if (xp && origin?.getBoundingClientRect) {
    const r = origin.getBoundingClientRect();
    floatXp(xp, r.left + r.width / 2 - 20, r.top);
  }
  if (!quiet && (xp || coins)) {
    const parts = [];
    if (xp) parts.push(`<b>${xp > 0 ? '+' : ''}${fmt(xp)} XP</b>`);
    if (coins) parts.push(`<b class="coin">${coins > 0 ? '+' : ''}${fmt(coins)} ◈</b>`);
    toast(parts.join(' · '), 'xp', 2200);
  }
  for (const e of events) {
    if (e.type === 'bonus') {
      toast('🌟 <b>Missões essenciais completas!</b> Bônus diário recebido.', 'gold', 4200);
      inbox.push(['goal', 'Dia perfeito', 'Todas as missões essenciais do dia foram concluídas.']);
    }
    if (e.type === 'comeback') toast('🐦‍🔥 <b>Bem-vindo de volta!</b> Retomar é uma vitória. Bônus de retomada recebido.', 'gold', 5000);
    if (e.type === 'attrUp') {
      const a = attrInfo(e.attr);
      toast(`<span style="color:${a.color}">▲ ${a.key}</span> ${esc(a.name)} subiu para o nível <b>${e.level}</b>`, '', 3600);
      inbox.push(['attribute', `${a.name} nível ${e.level}`, `Seu atributo ${a.key} evoluiu.`]);
    }
    if (e.type === 'achievement') {
      const a = e.achievement;
      toast(`${a.icon} <b>Conquista desbloqueada:</b> ${esc(a.name)}${a.title ? `<br><span class="muted">Novo título: ${esc(a.title)}</span>` : ''}`, 'gold', 5200);
      inbox.push(['achievement', `Conquista: ${a.name}`, a.title ? `Título desbloqueado: ${a.title}` : a.desc]);
    }
    if (e.type === 'levelUp') {
      showLevelUp(e.level, events.find((x) => x.type === 'classUp')?.cls);
      inbox.push(['levelUp', `Nível ${e.level} alcançado`, 'Você subiu de nível no System Ascension.']);
    }
    if (e.type === 'classUp') inbox.push(['levelUp', `Nova classe: ${e.cls.name}`, e.cls.perkText.join(' · ')]);
  }
  if (result?.kind === 'mission' && result.missionType !== 'daily') {
    inbox.push(['goal', 'Objetivo concluído', result.title]);
  }
  if (inbox.length) {
    store.mutate((s) => { for (const [type, title, body] of inbox) pushInbox(s, type, title, body); });
    for (const [type, title, body] of inbox) systemNotify(notif, type, title, body);
  }
}

export function pushInbox(state, type, title, body) {
  state.inbox.unshift({ id: uid('n-'), ts: Date.now(), type, title, body, read: false });
  state.inbox = state.inbox.slice(0, 60);
}

function showLevelUp(level, cls) {
  const el = document.createElement('div');
  el.className = 'levelup';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<div class="panel box"><div class="ttl">[ SISTEMA ]</div><div class="hud">Nível alcançado</div>
    <div class="big">${level}</div>
    ${cls ? `<p style="margin:14px 0 0;font-size:18px">Nova classe: <b style="color:var(--accent)">${esc(cls.name)}</b></p><p class="muted" style="margin:6px 0 0">${cls.perkText.map(esc).join(' · ')}</p>` : '<p class="muted" style="margin:14px 0 0">Sua evolução foi registrada. Continue no seu ritmo.</p>'}
    <p class="hud" style="margin-top:18px">Toque para continuar</p></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/* ------------------------------ Render ------------------------------ */

const root = () => document.getElementById('app');

function navItems(c) {
  return VIEWS.map((v) => {
    const badge = v.badge?.(c);
    return `<button class="nav-item ${ui.view === v.id ? 'active' : ''}" data-nav="${v.id}">${icon(v.icon)}<span>${v.title}</span>${badge ? `<span class="count">${badge}</span>` : ''}</button>`;
  }).join('');
}

function applyTheme(state) {
  const t = THEMES[state.profile.theme] || THEMES.azul;
  document.documentElement.style.setProperty('--accent', t.accent);
  document.documentElement.style.setProperty('--accent2', t.accent2);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#04050c');
}

export function render() {
  if (!store.state) return renderOnboarding();
  const c = ctx();
  applyTheme(c.state);
  const view = VIEWS.find((v) => v.id === ui.view) || statusView;
  const brand = () => `<div class="brand">${logo()}<div class="brand-name">SYSTEM<span>ASCENSION</span></div></div>`;
  const unread = c.state.inbox.filter((n) => !n.read).length;
  root().innerHTML = `<div class="app">
    <aside class="sidebar" aria-label="Navegação">${brand()}${navItems(c)}
      <div class="sidebar-foot"><div class="hud">Nv ${c.d.level.level} · ${esc(c.d.cls.name)}</div>
      <div class="bar thin mt-s"><i style="--w:${(c.d.level.progress * 100).toFixed(1)}%"></i></div>
      ${ui.installPrompt ? `<button class="btn sm mt" data-action="install">${icon('download')} Instalar app</button>` : ''}</div>
    </aside>
    <header class="topbar">${brand()}<div class="row"><span class="chip gold num">◈ ${fmt(c.d.coins)}</span>
      <button class="btn icon ghost" data-nav="status" data-scroll="inbox" aria-label="Notificações">${icon('bell')}${unread ? `<span class="count" style="position:absolute;margin:-18px 0 0 18px;font-size:10px;background:var(--accent);border-radius:99px;padding:0 5px">${unread}</span>` : ''}</button></div></header>
    <main class="main" id="main">${view.render(c)}</main>
    <nav class="bottom-nav" aria-label="Navegação principal">
      ${MOBILE_NAV.map((id) => { const v = VIEWS.find((x) => x.id === id); return `<button class="${ui.view === id ? 'active' : ''}" data-nav="${id}">${icon(v.icon)}${v.short || v.title}</button>`; }).join('')}
      <button class="${!MOBILE_NAV.includes(ui.view) ? 'active' : ''}" data-action="more">${icon('more')}Mais</button>
    </nav>
    ${ui.moreOpen ? `<div class="more-sheet">${VIEWS.filter((v) => !MOBILE_NAV.includes(v.id)).map((v) => `<button class="nav-item ${ui.view === v.id ? 'active' : ''}" data-nav="${v.id}">${icon(v.icon)}${v.title}</button>`).join('')}</div>` : ''}
  </div>`;
  view.mounted?.(c);
}

function renderOnboarding() {
  root().innerHTML = `<div class="onboard"><form class="panel" data-form="onboard">
    <div class="row">${logo()}<span class="typing">[ SISTEMA ] Um novo jogador foi detectado.</span></div>
    <h1>Bem-vindo ao System Ascension</h1>
    <p class="muted">Seu progresso real vira evolução de personagem. Hábitos, estudos, treinos e descanso geram XP,
    atributos e conquistas. Os dados ficam salvos apenas neste dispositivo.</p>
    <div class="stack mt">
      <label class="field">Nome do personagem<input name="name" required maxlength="40" placeholder="Seu nome ou apelido" autocomplete="nickname"></label>
      <label class="check"><input type="checkbox" name="examples" checked> Começar com missões de exemplo (editáveis)</label>
      <button class="btn primary">${icon('sword')} Aceitar e despertar</button>
      <button type="button" class="btn ghost" data-action="onboard-import">${icon('upload')} Restaurar backup</button>
    </div></form></div>`;
}

/* ------------------------------ Eventos ------------------------------ */

function currentView() {
  return VIEWS.find((v) => v.id === ui.view);
}

export function navigate(id, { scroll } = {}) {
  if (!VIEWS.some((v) => v.id === id)) id = 'status';
  ui.view = id;
  ui.moreOpen = false;
  if (location.hash !== `#/${id}`) history.replaceState(null, '', `#/${id}`);
  render();
  if (scroll) document.getElementById(scroll)?.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: 0 });
}

const globalActions = {
  'modal-close': () => closeModal(),
  more: () => { ui.moreOpen = !ui.moreOpen; render(); },
  install: async () => {
    const p = ui.installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    ui.installPrompt = null;
    render();
  },
  'set-tab': (el) => { ui.tabs[el.dataset.view || ui.view] = el.dataset.tab; render(); },
  'onboard-import': async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const text = await readFile(file);
      const pw = isEncrypted(text) ? await promptDialog('Backup protegido', 'Senha do backup', { type: 'password' }) : '';
      const data = await parseBackup(text, pw || '');
      store.set(data);
      navigate('status');
      toast('Backup restaurado. Bem-vindo de volta!', 'gold');
    } catch (err) { toast(esc(err.message), 'err', 5000); }
  },
};

const globalForms = {
  onboard: (data) => {
    const s = createInitialState({ name: data.name || 'Jogador', withExamples: !!data.examples, today: E.todayKey({ settings: { rules: { dayStartHour: 4 } } }) });
    store.set(s);
    requestPersistence();
    navigate('status');
    toast('[ SISTEMA ] Jogador registrado. Sua jornada começa agora.', 'xp', 4500);
  },
};

function formData(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) {
    if (k.endsWith('[]')) (out[k.slice(0, -2)] ||= []).push(v);
    else out[k] = v;
  }
  return out;
}

function bindEvents() {
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); navigate(nav.dataset.nav, { scroll: nav.dataset.scroll }); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) {
      if (ui.moreOpen && !e.target.closest('.more-sheet')) { ui.moreOpen = false; render(); }
      return;
    }
    const name = el.dataset.action;
    const handler = currentView()?.actions?.[name] || globalActions[name] || VIEWS.find((v) => v.actions?.[name])?.actions[name];
    if (!handler) return;
    e.preventDefault();
    await handler(el, ctx(), e);
  });
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const name = form.dataset.form;
    const handler = currentView()?.forms?.[name] || globalForms[name] || VIEWS.find((v) => v.forms?.[name])?.forms[name];
    if (handler) await handler(formData(form), form, ctx());
  });
  document.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const name = el.dataset.change;
    const handler = currentView()?.changes?.[name] || VIEWS.find((v) => v.changes?.[name])?.changes[name];
    if (handler) await handler(el, ctx(), e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen()) closeModal();
  });
  window.addEventListener('hashchange', () => { if (!consumeHealthLink()) navigate(location.hash.replace('#/', '')); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e; if (store.state) render(); });
}

/** Link aberto pelo Atalho do iPhone: #/saude?j=... (os dados nunca saem do aparelho). */
function consumeHealthLink() {
  if (!location.hash.startsWith('#/saude')) return false;
  let text = null;
  try { text = healthFromHash(location.hash); } catch { toast('Link do Saúde inválido.', 'err'); }
  history.replaceState(null, '', '#/log');
  if (store.state && text) {
    navigate('log');
    importHealthText(text);
  } else if (!store.state) {
    toast('Crie seu personagem antes de importar dados do Saúde.', 'err', 5000);
  }
  return true;
}

/* ---------------------------- Lembretes ---------------------------- */

let lastDay = null;
function tick() {
  const s = store.state;
  if (!s) return;
  const today = E.todayKey(s);
  if (lastDay && lastDay !== today && !modalOpen()) render(); // virada do dia
  lastDay = today;
  const notif = s.settings.notifications;
  for (const r of dueReminders(notif, s.meta.lastNotified || {}, new Date(), today)) {
    const pending = essentialsFor(s, today).filter((m) => !s.log.some((e) => e.key === completionKey(m, today))).length;
    const [title, body] = r.type === 'daily'
      ? ['Missões do dia', pending ? `${pending} missão(ões) essencial(is) aguardando. Comece pela mais leve.` : 'Confira suas missões de hoje.']
      : ['Revisão semanal', 'Hora de revisar a semana, celebrar avanços e planejar a próxima.'];
    store.mutate((st) => {
      st.meta.lastNotified = { ...(st.meta.lastNotified || {}), [r.type]: r.key };
      if (notif.enabled) pushInbox(st, r.type, title, body);
    });
    systemNotify(notif, r.type, title, body);
  }
}

/* ------------------------------ Início ------------------------------ */

export async function start() {
  initTooltips();
  bindEvents();
  let saved = null;
  try { saved = await loadState(); } catch { saved = null; }
  if (saved) {
    try { store.state = migrate(saved); } catch { store.state = null; }
  }
  store.listeners.add(() => { if (!modalOpen()) render(); });
  const healthLink = location.hash.startsWith('#/saude');
  ui.view = location.hash.replace('#/', '') || 'status';
  if (!VIEWS.some((v) => v.id === ui.view)) ui.view = 'status';
  render();
  if (healthLink) consumeHealthLink();
  tick();
  setInterval(tick, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => {
      if (store.state?.settings.notifications.enabled) registerPeriodicSync();
    }).catch(() => {});
  }
  window.addEventListener('beforeunload', () => { flush(); });
}

export { ATTRIBUTES };
