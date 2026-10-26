
/* ============================================================================
   TOPBAR — the quiet strip above the card.
   ============================================================================ */
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
  const note = route.view === 'note' ? store.getNote(route.id) : null;
  let meta = '';
  let modeSwitch = '';

  if (note) {
    const mode = store.noteMode(note);
    const modeBtn = (value, label, iconName) =>
      `<button type="button" class="seg__btn ${mode === value ? 'is-on' : ''}" data-action="mode-set" data-id="${note.id}" data-mode="${value}" aria-pressed="${mode === value}">${icon(iconName, 16)}${label}</button>`;

    modeSwitch = `<div class="seg seg--plain" role="group" aria-label="Write or Read" title="Write / Read — saved for this note (${comboLabel(CONFIG.shortcuts['mode.toggle'])})">${modeBtn('edit', 'Write', 'write')}${modeBtn('read', 'Read', 'eye')}</div>`;

    const liveEditor = document.querySelector('#view .editor');
    const count = statsLabel(liveEditor ? liveEditor.innerText : htmlToText(note.html), getStatsMode());

    meta = `<div class="topbar__meta">
        ${noteLocation(note, noteState(note).trashed)}
        <span class="topbar__sep" aria-hidden="true"></span>
        <button type="button" class="topbar__stats" data-action="stats-toggle" data-note-stats title="Click to switch between words and characters">${count}</button>
      </div>`;
  }

  return `
    <div class="topbar__lead">
      ${note ? '' : `<button type="button" class="btn btn--icon" data-action="sidebar-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">${icon('menu')}</button>`}
    </div>
    ${note ? `<button type="button" class="btn btn--icon" data-action="sidebar-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">${icon('menu')}</button>` : ''}
    ${meta}
    <div class="topbar__spacer"></div>
    ${button({ action: 'note-new', iconName: 'plus', label: 'New Note' })}
    ${modeSwitch}
    <button type="button" class="status" id="sync-status" data-action="sync-key" data-state="${status}" title="Sync status — click to set the sync key">
      <span class="status__dot"></span><span class="status__text">${STATUS_LABELS[status]}</span>
    </button>
    <button type="button" class="btn btn--icon" data-action="more-menu" aria-label="More" aria-haspopup="menu" aria-expanded="false" title="More">${icon('more')}</button>`;
}
