// Fluxos de interface da integração com o app Saúde do iPhone.
import * as E from '../core/engine.js';
import { dayKey, formatDay } from '../core/dates.js';
import { HEALTH_SOURCE, parseHealthExport, parseHealthPayload, summariesToItems } from '../services/health.js';
import { closeModal, esc, openModal, pickFile, toast } from './dom.js';
import { run, store } from './app.js';

/** Converte resumos diários em itens, importa e informa o resultado. */
export function importHealthDays(days, label = 'App Saúde') {
  const s = store.state;
  const items = summariesToItems(days, s.settings.health, s.settings.activities);
  if (!items.length) {
    toast(`${label}: ${days.length} dia(s) lidos, nenhuma meta atingida ainda (ajuste as metas em Ajustes → Integrações).`, '', 5500);
    return;
  }
  const res = run((st) => {
    const r = E.importItems(st, items, { autoConfirm: st.settings.health.autoConfirm });
    st.settings.health.lastImport = Date.now();
    return r;
  }, null, { quiet: true });
  if (!res) return;
  const parts = [];
  if (res.confirmed) parts.push(`${res.confirmed} confirmado(s) automaticamente`);
  if (res.pending) parts.push(`${res.pending} aguardando confirmação`);
  toast(`❤️ ${label}: ${parts.join(', ') || 'nenhum registro novo (já importados antes)'}.`, res.confirmed ? 'gold' : 'xp', 5500);
}

export function importHealthText(text) {
  try {
    importHealthDays(parseHealthPayload(text, E.todayKey(store.state)), 'Atalho do Saúde');
  } catch (err) {
    toast(esc(err.message), 'err', 5000);
  }
}

/** Lê a área de transferência (o Atalho copia o JSON) e importa. */
export async function pasteHealth() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* sem permissão: cai no campo manual */ }
  if (text && /[{[]/.test(text)) { importHealthText(text); return; }
  openModal('Colar dados do Saúde', `<form data-form="health-paste"><p class="muted" style="margin-top:0">Não foi possível ler a área de transferência automaticamente. Cole abaixo o texto copiado pelo Atalho.</p>
    <label class="field">Dados<textarea name="json" rows="6" placeholder='{"date":"2026-10-18","sleepHours":7.5,"steps":9200}'></textarea></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary">Importar</button></div></form>`);
}

export async function importHealthFile() {
  const file = await pickFile('.zip,.xml,application/zip,text/xml,application/xml');
  if (!file) return;
  const s = store.state;
  const mb = (file.size / 1048576).toFixed(0);
  toast(`Lendo exportação do Saúde (${mb} MB). Isso pode levar alguns instantes…`, '', 4000);
  try {
    const days = await parseHealthExport(file, { today: E.todayKey(s), windowDays: s.settings.rules.importWindowDays });
    importHealthDays(days, `Exportação do Saúde (${days.length} dia(s))`);
  } catch (err) {
    toast(esc(err.message || 'Falha ao ler o arquivo.'), 'err', 6000);
  }
}

export function healthSummaryLine(state) {
  const h = state.settings.health;
  const pend = state.pending.filter((p) => p.source === HEALTH_SOURCE).length;
  const last = h.lastImport ? `Última importação: ${formatDay(dayKey(new Date(h.lastImport)))}` : 'Nenhuma importação ainda';
  return `${last}${pend ? ` · ${pend} pendente(s)` : ''}`;
}

export const healthForms = {
  'health-paste': (data) => { closeModal(); importHealthText(data.json); },
};
