/* ============================================================================
   SERVICE WORKER — keeps the app itself (HTML, CSS, JS, fonts, icons) available offline.

   Strategy: NETWORK FIRST.
     • Online:  every file is fetched fresh (revalidated), so a new deploy shows up on the
                next load — no stale JavaScript — and the copy is saved for later.
     • Offline / slow (>4 s): the last saved copy is used instead.
   Your notes are not handled here: they live in localStorage and sync through /api, which this
   worker never touches (the app already shows "Offline, will sync when back").

   Bump CACHE when you add or rename files that must be available on first offline load.
   ========================================================================== */

const CACHE = 'notes-app-v8';
const SLOW_MS = 4000;

const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/css/fonts.css', '/css/tokens.css', '/css/base.css', '/css/layout.css', '/css/components.css', '/css/gallery.css', '/css/editor.css',
  '/fonts/geist-latin-wght-normal.woff2', '/fonts/geist-latin-ext-wght-normal.woff2',
  '/fonts/geist-mono-latin-wght-normal.woff2', '/fonts/geist-mono-latin-ext-wght-normal.woff2',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/js/app.js',
  '/js/core/actions.js', '/js/core/blockindex.js', '/js/core/threads.js', '/js/core/config.js', '/js/core/icons.js', '/js/core/keys.js', '/js/core/router.js',
  '/js/core/settings.js', '/js/core/store.js', '/js/core/sync.js', '/js/core/utils.js',
  '/js/ui/components.js', '/js/ui/modal.js', '/js/ui/pane.js', '/js/ui/sidebar.js', '/js/ui/topbar.js',
  '/js/views/home.js', '/js/views/inbox.js', '/js/views/journal.js', '/js/views/note.js', '/js/views/notebook.js', '/js/views/notebooks.js', '/js/views/blocklist.js', '/js/views/tag.js', '/js/views/thread.js', '/js/views/threads.js', '/js/views/trash.js',
  '/js/editor/block-handle.js', '/js/editor/block-ops.js', '/js/editor/blocks.js', '/js/editor/editor.js', '/js/editor/history.js', '/js/editor/focus.js', '/js/editor/inline.js', '/js/editor/lists.js', '/js/editor/normalize.js',
  '/js/editor/paste.js', '/js/editor/selection-toolbar.js', '/js/editor/block-menu.js', '/js/editor/slash-menu.js', '/js/editor/shortcuts.js', '/js/editor/tag-suggest.js', '/js/editor/tags.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One by one: a single missing file must not stop the worker from installing.
    await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // only our own files
  if (url.pathname.startsWith('/api/')) return;           // data sync is never cached here
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? '/index.html' : req;   // the app is one page; #/routes all share it
  const store = (res) => { if (res && res.ok && res.type === 'basic') cache.put(key, res.clone()); return res; };

  const network = fetch(req, { cache: 'no-cache' });
  try {
    const first = await Promise.race([network, new Promise((r) => setTimeout(() => r(null), SLOW_MS))]);
    if (first) return store(first);

    const cached = await cache.match(key);              // network is slow → show the saved copy…
    if (cached) { network.then(store).catch(() => {}); return cached; }   // …and refresh it in the background
    return store(await network);
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    return new Response('Offline, and this file has not been saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
