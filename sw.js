const CACHE_NAME = 'life-planner-v14';
const ASSETS = ['./'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle GET requests — POST (e.g. Firebase auth) cannot be cached
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // CRITICAL: never intercept cross-origin requests (Firestore / Firebase / Google APIs / CDNs).
  // Firestore opens a streaming WebChannel over GET to firestore.googleapis.com; if the SW
  // caches/clones that response the connection breaks and the client reports
  // "Failed to get document because the client is offline" → cloud sync silently fails.
  if (url.origin !== self.location.origin) return;

  // Network-first for the app shell (HTML document) so an online user ALWAYS gets the latest
  // code immediately after deploy. Falls back to cache when offline. This ends the recurring
  // "stale cached version after update" problem.
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }

  // Cache-first for other same-origin static assets (fast + offline-capable)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match('./')))
  );
});
