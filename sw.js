'use strict';
// ─── Dompet.ku Service Worker ─────────────────────────────────
// Caches the app shell so it works offline and qualifies as an installable PWA.
const CACHE_NAME = 'dompetku-cache-v5';

const ASSETS = [
  './',
  './index.html',
  './404.html',
  './manifest.json',
  './css/style.css',
  './js/firebase-config.js',
  './js/storage.js',
  './js/utils.js',
  './js/ui.js',
  './js/auth.js',
  './js/account-deletion.js',
  './js/beranda.js',
  './js/transaksi.js',
  './js/laporan.js',
  './js/utang.js',
  './js/recurring.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation (so updates show up fast), cache-first for assets
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
