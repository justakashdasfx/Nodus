/* ============================================================================
   APP — wiring only. Boots the store, router, sync, and connects clicks to
   store/sync actions. Rendering lives in ui/ and views/; logic in core/.

   Render flow
     route change  → draw sidebar + topbar + view
     store change  → redraw what changed (typing only refreshes the sidebar)
   ========================================================================== */

import { CONFIG } from './core/config.js';
import * as store from './core/store.js';
import * as sync from './core/sync.js';
import * as settings from './core/settings.js';
import { parseRoute, startRouter, go } from './core/router.js';
import { matches, comboLabel } from './core/keys.js';
import { initActions, registerActions, registerChanges } from './core/actions.js';
import { $, downloadFile, escapeHtml, htmlToText, safeFilename, sanitizeHtml, textToHtml, todayKey } from './core/utils.js';
import { renderSidebar } from './ui/sidebar.js';
import { renderTopbar, STATUS_LABELS } from './ui/topbar.js';
import * as modal from './ui/modal.js';
import * as pane from './ui/pane.js';
import { focusedEditor } from './editor/editor.js';
import * as home from './views/home.js';
import * as notebooks from './views/notebooks.js';
import * as notebook from './views/notebook.js';
import * as journal from './views/journal.js';
import * as trash from './views/trash.js';
import * as note from './views/note.js';
import * as tag from './views/tag.js';
import * as threads from './views/threads.js';
import * as thread from './views/thread.js';
import * as inbox from './views/inbox.js';

const VIEWS = { home, inbox, notebooks, notebook, journal, trash, note, tag, threads, thread };
const els = { sidebar: $('#sidebar'), topbar: $('#topbar'), view: $('#view'), card: $('#card'), pane: $('#pane'), divider: $('#divider') };

let route = parseRoute();
let status = 'idle';
let cleanup = null; // tears down the current view (the editor flushes its save here)

/* ---------- Drawing ---------- */

const drawSidebar = () => { els.sidebar.innerHTML = renderSidebar(route); };
const drawTopbar  = () => { els.topbar.innerHTML = renderTopbar(route, status); };

function drawView({ resetScroll = false } = {}) {
  cleanup?.();
  cleanup = null;
  const view = VIEWS[route.view] || VIEWS.home;
  const out = view.render(route);
  els.view.innerHTML = out.html;
  cleanup = out.mount ? out.mount(els.view) : null;
  if (resetScroll) els.view.scrollTop = 0;
}

let lastNoteFolder = null; // so a folder you collapsed stays collapsed while you move between its notes

function onRoute(next) {
  route = next;
  if (route.view === 'note') {
    const folderId = store.getNote(route.id)?.folderId || null;
    if (folderId && folderId !== lastNoteFolder) { // expand the open note's folder once, on arrival
      const open = settings.getExpanded();
      open.add(folderId);
      settings.setExpanded(open);
    }
    lastNoteFolder = folderId;
  } else {
    lastNoteFolder = null;
  }
  if (settings.isMobile()) document.documentElement.classList.add('sidebar-collapsed');
  pane.onRoute(route); // a note can't be the page and in the pane at once
  drawSidebar();
  drawTopbar();
  drawView({ resetScroll: true });
}

/* ---------- Store → UI ---------- */

store.subscribe((kind, detail) => {
  pane.onStore(kind, detail);                         // the side pane follows the store on its own
  if (kind === 'dirty' || kind === 'thread') return; // a thread edit repaints only the thread page itself
  drawSidebar();
  if (kind === 'content') return; // typing: never redraw the page under the cursor
  if (kind === 'remote' && route.view === 'note') {
    const editing = document.activeElement?.classList.contains('editor') && els.view.contains(document.activeElement);
    if (!detail.ids?.includes(route.id) || editing) return;
  }
  drawView();
});

sync.onStatus((s) => {
  status = s;
  const el = $('#sync-status');
  if (!el) return;
  el.dataset.state = s;
  el.querySelector('.status__text').textContent = STATUS_LABELS[s];
});

/* ---------- Helpers used by actions ---------- */

/** Which notebook a "New note" should land in, based on where you are. */
function contextFolder() {
  if (route.view === 'notebook') return route.id;
  if (route.view === 'note') { const n = store.getNote(route.id); return n?.type === 'note' ? n.folderId : null; }
  return null;
}

function openToday() {
  go(`#/note/${store.getOrCreateJournal(todayKey()).id}`);
}

