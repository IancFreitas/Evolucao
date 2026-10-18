// Utilitários de interface: escape, ícones, toasts, modais e tooltips.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
export const $ = (sel, root = document) => root.querySelector(sel);

const PATHS = {
  status: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  missions: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  log: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  analytics: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  achievements: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  shop: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;

// Cada instância do logo precisa de um id próprio: um gradiente dentro de um elemento oculto
// (como a barra lateral no celular) não é desenhado para quem o referencia.
let logoSeq = 0;
export const logo = () => {
  const id = `lg${++logoSeq}`;
  return `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient></defs><path d="M32 4 58 18v28L32 60 6 46V18z" fill="none" stroke="url(#${id})" stroke-width="3"/><path d="M32 14 46 40H18z" fill="url(#${id})" opacity=".9"/><path d="M32 26 38 38H26z" fill="#04050c"/></svg>`;
};

/* ---------- Toasts ---------- */
let toastRoot;
export function toast(html, kind = '', ms = 3200) {
  toastRoot ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'toasts' });
  toastRoot.setAttribute('role', 'status');
  toastRoot.setAttribute('aria-live', 'polite');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  toastRoot.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, ms);
}

export function floatXp(amount, x, y) {
  if (!amount) return;
  const el = document.createElement('div');
  el.className = 'float-xp';
  el.textContent = `${amount > 0 ? '+' : ''}${amount} XP`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/* ---------- Modal ---------- */
let modalEl = null;
let lastFocus = null;
export function openModal(title, body, { wide = false } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-wrap';
  modalEl.innerHTML = `<div class="panel modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'width:min(860px,100%)' : ''}">
    <div class="panel-title"><h2>${esc(title)}</h2><button class="btn icon ghost" data-action="modal-close" aria-label="Fechar">${icon('x')}</button></div>
    ${body}</div>`;
  modalEl.addEventListener('mousedown', (e) => { if (e.target === modalEl) closeModal(); });
  document.body.appendChild(modalEl);
  const first = modalEl.querySelector('input:not([type=hidden]), select, textarea, button.primary');
  (first || modalEl.querySelector('button'))?.focus();
  return modalEl;
}
export function closeModal() {
  if (!modalEl) return;
  modalEl.remove();
  modalEl = null;
  lastFocus?.focus?.();
}
export const modalOpen = () => !!modalEl;

export function confirmDialog(message, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    const el = openModal('Confirmação', `<p>${message}</p><div class="modal-actions">
      <button class="btn ghost" data-c="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="1">${esc(ok)}</button></div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c], [data-action=modal-close]');
      if (!b) return;
      e.stopPropagation();
      closeModal();
      resolve(b.dataset.c === '1');
    });
  });
}

export function promptDialog(title, label, { type = 'text', ok = 'OK', value = '' } = {}) {
  return new Promise((resolve) => {
    const el = openModal(title, `<form data-p><label class="field">${esc(label)}<input name="v" type="${type}" value="${esc(value)}" autocomplete="off"></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-c="0">Cancelar</button><button class="btn primary">${esc(ok)}</button></div></form>`);
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const v = new FormData(e.target).get('v');
      closeModal();
      resolve(v);
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-c="0"], [data-action=modal-close]')) { e.stopPropagation(); closeModal(); resolve(null); }
    });
  });
}

/* ---------- Tooltip ---------- */
let tipEl;
export function initTooltips() {
  tipEl = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'tip hidden' });
  const show = (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) { tipEl.classList.add('hidden'); return; }
    tipEl.innerHTML = t.dataset.tip;
    tipEl.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2));
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${Math.max(40, r.top)}px`;
  };
  document.addEventListener('pointerover', show);
  document.addEventListener('focusin', show);
  document.addEventListener('scroll', () => tipEl.classList.add('hidden'), true);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}
