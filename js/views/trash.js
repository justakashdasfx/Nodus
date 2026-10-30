/* TRASH — deleted notebooks and notes. Restore them, or delete them one by one. */
import * as store from '../core/store.js';
import { icon } from '../core/icons.js';
import { button, viewHead, emptyState } from '../ui/components.js';
import { escapeHtml, formatDate } from '../core/utils.js';

export function render() {
  const folders = store.trashedFolders();
  const all = store.trashedNotes();
  const notes = all.filter(n => n.type !== 'map');
  const maps = all.filter(n => n.type === 'map' || n.type === 'maptemplate');

  const folderRows = folders.map(f => {
    const count = store.noteCount(f.id);
    return `
    <div class="row row--static">
      <a class="row__title row__title--icon" href="#/notebook/${f.id}">${icon('notebook', 16)}<span>${escapeHtml(f.name)}</span></a>
      <span class="row__text">${count} ${count === 1 ? 'note' : 'notes'} · Deleted ${formatDate(f.deletedAt)}</span>
      <span class="row__actions">
        ${button({ action: 'notebook-restore', iconName: 'restore', label: 'Restore', data: { id: f.id } })}
        ${button({ action: 'notebook-delete-forever', iconName: 'close', label: 'Delete forever', variant: 'btn--danger-text', data: { id: f.id } })}
      </span>
    </div>`;
  }).join('');

  const noteRows = notes.map(n => rowFor(n)).join('');
  const mapRows = maps.map(n => rowFor(n)).join('');

  function rowFor(n) {
    const isMap = n.type === 'map';
    return `
    <div class="row row--static">
      ${n.type === 'maptemplate' ? `<span class="row__title row__title--icon">${icon('mindmap', 16)}<span>Template · ${escapeHtml(n.title || 'Untitled map')}</span></span>` : isMap ? `<a class="row__title row__title--icon" href="#/map/${n.id}">${icon('mindmap', 16)}<span>${escapeHtml(n.title || 'Untitled map')}</span></a>` : `<a class="row__title" href="#/note/${n.id}">${escapeHtml(n.title || 'Untitled')}</a>`}
      <span class="row__text">Deleted ${formatDate(n.deletedAt)}</span>
      <span class="row__actions">
        ${button({ action: 'note-restore', iconName: 'restore', label: 'Restore', data: { id: n.id } })}
        ${button({ action: 'note-delete', iconName: 'close', label: 'Delete forever', variant: 'btn--danger-text', data: { id: n.id } })}
      </span>
    </div>`;
  }

  const empty = button({ action: 'trash-empty', iconName: 'trash', label: 'Empty trash' });
  const any = folders.length || all.length;
  const body = any
    ? `${folders.length ? `<h2 class="list-label">Notebooks</h2><div class="list">${folderRows}</div>` : ''}
       ${notes.length ? `<h2 class="list-label">Notes</h2><div class="list">${noteRows}</div>` : ''}
       ${maps.length ? `<h2 class="list-label">Mind maps</h2><div class="list">${mapRows}</div>` : ''}`
    : emptyState({ title: 'Trash is empty', text: 'Deleted notes and notebooks appear here.', art: 'trash'  });
  return { html: `<div class="view">${viewHead({ title: 'Trash', actions: any ? empty : '' })}${body}</div>` };
}
