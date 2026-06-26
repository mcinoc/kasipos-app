// ═══════════════════════════════════════════════════════════════
// Kasi POS – Service Worker
// UKA Systems | app.ukasystems.co.za
// ═══════════════════════════════════════════════════════════════
// Strategy: Cache-first for app shell, network-first for updates
// This ensures the app always opens offline, while silently
// fetching updates in the background when online.

const CACHE_NAME = 'kasipos-v2';
const APP_SHELL = [
  '/kasipos-app/',
  '/kasipos-app/manifest.json',
  '/kasipos-app/icon-192.png',
  '/kasipos-app/icon-512.png'
];

// ── INSTALL: Cache app shell on first install ─────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing Kasi POS service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching app shell');
        // Cache what we can — don't fail if an asset is missing
        return Promise.allSettled(
          APP_SHELL.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Could not cache: ' + url, err);
            });
          })
        );
      })
      .then(function() {
        console.log('[SW] Install complete');
        // Take control immediately — don't wait for old SW to expire
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: Clean up old caches ────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating Kasi POS service worker...');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name) {
              console.log('[SW] Deleting old cache: ' + name);
              return caches.delete(name);
            })
        );
      })
      .then(function() {
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// ── FETCH: Serve from cache, update in background ─────────────
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http requests (chrome-extension://, etc.)
  if (!event.request.url.startsWith('http')) return;

  // Skip WhatsApp, external API, and third-party calls
  var url = new URL(event.request.url);
  var isAppShell = APP_SHELL.some(function(path) {
    return url.pathname === path || url.pathname.endsWith(path);
  });

  if (isAppShell) {
    // CACHE-FIRST for app shell: serve instantly from cache,
    // then update cache from network in background (stale-while-revalidate)
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var networkFetch = fetch(event.request)
            .then(function(networkResponse) {
              // Update cache with fresh version
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(function() {
              // Network failed — cached version is already being served
              console.log('[SW] Network unavailable, serving from cache');
            });

          // Return cache immediately if available, else wait for network
          return cached || networkFetch;
        });
      })
    );
  } else {
    // NETWORK-FIRST for everything else (API calls, WhatsApp links, etc.)
    // Fall back to cache if network fails
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          return caches.match(event.request);
        })
    );
  }
});

// ── BACKGROUND SYNC: Queue failed syncs ──────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'uka-cloud-sync') {
    console.log('[SW] Background sync triggered: uka-cloud-sync');
    // Backend sync will be implemented in Phase 2 (UKA Cloud)
    event.waitUntil(Promise.resolve());
  }
});

// ── PUSH NOTIFICATIONS: Future feature ───────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  var options = {
    body: data.body || 'You have a notification from Kasi POS',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kasi POS', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

console.log('[SW] Kasi POS service worker loaded – UKA Systems');
