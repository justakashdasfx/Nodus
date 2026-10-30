/* ============================================================================
   STORE — the single source of truth for notebooks and notes.

   • Local-first: every change is saved to localStorage immediately.
   • Changes are flagged "dirty"; sync.js pushes them to the server.
   • Views never touch localStorage or the network — they call this module
     and listen with subscribe().

   Data model
     folder: { id, name, description, createdAt, deletedAt,
               kind?: 'collection'  (a folder that holds notebooks; no kind = a notebook),
               parentId?: the collection it sits in (none = top level),
               ord?: its place among its siblings }
     note:   { id, type: 'note' | 'journal', date, folderId, html, title,
               blocks, createdAt, updatedAt, deletedAt }
     • blocks = small index of the note's blocks (id, type, text, tags) — see core/blockindex.js
       Notes saved before blocks existed are migrated on load (deterministic ids, nothing is re-synced).
     • type 'journal' notes have date = 'YYYY-MM-DD' and no folder
     • deletedAt set  → the note is in Trash
   ========================================================================== */

import { CONFIG } from './config.js';
import { uid, deriveTitle, formatJournalDate, escapeHtml, sanitizeHtml, todayKey } from './utils.js';
import { indexHtml, migrateHtml } from './blockindex.js';
import { matchBlocks, normalizeRules } from './threads.js';
import { newMap, mapTitle } from '../maps/model.js';
import { THEMES, LINES, LAYOUTS } from '../maps/config.js';
import { rebalance } from '../maps/model.js';

/* ---------- State ---------- */

const state = {
  folders: [],
  foldersUpdatedAt: 0,
  threads: [],
  threadsUpdatedAt: 0,
  threadsDirty: false,
  notes: [],
  dirtyNotes: new Set(),   // ids waiting to be pushed
  foldersDirty: false,
  pendingPurge: new Set(), // ids waiting to be permanently deleted on the server
};

const listeners = new Set();

/** Events: 'change' (structure changed) · 'content' (text edited) · 'remote' (server data merged) · 'dirty' (needs sync) */
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (kind, detail = {}) => listeners.forEach(fn => fn(kind, detail));

/** Notes without a block index (older notes, or older server copies) get block ids + an index. In memory only. */
function ensureBlocks(note) {
  if (Array.isArray(note.blocks)) {
    // Indexes written before checklists were indexed lack the tick state the Tasks page reads → rebuild them (in memory).
    if (note.html && note.html.includes('data-check') && note.blocks.some(b => b.t === 'li') && !note.blocks.some(b => b.chk !== undefined)) note.blocks = indexHtml(note.html);
    return;
  }
  const migrated = migrateHtml(note.html || '', note.id);
  note.html = migrated.html;
  note.blocks = migrated.blocks;
}

/* ---------- Persistence (localStorage cache) ---------- */

function persist() {
  try {
    localStorage.setItem(CONFIG.storage.cache, JSON.stringify({
      folders: state.folders,
      foldersUpdatedAt: state.foldersUpdatedAt,
      threads: state.threads,
      threadsUpdatedAt: state.threadsUpdatedAt,
      threadsDirty: state.threadsDirty,
      notes: state.notes,
      dirtyNotes: [...state.dirtyNotes],
      foldersDirty: state.foldersDirty,
      pendingPurge: [...state.pendingPurge],
    }));
  } catch (err) {
    console.warn('Could not write local cache', err);
  }
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.storage.cache) || 'null');
    if (!raw) return;
    state.folders = raw.folders || [];
    state.foldersUpdatedAt = raw.foldersUpdatedAt || 0;
    state.threads = raw.threads || [];
    state.threadsUpdatedAt = raw.threadsUpdatedAt || 0;
    state.threadsDirty = !!raw.threadsDirty;
    state.notes = raw.notes || [];
    state.notes.forEach(ensureBlocks);
    state.dirtyNotes = new Set(raw.dirtyNotes || []);
    state.foldersDirty = !!raw.foldersDirty;
    state.pendingPurge = new Set(raw.pendingPurge || []);
  } catch (err) {
    console.warn('Could not read local cache', err);
  }
}

