// ═══════════════════════════════════════════════════════════════
// Kasi POS – Service Worker v4
// UKA Systems | app.ukasystems.co.za
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'kasipos-v7';

// Use relative paths — works on any domain or subdirectory
const APP_SHELL = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing v4...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Could not cache: ' + url, err);
          });
        })
      );
    }).then(function() {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating v4...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Removing old cache: ' + name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  var url = new URL(event.request.url);

  // Only cache same-origin requests
  var isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Cache-first with network update in background
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var networkFetch = fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() {
            console.log('[SW] Offline, serving from cache');
          });
          return cached || networkFetch;
        });
      })
    );
  } else {
    // Network-first for external requests (API, WhatsApp, etc.)
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
  }
});

// ── BACKGROUND SYNC ───────────────────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'uka-cloud-sync') {
    event.waitUntil(Promise.resolve());
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kasi POS', {
      body: data.body || 'You have a notification from Kasi POS',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || './'));
});

console.log('[SW] Kasi POS service worker v4 loaded – UKA Systems');
