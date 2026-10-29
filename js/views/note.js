/* NOTE — the writing page: a small details bar + the editor.
   On desktop the details (date, notebook, word count) and the Trash / Restore actions live in the top bar and its ⋯ menu,
   so this bar is only visible on phones and in the side pane (css/editor.css hides it for the main page on desktop).
   Read mode and notes in Trash open read-only. The note's own font (Sans / Mono / Serif) and mode are set here as data-font / data-mode
   (css/tokens.css maps the Write / Read colours from data-mode).
   Used twice: as the main view, and inside the side pane (render(route, { pane: true })). */
import * as store from '../core/store.js';
import { icon } from '../core/icons.js';
import { emptyState } from '../ui/components.js';
import { formatDate, htmlToText, statsLabel } from '../core/utils.js';
import { getStatsMode } from '../core/settings.js';
import { noteLocation, noteState } from '../ui/note-meta.js';
import { mountEditor } from '../editor/editor.js';
import { mountRelated } from '../ui/related.js';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** Scrolls the block to the middle of its own scroll area (the page or the pane), never the whole window. */
function scrollBlockIntoView(el) {
  const scroller = el.closest('.pane__scroll, .card__scroll');
  if (!scroller) { el.scrollIntoView({ block: 'center' }); return; }
  const s = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  scroller.scrollTop += (r.top - s.top) - (s.height - r.height) / 2;
}

/**
 * Scrolls to a block and marks it with a soft highlight (.is-target, css/editor.css → --block-target-bg).
 * The highlight stays until you click or type in that editor. Runs after the page's own scroll reset.
 */
export function revealBlock(editor, blockId) {
  if (!editor || !/^[a-z0-9]+$/.test(blockId || '')) return;
  requestAnimationFrame(() => {
    const el = editor.querySelector(`[data-bid="${blockId}"]`);
    if (!el) return;
    editor.querySelectorAll('.is-target').forEach((b) => b.classList.remove('is-target'));
    scrollBlockIntoView(el);
    el.classList.add('is-target');
    const clear = (e) => {
      if (e.type === 'keydown' && MODIFIERS.has(e.key)) return; // pressing Shift alone is not "typing"
      el.classList.remove('is-target');
      editor.removeEventListener('pointerdown', clear);
      editor.removeEventListener('keydown', clear);
    };
    editor.addEventListener('pointerdown', clear);
    editor.addEventListener('keydown', clear);
  });
}

export function render({ id, block }, { pane = false } = {}) {
  const note = store.getNote(id);
  if (!note) {
    return { html: `<div class="view">${emptyState({ title: 'Note not found', text: 'It may have been deleted.', art: 'notfound',
      actionHtml: pane ? '' : '<a class="btn btn--solid" href="#/home"><span class="btn__label">Back to Home</span></a>' })}</div>` };
  }

  const { trashed } = noteState(note); // the note or its notebook is in Trash: read-only
  const mode = store.noteMode(note);                  // Write or Read — saved on the note
  const readOnly = trashed || mode === 'read';
  const stats = pane ? '' : `<button type="button" class="note__stats" data-action="stats-toggle" data-note-stats title="Click to switch between words and characters">${statsLabel(htmlToText(note.html), getStatsMode())}</button>`;

  const html = `
    <div class="note${pane ? ' note--pane' : ''}" data-font="${note.font === 'mono' || note.font === 'serif' ? note.font : 'sans'}" data-mode="${mode}">
      <div class="note__col">
        <div class="note__bar">
          <span class="note__date">${formatDate(note.createdAt)}</span>
          ${noteLocation(note, trashed)}
          <span class="note__spacer"></span>
          ${stats}
        </div>
        ${trashed ? `<p class="note__banner">${note.deletedAt ? 'This note is in Trash.' : 'This note’s notebook is in Trash.'}</p>` : ''}
        <div class="note__body">
          <div class="prose editor" spellcheck="true" aria-label="Note"></div>
          <div class="tag-rail" aria-label="Tags"></div>
        </div>
        <div class="rel" hidden></div>
      </div>
    </div>`;

  return {
    html,
    mount: (root) => {
      const editor = root.querySelector('.editor');
      const stop = mountEditor(editor, note, { readOnly });
      revealBlock(editor, block);
      const stopRel = mountRelated(root.querySelector('.rel'), note.id);   // "Related notes" footer (backlinks)
      return () => { stop?.(); stopRel(); };
    },
  };
}
