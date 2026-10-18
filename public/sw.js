/*
 * PolyglotReader Service Worker
 * Enables offline caching, fast load times, and PWA installation criteria.
 */

const CACHE_NAME = 'polyglot-reader-v1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Avoid caching Next.js server actions or development hot-reloads
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update in background (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {
          // Offline, ignore network fetch failure
        });
        return cachedResponse;
      }

      // Not cached, fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache static files and images
        if (
          url.pathname.startsWith('/icons/') ||
          url.pathname.startsWith('/audio/') ||
          url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|woff2)$/)
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
