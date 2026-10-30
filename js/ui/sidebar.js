/* ============================================================================
   SIDEBAR — search box shell, Home · Notebooks · Tags · Threads · Tasks, Pinned, then the Notebook section
   (Inbox · Journal · every notebook; click the "Notebook" label to hide or show the whole section), Trash.
   A notebook has no caret: clicking it opens it. A folder (a collection of notebooks) opens its own page AND unfolds to show its notebooks;
   its chevron only unfolds. Notebooks and folders can be dragged onto each other (js/ui/folder-dnd.js). Notes are listed on the notebook's own page, not here.
   Every row uses the same icon size (18) and the same gap — see css/layout.css → "Sidebar rows".
   Pure render function; clicks are handled in app.js through data-action.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { getPinnedOpen, getNotebooksOpen, getExpanded } from '../core/settings.js';
import { escapeHtml } from '../core/utils.js';
import { comboLabel } from '../core/keys.js';
import { openCount } from '../core/tasks.js';

const ICON = 18;   // one icon size for every row in the sidebar

const navItem = ({ href, iconName, label, active, count }) =>
  `<a class="nav-item ${active ? 'is-active' : ''}" href="${href}">${icon(iconName, ICON)}<span class="nav-item__label">${label}</span>${count ? `<span class="nav-item__count">${count}</span>` : ''}</a>`;

/** A note in Pinned: a link, plus an Unpin button that shows on hover. */
const noteRow = (note, activeId, unpin = false) =>
  `<div class="tree-row tree-note ${note.id === activeId ? 'is-active' : ''}">
    <a class="tree-link" draggable="true" href="#/${note.type === 'map' ? 'map' : 'note'}/${note.id}">${icon(note.type === 'map' ? 'mindmap' : 'note', ICON)}<span class="tree-row__label">${escapeHtml(note.title || (note.type === 'map' ? 'Untitled map' : 'Untitled'))}</span></a>
    ${unpin ? `<button type="button" class="tree-pin" data-action="note-pin" data-id="${note.id}" aria-label="Unpin" title="Unpin">${icon('unpin', 14)}</button>` : ''}
  </div>`;

/** A plain row in the Notebook section: Inbox, Journal. */
const treeLink = ({ href, iconName, label, active }) =>
  `<div class="tree-row tree-row--folder ${active ? 'is-active' : ''}">
    <a class="tree-link" href="${href}">${icon(iconName, ICON)}<span class="tree-row__label">${label}</span></a>
  </div>`;

/** The + (new note / new notebook) and ⋯ buttons on the right of a notebook or folder row. */
const trail = (kind, f, addAction, addLabel, extra = '') => `<span class="tree-trail">
        <button type="button" class="tree-add" data-action="${addAction}" ${kind === 'folder' ? `data-parent="${f.id}"` : `data-folder="${f.id}"`} aria-label="${addLabel} in ${escapeHtml(f.name)}" title="${addLabel}">${icon('plus', 14)}</button>
        <button type="button" class="tree-add tree-more" data-action="item-more" data-kind="${kind}" data-id="${f.id}" aria-label="More" aria-haspopup="menu" title="More">${icon('more', 14)}</button>${extra}
      </span>`;

/** A notebook: no caret, no list of notes. The + adds a note to it. */
function notebookRow(folder, route) {
  const active = route.view === 'notebook' && route.id === folder.id;
  return `<div class="tree-folder">
    <div class="tree-row tree-row--folder ${active ? 'is-active' : ''}" data-fid="${folder.id}" data-item="notebook:${folder.id}">
      <a class="tree-link" draggable="true" href="#/notebook/${folder.id}">${icon('notebook', ICON)}<span class="tree-row__label">${escapeHtml(folder.name)}</span></a>
      ${trail('notebook', folder, 'note-new', 'New note')}
    </div>
  </div>`;
}

