/* HOME — recent notes as a gallery, with New note and Import. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { button, viewHead, gallery, noteCard, noteList, viewSwitch, emptyState } from '../ui/components.js';

export function render() {
  const notes = store.recentNotes();
  const pinned = store.pinnedNotes().filter(n => n.type !== 'map');   // pinned maps live in the sidebar
  const style = settings.getViewStyle('home');
  const show = (list) => (style === 'list' ? noteList(list) : gallery(list.map(noteCard)));
  const actions = viewSwitch(style, { page: 'home' })
                + button({ action: 'template-pick', iconName: 'copy', label: 'From template' })
                + button({ action: 'import-text', iconName: 'upload', label: 'Import' })
                + button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'button' });
  const body = notes.length
    ? show(notes)
    : emptyState({ title: 'No notes yet', text: 'Write a new note or import a text file.',art: 'notes',
        actionHtml: button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'btn--solid' }) });
  return { html: `<div class="view">${viewHead({ title: 'Home', subtitle: 'Recent notes', actions })}${pinned.length ? `<p class="list-label">Pinned</p>${show(pinned)}<p class="list-label">Recent</p>` : ''}${body}</div>` };
}
