/* TASKS — every checklist item from every note, grouped: Overdue · Today · Upcoming · No date · Done.
   Tick the circle to tick the item in its note; click the text to open the note at that item (Shift+click opens the side pane).
   The row shows the task, the note it lives in and its notebook, and a coloured date pill on the right.
   The chips at the top filter the page (All · Overdue · Today …); the choice is remembered until you reload.
   Click a date pill (or "Add date" on hover) to change it: Today · Tomorrow · Next week · Pick a date… · Remove date.
   The same menu opens in a note with "@" (js/editor/due.js). Limits (Done: how many days): config.js → tasks.
   Look: css/tasks-tags.css (.tk-*) · date colours and sizes: --due-…, --task-… in css/tokens.css. */
import * as store from '../core/store.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { groupTasks, setTaskDue } from '../core/tasks.js';
import { labelFor, dueState, presets } from '../core/dates.js';
import { pickDate } from '../ui/calendar.js';
import { viewHead, emptyState, moreBtn } from '../ui/components.js';

const SECTIONS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['nodate', 'No date'], ['done', 'Done']];
let filter = 'all';          // which chip is on; survives the page redrawing when you tick a task

// Chips: filter without redrawing (CSS hides the other groups).
document.addEventListener('click', (e) => {
  const chip = e.target.closest?.('[data-tk-filter]');
  if (!chip) return;
  const root = chip.closest('.tk');
  if (!root) return;
  filter = chip.dataset.tkFilter;
  root.dataset.filter = filter;
  root.querySelectorAll('[data-tk-filter]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
});

/* ---------- The date menu (same choices as typing "@" in a note) ----------
   app.js calls editDue(button) for data-action="task-due"; it returns true when a date changed, so the page redraws. */
let dismiss = null;

export function editDue(btn) {
  if (dismiss) dismiss(false);
  return new Promise((resolve) => {
    const { note: noteId, block: blockId } = btn.dataset;
    const current = btn.dataset.due || '';
    const list = presets(new Date()).filter((p) => p.top).map((p) => ({ iso: p.iso, label: p.label, hint: p.hint }));
    list.push({ pick: true, label: 'Pick a date…', hint: '' });
    if (current) list.push({ remove: true, label: 'Remove date', hint: '' });
    let active = 0;

    const menu = document.createElement('div');
    menu.className = 'block-menu due-menu';
    menu.setAttribute('role', 'menu');
    const paint = () => {
      menu.innerHTML = `<div class="block-menu__title">Due date</div>${list.map((it, i) =>
        `<button type="button" role="menuitem" class="block-menu__item${i === active ? ' is-active' : ''}${it.remove ? ' is-danger' : ''}" data-i="${i}">`
        + `<span class="block-menu__icon">${icon(it.remove ? 'close' : it.pick ? 'calendar' : 'clock', 16)}</span>`
        + `<span class="block-menu__label">${escapeHtml(it.label)}</span>${it.hint ? `<span class="block-menu__hint">${escapeHtml(it.hint)}</span>` : ''}</button>`).join('')}`;
    };

    const onOutside = (e) => { if (!menu.contains(e.target)) finish(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; paint(); }
      else if (e.key === 'Enter') choose(active);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClose = () => finish(false);
    const cleanup = () => {
      menu.remove();
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      dismiss = null;
    };
    const finish = (changed) => { cleanup(); resolve(changed); };

    async function choose(i) {
      const it = list[i];
      if (!it) return;
      if (it.pick) {
        cleanup();
        const r = btn.getBoundingClientRect();
        const iso = await pickDate({ value: current, rect: { left: r.right - 280, top: r.top, bottom: r.bottom } });
        resolve(iso !== null ? setTaskDue(noteId, blockId, iso) : false);
        return;
      }
      finish(setTaskDue(noteId, blockId, it.remove ? '' : it.iso));
    }

    menu.addEventListener('click', (e) => { const b = e.target.closest('.block-menu__item'); if (b) choose(+b.dataset.i); });
    document.body.append(menu);
    paint();
    const r = btn.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + menu.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 6);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8))}px`;
    dismiss = finish;
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
  });
}

function where(note) {
  const folder = note.folderId ? store.getFolder(note.folderId) : null;
  const place = note.type === 'journal' ? { ic: 'journal', name: 'Journal' } : folder ? { ic: 'notebook', name: folder.name } : { ic: 'inbox', name: 'Inbox' };
  return `<span class="tk-note">${escapeHtml(note.title || 'Untitled')}</span><span class="tk-dotsep" aria-hidden="true">·</span><span class="tk-place">${icon(place.ic, 12)}<span>${escapeHtml(place.name)}</span></span>`;
}

function taskRow({ note, block, done, due }) {
  return `<div class="tk-row${done ? ' is-done' : ''}" data-item="task:${note.id}:${block.id}">
    <button type="button" class="tk-box" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}" data-action="task-toggle" data-note="${note.id}" data-block="${block.id}">${icon('check', 12)}</button>
    <a class="tk-main" href="#/note/${note.id}/${block.id}">
      <span class="tk-text">${escapeHtml(block.text)}</span>
      <span class="tk-sub">${where(note)}</span>
    </a>
    ${due
      ? `<button type="button" class="tk-due" data-state="${dueState(due)}" data-action="task-due" data-note="${note.id}" data-block="${block.id}" data-due="${due}" title="Change the date" aria-haspopup="menu">${icon('calendar', 12)}${escapeHtml(labelFor(due))}</button>`
      : `<button type="button" class="tk-due tk-due--add" data-action="task-due" data-note="${note.id}" data-block="${block.id}" data-due="" title="Add a date" aria-haspopup="menu">${icon('calendar', 12)}Add date</button>`}
    ${moreBtn('task', `${note.id}:${block.id}`)}
  </div>`;
}

export function render() {
  const g = groupTasks();
  const open = g.overdue.length + g.today.length + g.upcoming.length + g.nodate.length;
  const total = open + g.done.length;
  if (filter !== 'all' && !g[filter]?.length) filter = 'all';   // that group just emptied (you ticked its last item)

  if (!total) {
    return { html: `<div class="view">${viewHead({ title: 'Tasks', subtitle: '0 open' })}${emptyState({ title: 'No tasks yet', text: 'Make a checklist in any note, then type @ in an item to give it a date. Every item shows up here.', art: 'tasks', })}</div>` };
  }

  const chip = (key, label, n, tone = '') =>
    `<button type="button" class="tk-chip" data-tk-filter="${key}"${tone ? ` data-tone="${tone}"` : ''} aria-pressed="${filter === key}">${label}<span class="tk-chip__n">${n}</span></button>`;
  const chips = chip('all', 'All', total)
    + SECTIONS.filter(([k]) => g[k].length).map(([k, label]) => chip(k, label, g[k].length, k)).join('');

  const groups = SECTIONS.filter(([k]) => g[k].length).map(([k, label]) =>
    `<section class="tk-group" data-group="${k}">
      <h2 class="tk-label">${label}<span class="tk-label__n">${g[k].length}</span>${k === 'done' ? `<span class="tk-label__note">last ${CONFIG.tasks.doneDays} days</span>` : ''}</h2>
      <div class="tk-rows">${g[k].map(taskRow).join('')}</div>
    </section>`).join('');

  return { html: `<div class="view tk" data-filter="${filter}">
    ${viewHead({ title: 'Tasks', subtitle: `${open} open` })}
    <div class="tk-chips" role="group" aria-label="Filter tasks">${chips}</div>
    ${groups}
  </div>` };
}
