/* ============================================================================
   TASKS — every checklist item of every note, from the notes' block indexes.
   An index entry for a checklist item looks like { id, t: 'li', text, chk: 0|1, due?: 'YYYY-MM-DD' } (see blockindex.js).
   Ticking a task here changes the note itself, exactly like ticking it in the editor.
   Look and limits: config.js → tasks, css/tokens.css → section 17.
   ========================================================================== */

import { CONFIG } from './config.js';
import * as store from './store.js';
import { sanitizeHtml, BID_RE } from './utils.js';
import { todayIso } from './dates.js';

/** Every checklist item: [{ note, block, done, due }] — notes in Trash and templates are not included. */
export function allTasks() {
  const out = [];
  for (const note of store.searchableNotes()) {
    for (const block of note.blocks || []) {
      if (block.t === 'li' && (block.chk === 0 || block.chk === 1)) out.push({ note, block, done: block.chk === 1, due: block.due || '' });
    }
  }
  return out;
}

/** → { overdue, today, upcoming, nodate, done } each a list of tasks, already in the order shown. */
export function groupTasks(now = new Date()) {
  const today = todayIso(now);
  const g = { overdue: [], today: [], upcoming: [], nodate: [], done: [] };
  const recent = (t) => t.note.updatedAt;
  const since = now.getTime() - CONFIG.tasks.doneDays * 864e5;
  for (const t of allTasks()) {
    if (t.done) { if (recent(t) >= since) g.done.push(t); continue; }
    if (!t.due) g.nodate.push(t);
    else if (t.due < today) g.overdue.push(t);
    else if (t.due === today) g.today.push(t);
    else g.upcoming.push(t);
  }
  const byDue = (a, b) => a.due.localeCompare(b.due) || recent(b) - recent(a);
  const byRecent = (a, b) => recent(b) - recent(a);
  g.overdue.sort(byDue);
  g.upcoming.sort(byDue);
  g.today.sort(byRecent);
  g.nodate.sort(byRecent);
  g.done.sort(byRecent);
  g.done = g.done.slice(0, CONFIG.tasks.doneMax);
  return g;
}

/** Not done and due today or earlier — the number beside Tasks in the sidebar. */
export function openCount(now = new Date()) {
  const today = todayIso(now);
  let n = 0;
  for (const t of allTasks()) if (!t.done && t.due && t.due <= today) n += 1;
  return n;
}

/** Flips one checklist item in its note. → true if it was found. */
export function toggleTask(noteId, blockId) {
  const note = store.getNote(noteId);
  if (!note || !BID_RE.test(blockId || '')) return false;
  const body = new DOMParser().parseFromString(`<body>${sanitizeHtml(note.html || '')}</body>`, 'text/html').body;
  const li = body.querySelector(`li[data-bid="${blockId}"]`);
  if (!li || !li.hasAttribute('data-check')) return false;
  li.setAttribute('data-check', li.getAttribute('data-check') === 'true' ? 'false' : 'true');
  store.updateNoteContent(noteId, body.innerHTML);
  return true;
}
