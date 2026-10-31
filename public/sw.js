/*
 * PolyglotReader Service Worker v2
 * Enables full offline reading, neural audio caching, range requests for HTML5 audio,
 * and PWA installability.
 */

const CACHE_NAME = 'polyglot-reader-v2';
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
        keys.filter((key) => key !== CACHE_NAME && !key.startsWith('polyglot-')).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Avoid caching Next.js webpack HMR or dev hot-reloads
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // 1. Audio Range Request Handling (Crucial for Safari/Chrome HTML5 audio scrubbing & offline playback)
  if (url.pathname.includes('/audio/')) {
    event.respondWith(
      (async () => {
        // Try matching in any cache by exact request, pathname, or alternative prefix
        let cachedResponse = await caches.match(event.request);
        if (!cachedResponse) {
          cachedResponse = await caches.match(url.pathname);
        }
        if (!cachedResponse && url.pathname.startsWith('/api/audio/')) {
          cachedResponse = await caches.match(url.pathname.replace('/api/audio/', '/audio/'));
        }
        if (!cachedResponse && url.pathname.startsWith('/audio/')) {
          cachedResponse = await caches.match(url.pathname.replace('/audio/', '/api/audio/'));
        }

        if (cachedResponse) {
          const rangeHeader = event.request.headers.get('range');
          if (rangeHeader) {
            const arrayBuffer = await cachedResponse.arrayBuffer();
            const byteLength = arrayBuffer.byteLength;
            const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
              const start = parseInt(matches[1], 10);
              const end = matches[2] ? parseInt(matches[2], 10) : byteLength - 1;
              const slicedBuffer = arrayBuffer.slice(start, end + 1);

              return new Response(slicedBuffer, {
                status: 206,
                statusText: 'Partial Content',
                headers: {
                  'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
                  'Content-Range': `bytes ${start}-${end}/${byteLength}`,
                  'Content-Length': String(slicedBuffer.byteLength),
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'public, max-age=31536000',
                },
              });
            }
          }
          return cachedResponse;
        }

        // Not cached, fetch from network
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(url.pathname, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('Audio unavailable offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
    return;
  }

  // 2. Story API routes (/api/stories/[id])
  if (url.pathname.startsWith('/api/stories/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        // If offline, return cached immediately
        if (!navigator.onLine && cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(JSON.stringify({ error: 'Offline, story not cached' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })()
    );
    return;
  }

  // 3. General static assets & navigation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and refresh in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        if (
          url.pathname.startsWith('/icons/') ||
          url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|woff2)$/)
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
