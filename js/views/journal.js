/* JOURNAL — one entry per day, newest first, as a list. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { button, viewHead, gallery, noteCard, viewSwitch, emptyState } from '../ui/components.js';
import { escapeHtml, formatJournalDate, htmlToText } from '../core/utils.js';

const snippet = (note) =>
  htmlToText(note.html).split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);

export function render() {
  const entries = store.journalEntries();
  const style = settings.getViewStyle('journal');
  const today = button({ action: 'journal-today', iconName: 'plus', label: "Today's Entry", variant: 'button' });
  const rows = entries.map(n => `
    <a class="row" href="#/note/${n.id}">
      <span class="row__title">${escapeHtml(formatJournalDate(n.date))}</span>
      <span class="row__text">${escapeHtml(snippet(n) || 'Empty entry')}</span>
    </a>`).join('');
  const body = entries.length
    ? (style === 'gallery' ? gallery(entries.map(noteCard)) : `<div class="list">${rows}</div>`)
    : emptyState({ title: 'No journal entries yet', text: 'Start with today.', actionHtml: today });
  return { html: `<div class="view">${viewHead({ title: 'Journal', actions: entries.length ? viewSwitch(style, { page: 'journal' }) + today : '' })}${body}</div>` };
}
