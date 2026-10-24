/* TASKS — every checklist item from every note, grouped: Overdue · Today · Upcoming · No date · Done.
   Tick the box to tick it in its note; click the text to open the note (Shift+click opens it in the side pane).
   The page follows your notes like a live thread. Dates are typed in a note with "@" (js/editor/due.js).
   Limits (Done: how many days, how many): config.js → tasks. Look: .task-* in css/gallery.css, --due-… and --task-… in css/tokens.css. */
import * as store from '../core/store.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { groupTasks } from '../core/tasks.js';
import { labelFor, dueState } from '../core/dates.js';
import { viewHead, emptyState } from '../ui/components.js';

const SECTIONS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['nodate', 'No date'], ['done', 'Done']];

function where(note) {
  const folder = note.folderId ? store.getFolder(note.folderId) : null;
  const place = note.type === 'journal' ? { ic: 'journal', name: 'Journal' } : folder ? { ic: 'folder', name: folder.name } : { ic: 'inbox', name: 'Inbox' };
  const item = (ic, name) => `<span class="where__item">${icon(ic, 14)}<span class="where__name">${escapeHtml(name)}</span></span>`;
  return `${item('note', note.title || 'Untitled')}<span class="where__sep" aria-hidden="true">·</span>${item(place.ic, place.name)}`;
}

function taskRow({ note, block, done, due }) {
  return `<div class="row row--static row--task${done ? ' is-done' : ''}">
    <span class="row__title task__main">
      <button type="button" class="task__box" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}" data-action="task-toggle" data-note="${note.id}" data-block="${block.id}">${icon('check', 12)}</button>
      <a class="task__text" href="#/note/${note.id}/${block.id}">${escapeHtml(block.text)}</a>
    </span>
    <span class="row__text block-row__where">${where(note)}</span>
    <span class="row__meta task__due"${due ? ` data-state="${dueState(due)}"` : ''}>${due ? escapeHtml(labelFor(due)) : ''}</span>
  </div>`;
}

export function render() {
  const g = groupTasks();
  const open = g.overdue.length + g.today.length + g.upcoming.length + g.nodate.length;
  const body = SECTIONS.filter(([k]) => g[k].length).map(([k, label]) =>
    `<p class="list-label">${label}<span class="list-label__n">${g[k].length}</span>${k === 'done' ? `<span class="list-label__note">last ${CONFIG.tasks.doneDays} days</span>` : ''}</p>
     <div class="list">${g[k].map(taskRow).join('')}</div>`).join('');
  const html = body || emptyState({ title: 'No tasks yet', text: 'Make a checklist in any note, then type @ in an item to give it a date. Every item shows up here.' });
  return { html: `<div class="view">${viewHead({ title: 'Tasks', subtitle: `${open} open` })}${html}</div>` };
}
