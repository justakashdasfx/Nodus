/* ============================================================================
   SIDEBAR — search box shell, Home · Inbox · Journal · Notebooks · Threads · Tasks, then the Folder → Notes tree
   (chevron · icon · name · count, with a guide line under open folders), Trash.
   Pure render function; clicks are handled in app.js through data-action.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { getExpanded, getPinnedOpen } from '../core/settings.js';
import { escapeHtml } from '../core/utils.js';
import { comboLabel } from '../core/keys.js';
import { openCount } from '../core/tasks.js';

const navItem = ({ href, iconName, label, active, count }) =>
  `<a class="nav-item ${active ? 'is-active' : ''}" href="${href}">${icon(iconName)}<span class="nav-item__label">${label}</span>${count ? `<span class="nav-item__count">${count}</span>` : ''}</a>`;

/** A note in the tree or in Pinned. Only the Pinned list gets a button: Unpin, shown on hover. */
const noteRow = (note, activeId, unpin = false) =>
  `<div class="tree-row tree-note ${note.id === activeId ? 'is-active' : ''}">
    <a class="tree-link" draggable="true" href="#/note/${note.id}">${icon('note', 16)}<span class="tree-row__label">${escapeHtml(note.title || 'Untitled')}</span></a>
    ${unpin ? `<button type="button" class="tree-pin" data-action="note-pin" data-id="${note.id}" aria-label="Unpin" title="Unpin">${icon('unpin', 14)}</button>` : ''}
  </div>`;

function folderBlock(folder, route, expanded) {
  const notes = store.notesInFolder(folder.id);
  const open = expanded.has(folder.id);
  const active = route.view === 'notebook' && route.id === folder.id;
  return `<div class="tree-folder ${open ? 'is-open' : ''}">
    <div class="tree-row tree-row--folder ${active ? 'is-active' : ''}">
      <button type="button" class="tree-caret" data-action="folder-toggle" data-id="${folder.id}" aria-label="${open ? 'Collapse' : 'Expand'} ${escapeHtml(folder.name)}" aria-expanded="${open}">${icon('caret', 14)}</button>
      <a class="tree-link" href="#/notebook/${folder.id}">${icon('folder', 16)}<span class="tree-row__label">${escapeHtml(folder.name)}</span></a>
      <span class="tree-trail">
        ${notes.length ? `<span class="tree-count">${notes.length}</span>` : ''}
        <button type="button" class="tree-add" data-action="note-new" data-folder="${folder.id}" aria-label="New note in ${escapeHtml(folder.name)}" title="New note">${icon('plus', 14)}</button>
      </span>
    </div>
    ${open ? `<div class="tree-children">${notes.length ? notes.map(n => noteRow(n, route.id)).join('') : '<p class="tree-empty">No notes yet</p>'}</div>` : ''}
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
  const expanded = getExpanded(); // toggled only by you (app.js expands a note's folder once when you open it)
  const folders = store.folders();
  const loose = store.looseNotes();
  const pinned = store.pinnedNotes();
  const pinnedOpen = getPinnedOpen();
  const trashCount = store.trashedNotes().length + store.trashedFolders().length;

  return `
    <div class="sidebar__head"></div>
    ${searchBox()}
    <nav class="sidebar__nav" aria-label="Main">
      ${navItem({ href: '#/home', iconName: 'home', label: 'Home', active: route.view === 'home' })}
      ${navItem({ href: '#/inbox', iconName: 'inbox', label: 'Inbox', active: route.view === 'inbox', count: loose.length })}
      ${navItem({ href: '#/journal', iconName: 'journal', label: 'Journal', active: route.view === 'journal' })}
      ${navItem({ href: '#/notebooks', iconName: 'notebooks', label: 'Notebooks', active: route.view === 'notebooks' })}
      ${navItem({ href: '#/tags', iconName: 'tag', label: 'Tags', active: route.view === 'tags' || route.view === 'tag', count: store.tagCounts().size })}
      ${navItem({ href: '#/threads', iconName: 'threads', label: 'Threads', active: route.view === 'threads' || route.view === 'thread' })}
      ${navItem({ href: '#/tasks', iconName: 'tasks', label: 'Tasks', active: route.view === 'tasks', count: openCount() })}
    </nav>
    ${pinned.length ? `<div class="sidebar__pinned">
      <button type="button" class="sidebar__label sidebar__label--toggle" data-action="pinned-toggle" aria-expanded="${pinnedOpen}"><span>Pinned</span><span class="sidebar__count">${pinned.length}</span></button>
      ${pinnedOpen ? `<div class="sidebar__pinned-list">${pinned.map(n => noteRow(n, route.id, true)).join('')}</div>` : ''}
    </div>` : ''}
   <div class="sidebar__label-row">
      <button type="button" class="sidebar__label sidebar__label--btn" data-action="folders-toggle-all" title="Collapse or expand all notebooks">Notebook</button>
      <button type="button" class="sidebar__label-add" data-action="notebook-new" aria-label="New notebook" title="New notebook">${icon('plus', 14)}</button>
    </div>
    <div class="sidebar__tree" aria-label="Notebooks and notes">
      ${folders.map(f => folderBlock(f, route, expanded)).join('')}
    </div>
    <div class="sidebar__foot">
      ${navItem({ href: '#/trash', iconName: 'trash', label: 'Trash', active: route.view === 'trash', count: trashCount })}
    </div>`;
}
