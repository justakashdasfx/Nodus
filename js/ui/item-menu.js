/* ============================================================================
   ITEM MENU — the ⋯ button (and right-click) on every card and row: notes, notebooks, folders, mind maps, threads, tasks.
   One place decides what each kind of item offers (itemsFor below); an entry is an ordinary data-action, so the menu
   (js/ui/popmenu.js) just runs it. The ⋯ button itself is made by moreBtn() in js/ui/components.js, and any card or row can carry
   data-item="kind:id" so right-click opens the same menu.

   kind: note · map · notebook · folder · thread · task   (a task's id is "noteId:blockId")
   Tags are left out on purpose. Tasks have no Delete: a task is a line inside its note.
   ========================================================================== */

import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { registerActions } from '../core/actions.js';
import { go, parseRoute } from '../core/router.js';
import { setTaskDue } from '../core/tasks.js';
import * as modal from './modal.js';
import { openPopMenu } from './popmenu.js';
import * as tasks from '../views/tasks.js';

const entry = (label, ic, action, data = {}, more = {}) => ({ label, ic, action, data, ...more });
const SEP = { sep: true };

/* ---------- What each kind offers ---------- */

function itemsFor(kind, id) {
  if (kind === 'note') {
    const n = store.getNote(id);
    if (!n) return [];
    return [
      entry('Open', 'arrowRight', 'item-open', { href: `#/note/${id}` }),
      entry('Rename', 'pencil', 'note-rename', { id }),
      entry(n.pinned ? 'Unpin from sidebar' : 'Pin to sidebar', n.pinned ? 'unpin' : 'pin', 'note-pin', { id }),
      SEP,
      entry('Move to notebook…', 'notebook', 'note-move-pick', { id }),
      entry('Duplicate', 'copy', 'note-duplicate', { id }),
      SEP,
      entry('Move to Trash', 'trash', 'note-trash', { id }, { danger: true }),
    ];
  }
  if (kind === 'map') {
    if (!store.getNote(id)) return [];
    return [
      entry('Open', 'arrowRight', 'item-open', { href: `#/map/${id}` }),
      entry('Rename', 'pencil', 'map-rename', { id }),
      SEP,
      entry('Move to notebook…', 'notebook', 'note-move-pick', { id }),
      entry('Duplicate', 'copy', 'note-duplicate', { id }),
      entry('Save as template', 'copy', 'map-template-save', { id }),
      SEP,
      entry('Move to Trash', 'trash', 'note-trash', { id }, { danger: true }),
    ];
  }
  if (kind === 'notebook') {
    if (!store.getFolder(id)) return [];
    const out = [
      entry('Open', 'arrowRight', 'item-open', { href: `#/notebook/${id}` }),
      entry('New note here', 'plus', 'note-new', { folder: id }),
      SEP,
      entry('Rename', 'pencil', 'notebook-rename', { id }),
      entry('Edit notebook…', 'pencil', 'notebook-edit', { id }),
    ];
    const hasHome = store.collections().some(c => store.canPlace(id, c.id) && store.parentFolder(id)?.id !== c.id);
    if (hasHome || store.parentFolder(id)) out.push(SEP);
    if (hasHome) out.push(entry('Move to folder…', 'folder', 'notebook-move-pick', { id }));
    if (store.parentFolder(id)) out.push(entry('Remove from folder', 'arrowUp', 'notebook-unparent', { id }));
    out.push(SEP, entry('Delete notebook', 'trash', 'notebook-delete', { id }, { danger: true }));
    return out;
  }
  if (kind === 'folder') {
    if (!store.getFolder(id)) return [];
    const out = [
      entry('Open', 'arrowRight', 'item-open', { href: `#/collection/${id}` }),
      entry('New notebook here', 'plus', 'notebook-new', { parent: id }),
      SEP,
      entry('Rename', 'pencil', 'coll-rename', { id }),
    ];
    const hasHome = store.collections().some(c => store.canPlace(id, c.id) && store.parentFolder(id)?.id !== c.id);
    if (hasHome) out.push(entry('Move to folder…', 'folder', 'notebook-move-pick', { id }));
    if (store.parentFolder(id)) out.push(entry('Remove from folder', 'arrowUp', 'notebook-unparent', { id }));
    out.push(SEP, entry('Delete folder', 'trash', 'coll-delete', { id }, { danger: true }));
    return out;
  }
  if (kind === 'thread') {
    if (!store.getThread(id)) return [];
    return [
      entry('Open', 'arrowRight', 'item-open', { href: `#/thread/${id}` }),
      entry('Rename', 'pencil', 'thread-rename', { id }),
      entry('Duplicate', 'copy', 'thread-duplicate', { id }),
      SEP,
      entry('Delete thread', 'trash', 'thread-delete', { id }, { danger: true }),
    ];
  }
  if (kind === 'task') {
    const [noteId, blockId] = String(id).split(':');
    const block = store.getNote(noteId)?.blocks?.find(b => b.id === blockId);
    if (!block) return [];
    const done = block.chk === 1;
    return [
      entry('Open note', 'arrowRight', 'item-open', { href: `#/note/${noteId}/${blockId}` }),
      entry(done ? 'Mark as not done' : 'Mark as done', 'check', 'task-toggle', { note: noteId, block: blockId }),
      SEP,
      entry(block.due ? 'Change date…' : 'Set a date…', 'calendar', 'task-due-pick', { note: noteId, block: blockId }),
      ...(block.due ? [entry('Remove date', 'close', 'task-due-clear', { note: noteId, block: blockId })] : []),
    ];
  }
  return [];
}

