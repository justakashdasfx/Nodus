/* ============================================================================
   TOPBAR — the quiet strip above the card.
   [☰ app name] · (note pages: date created · notebook │ words / read time) ····· New · Write|Read (note pages, each with an icon) · Sync status · ⋯
   The ⋯ menu (more-menu.js) holds Light/Dark, the note's font, downloads, Markdown, Trash and About.
   Every action shows an icon AND a text label (labels hide on small screens).
   The ☰ and the app name (config.js → appName) form one cluster pinned to the top-left corner of the screen
   (.topbar__lead in css/layout.css): it sits above the sidebar when it is open and stays in the same place when it is collapsed.
   On phones the note details move into the note's own bar, under the top bar.
   ========================================================================== */
import { CONFIG } from '../core/config.js';
import { button } from './components.js';
import { icon } from '../core/icons.js';
import { getStatsMode } from '../core/settings.js';
import * as store from '../core/store.js';
import { htmlToText, statsLabel, escapeHtml, formatDate } from '../core/utils.js';
import { noteLocation, noteState } from './note-meta.js';
import { comboLabel } from '../core/keys.js';

export const STATUS_LABELS = {
  idle: 'Local', saving: 'Saving…', saved: 'Saved', offline: 'Offline, will sync when back',
  error: 'Sync error', nokey: 'Add sync key', badkey: 'Wrong key',
};

export function renderTopbar(route, status = 'idle') {
  // On a note: "Oct 15, 2026 · 📁 Notebook │ 342 words · 2 min read" (the editor keeps the count live while you type)
  const note = route.view === 'note' ? store.getNote(route.id) : null;
  let meta = '';
  let modeSwitch = '';
  if (note) {
    const mode = store.noteMode(note);
    const modeBtn = (value, label, iconName) =>
      `<button type="button" class="seg__btn ${mode === value ? 'is-on' : ''}" data-action="mode-set" data-id="${note.id}" data-mode="${value}" aria-pressed="${mode === value}">${icon(iconName, 16)}${label}</button>`;
    modeSwitch = `<div class="seg seg--plain" role="group" aria-label="Write or Read" title="Write / Read — saved for this note (${comboLabel(CONFIG.shortcuts['mode.toggle'])})">${modeBtn('edit', 'Write', 'pencil-simple')}${modeBtn('read', 'Read', 'eye')}</div>`;
    const liveEditor = document.querySelector('#view .editor');
    const count = statsLabel(liveEditor ? liveEditor.innerText : htmlToText(note.html), getStatsMode());
    meta = `<div class="topbar__meta">
        <span class="topbar__date" title="Date created">${formatDate(note.createdAt)}</span>
        ${noteLocation(note, noteState(note).trashed)}
        <span class="topbar__sep" aria-hidden="true"></span>
        <button type="button" class="topbar__stats" data-action="stats-toggle" data-note-stats title="Click to switch between words and characters">${count}</button>
      </div>`;
  }

  return `
    <div class="topbar__lead">
      <button type="button" class="btn btn--icon" data-action="sidebar-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">${icon('menu')}</button>
      <span class="topbar__brand">${escapeHtml(CONFIG.appName)}</span>
    </div>
    ${meta}
    <div class="topbar__spacer"></div>
    ${button({ action: 'note-new', iconName: 'plus', label: 'New Note' })}
    ${modeSwitch}
    <button type="button" class="status" id="sync-status" data-action="sync-key" data-state="${status}" title="Sync status — click to set the sync key">
      <span class="status__dot"></span><span class="status__text">${STATUS_LABELS[status]}</span>
    </button>
    <button type="button" class="btn btn--icon" data-action="more-menu" aria-label="More" aria-haspopup="menu" aria-expanded="false" title="More">${icon('more')}</button>`;
}
