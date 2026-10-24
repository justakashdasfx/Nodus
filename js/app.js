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
import { toggleTask } from './core/tasks.js';
import { parseRoute, startRouter, go } from './core/router.js';
import { matches, comboLabel } from './core/keys.js';
import { initActions, registerActions, registerChanges } from './core/actions.js';
import { $, downloadFile, escapeHtml, htmlToText, htmlToMarkdown, safeFilename, sanitizeHtml, textToHtml, todayKey } from './core/utils.js';
import { renderSidebar } from './ui/sidebar.js';
import { renderTopbar, STATUS_LABELS } from './ui/topbar.js';
import * as modal from './ui/modal.js';
import * as pane from './ui/pane.js';
import { initMoreMenu } from './ui/more-menu.js';
import { initSearch } from './ui/search.js';
import { openFind, closeFind } from './ui/find.js';
import { focusedEditor, refreshStats } from './editor/editor.js';
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
import * as tasks from './views/tasks.js';
import * as tags from './views/tags.js';

const VIEWS = { home, inbox, notebooks, notebook, journal, trash, note, tag, threads, thread, tasks, tags };
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
  closeFind();
  drawSidebar();
  drawTopbar();
  drawView({ resetScroll: true });
}

/* ---------- Store → UI ---------- */

store.subscribe((kind, detail) => {
  pane.onStore(kind, detail);                         // the side pane follows the store on its own
  if (kind === 'dirty' || kind === 'thread') return; // a thread edit repaints only the thread page itself
  drawSidebar();
  if (kind === 'content') { if (route.view === 'tasks' || route.view === 'tags') drawView(); return; } // typing: never redraw the page under the cursor (the Tasks page has no editor, so it follows)
  drawTopbar();                   // the notebook picker and the note's details follow the store
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

/** A new note from a template: id is 'b:<built-in id>' (config.js → templates) or 't:<id of one of your template notes>'. */
function newFromTemplate(id) {
  const key = String(id || '').slice(2);
  const html = String(id || '').startsWith('b:') ? CONFIG.templates.find(t => t.id === key)?.html : store.getNote(key)?.html;
  if (!html) return;
  const folderId = contextFolder();
  if (folderId) { const open = settings.getExpanded(); open.add(folderId); settings.setExpanded(open); }
  go(`#/note/${store.createFromTemplate(html, { folderId }).id}`);
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

/** The note you are working in (the editor you last used, page or pane) and its text as it is on screen right now. */
function currentNote() {
  const live = focusedEditor() || els.view.querySelector('.editor');
  return store.getNote(live?.dataset.noteId || route.id);
}
function currentNoteMarkdown() {
  const live = focusedEditor() || els.view.querySelector('.editor');
  const n = currentNote();
  if (!n) return '';
  return htmlToMarkdown(live && live.dataset.noteId === n.id ? sanitizeHtml(live.innerHTML) : n.html);
}

/** Write ⇄ Read for one note: saved on the note, and the page is rebuilt so the editor opens editable or read-only (scroll kept). */
function setNoteMode(id, mode) {
  const note = store.getNote(id);
  if (!note || store.noteMode(note) === mode) return;
  store.setNoteMode(id, mode);
  document.activeElement?.blur?.();
  const top = els.view.scrollTop;
  drawTopbar();
  drawView();
  els.view.scrollTop = top;
  pane.refresh();
}

/* ---------- Actions (data-action="…") ---------- */

registerActions({
  'sidebar-toggle': () => settings.setSidebarCollapsed(!settings.isSidebarCollapsed()),

  /* Click "Notebook" above the notebooks: close them all (or open them all when none is open) */
  'folders-toggle-all': () => {
    const open = settings.getExpanded();
    const ids = store.folders().map(f => f.id);
    settings.setExpanded(ids.some(id => open.has(id)) ? new Set() : new Set(ids));
    drawSidebar();
  },
  /* Tags page: a tag pill opens the side pane with its blocks */
  'tag-pane': (el) => pane.openTag(el.dataset.tag),

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
        { name: 'viewStyle', label: 'View style', type: 'segmented', options: ['Gallery', 'List'], value: (folder.viewStyle || CONFIG.defaults.views.notebook) === 'list' ? 'List' : 'Gallery' },
      ],
    });
    if (values) store.updateFolder(folder.id, { ...values, viewStyle: String(values.viewStyle || '').toLowerCase() });
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
    if (ok) { store.trashFolder(folder.id); go('#/notebooks'); toastUndo('Notebook moved to Trash', () => store.restoreFolder(folder.id)); }
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

  /* Gallery | List switch in a page header (a notebook keeps its choice on the notebook, other pages on this device) */
  'view-style': (el) => {
    const style = el.dataset.style === 'list' ? 'list' : 'gallery';
    if (el.dataset.page === 'notebook') store.updateFolder(el.dataset.id, { viewStyle: style });
    else { settings.setViewStyle(el.dataset.page, style); drawView(); }
  },

  'import-text': importFiles,
  'journal-today': openToday,

  /* Tasks page: tick the box → the checklist item is ticked in its note */
  'task-toggle': (el) => { if (toggleTask(el.dataset.note, el.dataset.block)) drawView(); },

  /* Templates (built in: config.js → templates · your own: notes of type 'template') */
  'template-pick': async () => {
    const mine = store.templates();
    const res = await modal.pick({
      title: 'New from template',
      sections: [
        { label: 'Built in', items: CONFIG.templates.map(t => ({ id: 'b:' + t.id, label: t.name, sub: t.about })) },
        ...(mine.length ? [{ label: 'Yours', items: mine.map(t => ({ id: 't:' + t.id, label: t.title || 'Untitled', removable: true })) }] : []),
      ],
    });
    if (!res) return;
    if (res.remove) {
      const id = res.remove.slice(2);
      store.trashNote(id);
      toastUndo('Template moved to Trash', () => store.restoreNote(id));
      return;
    }
    newFromTemplate(res.id);
  },
  'template-new': (el) => newFromTemplate(el.dataset.id),
  'template-save': (el) => { if (store.saveAsTemplate(el.dataset.id)) toast('Saved as a template. Find it under New from template.'); },

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
    toastUndo('Moved to Trash', () => { store.restoreNote(n.id); go(`#/note/${n.id}`); });
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

  /* Write ⇄ Read: the page is rebuilt so the editor opens editable or read-only; the scroll position is kept */
  'mode-set': (el) => setNoteMode(el.dataset.id, el.dataset.mode),

  /* Light | Dark from the ⋯ menu */
  'theme-set': (el) => settings.setTheme(el.dataset.theme),

  /* Pin / unpin a note (sidebar Pinned section, top of Home) and collapse that section */
  'note-pin': (el) => {
    const n = store.getNote(el.dataset.id);
    if (!n) return;
    store.setNotePinned(n.id, !n.pinned);
    if (route.view === 'home') drawView();
  },
  'pinned-toggle': () => { settings.togglePinnedOpen(); drawSidebar(); },

  /* The notebook picker */
  'note-move-to': (el) => {
    const n = store.getNote(el.dataset.id);
    if (!n) return;
    const was = n.folderId || null;
    const to = el.dataset.folder || null;
    if (was === to) return;
    store.moveNote(n.id, to);
    toastUndo(`Moved to ${to ? (store.getFolder(to)?.name || 'notebook') : 'Inbox'}`, () => store.moveNote(n.id, was));
  },

  /* The count in the top bar: words ⇄ characters */
  'stats-toggle': () => { settings.toggleStatsMode(); refreshStats(); },

  /* The writing font of one note: Sans, Mono or Serif (the interface itself always stays Sans) */
  'note-font': (el) => {
    store.setNoteFont(el.dataset.id, el.dataset.font);
    document.querySelectorAll(`.editor[data-note-id="${el.dataset.id}"]`).forEach((ed) => {
      const page = ed.closest('.note');
      if (page) page.dataset.font = el.dataset.font === 'mono' || el.dataset.font === 'serif' ? el.dataset.font : 'sans';
    });
  },

  'copy-markdown': async () => {
    const md = currentNoteMarkdown();
    if (!md) return;
    try { await navigator.clipboard.writeText(md); toast('Copied as Markdown'); }
    catch { toast('Could not copy — use Export as Markdown instead'); }
  },
  'export-markdown': () => {
    const n = currentNote();
    const md = currentNoteMarkdown();
    if (n && md) downloadFile(`${safeFilename(n.title)}.md`, md, 'text/markdown');
  },

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

/** A toast with an Undo button (6 seconds). Used after Trash and Move. */
function toastUndo(message, onUndo) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.append(el); }
  el.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="toast__undo">Undo</button>`;
  el.classList.add('is-on', 'toast--action');
  clearTimeout(toast.timer);
  const done = () => el.classList.remove('is-on', 'toast--action');
  el.querySelector('.toast__undo').onclick = () => { done(); clearTimeout(toast.timer); onUndo(); };
  toast.timer = setTimeout(done, 6000);
}
window.addEventListener('app-toast', (e) => toast(String(e.detail || ''))); // messages from the editor modules (code blocks)

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

  if (matches(e, SK['find.open'])) {   // only on a page that has a note in it; elsewhere the browser's own find stays
    if (route.view === 'note' || document.querySelector('.pane .editor')) { e.preventDefault(); openFind(); }
    return;
  }
  if (matches(e, SK['mode.toggle'])) {
    e.preventDefault();
    const n = route.view === 'note' ? store.getNote(route.id) : null;
    if (n) setNoteMode(n.id, store.noteMode(n) === 'edit' ? 'read' : 'edit');
    return;
  }

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

/* Commands from the search window that are not buttons (js/ui/search.js → config.js → commands) */
window.addEventListener('app-command', (e) => {
  const SK = CONFIG.shortcuts;
  if (e.detail === 'focus-toggle') toggleFocusMode();
  else if (e.detail === 'topbar-toggle') {
    const hide = !settings.isTopbarHidden();
    settings.setTopbarHidden(hide);
    if (hide) toast(`Top bar hidden — ${comboLabel(SK['topbar.toggle'])} to show it`);
  } else if (e.detail === 'mode-toggle') {
    const n = route.view === 'note' ? store.getNote(route.id) : null;
    if (n) setNoteMode(n.id, store.noteMode(n) === 'edit' ? 'read' : 'edit');
  }
});

/* ---------- Boot ---------- */

store.load();
initActions();
initMoreMenu({ route: () => route });
initSearch({ route: () => route });
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
