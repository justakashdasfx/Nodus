/* MAP — one mind map: the infinite canvas. The whole page is the canvas (css/maps.css → .mm).
   Everything that happens on it lives in js/maps/engine.js; the choices (theme, lines, layout) are in the ⋯ menu (js/ui/more-menu.js).
   A map in Trash (or in a notebook that is in Trash) opens read-only. */
import * as store from '../core/store.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { comboLabel } from '../core/keys.js';
import { emptyState } from '../ui/components.js';
import { noteState } from '../ui/note-meta.js';
import { mountMap } from '../maps/engine.js';
import { KEYMAP, HAND_LABEL } from '../maps/keymap.js';

/** The little hint line at the bottom, built from the shortcuts in js/maps/keymap.js so it never goes out of date. */
function hint() {
  const first = (action) => comboLabel((KEYMAP.canvas[action] || [])[0] || '');
  return [['node.sibling', 'node beside'], ['node.child', 'branch'], ['node.edit', 'edit'], ['node.collapse', 'fold']]
    .filter(([a]) => first(a))
    .map(([a, label]) => `<span><kbd>${escapeHtml(first(a))}</kbd> ${label}</span>`).join('')
    + `<span><kbd>${escapeHtml(HAND_LABEL)}</kbd> + drag to move</span>`;
}

export function render({ id }) {
  const note = store.getNote(id);
  if (!note || note.type !== 'map' || !note.map) {
    return { html: `<div class="view">${emptyState({ title: 'Mind map not found', text: 'It may have been deleted.',
      actionHtml: '<a class="btn btn--solid" href="#/maps"><span class="btn__label">Back to Mind maps</span></a>' })}</div>` };
  }
  const { trashed } = noteState(note);
  const m = note.map;

  const html = `
    <div class="mm" data-mm-theme="${escapeHtml(m.theme || 'colored')}">
      <div class="mm__viewport" tabindex="0" aria-label="Mind map canvas">
        <div class="mm__world">
          <svg class="mm__edges" width="1" height="1" aria-hidden="true"></svg>
          <div class="mm__nodes"></div>
        </div>
      </div>
      ${trashed ? `<p class="mm__banner">${note.deletedAt ? 'This mind map is in Trash.' : 'This mind map’s notebook is in Trash.'}</p>` : ''}
      <div class="mm__zoom" role="group" aria-label="Zoom">
        <button type="button" class="btn btn--icon" data-mm="out" title="Zoom out (${escapeHtml(comboLabel((KEYMAP.canvas['view.zoomOut'] || [])[0] || ''))})" aria-label="Zoom out">${icon('minus', 16)}</button>
        <button type="button" class="mm__zoom-value" data-mm="reset" data-mm-zoom title="Back to 100%">100%</button>
        <button type="button" class="btn btn--icon" data-mm="in" title="Zoom in (${escapeHtml(comboLabel((KEYMAP.canvas['view.zoomIn'] || [])[0] || ''))})" aria-label="Zoom in">${icon('plus', 16)}</button>
        <button type="button" class="btn btn--icon" data-mm="fit" title="Fit to screen (${escapeHtml(comboLabel((KEYMAP.canvas['view.fit'] || [])[0] || ''))})" aria-label="Fit to screen">${icon('fit', 16)}</button>
        <span class="mm__zoom-sep" aria-hidden="true"></span>
        <span class="mm__count" data-mm-count></span>
      </div>
      ${trashed ? '' : `<div class="mm__hint">${hint()}</div>`}
    </div>`;

  return {
    html,
    mount: (root) => mountMap(root.querySelector('.mm'), note, {
      readOnly: trashed,
      onSave: (map) => store.touchMap(note.id, map),
    }),
  };
}
