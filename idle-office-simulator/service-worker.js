// Service worker — cache versionado, offline-first (PRD §42).
// Atualizar CACHE_VERSION invalida o cache antigo SEM tocar no save (localStorage).

const CACHE_VERSION = 'idle-office-v1.1.0';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './styles/screens.css',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './src/app.js',
  './src/core/bus.js',
  './src/core/rng.js',
  './src/core/format.js',
  './src/core/formulas.js',
  './src/core/store.js',
  './src/data/balance.js',
  './src/data/buildings.js',
  './src/data/companies.js',
  './src/data/managers.js',
  './src/data/missions.js',
  './src/data/achievements.js',
  './src/data/events.js',
  './src/data/projects.js',
  './src/data/research.js',
  './src/data/prestige.js',
  './src/data/campaign.js',
  './src/data/extras.js',
  './src/systems/actions.js',
  './src/systems/progression.js',
  './src/systems/events.js',
  './src/systems/offline.js',
  './src/systems/projects.js',
  './src/systems/prestige.js',
  './src/systems/monetization.js',
  './src/systems/challenges.js',
  './src/persistence/save.js',
  './src/ui/ui.js',
  './src/ui/music.js',
  './src/ui/screens.js',
  './src/ui/handlers.js',
  './src/debug/panel.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

// "Atualizar" no banner da UI → ativa a nova versão imediatamente
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Cache-first com atualização em segundo plano (stale-while-revalidate)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // nenhuma dependência externa (PRD §42)

  event.respondWith(
    caches.match(request, { ignoreSearch: url.pathname.endsWith('index.html') || url.pathname.endsWith('/') }).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || network;
    }),
  );
});