function importFiles() {
  const input = Object.assign(document.createElement('input'), {
    type: 'file', accept: '.txt,.md,.markdown,text/plain,text/markdown', multiple: true,
  });
  input.addEventListener('change', async () => {
    const folderId = contextFolder();
    let last = null;
    for (const file of input.files) {
      const text = await file.text();
      const title = file.name.replace(/\.[^.]+$/, '');
      const hasHeading = /^\s*#\s/.test(text); // markdown file that already starts with a title
      last = store.createNote({ folderId, html: (hasHeading ? '' : `<h1>${escapeHtml(title)}</h1>`) + textToHtml(text) });
    }
    if (input.files.length === 1 && last) go(`#/note/${last.id}`);
  });
  input.click();
}

async function askSyncKey() {
  const key = await modal.prompt({
    title: 'Sync key',
    message: 'Enter the SYNC_KEY from your Vercel project settings. It is stored only on this device.',
    type: 'password', value: sync.getKey(), placeholder: 'Sync key', confirmLabel: 'Save',
  });
  if (key && key.trim()) sync.setKey(key);
}

/* ---------- Actions (data-action="…") ---------- */

registerActions({
  'sidebar-toggle': () => settings.setSidebarCollapsed(!settings.isSidebarCollapsed()),

  'folder-toggle': (el) => {
    const open = settings.getExpanded();
    open.has(el.dataset.id) ? open.delete(el.dataset.id) : open.add(el.dataset.id);
    settings.setExpanded(open);
    drawSidebar();
  },

  'note-new': (el) => {
    if (route.view === 'journal' && !el.dataset.folder) { openToday(); return; }
    const folderId = el.dataset.folder || contextFolder();
    if (folderId) { const open = settings.getExpanded(); open.add(folderId); settings.setExpanded(open); }
    go(`#/note/${store.createNote({ folderId }).id}`);
  },

  'thread-new': () => go(`#/thread/${store.createThread().id}`),
  'thread-from-tag': (el) => {
    const tag = el.dataset.tag;
    go(`#/thread/${store.createThread({ title: '#' + tag, rules: { tags: [tag] } }).id}`);
  },
  'thread-delete': async (el) => {
    const t = store.getThread(el.dataset.id);
    if (!t) return;
    const ok = await modal.confirm({
      title: 'Delete this thread?',
      message: `“${t.title}” will be deleted. Your notes are not touched — a thread only gathers blocks.`,
      confirmLabel: 'Delete thread',
    });
    if (!ok) return;
    store.deleteThread(t.id);
    go('#/threads');
  },

  'notebook-new': async () => {
    const name = await modal.prompt({ title: 'New notebook', label: 'Notebook name', placeholder: 'Notebook name', confirmLabel: 'Create' });
    if (name && name.trim()) go(`#/notebook/${store.createFolder(name).id}`);
  },
  'notebook-edit': async (el) => {
    const folder = store.getFolder(el.dataset.id);
    if (!folder) return;
    const values = await modal.form({
      title: 'Edit notebook',
      confirmLabel: 'Save',
      fields: [
        { name: 'name', label: 'Name', type: 'text', value: folder.name, required: true, maxlength: 80 },
        { name: 'description', label: 'Description', type: 'textarea', value: folder.description || '', placeholder: 'What is this notebook for?', maxlength: 280 },
        { label: 'Icon', type: 'select', options: ['Folder'], disabled: true, hint: 'coming soon' },
        { label: 'View style', type: 'segmented', options: ['Gallery', 'List'], value: 'Gallery', disabled: true, hint: 'coming soon' },
      ],
    });
    if (values) store.updateFolder(folder.id, values);
  },
  'notebook-rename': async (el) => {
    const folder = store.getFolder(el.dataset.id);
    const name = folder && await modal.prompt({ title: 'Rename notebook', label: 'Notebook name', value: folder.name, confirmLabel: 'Save' });
    if (name && name.trim()) store.renameFolder(folder.id, name);
  },
  'notebook-delete': async (el) => {
    const folder = store.getFolder(el.dataset.id);
    if (!folder) return;
    const count = store.noteCount(folder.id);
    const ok = await modal.confirm({
      title: `Move “${folder.name}” to Trash?`,
      message: count
        ? `The notebook and its ${count} ${count === 1 ? 'note' : 'notes'} will move to Trash. You can restore them from there.`
        : 'The notebook will move to Trash. You can restore it from there.',
      confirmLabel: 'Move to Trash',
    });
    if (ok) { store.trashFolder(folder.id); go('#/notebooks'); }
  },
  'notebook-restore': (el) => store.restoreFolder(el.dataset.id),
  'notebook-delete-forever': async (el) => {
    const folder = store.getFolder(el.dataset.id);
    if (!folder) return;
    const ok = await modal.confirm({
      title: `Delete “${folder.name}” forever?`,
      message: 'The notebook and all of its notes will be permanently deleted.',
      confirmLabel: 'Delete forever', danger: true,
    });
    if (ok) store.deleteFolderPermanently(folder.id);
  },

  'import-text': importFiles,
  'journal-today': openToday,

  'note-trash': async (el) => {
    const n = store.getNote(el.dataset.id);
    if (!n) return;
    const ok = await modal.confirm({
      title: 'Move to Trash?',
      message: `“${n.title || 'Untitled'}” will move to Trash. You can restore it from there.`,
      confirmLabel: 'Move to Trash',
    });
    if (!ok) return;
    store.trashNote(n.id);
    go(n.type === 'journal' ? '#/journal' : n.folderId ? `#/notebook/${n.folderId}` : '#/home');
  },
  'note-restore': (el) => store.restoreNote(el.dataset.id),
  'note-delete': async (el) => {
    const ok = await modal.confirm({ title: 'Delete forever?', message: 'This note will be permanently deleted.', confirmLabel: 'Delete forever', danger: true });
    if (!ok) return;
    store.deleteNotePermanently(el.dataset.id);
    if (route.view === 'note') go('#/trash');
  },
  'trash-empty': async () => {
    const ok = await modal.confirm({ title: 'Empty trash?', message: 'Every note and notebook in Trash will be permanently deleted.', confirmLabel: 'Empty trash', danger: true });
    if (ok) store.emptyTrash();
  },

  'theme-toggle': () => { settings.setTheme(settings.getTheme() === 'dark' ? 'light' : 'dark'); drawTopbar(); },
  'font-set': (el) => { settings.setFont(el.dataset.font); drawTopbar(); },

  'download-all': () =>
    downloadFile(`notes-backup-${todayKey()}.json`, JSON.stringify(store.exportAll(), null, 2), 'application/json'),
  'download-text': () => {
    const live = focusedEditor() || els.view.querySelector('.editor'); // the editor you last wrote in (page or pane)
    const n = store.getNote(live?.dataset.noteId || route.id);
    if (!n) return;
    const html = live && live.dataset.noteId === n.id ? sanitizeHtml(live.innerHTML) : n.html; // what is on screen, not the last saved copy
    downloadFile(`${safeFilename(n.title)}.txt`, htmlToText(html, { markers: true }));
  },

  'sync-key': askSyncKey,
  'about-open': () => modal.about(CONFIG.about),
});

