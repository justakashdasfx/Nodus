/* ============================================================================
   SIDEBAR — search box shell, Home · Inbox · Journal · Notebooks · Threads, then the Folder → Notes tree
   (chevron · icon · name · count, with a guide line under open folders), Trash.
   Pure render function; clicks are handled in app.js through data-action.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { getExpanded } from '../core/settings.js';
import { escapeHtml } from '../core/utils.js';
import { comboLabel } from '../core/keys.js';

const navItem = ({ href, iconName, label, active, count }) =>
  `<a class="nav-item ${active ? 'is-active' : ''}" href="${href}">${icon(iconName)}<span class="nav-item__label">${label}</span>${count ? `<span class="nav-item__count">${count}</span>` : ''}</a>`;

const noteRow = (note, activeId) =>
  `<a class="tree-row tree-note ${note.id === activeId ? 'is-active' : ''}" href="#/note/${note.id}">${icon('note', 16)}<span class="tree-row__label">${escapeHtml(note.title || 'Untitled')}</span></a>`;

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

/** Search box shell — looks finished, does nothing yet (the real search comes later). */
function searchBox() {
  const hint = comboLabel(CONFIG.shortcuts['search.open']).replace('+', ' ');
  return `<button type="button" class="search-box" aria-disabled="true" title="Search — coming soon">
    ${icon('search', 16)}<span class="search-box__label">Search</span><kbd class="search-box__hint">${escapeHtml(hint)}</kbd>
  </button>`;
}

export function renderSidebar(route) {
  const expanded = getExpanded(); // toggled only by you (app.js expands a note's folder once when you open it)
  const folders = store.folders();
  const loose = store.looseNotes();
  const trashCount = store.trashedNotes().length + store.trashedFolders().length;

  return `
    <div class="sidebar__head"><span class="sidebar__brand">${escapeHtml(CONFIG.appName)}</span></div>
    ${searchBox()}
    <nav class="sidebar__nav" aria-label="Main">
      ${navItem({ href: '#/home', iconName: 'home', label: 'Home', active: route.view === 'home' })}
      ${navItem({ href: '#/inbox', iconName: 'inbox', label: 'Inbox', active: route.view === 'inbox', count: loose.length })}
      ${navItem({ href: '#/journal', iconName: 'journal', label: 'Journal', active: route.view === 'journal' })}
      ${navItem({ href: '#/notebooks', iconName: 'notebooks', label: 'Notebooks', active: route.view === 'notebooks' })}
      ${navItem({ href: '#/threads', iconName: 'threads', label: 'Threads', active: route.view === 'threads' || route.view === 'thread' })}
    </nav>
   <p class="sidebar__label">Notebook</p>
    <div class="sidebar__tree" aria-label="Notebooks and notes">
      ${folders.map(f => folderBlock(f, route, expanded)).join('')}
    </div>
    <div class="sidebar__foot">
      ${navItem({ href: '#/trash', iconName: 'trash', label: 'Trash', active: route.view === 'trash', count: trashCount })}
    </div>`;
}
