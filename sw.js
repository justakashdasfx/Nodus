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

const CACHE = 'nodus-v11e';
const SLOW_MS = 4000;

const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/css/fonts.css', '/css/tokens.css', '/css/base.css', '/css/layout.css', '/css/components.css', '/css/gallery.css', '/css/editor.css', '/css/maps.css',
  '/fonts/geist-latin-wght-normal.woff2', '/fonts/geist-latin-ext-wght-normal.woff2',
  '/fonts/geist-mono-latin-wght-normal.woff2', '/fonts/geist-mono-latin-ext-wght-normal.woff2',
  '/fonts/merriweather-latin-400-normal.woff2', '/fonts/merriweather-latin-400-italic.woff2',
  '/fonts/merriweather-latin-700-normal.woff2', '/fonts/merriweather-latin-700-italic.woff2',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons-ui/arrowDown.svg', '/icons-ui/sort.svg', '/icons-ui/arrowLeft.svg', '/icons-ui/arrowUp.svg', '/icons-ui/bold.svg', '/icons-ui/brush.svg', '/icons-ui/bullets.svg', '/icons-ui/calendar.svg', '/icons-ui/callout.svg', '/icons-ui/caret.svg', '/icons-ui/check.svg', '/icons-ui/clear.svg', '/icons-ui/clock.svg', '/icons-ui/close.svg', '/icons-ui/code.svg', '/icons-ui/copy.svg', '/icons-ui/divider.svg', '/icons-ui/dividerGrip.svg', '/icons-ui/download.svg', '/icons-ui/external.svg', '/icons-ui/eye.svg', '/icons-ui/fileDown.svg', '/icons-ui/folder.svg', '/icons-ui/font.svg', '/icons-ui/grip.svg', '/icons-ui/h1.svg', '/icons-ui/h2.svg', '/icons-ui/h3.svg', '/icons-ui/h4.svg', '/icons-ui/home.svg', '/icons-ui/inbox.svg', '/icons-ui/info.svg', '/icons-ui/italic.svg', '/icons-ui/journal.svg', '/icons-ui/menu.svg', '/icons-ui/moon.svg', '/icons-ui/more.svg', '/icons-ui/note.svg', '/icons-ui/notebooks.svg', '/icons-ui/numbers.svg', '/icons-ui/pencil.svg', '/icons-ui/pencil-simple.svg', '/icons-ui/pin.svg', '/icons-ui/plus.svg', '/icons-ui/quote.svg', '/icons-ui/restore.svg', '/icons-ui/search.svg', '/icons-ui/sidepanel.svg', '/icons-ui/sun.svg', '/icons-ui/tag.svg', '/icons-ui/tasks.svg', '/icons-ui/text.svg', '/icons-ui/threads.svg', '/icons-ui/toggle.svg', '/icons-ui/trash.svg', '/icons-ui/underline.svg', '/icons-ui/upload.svg','/icons-ui/unpin.svg', '/icons-ui/mindmap.svg', '/icons-ui/minus.svg', '/icons-ui/fit.svg', '/icons-ui/palette.svg', '/icons-ui/shape.svg', '/icons-ui/sticky.svg', '/icons-ui/undo.svg', '/icons-ui/redo.svg','/icons-ui/code-block.svg',
  '/js/app.js',
  '/js/core/actions.js', '/js/core/blockindex.js', '/js/core/threads.js', '/js/core/config.js', '/js/core/icons.js', '/js/core/keys.js', '/js/core/router.js',
  '/js/core/settings.js', '/js/core/search.js', '/js/core/prefs.js', '/js/core/dates.js', '/js/core/tasks.js', '/js/core/store.js', '/js/core/sync.js', '/js/core/utils.js',
  '/js/ui/components.js', '/js/ui/modal.js', '/js/ui/pane.js', '/js/ui/more-menu.js', '/js/ui/note-meta.js', '/js/ui/find.js', '/js/core/vendor.js', '/js/editor/code-block.js', '/js/ui/sidebar.js', '/js/ui/search.js', '/js/ui/topbar.js',
  '/js/views/maps.js', '/js/views/map.js', '/js/maps/config.js', '/js/maps/model.js', '/js/maps/layout.js', '/js/maps/render.js', '/js/maps/keymap.js', '/js/maps/engine.js', '/js/maps/thumb.js', '/js/maps/drag.js', '/js/maps/panel.js', '/js/maps/richtext.js', '/js/maps/clip.js', '/js/maps/outline.js', '/js/maps/preview.js', '/js/maps/export.js',
  '/js/views/home.js', '/js/views/inbox.js', '/js/views/journal.js', '/js/views/note.js', '/js/views/notebook.js', '/js/views/notebooks.js', '/js/views/blocklist.js', '/js/views/tag.js', '/js/views/thread.js', '/js/views/threads.js', '/js/views/trash.js', '/js/views/tasks.js', '/js/views/tags.js', '/js/ui/calendar.js', '/js/editor/blocks-extra.js', '/js/ui/popmenu.js', '/js/ui/sidebar-dnd.js', '/js/editor/block-select.js',
  '/js/editor/block-handle.js', '/js/editor/block-ops.js', '/js/editor/blocks.js', '/js/editor/editor.js', '/js/editor/history.js', '/js/editor/focus.js', '/js/editor/due.js', '/js/editor/inline.js', '/js/editor/lists.js', '/js/editor/normalize.js',
  '/js/editor/paste.js', '/js/editor/selection-toolbar.js', '/js/editor/block-menu.js', '/js/editor/block-rules.js', '/js/editor/thread-block.js', '/js/editor/map-block.js', '/js/editor/note-link.js', '/js/editor/note-mention.js', '/js/core/links.js', '/js/ui/related.js', '/js/editor/slash-menu.js', '/js/editor/shortcuts.js', '/js/editor/tag-suggest.js', '/js/editor/tags.js',
  '/css/tasks-tags.css'
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
