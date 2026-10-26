/* JOURNAL — one entry per day, newest first, as a list. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { icon } from '../core/icons.js';
import { button, viewHead, gallery, noteCard, viewSwitch, emptyState, caretHtml } from '../ui/components.js';
import { escapeHtml, formatJournalDate } from '../core/utils.js';

export function render() {
  const entries = store.journalEntries();
  const style = settings.getViewStyle('journal');
  const today = button({ action: 'journal-today', iconName: 'plus', label: "Today's Entry", variant: 'button' });
  const rows = entries.map(n => `
    <a class="lrow lrow--journal" href="#/note/${n.id}">
      <span class="lrow__lead">${icon('journal', 16)}</span>
      <span class="lrow__main"><span class="lrow__title">${escapeHtml(formatJournalDate(n.date))}</span></span>
      ${caretHtml}
    </a>`).join('');
  const body = entries.length
    ? (style === 'gallery' ? gallery(entries.map(noteCard)) : `<div class="list">${rows}</div>`)
    : emptyState({ title: 'No journal entries yet', text: 'Start with today.', actionHtml: today });
  return { html: `<div class="view">${viewHead({ title: 'Journal', actions: entries.length ? viewSwitch(style, { page: 'journal' }) + today : '' })}${body}</div>` };
}