registerChanges({
  'note-move': (el) => store.moveNote(el.dataset.id, el.value || null),
});

/* ---------- Keyboard: sidebar · top bar · focus mode ---------- */

function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' });
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-on'), 2400);
}

/** Focus mode: sidebar and top bar out of the way, inactive paragraphs dimmed. Not remembered across reloads. */
function toggleFocusMode() {
  const on = !settings.isFocusMode();
  settings.setFocusMode(on);
  if (on) toast(`Focus mode — Esc or ${comboLabel(CONFIG.shortcuts['focus.toggle'])} to leave`);
}

document.addEventListener('keydown', (e) => {
  const SK = CONFIG.shortcuts;

  if (e.key === 'Escape' && settings.isFocusMode() && !document.querySelector('.modal')) { settings.setFocusMode(false); return; }

  if (matches(e, SK['focus.toggle'])) { e.preventDefault(); toggleFocusMode(); return; }

  // While in focus mode the two layout shortcuts simply bring everything back.
  if (matches(e, SK['sidebar.toggle'])) {
    e.preventDefault();
    if (settings.isFocusMode()) settings.setFocusMode(false);
    else settings.setSidebarCollapsed(!settings.isSidebarCollapsed());
    return;
  }
  if (matches(e, SK['topbar.toggle'])) {
    e.preventDefault();
    if (settings.isFocusMode()) { settings.setFocusMode(false); return; }
    const hide = !settings.isTopbarHidden();
    settings.setTopbarHidden(hide);
    if (hide) toast(`Top bar hidden — ${comboLabel(SK['topbar.toggle'])} to show it`);
  }
});

/* ---------- Boot ---------- */

store.load();
initActions();
pane.initPane({ card: els.card, view: els.view, pane: els.pane, divider: els.divider, route: () => route });
if (localStorage.getItem(CONFIG.storage.sidebar) === null && settings.isMobile()) {
  document.documentElement.classList.add('sidebar-collapsed'); // first visit on a phone: start closed
}
startRouter(onRoute);
sync.startSync();

if (!sync.getKey() && !localStorage.getItem(CONFIG.storage.keyPrompted)) {
  localStorage.setItem(CONFIG.storage.keyPrompted, '1');
  askSyncKey();
}

/* ---------- Offline: the service worker keeps the app itself available without a connection ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered:', err));
  });
}
