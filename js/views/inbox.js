/* INBOX — every note that is not in a notebook, newest first. Journal entries are not included.
   New notes start here (unless you create them inside a notebook); file one by choosing a notebook at the top of the note. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { button, viewHead, gallery, noteCard, noteList, viewSwitch, emptyState } from '../ui/components.js';

export function render() {
  const notes = store.looseNotes();
  const style = settings.getViewStyle('inbox');
const actions = (notes.length ? viewSwitch(style, { page: 'inbox' }) : '')
  + button({ action: 'import-text', iconName: 'upload', label: 'Import' })
  + (notes.length ? button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'button' }) : '');
+ button({ action: 'import-text', iconName: 'upload', label: 'Import' })
  + button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'button' });
  const body = notes.length
    ? (style === 'list' ? noteList(notes) : gallery(notes.map(noteCard)))
    : emptyState({ title: 'Your inbox is empty', text: 'Notes without a notebook land here. Everything you file into a notebook leaves the inbox.', art: 'inbox',
        actionHtml: button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'button' }) });
  const subtitle = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} without a notebook`;
  return { html: `<div class="view">${viewHead({ title: 'Inbox', actions })}${body}</div>` };
}