/* ---------- Pickers ---------- */

const where = (f) => store.folderPath(f.id);

async function pickNotebook(title, current) {
  const res = await modal.pick({
    title,
    sections: [{ label: 'Move to', items: [{ id: '', label: 'Inbox', sub: current === '' ? 'Current' : '' }, ...store.folders().map(f => ({ id: f.id, label: where(f), sub: current === f.id ? 'Current' : '' }))] }],
  });
  return res ? res.id : undefined;       // undefined = cancelled ('' is Inbox)
}

async function pickFolder(id) {
  const here = store.parentFolder(id)?.id || null;
  const options = store.collections().filter(c => store.canPlace(id, c.id) && c.id !== here);
  const res = await modal.pick({
    title: 'Move to folder',
    sections: [{ label: 'Move to', items: [...(here ? [{ id: '', label: 'Top level', sub: 'Notebooks' }] : []), ...options.map(c => ({ id: c.id, label: where(c) }))] }],
  });
  return res ? res.id : undefined;       // '' = the top level
}

/* ---------- Actions ---------- */

export function initItemMenu({ toast, toastUndo, redraw }) {
  const expand = (id) => { const open = settings.getExpanded(); open.add(id); settings.setExpanded(open); };
  const name = async (title, label, value) => {
    const v = await modal.prompt({ title, label, value, confirmLabel: 'Save' });
    return v && v.trim() ? v.trim() : null;
  };

  registerActions({
    'item-more': (el) => openPopMenu(el, itemsFor(el.dataset.kind, el.dataset.id)),
    'item-open': (el) => go(el.dataset.href),

    /* notes and maps */
    'note-rename': async (el) => {
      const n = store.getNote(el.dataset.id);
      const v = n && await name('Rename note', 'Note name', n.title || '');
      if (v) store.renameNote(n.id, v);
    },
    'map-rename': async (el) => {
      const n = store.getNote(el.dataset.id);
      const v = n && await name('Rename mind map', 'Map name', n.title || '');
      if (v) store.renameMap(n.id, v);
    },
    'note-duplicate': (el) => {
      const copy = store.duplicateNote(el.dataset.id);
      if (copy) toast(copy.type === 'map' ? 'Mind map duplicated' : 'Note duplicated');
    },
    'note-move-pick': async (el) => {
      const n = store.getNote(el.dataset.id);
      if (!n) return;
      const was = n.folderId || '';
      const to = await pickNotebook(n.type === 'map' ? 'Move mind map' : 'Move note', was);
      if (to === undefined || to === was) return;
      store.moveNote(n.id, to || null);
      toastUndo(`Moved to ${to ? (store.getFolder(to)?.name || 'notebook') : 'Inbox'}`, () => store.moveNote(n.id, was || null));
    },

    /* threads */
    'thread-rename': async (el) => {
      const t = store.getThread(el.dataset.id);
      const v = t && await name('Rename thread', 'Thread name', t.title);
      if (v) { store.updateThread(t.id, { title: v }); redraw(); }
    },
    'thread-duplicate': (el) => {
      if (store.duplicateThread(el.dataset.id)) { toast('Thread duplicated'); redraw(); }
    },

    /* tasks */
    'task-due-pick': async (el) => {
      const btn = document.querySelector(`.tk-row [data-action="task-due"][data-note="${el.dataset.note}"][data-block="${el.dataset.block}"]`);
      if (btn && await tasks.editDue(btn)) redraw();
    },
    'task-due-clear': (el) => { if (setTaskDue(el.dataset.note, el.dataset.block, '')) redraw(); },

    /* folders: new, rename, delete (ungroup), move in and out */
    'coll-new': async () => {
      const r = parseRoute();
      const parent = r.view === 'collection' && store.getFolder(r.id) ? r.id : null;
      const v = await name('New folder', 'Folder name', 'New folder');
      if (!v) return;
      const f = store.createCollection(v, { parentId: parent });
      if (parent) expand(parent);
      toast(`Folder “${f.name}” created. Drag notebooks into it.`);
    },
    'coll-rename': async (el) => {
      const f = store.getFolder(el.dataset.id);
      const v = f && await name('Rename folder', 'Folder name', f.name);
      if (v) store.renameFolder(f.id, v);
    },
    'coll-delete': async (el) => {
      const f = store.getFolder(el.dataset.id);
      if (!f) return;
      const count = store.childrenOf(f.id).length;
      const ok = await modal.confirm({
        title: `Delete the folder “${f.name}”?`,
        message: count
          ? `Only the folder is deleted. Its ${count} ${count === 1 ? 'item' : 'items'} will be kept and move up to where the folder was.`
          : 'The empty folder will be deleted.',
        confirmLabel: 'Delete folder',
      });
      if (!ok) return;
      const snap = store.foldersSnapshot();
      const up = store.parentFolder(f.id);
      store.ungroupCollection(f.id);
      const r = parseRoute();
      if (r.view === 'collection' && r.id === f.id) go(up ? `#/collection/${up.id}` : '#/notebooks');
      toastUndo('Folder deleted. Its notebooks were kept.', () => store.restoreFoldersSnapshot(snap));
    },
    'notebook-move-pick': async (el) => {
      const f = store.getFolder(el.dataset.id);
      if (!f) return;
      const to = await pickFolder(f.id);
      if (to === undefined) return;
      const snap = store.foldersSnapshot();
      if (store.placeFolder(f.id, { parentId: to || null })) {
        if (to) expand(to);
        toastUndo(to ? `Moved “${f.name}” into “${store.getFolder(to)?.name}”` : `Moved “${f.name}” to the top level`, () => store.restoreFoldersSnapshot(snap));
      }
    },
    'notebook-unparent': (el) => {
      const f = store.getFolder(el.dataset.id);
      if (!f) return;
      const snap = store.foldersSnapshot();
      if (store.placeFolder(f.id, { parentId: null })) toastUndo(`Moved “${f.name}” out of its folder`, () => store.restoreFoldersSnapshot(snap));
    },
  });

  /* Right-click on any card or row that carries data-item="kind:id" */
  document.addEventListener('contextmenu', (e) => {
    const host = e.target.closest?.('[data-item]');
    if (!host || e.target.closest('input, textarea, [contenteditable="true"], .editor')) return;
    const [kind, ...rest] = host.dataset.item.split(':');
    const items = itemsFor(kind, rest.join(':'));
    if (!items.length) return;
    e.preventDefault();
    const rect = { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 };
    openPopMenu({ getBoundingClientRect: () => rect, contains: () => false }, items);
  });
}