/* ---------- Reading ---------- */

const byUpdated = (a, b) => b.updatedAt - a.updatedAt;
const live = (n) => !n.deletedAt;

export const getNote   = (id) => state.notes.find(n => n.id === id) || null;
export const getFolder = (id) => state.folders.find(f => f.id === id) || null;

const folderTrashed = (n) => !!(n.folderId && getFolder(n.folderId)?.deletedAt);

/* ---------- Notebook folders ----------
   A "collection" (shown as a Folder) is a folder record with kind: 'collection'. It holds notebooks (parentId on the notebook).
   How deep folders may go: config.js → folders.maxLevels (1 = a folder holds notebooks only). Everything below is written for any depth. */

export const isCollection = (f) => f?.kind === 'collection';
const maxLevels = () => Math.max(1, CONFIG.folders?.maxLevels || 1);
const ordKey = (f) => (Number.isFinite(f.ord) ? f.ord : Infinity);
const bySlot = (a, b) => (ordKey(a) - ordKey(b)) || (a.createdAt - b.createdAt);   // Infinity - Infinity is NaN → falls through to the date

/** The folder that holds this one, or null (a parent that is gone counts as "top level"). */
const parentOf = (f) => {
  const p = f?.parentId ? getFolder(f.parentId) : null;
  return p && isCollection(p) && !p.deletedAt && p.id !== f.id ? p : null;
};
export const parentFolder = (id) => parentOf(getFolder(id));
const depthOf = (f) => { let d = 0, p = parentOf(f), guard = 0; while (p && guard++ < 50) { d += 1; p = parentOf(p); } return d; };
const isInside = (f, ancestorId) => { let p = parentOf(f), guard = 0; while (p && guard++ < 50) { if (p.id === ancestorId) return true; p = parentOf(p); } return false; };
/** How many folder levels sit below this folder (0 = it holds no folders). */
const levelsBelow = (f) => Math.max(0, ...state.folders.filter(c => !c.deletedAt && isCollection(c) && parentOf(c)?.id === f.id).map(c => 1 + levelsBelow(c)));

/** Can this notebook / folder sit inside that folder (null = top level)? */
export function canPlace(id, parentId) {
  const item = getFolder(id);
  if (!item) return false;
  if (!parentId) return true;
  const parent = getFolder(parentId);
  if (!parent || !isCollection(parent) || parent.deletedAt || parent.id === id || isInside(parent, id)) return false;
  const above = depthOf(parent) + 1;                                       // folders above the item once it is in
  return isCollection(item) ? above + 1 + levelsBelow(item) <= maxLevels() : above <= maxLevels();
}

const liveFolders = () => state.folders.filter(f => !f.deletedAt);
/** What sits directly inside a folder (null = the top level): notebooks and folders, in the order you arranged them. */
export const childrenOf = (parentId = null) => liveFolders().filter(f => (parentOf(f)?.id || null) === (parentId || null)).sort(bySlot);
export const topLevel = () => childrenOf(null);
/** Every notebook that is not in Trash, in sidebar order (folders are left out: this feeds pickers, search and counts). */
export function folders() {
  const out = [];
  const walk = (pid) => childrenOf(pid).forEach(f => (isCollection(f) ? walk(f.id) : out.push(f)));
  walk(null);
  return out;
}
export const collections = () => liveFolders().filter(isCollection).sort(bySlot);
export const trashedFolders = () => state.folders.filter(f => f.deletedAt && !isCollection(f)).sort((a, b) => b.deletedAt - a.deletedAt);
/** "Work / Projects": a notebook's name with the folders around it. */
export function folderPath(id) {
  const f = getFolder(id);
  if (!f) return '';
  const names = [f.name];
  for (let p = parentOf(f), guard = 0; p && guard++ < 50; p = parentOf(p)) names.unshift(p.name);
  return names.join(' / ');
}
/** Notebooks inside a folder (and the folders under it), counted. */
export const notebookCount = (id) => childrenOf(id).reduce((sum, f) => sum + (isCollection(f) ? notebookCount(f.id) : 1), 0);
export const notesInFolder = (folderId) =>
  state.notes.filter(n => n.type === 'note' && live(n) && n.folderId === folderId).sort(byUpdated);
