/* ══════════════════════════════════════════
   sw.js — HVW Keukenapp Service Worker
   ══════════════════════════════════════════ */

const CACHE_NAME = 'hvw-keuken-v8';
const ASSETS = [
  '/hvw-keukenapp/',
  '/hvw-keukenapp/index.html',
  '/hvw-keukenapp/assets/app.js',
  '/hvw-keukenapp/assets/suppliers.js',
  '/hvw-keukenapp/assets/ijsdesserts.js',
  '/hvw-keukenapp/assets/etiketten.js',
  '/hvw-keukenapp/assets/cars.js',
  '/hvw-keukenapp/assets/tijdstool.js',
  '/hvw-keukenapp/assets/functionsheets.js',
  '/hvw-keukenapp/assets/broodjes.js',
  '/hvw-keukenapp/assets/recepten.js',
  '/hvw-keukenapp/assets/style.css',
  '/hvw-keukenapp/assets/logo.png',
  '/hvw-keukenapp/assets/icon-192.png',
  '/hvw-keukenapp/assets/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

/* ── Installatie: cache alle assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.map(url => new Request(url, { mode: 'cors' })))
        .catch(() => cache.addAll(ASSETS.filter(u => u.startsWith('/'))));
    }).then(() => self.skipWaiting())
  );
});

/* ── Activatie: verwijder oude caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first voor assets, network-first voor pagina ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Sla niet-GET requests over
  if (event.request.method !== 'GET') return;

  // Google Fonts en CDN: cache-first
  if (url.hostname.includes('fonts.googleapis') ||
      url.hostname.includes('fonts.gstatic') ||
      url.hostname.includes('cdnjs.cloudflare')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App bestanden: network-first (altijd vers), fallback naar cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
