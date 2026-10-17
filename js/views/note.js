/* NOTE — the writing page. Meta bar (date, notebook, delete) + editor.
   Used twice: as the main view, and inside the side pane (render(route, { pane: true })).
   In the pane the Trash / Restore buttons are left out — "Open full page" in the pane header is the way to those. */
import * as store from '../core/store.js';
import { icon } from '../core/icons.js';
import { button, emptyState } from '../ui/components.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { mountEditor } from '../editor/editor.js';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** Scrolls the block to the middle of its own scroll area (the page or the pane), never the whole window. */
function scrollBlockIntoView(el) {
  const scroller = el.closest('.pane__scroll, .card__scroll');
  if (!scroller) { el.scrollIntoView({ block: 'center' }); return; }
  const s = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  scroller.scrollTop += (r.top - s.top) - (s.height - r.height) / 2;
}

/**
 * Scrolls to a block and marks it with a soft highlight (.is-target, css/editor.css → --block-target-bg).
 * The highlight stays until you click or type in that editor. Runs after the page's own scroll reset.
 */
export function revealBlock(editor, blockId) {
  if (!editor || !/^[a-z0-9]+$/.test(blockId || '')) return;
  requestAnimationFrame(() => {
    const el = editor.querySelector(`[data-bid="${blockId}"]`);
    if (!el) return;
    editor.querySelectorAll('.is-target').forEach((b) => b.classList.remove('is-target'));
    scrollBlockIntoView(el);
    el.classList.add('is-target');
    const clear = (e) => {
      if (e.type === 'keydown' && MODIFIERS.has(e.key)) return; // pressing Shift alone is not "typing"
      el.classList.remove('is-target');
      editor.removeEventListener('pointerdown', clear);
      editor.removeEventListener('keydown', clear);
    };
    editor.addEventListener('pointerdown', clear);
    editor.addEventListener('keydown', clear);
  });
}

export function render({ id, block }, { pane = false } = {}) {
  const note = store.getNote(id);
  if (!note) {
    return { html: `<div class="view">${emptyState({ title: 'Note not found', text: 'It may have been deleted.',
      actionHtml: pane ? '' : '<a class="btn btn--solid" href="#/home"><span class="btn__label">Back to Home</span></a>' })}</div>` };
  }

  const folder = note.folderId ? store.getFolder(note.folderId) : null;
  const folderTrashed = !!folder?.deletedAt;          // the note is fine, but its notebook is in Trash
  const trashed = !!note.deletedAt || folderTrashed;  // either way the page is read-only
  const location = note.type === 'journal'
    ? `<span class="note__tag">${icon('journal', 14)}Journal</span>`
    : `<label class="note__folder">${icon('folder', 14)}
         <select data-change="note-move" data-id="${note.id}" aria-label="Notebook" ${trashed ? 'disabled' : ''}>
           <option value="">Inbox</option>
           ${store.folders().map(f => `<option value="${f.id}" ${f.id === note.folderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
         </select>
       </label>`;

  const actions = pane ? '' : note.deletedAt
    ? button({ action: 'note-restore', iconName: 'restore', label: 'Restore', data: { id } })
      + button({ action: 'note-delete', iconName: 'close', label: 'Delete forever', variant: 'btn--danger-text', data: { id } })
    : folderTrashed
      ? button({ action: 'notebook-restore', iconName: 'restore', label: 'Restore notebook', data: { id: folder.id } })
      : button({ action: 'note-trash', iconName: 'trash', label: 'Move to Trash', data: { id } });

  const html = `
    <div class="note${pane ? ' note--pane' : ''}">
      <div class="note__col">
        <div class="note__bar">
          <span class="note__date">${formatDate(note.createdAt)}</span>
          ${location}
          <span class="note__spacer"></span>
          ${actions}
        </div>
        ${trashed ? `<p class="note__banner">${note.deletedAt ? 'This note is in Trash.' : 'This note’s notebook is in Trash.'}</p>` : ''}
        <div class="note__body">
          <div class="prose editor" spellcheck="true" aria-label="Note"></div>
          <div class="tag-rail" aria-label="Tags"></div>
        </div>
      </div>
    </div>`;

  return {
    html,
    mount: (root) => {
      const editor = root.querySelector('.editor');
      const stop = mountEditor(editor, note, { readOnly: trashed });
      revealBlock(editor, block);
      return stop;
    },
  };
}
