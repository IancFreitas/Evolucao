// Notificações do sistema operacional + agendamento local.
// Lembretes agendados disparam enquanto o app está aberto (ou em segundo plano via
// Periodic Background Sync, quando o navegador suporta e o app está instalado).

export const NOTIFICATION_TYPES = {
  daily: 'Missões do dia',
  weekly: 'Revisão semanal',
  goal: 'Conclusão de objetivos',
  levelUp: 'Subida de nível',
  achievement: 'Conquistas desbloqueadas',
  attribute: 'Evolução de atributos',
  backup: 'Lembrete de backup no iCloud',
};

export const supported = () => typeof window !== 'undefined' && 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');

export async function requestPermission() {
  if (!supported()) return 'unsupported';
  return Notification.requestPermission();
}

export function isTypeEnabled(settings, type) {
  if (!settings.enabled) return false;
  const v = settings[type];
  return typeof v === 'object' ? !!v.on : !!v;
}

/** Mostra uma notificação do sistema (se permitida e habilitada para o tipo). */
export async function systemNotify(settings, type, title, body) {
  if (!isTypeEnabled(settings, type) || permission() !== 'granted') return false;
  const opts = { body, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: `sa-${type}`, lang: 'pt-BR' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Verifica lembretes agendados. `markSent(type, key)` registra o envio para não repetir.
 * Retorna a lista de lembretes devidos (para também aparecerem dentro do app).
 */
export function dueReminders(settings, lastNotified, now = new Date(), todayKey) {
  const due = [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (settings.daily?.on && nowMin >= minutesOf(settings.daily.time) && lastNotified.daily !== todayKey) {
    due.push({ type: 'daily', key: todayKey });
  }
  if (settings.weekly?.on && now.getDay() === Number(settings.weekly.day) &&
      nowMin >= minutesOf(settings.weekly.time) && lastNotified.weekly !== todayKey) {
    due.push({ type: 'weekly', key: todayKey });
  }
  return due;
}

export async function registerPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg?.periodicSync) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register('sa-reminders', { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
