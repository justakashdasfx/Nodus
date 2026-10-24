/* ============================================================================
   NOTE META — the small pieces that describe a note: when it was made and where it lives.
   Shown in the top bar (desktop) and in the note's own bar (phone and side pane).
   Styles: .note__date / .note__tag / .notebook-pick in css/editor.css, .topbar__meta in css/layout.css.
   ========================================================================== */

import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';

/** Is the page read-only for a reason other than Read mode? (the note, or its notebook, is in Trash) */
export function noteState(note) {
  const folder = note.folderId ? store.getFolder(note.folderId) : null;
  const folderTrashed = !!folder?.deletedAt;
  return { folder, folderTrashed, trashed: !!note.deletedAt || folderTrashed };
}

/** "Journal" label, or the notebook picker: a button that opens a menu (more-menu.js) to file the note or send it back to the Inbox. */
export function noteLocation(note, trashed) {
  if (note.type === 'journal') return `<span class="note__tag">${icon('journal', 14)}Journal</span>`;
  const { folder } = noteState(note);
  return `<button type="button" class="notebook-pick" data-action="notebook-menu" data-id="${note.id}" aria-haspopup="menu" aria-expanded="false"
      title="Move to another notebook" ${trashed ? 'disabled' : ''}>
    ${icon(folder ? 'folder' : 'inbox', 14)}<span class="notebook-pick__name">${escapeHtml(folder ? folder.name : 'Inbox')}</span>${icon('caret', 12).replace('class="icon"', 'class="icon notebook-pick__caret"')}
  </button>`;
}
