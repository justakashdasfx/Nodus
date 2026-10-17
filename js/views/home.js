/* HOME — recent notes as a gallery, with New note and Import. */
import * as store from '../core/store.js';
import { button, viewHead, gallery, noteCard, emptyState } from '../ui/components.js';

export function render() {
  const notes = store.recentNotes();
  const actions = button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'btn--solid' })
                + button({ action: 'import-text', iconName: 'upload', label: 'Import' });
  const body = notes.length
    ? gallery(notes.map(noteCard))
    : emptyState({ title: 'No notes yet', text: 'Write a new note or import a text file.',
        actionHtml: button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'btn--solid' }) });
  return { html: `<div class="view">${viewHead({ title: 'Home', subtitle: 'Recent notes', actions })}${body}</div>` };
}
