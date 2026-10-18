// Backup no iCloud (ou em qualquer nuvem do aparelho).
// Apps web não gravam no iCloud Drive sozinhos: o backup é entregue à folha de compartilhamento
// do sistema ("Salvar em Arquivos" → iCloud Drive) com um toque. No computador, vira um download.
import { diffDays, dayKey } from '../core/dates.js';
import { buildBackup, download } from '../storage/backup.js';
import { toast } from './dom.js';
import { run, store } from './app.js';

export const BACKUP_FOLDER = 'Ascension';

/** Entrega o arquivo pela folha de compartilhamento; retorna 'shared', 'downloaded' ou 'cancelled'. */
async function deliver(filename, text) {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup do System Ascension' });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // compartilhamento indisponível neste contexto: cai para o download
    }
  }
  download(filename, text);
  return 'downloaded';
}

export async function saveBackupToCloud() {
  const s = store.state;
  const pw = s.settings.backup.password || '';
  const today = dayKey(new Date());
  const text = await buildBackup(s, pw);
  const result = await deliver(`ascension-backup-${today}${pw ? '-protegido' : ''}.json`, text);
  if (result === 'cancelled') {
    toast('Backup cancelado. Nada foi salvo.', 'err');
    return false;
  }
  // registra o backup e avalia conquistas (Guardião dos Registros)
  run((st) => {
    st.meta.backups = (st.meta.backups || 0) + 1;
    st.meta.lastBackupAt = Date.now();
  }, null, { quiet: true });
  toast(result === 'shared'
    ? `💾 Backup pronto. Na primeira vez, escolha <b>Salvar em Arquivos → iCloud Drive → ${BACKUP_FOLDER}</b>.`
    : '💾 Backup baixado. Guarde o arquivo na sua nuvem.', 'gold', 6000);
  return true;
}

/** Dias desde o último backup (null = nunca). */
export function daysSinceBackup(state) {
  return state.meta.lastBackupAt ? diffDays(dayKey(new Date(state.meta.lastBackupAt)), dayKey(new Date())) : null;
}

/** Backup em atraso: passou do intervalo escolhido, ou nunca feito depois de alguns registros. */
export function backupOverdue(state) {
  const every = state.settings.backup.reminderDays;
  if (!every) return false;
  const days = daysSinceBackup(state);
  if (days == null) return state.log.length >= 5;
  return days >= every;
}

export function backupStatusText(state) {
  const days = daysSinceBackup(state);
  if (days == null) return 'Nenhum backup salvo ainda.';
  if (days === 0) return 'Último backup: hoje.';
  return `Último backup: há ${days} dia(s).`;
}