/** A folder of notebooks: click it to open its page (and unfold it); the chevron only unfolds. */
function folderBlock(folder, route, open) {
  const active = route.view === 'collection' && route.id === folder.id;
  const isOpen = open.has(folder.id);
  const kids = store.childrenOf(folder.id);
  const chevron = `<button type="button" class="tree-chev" data-action="coll-toggle" data-id="${folder.id}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Fold' : 'Unfold'} ${escapeHtml(folder.name)}">${icon('caret', 14)}</button>`;
  return `<div class="tree-coll${isOpen ? ' is-open' : ''}">
    <div class="tree-row tree-row--folder ${active ? 'is-active' : ''}" data-fid="${folder.id}" data-item="folder:${folder.id}">
      <a class="tree-link" draggable="true" href="#/collection/${folder.id}" data-action="coll-open" data-id="${folder.id}">${icon('folder', ICON)}<span class="tree-row__label">${escapeHtml(folder.name)}</span></a>
      ${trail('folder', folder, 'notebook-new', 'New notebook', chevron)}
    </div>
    ${isOpen ? `<div class="tree-children">${kids.length ? kids.map(k => (store.isCollection(k) ? folderBlock(k, route, open) : notebookRow(k, route))).join('') : '<div class="tree-empty">No notebooks yet</div>'}</div>` : ''}
  </div>`;
}

/** The Search box: opens the search window (js/ui/search.js). */
function searchBox() {
  const hint = comboLabel(CONFIG.shortcuts['search.open']).replace('+', ' ');
  return `<button type="button" class="search-box" data-action="search-open" title="Search and commands">
    ${icon('search', 16)}<span class="search-box__label">Search</span><kbd class="search-box__hint">${escapeHtml(hint)}</kbd>
  </button>`;
}

export function renderSidebar(route) {
  const items = store.topLevel();
  const expanded = getExpanded();
  const pinned = store.pinnedNotes();
  const pinnedOpen = getPinnedOpen();
  const notebooksOpen = getNotebooksOpen();
  const trashCount = store.trashedNotes().length + store.trashedFolders().length;

return `
    <div class="sidebar__head">
  <img src="/icons-ui/icon.svg" width="28" height="28" alt="" style="flex-shrink:0">
  <span class="sidebar-brand">Nodus</span>
</div>
    <nav class="sidebar__nav" aria-label="Main">
      ${navItem({ href: '#/home', iconName: 'home', label: 'Home', active: route.view === 'home' })}
      ${navItem({ href: '#/notebooks', iconName: 'notebooks', label: 'Notebooks', active: route.view === 'notebooks' })}
      ${navItem({ href: '#/tags', iconName: 'tag', label: 'Tags', active: route.view === 'tags' || route.view === 'tag', count: store.tagCounts().size })}
      ${navItem({ href: '#/threads', iconName: 'threads', label: 'Threads', active: route.view === 'threads' || route.view === 'thread' })}
      ${navItem({ href: '#/tasks', iconName: 'tasks', label: 'Tasks', active: route.view === 'tasks', count: openCount() })}
      ${navItem({ href: '#/maps', iconName: 'mindmap', label: 'Mind maps', active: route.view === 'maps' || route.view === 'map', count: store.maps().length })}
    </nav>
    ${searchBox()}
    ${pinned.length ? `<div class="sidebar__pinned">
      <button type="button" class="sidebar__label sidebar__label--toggle" data-action="pinned-toggle" aria-expanded="${pinnedOpen}"><span>Pinned</span><span class="sidebar__count">${pinned.length}</span></button>
      ${pinnedOpen ? `<div class="sidebar__pinned-list">${pinned.map(n => noteRow(n, route.id, true)).join('')}</div>` : ''}
    </div>` : ''}
    <div class="sidebar__label-row">
      <button type="button" class="sidebar__label sidebar__label--btn" data-action="notebooks-toggle" aria-expanded="${notebooksOpen}" title="Show or hide notebooks">Notebook</button>
      <button type="button" class="sidebar__label-add" data-action="notebook-new" aria-label="New notebook" title="New notebook">${icon('plus', 14)}</button>
    </div>
    <div class="sidebar__tree" aria-label="Notebooks">${notebooksOpen ? `
      <div class="tree-group tree-group--system">
        ${treeLink({ href: '#/inbox', iconName: 'inbox', label: 'Inbox', active: route.view === 'inbox' })}
        ${treeLink({ href: '#/journal', iconName: 'journal', label: 'Journal', active: route.view === 'journal' })}
      </div>
      ${items.length ? `<div class="tree-group tree-group--mine">${items.map(f => (store.isCollection(f) ? folderBlock(f, route, expanded) : notebookRow(f, route))).join('')}</div>` : ''}` : ''}
    </div>
    <div class="sidebar__foot">
      ${navItem({ href: '#/trash', iconName: 'trash', label: 'Trash', active: route.view === 'trash', count: trashCount })}
    </div>`;
}
