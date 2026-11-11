/*
 * PolyglotReader Service Worker v6
 * Enables full offline reading, upgraded neural audio caching, range requests for HTML5 audio,
 * and PWA installability with immediate cache freshness on deployments.
 */

const CACHE_NAME = 'polyglot-reader-v6';
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
        keys.map((key) => {
          // Delete all older polyglot-reader app shell caches
          if (key.startsWith('polyglot-reader-') && key !== CACHE_NAME) {
            console.log('[SW] Purging legacy app shell cache:', key);
            return caches.delete(key);
          }
          return null;
        })
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

  // 3. Navigation / HTML Document requests: ALWAYS Network-First with Cache Fallback
  // Prevents stale HTML shells from trapping users in older CSS/JS bundles while online.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response('Offline: Page not cached', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // 4. Static assets & media: Hashed immutable chunks can use cache-first; mutable assets use network-first
  event.respondWith(
    (async () => {
      if (url.pathname.startsWith('/_next/static/immutable/')) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const netRes = await fetch(event.request);
        if (netRes && netRes.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, netRes.clone());
        }
        return netRes;
      }

      // Network-first for other assets (CSS, JS, icons, manifest)
      try {
        const netRes = await fetch(event.request);
        if (netRes && netRes.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, netRes.clone());
        }
        return netRes;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
