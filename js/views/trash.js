/* TRASH — deleted notebooks and notes. Restore them, or delete them one by one. */
import * as store from '../core/store.js';
import { icon } from '../core/icons.js';
import { button, viewHead, emptyState } from '../ui/components.js';
import { escapeHtml, formatDate } from '../core/utils.js';

export function render() {
  const folders = store.trashedFolders();
  const notes = store.trashedNotes();

  const folderRows = folders.map(f => {
    const count = store.noteCount(f.id);
    return `
    <div class="row row--static">
      <a class="row__title row__title--icon" href="#/notebook/${f.id}">${icon('folder', 16)}<span>${escapeHtml(f.name)}</span></a>
      <span class="row__text">${count} ${count === 1 ? 'note' : 'notes'} · Deleted ${formatDate(f.deletedAt)}</span>
      <span class="row__actions">
        ${button({ action: 'notebook-restore', iconName: 'restore', label: 'Restore', data: { id: f.id } })}
        ${button({ action: 'notebook-delete-forever', iconName: 'close', label: 'Delete forever', variant: 'btn--danger-text', data: { id: f.id } })}
      </span>
    </div>`;
  }).join('');

  const noteRows = notes.map(n => `
    <div class="row row--static">
      <a class="row__title" href="#/note/${n.id}">${escapeHtml(n.title || 'Untitled')}</a>
      <span class="row__text">Deleted ${formatDate(n.deletedAt)}</span>
      <span class="row__actions">
        ${button({ action: 'note-restore', iconName: 'restore', label: 'Restore', data: { id: n.id } })}
        ${button({ action: 'note-delete', iconName: 'close', label: 'Delete forever', variant: 'btn--danger-text', data: { id: n.id } })}
      </span>
    </div>`).join('');

  const empty = button({ action: 'trash-empty', iconName: 'trash', label: 'Empty trash' });
  const any = folders.length || notes.length;
  const body = any
    ? `${folders.length ? `<h2 class="list-label">Notebooks</h2><div class="list">${folderRows}</div>` : ''}
       ${notes.length ? `<h2 class="list-label">Notes</h2><div class="list">${noteRows}</div>` : ''}`
    : emptyState({ title: 'Trash is empty', text: 'Deleted notes and notebooks appear here.' });
  return { html: `<div class="view">${viewHead({ title: 'Trash', actions: any ? empty : '' })}${body}</div>` };
}
