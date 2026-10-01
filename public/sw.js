// ChessKids service worker. Registered from student pages (src/scripts/student.ts); it only
// handles /app navigations and static files, so coach pages are unaffected.
// - Static files (hashed /_astro bundles, Stockfish, voices, mascot images): cache-first.
// - Student pages: network-first, falling back to the last cached copy when offline, so
//   assigned games that were opened before keep working without a connection.
// - /api/* is never cached: results made offline wait in the outbox (src/lib/outbox.ts).
const VERSION = 'v1';
const STATIC = `ck-static-${VERSION}`;
const PAGES = 'ck-pages'; // only ever holds the pages of the student logged in right now

// Any login or logout on this device (student link, PIN, coach, logout) empties the page cache,
// so on a shared tablet a kid never sees another kid's pages offline.
const isAuthChange = (url) =>
  url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/u/') || url.pathname === '/entrar';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('ck-static-') && k !== STATIC).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isStatic = (url) =>
  url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/engine/') || url.pathname.startsWith('/voices/') ||
  url.pathname.startsWith('/potroculo/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isAuthChange(url)) event.waitUntil(caches.delete(PAGES));
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (isStatic(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode === 'navigate' && url.pathname.startsWith('/app')) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGES);
      try {
        const res = await fetch(req);
        // Only real student pages (not redirects to the login screen).
        if (res.ok && !res.redirected) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) ?? new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>' +
          '<body style="font-family:system-ui;text-align:center;padding:3rem;background:#f5f3ff;color:#4c1d95">' +
          '<p style="font-size:4rem;margin:0">📶</p><h1>¡Sin conexión!</h1><p>Vuelve a intentarlo cuando tengas internet.</p>' +
          '<button onclick="location.reload()" style="font-size:1.2rem;padding:.8rem 1.6rem;border-radius:1rem;border:0;background:#7c3aed;color:#fff">Reintentar</button></body>',
          { headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }
    })());
  }
});
