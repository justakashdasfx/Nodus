/* ============================================================================
   SIDEBAR — search box shell, Home · Notebooks · Tags · Threads · Tasks, Pinned, then the Notebook section
   (Inbox · Journal · every notebook; click the "Notebook" label to hide or show the whole section), Trash.
   Notebooks have no caret: clicking one opens it. Notes are listed on the notebook's own page, not here.
   Every row uses the same icon size (18) and the same gap — see css/layout.css → "Sidebar rows".
   Pure render function; clicks are handled in app.js through data-action.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { getPinnedOpen, getNotebooksOpen } from '../core/settings.js';
import { escapeHtml } from '../core/utils.js';
import { comboLabel } from '../core/keys.js';
import { openCount } from '../core/tasks.js';

const ICON = 18;   // one icon size for every row in the sidebar

const navItem = ({ href, iconName, label, active, count }) =>
  `<a class="nav-item ${active ? 'is-active' : ''}" href="${href}">${icon(iconName, ICON)}<span class="nav-item__label">${label}</span>${count ? `<span class="nav-item__count">${count}</span>` : ''}</a>`;

/** A note in Pinned: a link, plus an Unpin button that shows on hover. */
const noteRow = (note, activeId, unpin = false) =>
  `<div class="tree-row tree-note ${note.id === activeId ? 'is-active' : ''}">
    <a class="tree-link" draggable="true" href="#/note/${note.id}">${icon('note', ICON)}<span class="tree-row__label">${escapeHtml(note.title || 'Untitled')}</span></a>
    ${unpin ? `<button type="button" class="tree-pin" data-action="note-pin" data-id="${note.id}" aria-label="Unpin" title="Unpin">${icon('unpin', 14)}</button>` : ''}
  </div>`;

/** A plain row in the Notebook section: Inbox, Journal. */
const treeLink = ({ href, iconName, label, active }) =>
  `<div class="tree-row tree-row--folder ${active ? 'is-active' : ''}">
    <a class="tree-link" href="${href}">${icon(iconName, ICON)}<span class="tree-row__label">${label}</span></a>
  </div>`;

/** A notebook: no caret, no list of notes. The + adds a note to it. */
function folderBlock(folder, route) {
  const active = route.view === 'notebook' && route.id === folder.id;
  return `<div class="tree-folder">
    <div class="tree-row tree-row--folder ${active ? 'is-active' : ''}">
      <a class="tree-link" href="#/notebook/${folder.id}">${icon('folder', ICON)}<span class="tree-row__label">${escapeHtml(folder.name)}</span></a>
      <span class="tree-trail">
        <button type="button" class="tree-add" data-action="note-new" data-folder="${folder.id}" aria-label="New note in ${escapeHtml(folder.name)}" title="New note">${icon('plus', 14)}</button>
      </span>
    </div>
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
  const folders = store.folders();
  const pinned = store.pinnedNotes();
  const pinnedOpen = getPinnedOpen();
  const notebooksOpen = getNotebooksOpen();
  const trashCount = store.trashedNotes().length + store.trashedFolders().length;

  return `
    <div class="sidebar__head"></div>
    <nav class="sidebar__nav" aria-label="Main">
      ${navItem({ href: '#/home', iconName: 'home', label: 'Home', active: route.view === 'home' })}
      ${navItem({ href: '#/notebooks', iconName: 'notebooks', label: 'Notebooks', active: route.view === 'notebooks' })}
      ${navItem({ href: '#/tags', iconName: 'tag', label: 'Tags', active: route.view === 'tags' || route.view === 'tag', count: store.tagCounts().size })}
      ${navItem({ href: '#/threads', iconName: 'threads', label: 'Threads', active: route.view === 'threads' || route.view === 'thread' })}
      ${navItem({ href: '#/tasks', iconName: 'tasks', label: 'Tasks', active: route.view === 'tasks', count: openCount() })}
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
      ${folders.length ? `<div class="tree-group tree-group--mine">${folders.map(f => folderBlock(f, route)).join('')}</div>` : ''}` : ''}
    </div>
    <div class="sidebar__foot">
      ${navItem({ href: '#/trash', iconName: 'trash', label: 'Trash', active: route.view === 'trash', count: trashCount })}
    </div>`;
}
