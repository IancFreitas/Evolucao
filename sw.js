// Service worker: funcionamento offline, lembretes periódicos e clique em notificações.
const VERSION = 'sa-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'src/main.js', 'src/ui/app.js', 'src/ui/dom.js', 'src/ui/charts.js',
  'src/ui/views/status.js', 'src/ui/views/missions.js', 'src/ui/views/log.js', 'src/ui/views/analytics.js',
  'src/ui/views/achievements.js', 'src/ui/views/shop.js', 'src/ui/views/history.js', 'src/ui/views/settings.js',
  'src/core/dates.js', 'src/core/defaults.js', 'src/core/levels.js', 'src/core/ledger.js', 'src/core/missions.js',
  'src/core/streaks.js', 'src/core/achievements.js', 'src/core/analytics.js', 'src/core/engine.js',
  'src/storage/db.js', 'src/storage/backup.js', 'src/storage/migrations.js',
  'src/services/notifications.js', 'src/services/integrations.js', 'src/services/health.js', 'src/ui/health.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Rede primeiro (para receber atualizações), cache como fallback offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const win = list.find((c) => 'focus' in c);
    return win ? win.focus() : self.clients.openWindow('./#/status');
  }));
});

/* ---- Lembrete periódico (Periodic Background Sync, quando suportado) ---- */

function readState() {
  return new Promise((resolve) => {
    const req = indexedDB.open('system-ascension', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const g = req.result.transaction('kv', 'readonly').objectStore('kv').get('state');
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
  });
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'sa-reminders') return;
  e.waitUntil(readState().then((state) => {
    const n = state?.settings?.notifications;
    if (!n?.enabled || !n.daily?.on) return;
    const now = new Date(Date.now() - (state.settings.rules?.dayStartHour || 0) * 3600e3);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [h, m] = String(n.daily.time || '08:00').split(':').map(Number);
    const real = new Date();
    if (real.getHours() * 60 + real.getMinutes() < h * 60 + m) return;
    if (state.meta?.lastNotified?.daily === today) return;
    const active = (state.log || []).some((x) => x.date === today && ['mission', 'activity'].includes(x.kind));
    if (active) return;
    return self.registration.showNotification('Missões do dia', {
      body: 'Suas missões aguardam. Comece pela mais leve: todo progresso conta.',
      icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'sa-daily', lang: 'pt-BR',
    });
  }));
});
