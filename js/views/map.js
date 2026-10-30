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
    <div class="mm${trashed ? ' is-readonly' : ''}" data-mm-theme="${escapeHtml(m.theme || 'colored')}">
      <div class="mm__outline" aria-label="Mind map outline"></div>
      <div class="mm__viewport" tabindex="0" aria-label="Mind map canvas">
        <div class="mm__world">
          <svg class="mm__edges" width="1" height="1" aria-hidden="true"></svg>
          <div class="mm__nodes"></div>
        </div>
      </div>
      ${trashed ? `<p class="mm__banner">${note.deletedAt ? 'This mind map is in Trash.' : 'This mind map’s notebook is in Trash.'}</p>` : ''}


      <div class="mm__views" role="group" aria-label="View">
        <button type="button" class="mm-views__btn is-on" data-mode="map">${icon('mindmap', 16)}<span>Map</span></button>
        <button type="button" class="mm-views__btn" data-mode="outline">${icon('list', 16)}<span>Outline</span></button>
      </div>
      <div class="mm__find" hidden>
        <input type="text" placeholder="Find in map" spellcheck="false" aria-label="Find in map">
        <span class="mm__find-count"></span>
        <button type="button" class="mm-bar__btn mm-find__btn" data-find="prev" title="Previous (Shift+Enter)" aria-label="Previous">${icon('arrowUp', 16)}</button>
        <button type="button" class="mm-bar__btn mm-find__btn" data-find="next" title="Next (Enter)" aria-label="Next">${icon('arrowDown', 16)}</button>
        <button type="button" class="mm-bar__btn mm-find__btn" data-find="close" title="Close (Esc)" aria-label="Close">${icon('close', 16)}</button>
      </div>
      <div class="mm__bar" role="toolbar" aria-label="Map tools">
        <button type="button" class="mm-bar__btn" data-bar="text" title="Text" aria-label="Text">${icon('text', 18)}</button>
        <button type="button" class="mm-bar__btn" data-bar="color" title="Color" aria-label="Color">${icon('palette', 18)}</button>
        <button type="button" class="mm-bar__btn" data-bar="node" title="Node" aria-label="Node">${icon('shape', 18)}</button>
        <button type="button" class="mm-bar__btn" data-bar="map" title="Map" aria-label="Map">${icon('mindmap', 18)}</button>
        <button type="button" class="mm-bar__btn" data-bar="links" title="Linked from" aria-label="Linked from">${icon('link', 18)}</button>
      </div>
      <div class="mm__panel" hidden></div>
    </div>`;

  return {
    html,
    mount: (root) => mountMap(root.querySelector('.mm'), note, {
      readOnly: trashed,
      onSave: (map) => store.touchMap(note.id, map),
    }),
  };
}