export const looseNotes = () =>
  state.notes.filter(n => n.type === 'note' && live(n) && !n.folderId).sort(byUpdated);
export const recentNotes = () =>
  state.notes.filter(n => n.type === 'note' && live(n) && !folderTrashed(n)).sort(byUpdated);
export const journalEntries = () =>
  state.notes.filter(n => n.type === 'journal' && live(n)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
export const trashedNotes = () =>
  state.notes.filter(n => !live(n)).sort((a, b) => b.deletedAt - a.deletedAt);
/** tag → number of blocks using it (live notes only). Feeds the #tag suggestions. */
export function tagCounts() {
  const counts = new Map();
  for (const note of state.notes) {
    if (!live(note) || folderTrashed(note) || note.type === 'template' || note.type === 'map' || note.type === 'maptemplate') continue;
    for (const block of note.blocks || []) for (const t of block.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return counts;
}

/** Every block (from the notes' block indexes) that carries a tag, newest note first. */
export function blocksWithTag(tag) {
  return matchBlocks(searchableNotes(), { tags: [String(tag || '').toLowerCase()] });
}
export const noteCount = (folderId) => notesInFolder(folderId).length;

/* ---------- Writing: notes ---------- */

function touch(note, kind = 'change') {
  note.updatedAt = Math.max(Date.now(), (note.updatedAt || 0) + 1); // always strictly newer than the last version
  state.dirtyNotes.add(note.id);
  persist();
  emit(kind, { id: note.id });
  emit('dirty');
}

export function createNote({ folderId = null, type = 'note', date = null, html = '<h1><br></h1>' } = {}) {
  const now = Date.now();
  const note = { id: uid(), type, date, folderId, html, title: deriveTitle(html), createdAt: now, updatedAt: now, deletedAt: null };
  ensureBlocks(note);
  state.notes.push(note);
  touch(note);
  return note;
}

/** Called by the editor (debounced) while typing. */
export function updateNoteContent(id, html) {
  const note = getNote(id);
  if (!note || note.html === html) return;
  note.html = html;
  note.title = deriveTitle(html);
  note.blocks = indexHtml(html);
  touch(note, 'content');
}

export function moveNote(id, folderId) {
  const note = getNote(id);
  if (!note) return;
  note.folderId = folderId || null;
  touch(note);
}

/** The writing font of one note: 'sans' (the default, stored as nothing), 'mono' or 'serif'. Syncs with the note. */
export function setNoteFont(id, font) {
  const note = getNote(id);
  if (!note) return;
  const next = font === 'mono' || font === 'serif' ? font : null;
  if ((note.font || null) === next) return;
  if (next) note.font = next; else delete note.font;
  touch(note, 'content'); // the page is not redrawn; the caller updates the editor's font in place
}

/** Pinned notes sit in the sidebar's Pinned section and lead Home. note.pinned = when it was pinned (newest first); it syncs with the note. */
export const pinnedNotes = () =>
  state.notes.filter(n => live(n) && !folderTrashed(n) && n.pinned).sort((a, b) => b.pinned - a.pinned);
export function setNotePinned(id, on) {
  const note = getNote(id);
  if (!note) return;
  if (on) note.pinned = Date.now(); else delete note.pinned;
  touch(note, 'content'); // the sidebar redraws; the caller redraws Home if that is the page
}

/** Write ('edit') or Read for one note. The default (config.js → defaults.mode) is stored as nothing. Syncs with the note. */
export const noteMode = (note) => (note?.mode === 'read' || note?.mode === 'edit' ? note.mode : CONFIG.defaults.mode);
export function setNoteMode(id, mode) {
  const note = getNote(id);
  if (!note) return;
  const next = mode === CONFIG.defaults.mode ? null : mode;
  if ((note.mode || null) === next) return;
  if (next) note.mode = next; else delete note.mode;
  touch(note, 'content'); // the caller rebuilds the page so the editor opens editable or read-only
}

export const trashNote = (id) => { const n = getNote(id); if (n) { n.deletedAt = Date.now(); touch(n); } };

export function restoreNote(id) {
  const n = getNote(id);
  if (!n) return;
  n.deletedAt = null;
  if (n.folderId && (!getFolder(n.folderId) || getFolder(n.folderId).deletedAt)) n.folderId = null; // its notebook is gone or in Trash
  touch(n);
}

export function deleteNotePermanently(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  state.dirtyNotes.delete(id);
  state.pendingPurge.add(id);
  persist();
  emit('change');
  emit('dirty');
}

export function emptyTrash() {
  trashedNotes().forEach(n => deleteNotePermanently(n.id));
  trashedFolders().forEach(f => deleteFolderPermanently(f.id));
}

/** One journal entry per day. Starts with the date as its title. */
export function getOrCreateJournal(dateKey) {
  const existing = state.notes.find(n => n.type === 'journal' && n.date === dateKey && live(n));
  if (existing) return existing;
  return createNote({ type: 'journal', date: dateKey, html: `<h1>${escapeHtml(formatJournalDate(dateKey))}</h1><p><br></p>` });
}

/* ---------- Templates ---------- */
/* Your own templates are notes of type 'template': they sync like notes, but lists, search and threads leave them out.
   The built-in ones live in config.js → templates. "{date}" in a template becomes today's date when it is used. */

export const templates = () =>
  state.notes.filter(n => n.type === 'template' && live(n)).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

function templateBody(html, fill) {
  const body = new DOMParser().parseFromString(`<body>${sanitizeHtml(html || '')}</body>`, 'text/html').body;
  body.querySelectorAll('[data-bid]').forEach(el => el.removeAttribute('data-bid'));        // the new note gets its own block ids
  body.querySelectorAll('[data-due]').forEach(el => el.removeAttribute('data-due'));        // old dates would be wrong
  body.querySelectorAll('li[data-check]').forEach(el => el.setAttribute('data-check', 'false'));   // checklist items start unticked (tags stay)
  const out = body.innerHTML;
  return fill ? out.split('{date}').join(escapeHtml(formatJournalDate(todayKey()))) : out;
}

/** A new note from template HTML. */
export const createFromTemplate = (html, { folderId = null } = {}) => createNote({ folderId, html: templateBody(html, true) });

/** Saves a copy of a note as one of your templates. */
export function saveAsTemplate(id) {
  const note = getNote(id);
  return note ? createNote({ type: 'template', html: templateBody(note.html, false) }) : null;
}

/* ---------- Threads ---------- */

export const threads = () => state.threads.filter(t => !t.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
export const getThread = (id) => state.threads.find(t => t.id === id && !t.deletedAt) || null;

/** Notes that searches and threads look at: not in Trash, not in a notebook that is in Trash. */
export const searchableNotes = () => state.notes.filter(n => live(n) && !folderTrashed(n) && n.type !== 'template' && n.type !== 'map' && n.type !== 'maptemplate');   // maps have no text blocks: they stay out of search blocks, tags, threads, tasks and links

/* ---------- Mind maps: notes of type 'map' (the data is note.map, see js/maps/model.js) ---------- */

export const maps = () => state.notes.filter(n => n.type === 'map' && live(n) && !folderTrashed(n)).sort((a, b) => b.updatedAt - a.updatedAt);

export function createMap({ folderId = null } = {}) {
  const now = Date.now();
  const note = { id: uid(), type: 'map', folderId, html: '', title: 'Untitled map', blocks: [], map: newMap(), createdAt: now, updatedAt: now, deletedAt: null };
  state.notes.push(note);
  touch(note);
  return note;
}

/* Map templates: a copy of a whole map (look + content), kept as a note of type 'maptemplate' so it syncs like everything else. */
export const mapTemplates = () =>
  state.notes.filter(n => n.type === 'maptemplate' && live(n)).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

export function saveMapAsTemplate(id, name) {
  const src = getNote(id);
  if (!src || src.type !== 'map') return null;
  const now = Date.now();
  const note = { id: uid(), type: 'maptemplate', folderId: null, html: '', title: (name || '').trim() || mapTitle(src.map), blocks: [], map: JSON.parse(JSON.stringify(src.map)), createdAt: now, updatedAt: now, deletedAt: null };
  state.notes.push(note);
  touch(note);
  return note;
}

export function createMapFromTemplate(id, { folderId = null } = {}) {
  const tpl = getNote(id);
  if (!tpl || tpl.type !== 'maptemplate') return null;
  const note = createMap({ folderId });
  note.map = JSON.parse(JSON.stringify(tpl.map));
  note.title = mapTitle(note.map);
  touch(note);
  return note;
}

/** Called (debounced) by the map canvas after every change: keeps the name = the central node, and saves + syncs. */
export function touchMap(id, map) {
  const n = getNote(id);
  if (!n || n.type !== 'map') return;
  if (map) n.map = map;
  n.title = mapTitle(n.map);
  touch(n, 'content');   // 'content' = never redraw the page under the canvas
}

/** Theme / line style / layout of a map (from the ⋯ menu). */
export function setMapOptions(id, patch) {
  const n = getNote(id);
  if (!n || n.type !== 'map') return;
  const ok = { theme: THEMES, line: LINES, layout: LAYOUTS };
  for (const [k, v] of Object.entries(patch)) if (ok[k]?.some(([val]) => val === v)) n.map[k] = v;
  if (patch.layout === 'both') rebalance(n.map);   // coming back from Right only: share the branches between the two sides again
  touch(n, 'change');
}

function touchThreads() {
  state.threadsUpdatedAt = Date.now();
  state.threadsDirty = true;
  persist();
  emit('thread');   // the thread page repaints itself; nothing else redraws
  emit('dirty');
}

export function createThread({ title = 'Untitled thread', rules } = {}) {
  const now = Date.now();
  const thread = { id: uid(), title, rules: normalizeRules(rules), live: true, frozen: null, createdAt: now, updatedAt: now, deletedAt: null };
  state.threads.push(thread);
  touchThreads();
  return thread;
}

/** patch: { title?, rules? (merged), live?, frozen? } */
export function updateThread(id, patch = {}) {
  const t = getThread(id);
  if (!t) return null;
  if ('title' in patch) t.title = String(patch.title).trim().slice(0, 120) || 'Untitled thread';
  if ('rules' in patch) t.rules = normalizeRules({ ...t.rules, ...patch.rules });
  if ('live' in patch) t.live = !!patch.live;
  if ('frozen' in patch) t.frozen = patch.frozen;
  t.updatedAt = Date.now();
  touchThreads();
  return t;
}

export function deleteThread(id) {
  const t = getThread(id);
  if (!t) return;
  t.deletedAt = t.updatedAt = Date.now();   // kept as a marker so the deletion reaches your other devices
  touchThreads();
}

/* ---------- Writing: notebooks ---------- */

function touchFolders() {
  state.foldersUpdatedAt = Date.now();
  state.foldersDirty = true;
  persist();
  emit('change');
  emit('dirty');
}

export function createFolder(name, { parentId = null } = {}) {
  const folder = { id: uid(), name: name.trim() || 'Untitled notebook', description: '', createdAt: Date.now() };
  state.folders.push(folder);
  if (parentId && canPlace(folder.id, parentId)) folder.parentId = parentId;
  touchFolders();
  return folder;
}

/** A folder for notebooks. */
export function createCollection(name, { parentId = null } = {}) {
  const folder = { id: uid(), kind: 'collection', name: (name || '').trim() || 'New folder', description: '', createdAt: Date.now() };
  state.folders.push(folder);
  if (parentId && canPlace(folder.id, parentId)) folder.parentId = parentId;
  touchFolders();
  return folder;
}

/** Puts every sibling of a container in order, with the moved item at `index`. No save. */
function arrange(parentId, item, index) {
  const sibs = childrenOf(parentId).filter(x => x.id !== item.id);
  sibs.splice(Math.max(0, Math.min(index, sibs.length)), 0, item);
  sibs.forEach((x, i) => { x.ord = i; });
}
const indexIn = (parentId, id, itemId) => childrenOf(parentId).filter(x => x.id !== itemId).findIndex(x => x.id === id);

/** Moves a notebook or folder: into a folder (parentId) or to the top level (null), optionally right before / after a sibling. */
export function placeFolder(id, { parentId = null, before = null, after = null } = {}) {
  const f = getFolder(id);
  if (!f || !canPlace(id, parentId)) return false;
  let index = Infinity;
  const ref = before || after;
  if (ref) { const i = indexIn(parentId, ref, id); if (i >= 0) index = before ? i : i + 1; }
  if (parentId) f.parentId = parentId; else delete f.parentId;
  arrange(parentId, f, index);
  touchFolders();
  return true;
}

/** Can notebook A be dropped onto notebook B to make a folder of the two? (Not when there is no room for one more folder level.) */
export function canGroup(dragId, targetId) {
  const a = getFolder(dragId), b = getFolder(targetId);
  if (!a || !b || a.id === b.id || isCollection(a) || isCollection(b)) return false;
  const parent = parentOf(b);
  return (parent ? depthOf(parent) + 1 : 0) + 1 <= maxLevels();
}

/** Drop a notebook onto another notebook: both go into a new folder that takes the target's place. → the new folder, or null. */
export function groupFolders(dragId, targetId, name = 'New folder') {
  if (!canGroup(dragId, targetId)) return null;
  const a = getFolder(dragId), b = getFolder(targetId);
  const parent = parentOf(b);
  const coll = { id: uid(), kind: 'collection', name, description: '', createdAt: Date.now() };
  state.folders.push(coll);
  const parentId = parent?.id || null;
  if (parentId) coll.parentId = parentId;
  arrange(parentId, coll, indexIn(parentId, b.id, coll.id));
  b.parentId = coll.id; b.ord = 0;
  a.parentId = coll.id; a.ord = 1;
  touchFolders();
  return coll;
}

/** Deletes a folder but keeps what is inside: its notebooks move up to where the folder was. */
export function ungroupCollection(id) {
  const c = getFolder(id);
  if (!isCollection(c)) return false;
  const parentId = parentOf(c)?.id || null;
  const sibs = childrenOf(parentId);
  const at = sibs.findIndex(x => x.id === id);
  const kids = state.folders.filter(f => f.parentId === id);          // includes notebooks in Trash: they come back at the top level
  const live = kids.filter(f => !f.deletedAt).sort(bySlot);
  kids.forEach(f => { if (parentId) f.parentId = parentId; else delete f.parentId; });
  state.folders = state.folders.filter(f => f.id !== id);
  const order = sibs.filter(x => x.id !== id);
  order.splice(at < 0 ? order.length : at, 0, ...live);
  order.forEach((x, i) => { x.ord = i; });
  touchFolders();
  return true;
}

/** A copy of the folder list, so a move can be undone. */
export const foldersSnapshot = () => JSON.parse(JSON.stringify(state.folders));
export function restoreFoldersSnapshot(snapshot) {
  if (!Array.isArray(snapshot)) return;
  state.folders = JSON.parse(JSON.stringify(snapshot));
  touchFolders();
}

/** Edit panel: name, description and how the notebook's notes are shown ('gallery' | 'list'). */
export function updateFolder(id, { name, description, viewStyle } = {}) {
  const f = getFolder(id);
  if (!f) return;
  const nextName = (name ?? f.name).trim() || f.name;
  const nextDesc = (description ?? f.description ?? '').trim();
  const nextView = viewStyle === 'list' || viewStyle === 'gallery' ? viewStyle : (f.viewStyle || '');
  if (nextName === f.name && nextDesc === (f.description || '') && nextView === (f.viewStyle || '')) return;
  f.name = nextName;
  f.description = nextDesc;
  if (nextView) f.viewStyle = nextView;
  touchFolders();
}

/** How the notes of one notebook are sorted: 'edited' (the default, stored as nothing), 'created' or 'name'. Syncs with the notebook. */
export function setFolderSort(id, sort) {
  const f = getFolder(id);
  if (!f) return;
  const next = sort === 'created' || sort === 'name' ? sort : '';
  if ((f.sort || '') === next) return;
  if (next) f.sort = next; else delete f.sort;
  touchFolders();
}

export function renameFolder(id, name) {
  const f = getFolder(id);
  if (f && name.trim()) { f.name = name.trim(); touchFolders(); }
}

/** A notebook goes to Trash together with its notes; restoring it brings them all back. */
export function trashFolder(id) {
  const f = getFolder(id);
  if (f) { f.deletedAt = Date.now(); touchFolders(); }
}

export function restoreFolder(id) {
  const f = getFolder(id);
  if (f) { f.deletedAt = null; touchFolders(); }
}

/** Removes a notebook and every note inside it, for good. */
export function deleteFolderPermanently(id) {
  if (isCollection(getFolder(id))) return ungroupCollection(id);
  state.notes.filter(n => n.folderId === id).forEach(n => deleteNotePermanently(n.id));
  state.folders = state.folders.filter(f => f.id !== id);
  touchFolders();
}

/* ---------- Rename and duplicate (the ⋯ menus) ---------- */

/** A note's name is its first line of text: renaming rewrites that line (or adds a heading when the note starts with something else). */
export function renameNote(id, title) {
  const note = getNote(id);
  const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!note || note.type === 'map' || !t) return false;
  const body = new DOMParser().parseFromString(`<body>${sanitizeHtml(note.html || '')}</body>`, 'text/html').body;
  const first = [...body.children].find(el => el.textContent.trim());
  if (first && /^(H[1-4]|P|DIV|BLOCKQUOTE)$/.test(first.tagName)) first.textContent = t;
  else body.insertAdjacentHTML('afterbegin', `<h1>${escapeHtml(t)}</h1>`);
  note.html = body.innerHTML;
  note.title = deriveTitle(note.html);
  note.blocks = indexHtml(note.html);
  touch(note, 'change');
  return true;
}

/** A copy of a note (or map) next to the original. */
export function duplicateNote(id) {
  const src = getNote(id);
  if (!src || (src.type !== 'note' && src.type !== 'map')) return null;
  const now = Date.now();
  const copy = JSON.parse(JSON.stringify(src));
  Object.assign(copy, { id: uid(), createdAt: now, updatedAt: now, deletedAt: null, pinned: false });
  if (copy.type === 'map') {
    copy.title = `${src.title || 'Untitled map'} copy`;
    const root = copy.map?.nodes?.[copy.map.root];
    if (root) root.t = [copy.title, ...(root.t || '').split('\n').slice(1)].join('\n');
  } else {
    const fresh = migrateHtml((src.html || '').replace(/\sdata-bid="[^"]*"/g, ''), copy.id);   // the blocks of the copy get ids of their own
    copy.html = fresh.html;
    copy.blocks = fresh.blocks;
    copy.title = deriveTitle(copy.html);
  }
  state.notes.push(copy);
  touch(copy);
  return copy;
}

/** A map's name is the first line of its central node. */
export function renameMap(id, title) {
  const n = getNote(id);
  const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!n || n.type !== 'map' || !t) return false;
  const root = n.map.nodes[n.map.root];
  const rest = (root.t || '').split('\n').slice(1);
  root.t = [t, ...rest].join('\n');
  n.title = mapTitle(n.map);
  touch(n, 'change');
  return true;
}

/** A copy of a thread with the same rules. */
export function duplicateThread(id) {
  const t = getThread(id);
  if (!t) return null;
  return createThread({ title: `${t.title} copy`, rules: JSON.parse(JSON.stringify(t.rules)) });
}

/* ---------- Sync support (used only by sync.js) ---------- */

export const pending = () => ({
  notes: [...state.dirtyNotes].map(getNote).filter(Boolean),
  purge: [...state.pendingPurge],
  folders: state.foldersDirty ? { folders: state.folders, updatedAt: state.foldersUpdatedAt } : null,
  threads: state.threadsDirty ? { threads: state.threads, updatedAt: state.threadsUpdatedAt } : null,
});

export function clearDirty(id, sentUpdatedAt) {
  const n = getNote(id);
  if (!n || n.updatedAt === sentUpdatedAt) { state.dirtyNotes.delete(id); persist(); }
}
export function clearPurge(id) { state.pendingPurge.delete(id); persist(); }
export function clearFoldersDirty(sentUpdatedAt) {
  if (state.foldersUpdatedAt === sentUpdatedAt) { state.foldersDirty = false; persist(); }
}

export function clearThreadsDirty(sentUpdatedAt) {
  if (state.threadsUpdatedAt === sentUpdatedAt) { state.threadsDirty = false; persist(); }
}

/** Server copy of a note won (it was newer) → adopt it. */
export function adoptRemoteNote(remote) {
  if (remote.purged) { removeLocal(remote.id); } else {
    ensureBlocks(remote);
    const i = state.notes.findIndex(n => n.id === remote.id);
    if (i >= 0) state.notes[i] = remote; else state.notes.push(remote);
    state.dirtyNotes.delete(remote.id);
  }
  persist();
  emit('remote', { ids: [remote.id] });
}

export function adoptRemoteFolders({ folders: remote, updatedAt }) {
  state.folders = remote || [];
  state.foldersUpdatedAt = updatedAt || 0;
  state.foldersDirty = false;
  persist();
  emit('remote', { ids: [] });
}

export function adoptRemoteThreads({ threads: remote, updatedAt }) {
  state.threads = remote || [];
  state.threadsUpdatedAt = updatedAt || 0;
  state.threadsDirty = false;
  persist();
  emit('remote', { ids: [] });
}

function removeLocal(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  state.dirtyNotes.delete(id);
}

/** Merge a full server snapshot. Newer updatedAt wins; local unsent edits are never overwritten. */
export function applyRemote({ notes = [], folders: remoteFolders, foldersUpdatedAt = 0, threads: remoteThreads, threadsUpdatedAt = 0 }) {
  const changedIds = [];
  const remoteIds = new Set();

  for (const r of notes) {
    remoteIds.add(r.id);
    if (state.pendingPurge.has(r.id)) continue;
    if (r.purged) { if (getNote(r.id)) { removeLocal(r.id); changedIds.push(r.id); } continue; }
    const local = getNote(r.id);
    if (!local) { ensureBlocks(r); state.notes.push(r); changedIds.push(r.id); continue; }
    if (state.dirtyNotes.has(r.id)) continue; // our unsent edit; the server decides when we push
    if (r.updatedAt > local.updatedAt) {
      Object.assign(local, r);
      if (!Array.isArray(r.blocks)) local.blocks = undefined; // server copy predates blocks → rebuild
      ensureBlocks(local);
      changedIds.push(r.id);
    }
  }

  // Notes the server doesn't have yet (e.g. fresh database) → upload them.
  state.notes.forEach(n => { if (!remoteIds.has(n.id)) state.dirtyNotes.add(n.id); });

  let foldersChanged = false;
  if (!state.foldersDirty && remoteFolders && foldersUpdatedAt > state.foldersUpdatedAt) {
    state.folders = remoteFolders;
    state.foldersUpdatedAt = foldersUpdatedAt;
    foldersChanged = true;
  } else if (!remoteFolders && state.folders.length) {
    state.foldersDirty = true; // server has no folder list → upload ours
  }

  // remoteThreads === undefined means "the server does not know threads (yet)": leave them alone.
  let threadsChanged = false;
  if (remoteThreads !== undefined) {
    if (!state.threadsDirty && remoteThreads && threadsUpdatedAt > state.threadsUpdatedAt) {
      state.threads = remoteThreads;
      state.threadsUpdatedAt = threadsUpdatedAt;
      threadsChanged = true;
    } else if (!remoteThreads && state.threads.length) {
      state.threadsDirty = true; // server has no thread list → upload ours
    }
  }

  persist();
  if (changedIds.length || foldersChanged || threadsChanged) emit('remote', { ids: changedIds });
  if (state.dirtyNotes.size || state.foldersDirty || state.threadsDirty) emit('dirty');
}

/** Everything, for the "Download all" backup. */
export const exportAll = () => ({
  app: CONFIG.appName,
  version: 1,
  exportedAt: new Date().toISOString(),
  folders: state.folders,
  threads: state.threads.filter(t => !t.deletedAt),
  notes: state.notes,
});
