import * as E from '../../core/engine.js';
import { formatDay } from '../../core/dates.js';
import { closeModal, confirmDialog, esc, fmt, icon, openModal, toast } from '../dom.js';
import { run, ui } from '../app.js';

const TABS = { shop: 'Loja', inventory: 'Inventário', manage: 'Gerenciar recompensas' };

function shopTab(c) {
  if (!c.state.rewards.length) return '<div class="empty"><b>Nenhuma recompensa cadastrada.</b>Defina recompensas pessoais na aba Gerenciar.</div>';
  return `<div class="shop">${c.state.rewards.map((r) => {
    const av = E.rewardAvailability(c.state, r, c.today, c.d.coins);
    const limits = [r.maxPerWeek ? `até ${r.maxPerWeek}x/semana` : '', r.cooldownDays ? `intervalo de ${r.cooldownDays} dias` : ''].filter(Boolean).join(' · ');
    return `<div class="reward"><div class="ic">${esc(r.icon)}</div><h4>${esc(r.name)}</h4><p>${esc(r.desc)}${limits ? `<br><span class="dim">${limits}</span>` : ''}</p>
      <div class="row between"><span class="price">◈ ${fmt(r.cost)}</span>
      <button class="btn sm ${av.ok ? 'primary' : ''}" data-action="buy" data-id="${r.id}" ${av.ok ? '' : 'disabled'} ${av.ok ? '' : `data-tip="${esc(av.reason)}"`}>Trocar</button></div>
      ${av.ok ? '' : `<div class="tl-sub">${esc(av.reason)}</div>`}</div>`;
  }).join('')}</div>`;
}

function inventoryTab(c) {
  const items = [...c.state.inventory].sort((a, b) => b.boughtAt - a.boughtAt);
  if (!items.length) return '<div class="empty"><b>Inventário vazio.</b>Recompensas trocadas na loja ficam guardadas aqui até você usá-las.</div>';
  const unused = items.filter((i) => !i.usedAt);
  const used = items.filter((i) => i.usedAt);
  const row = (i) => `<div class="mission ${i.usedAt ? 'done' : ''}"><span style="font-size:24px">${esc(i.icon)}</span><div><div class="m-title">${esc(i.name)}</div>
    <div class="m-meta"><span>Trocada em ${formatDay(i.date)}</span><span class="price">◈ ${fmt(i.cost)}</span>${i.usedAt ? '<span class="chip ok">usada</span>' : ''}</div></div>
    <div class="m-actions">${i.usedAt ? '' : `<button class="btn sm ok" data-action="use-item" data-id="${i.id}">Usar</button><button class="btn sm ghost" data-action="refund" data-id="${i.id}" data-tip="Devolver e recuperar as moedas">Devolver</button>`}</div></div>`;
  return `<div class="hud">Disponíveis (${unused.length})</div><div class="list mt-s">${unused.map(row).join('') || '<p class="muted">Nada para usar agora.</p>'}</div>
    ${used.length ? `<div class="hud mt">Usadas (${used.length})</div><div class="list mt-s">${used.slice(0, 30).map(row).join('')}</div>` : ''}`;
}

function manageTab(c) {
  return `<div class="row between wrap" style="margin-bottom:12px"><p class="muted" style="margin:0;font-size:13px">Defina recompensas saudáveis. Limites semanais e intervalos evitam excessos.</p>
    <button class="btn primary sm" data-action="reward-new">${icon('plus')} Nova recompensa</button></div>
    <div class="list">${c.state.rewards.map((r) => `<div class="mission"><span style="font-size:24px">${esc(r.icon)}</span><div><div class="m-title">${esc(r.name)}</div>
      <div class="m-meta"><span class="price">◈ ${fmt(r.cost)}</span><span>${r.maxPerWeek ? `${r.maxPerWeek}x/semana` : 'sem limite semanal'}</span><span>${r.cooldownDays ? `intervalo ${r.cooldownDays}d` : ''}</span></div></div>
      <div class="m-actions"><button class="btn icon sm ghost" data-action="reward-edit" data-id="${r.id}" aria-label="Editar">${icon('edit')}</button>
      <button class="btn icon sm ghost" data-action="reward-delete" data-id="${r.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>`;
}

