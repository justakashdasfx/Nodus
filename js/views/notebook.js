/* NOTEBOOK — the notes inside one notebook, as a gallery. */
import * as store from '../core/store.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/utils.js';
import { button, viewHead, gallery, noteCard, noteList, viewSwitch, emptyState } from '../ui/components.js';

const notFound = (title, text, actionHtml) => ({ html: `<div class="view">${emptyState({ title, text, actionHtml })}</div>` });

export function render({ id }) {
  const folder = store.getFolder(id);
  if (!folder) {
    return notFound('Notebook not found', 'It may have been deleted.',
      '<a class="btn btn--solid" href="#/notebooks"><span class="btn__label">Back to notebooks</span></a>');
  }
  if (folder.deletedAt) {
    return notFound('This notebook is in Trash', 'Restore it to see its notes again.',
      button({ action: 'notebook-restore', iconName: 'restore', label: 'Restore notebook', variant: 'btn--solid', data: { id } }));
  }

  const notes = store.notesInFolder(id);
  const newBtn = button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'btn--solid', data: { folder: id } });
  const style = folder.viewStyle === 'list' || folder.viewStyle === 'gallery' ? folder.viewStyle : CONFIG.defaults.views.notebook;
  const actions = viewSwitch(style, { page: 'notebook', id }) + newBtn
    + button({ action: 'notebook-edit', iconName: 'pencil', label: 'Edit', data: { id } })
    + button({ action: 'notebook-delete', iconName: 'trash', label: 'Delete', data: { id } });
  const body = notes.length
    ? (style === 'list' ? noteList(notes) : gallery(notes.map(noteCard)))
    : emptyState({ title: 'This notebook is empty', text: 'Add the first note to get started.',
        actionHtml: button({ action: 'note-new', iconName: 'plus', label: 'Add a note', variant: 'btn--solid', data: { folder: id } }) });
  const subtitle = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
  const description = folder.description
    ? `<p class="view-head__desc">${escapeHtml(folder.description)}</p>`
    : `<button type="button" class="view-head__add-desc" data-action="notebook-edit" data-id="${id}">Add a description</button>`;
  return { html: `<div class="view">${viewHead({ title: folder.name, subtitle, description, actions })}${body}</div>` };
}
