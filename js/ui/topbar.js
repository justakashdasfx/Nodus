/* ============================================================================
   TOPBAR — the quiet strip above the card.
   Hamburger · words / read time (notes) · New · Font · Theme · Download all · Download as text · Sync status · (i) About
   Every action shows an icon AND a text label (labels hide on small screens).
   ========================================================================== */

import { button } from './components.js';
import { icon } from '../core/icons.js';
import { getFont, getTheme } from '../core/settings.js';
import * as store from '../core/store.js';
import { htmlToText, statsLabel } from '../core/utils.js';

export const STATUS_LABELS = {
  idle: 'Local', saving: 'Saving…', saved: 'Saved', offline: 'Offline, will sync when back',
  error: 'Sync error', nokey: 'Add sync key', badkey: 'Wrong key',
};

export function renderTopbar(route, status = 'idle') {
  const font = getFont();
  const theme = getTheme();
  const seg = (value, label) =>
    `<button type="button" class="seg__btn ${font === value ? 'is-on' : ''}" data-action="font-set" data-font="${value}" aria-pressed="${font === value}">${label}</button>`;

  // "│ 342 words · 2 min read" next to the menu button while a note is open (the editor keeps it live while you type)
  const note = route.view === 'note' ? store.getNote(route.id) : null;
  const liveEditor = document.querySelector('#view .editor');
  const stats = note
    ? `<span class="topbar__sep" aria-hidden="true"></span><span class="topbar__stats" id="note-stats">${statsLabel(liveEditor ? liveEditor.innerText : htmlToText(note.html))}</span>`
    : '';

  return `
    <button type="button" class="btn btn--icon" data-action="sidebar-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">${icon('menu')}</button>
    ${stats}
    <div class="topbar__spacer"></div>
    ${button({ action: 'note-new', iconName: 'plus', label: 'New' })}
    <div class="seg" role="group" aria-label="Font">${icon('font')}${seg('sans', 'Sans')}${seg('mono', 'Mono')}</div>
    ${button({ action: 'theme-toggle', iconName: theme === 'dark' ? 'sun' : 'moon', label: theme === 'dark' ? 'Light' : 'Dark' })}
    ${button({ action: 'download-all', iconName: 'download', label: 'Download all' })}
    ${route.view === 'note' ? button({ action: 'download-text', iconName: 'fileDown', label: 'As text' }) : ''}
    <button type="button" class="status" id="sync-status" data-action="sync-key" data-state="${status}" title="Sync status — click to set the sync key">
      <span class="status__dot"></span><span class="status__text">${STATUS_LABELS[status]}</span>
    </button>
    <button type="button" class="btn btn--icon" data-action="about-open" aria-label="About this app" title="About">${icon('info')}</button>`;
}