function rewardForm(r = null) {
  openModal(r ? 'Editar recompensa' : 'Nova recompensa', `<form data-form="reward" class="form-grid">
    <input type="hidden" name="id" value="${esc(r?.id || '')}">
    <label class="field">Ícone (emoji)<input name="icon" maxlength="4" value="${esc(r?.icon || '🎁')}"></label>
    <label class="field">Custo em moedas<input name="cost" type="number" min="1" max="100000" required value="${r?.cost ?? 50}"></label>
    <label class="field full">Nome<input name="name" required maxlength="80" value="${esc(r?.name || '')}" placeholder="Ex.: Noite de filme"></label>
    <label class="field full">Descrição<input name="desc" maxlength="200" value="${esc(r?.desc || '')}"></label>
    <label class="field">Máximo por semana (0 = sem limite)<input name="maxPerWeek" type="number" min="0" max="50" value="${r?.maxPerWeek ?? 2}"></label>
    <label class="field">Intervalo mínimo em dias<input name="cooldownDays" type="number" min="0" max="365" value="${r?.cooldownDays ?? 0}"></label>
    <div class="full notice">Dica: prefira recompensas que favoreçam o equilíbrio (lazer, descanso, experiências) a compras impulsivas.</div>
    <div class="full modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
}

function render(c) {
  const tab = ui.tabs.shop || 'shop';
  const body = tab === 'inventory' ? inventoryTab(c) : tab === 'manage' ? manageTab(c) : shopTab(c);
  const earnedMonth = c.state.log.filter((e) => e.coins > 0 && e.date >= c.today.slice(0, 8) + '01').reduce((s, e) => s + e.coins, 0);
  return `<div class="page-head"><div><div class="hud">[ Sistema ] Loja de recompensas</div><h1>Loja</h1></div>
    <div class="row"><span class="chip gold num" style="font-size:15px;padding:7px 14px">◈ ${fmt(c.d.coins)} moedas</span></div></div>
    <p class="muted" style="margin-top:-8px">Moedas vêm do XP (${Math.round(c.state.settings.rules.coinRate * 100)} por 100 XP${c.d.perks.coinBonus ? `, +${Math.round(c.d.perks.coinBonus * 100)}% pela classe` : ''}) e de conquistas. Este mês: <b class="coin">◈ ${fmt(earnedMonth)}</b>.</p>
    <div class="tabs">${Object.entries(TABS).map(([k, v]) => `<button class="tab ${k === tab ? 'active' : ''}" data-action="set-tab" data-view="shop" data-tab="${k}">${v}${k === 'inventory' ? `<span class="n">${c.state.inventory.filter((i) => !i.usedAt).length}</span>` : ''}</button>`).join('')}</div>
    <div class="panel">${body}</div>`;
}

const actions = {
  buy: async (el, c) => {
    const r = c.state.rewards.find((x) => x.id === el.dataset.id);
    if (await confirmDialog(`Trocar <b class="coin">◈ ${fmt(r.cost)}</b> por <b>${esc(r.name)}</b>?`, { ok: 'Trocar' })) {
      const item = run((s) => E.buyReward(s, r.id), el, { quiet: true });
      if (item) toast(`${esc(r.icon)} <b>${esc(r.name)}</b> adicionada ao inventário. Aproveite!`, 'gold');
    }
  },
  'use-item': (el) => run((s) => E.useItem(s, el.dataset.id), null, { quiet: true }),
  refund: async (el) => {
    if (await confirmDialog('Devolver esta recompensa e recuperar as moedas?', { ok: 'Devolver' })) run((s) => E.refundItem(s, el.dataset.id), null, { quiet: true });
  },
  'reward-new': () => rewardForm(),
  'reward-edit': (el, c) => rewardForm(c.state.rewards.find((r) => r.id === el.dataset.id)),
  'reward-delete': async (el, c) => {
    const r = c.state.rewards.find((x) => x.id === el.dataset.id);
    if (await confirmDialog(`Excluir a recompensa <b>${esc(r.name)}</b>? Itens já trocados continuam no inventário.`, { ok: 'Excluir', danger: true })) {
      run((s) => E.deleteReward(s, r.id), null, { quiet: true });
    }
  },
};

const forms = {
  reward: (data) => {
    closeModal();
    run((s) => E.saveReward(s, { ...data, id: data.id || undefined }), null, { quiet: true });
  },
};

export default { id: 'shop', title: 'Loja', icon: 'shop', render, actions, forms };
