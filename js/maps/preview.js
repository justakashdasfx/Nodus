/* ============================================================================
   MAP PREVIEW — a map you can look at but not edit: drag to move it around, Ctrl (or ⌘) + wheel / the buttons to zoom, double-click to open.
   Used by the Mind map block inside a note (js/editor/map-block.js). It draws with the same layout, nodes and lines as the real canvas
   (layout.js, render.js) and the same CSS (css/maps.css), so it looks exactly like the map. The plain mouse wheel is left alone,
   so the note keeps scrolling when the pointer is over the map.
   mountPreview(box, { getMap, onOpen }) → { refresh, fit, destroy }   (box must have a size and position: relative)
   ========================================================================== */

import { MAPS } from './config.js';
import { computeLayout } from './layout.js';
import { buildNodes, edgesSvg } from './render.js';
import { icon } from '../core/icons.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mountPreview(box, { getMap, onOpen = () => {} }) {
  box.innerHTML = `
    <div class="mm mm--preview">
      <div class="mm__viewport"><div class="mm__world"><svg class="mm__edges" width="1" height="1" aria-hidden="true"></svg><div class="mm__nodes"></div></div></div>
      <div class="mm__zoom" role="group" aria-label="Zoom">
        <button type="button" class="btn btn--icon" data-mm="out" aria-label="Zoom out" title="Zoom out">${icon('minus', 16)}</button>
        <button type="button" class="mm__zoom-value" data-mm="reset" data-mm-zoom title="Back to 100%">100%</button>
        <button type="button" class="btn btn--icon" data-mm="in" aria-label="Zoom in" title="Zoom in">${icon('plus', 16)}</button>
        <button type="button" class="btn btn--icon" data-mm="fit" aria-label="Fit to screen" title="Fit to screen">${icon('fit', 16)}</button>
      </div>
    </div>`;
  const root = box.querySelector('.mm');
  const viewport = root.querySelector('.mm__viewport');
  const world = root.querySelector('.mm__world');
  const svg = root.querySelector('.mm__edges');
  const layer = root.querySelector('.mm__nodes');
  const zoomLabel = root.querySelector('[data-mm-zoom]');

  const els = new Map();
  let pos = {};
  let bbox = { minX: -60, minY: -30, maxX: 60, maxY: 30 };
  let view = { x: 0, y: 0, k: 1 };
  let moved = false;                              // you moved or zoomed it yourself: stop re-fitting when the block is resized
  let drag = null;

  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    let step = MAPS.grid.size * view.k;
    while (step < 14) step *= 2;
    viewport.style.backgroundSize = `${step}px ${step}px`;
    viewport.style.backgroundPosition = `${view.x - step / 2}px ${view.y - step / 2}px`;
    zoomLabel.textContent = `${Math.round(view.k * 100)}%`;
  }

  function fit() {
    const r = viewport.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const w = bbox.maxX - bbox.minX, h = bbox.maxY - bbox.minY;
    const pad = 36;
    const k = clamp(Math.min((r.width - 2 * pad) / w, (r.height - 2 * pad) / h, MAPS.zoom.fitMax), MAPS.zoom.min, MAPS.zoom.max);
    view = { k, x: r.width / 2 - (bbox.minX + w / 2) * k, y: r.height / 2 - (bbox.minY + h / 2) * k };
    moved = false;
    applyView();
  }

  function zoomAt(factor, cx, cy) {
    const k = clamp(view.k * factor, MAPS.zoom.min, MAPS.zoom.max);
    const r = k / view.k;
    view.x = cx - (cx - view.x) * r;
    view.y = cy - (cy - view.y) * r;
    view.k = k;
    moved = true;
    applyView();
  }
  const zoomCentre = (factor) => { const r = viewport.getBoundingClientRect(); zoomAt(factor, r.width / 2, r.height / 2); };

  /** Draws the map again (it may have changed). Keeps your pan and zoom if you moved it. */
  function refresh() {
    const map = getMap();
    if (!map) return;
    root.dataset.mmTheme = map.theme || 'colored';
    root.dataset.shape = map.shape || 'round';
    buildNodes(layer, map, els, { picked: new Set(), editing: null });
    const size = {};
    for (const [id, el] of els) size[id] = { w: el.offsetWidth, h: el.offsetHeight };
    ({ pos, bbox } = computeLayout(map, size));
    for (const [id, el] of els) { const p = pos[id]; if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`; }
    svg.innerHTML = edgesSvg(map, pos);
    if (moved) applyView(); else fit();
    root.classList.add('is-ready');
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-panning');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.x = drag.vx + (e.clientX - drag.x);
    view.y = drag.vy + (e.clientY - drag.y);
    moved = true;
    applyView();
  });
  const end = () => { drag = null; viewport.classList.remove('is-panning'); };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('dblclick', () => onOpen());
  viewport.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;                      // the plain wheel scrolls the note
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 50 ? 0.01 : 0.0025)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  root.querySelector('.mm__zoom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mm]');
    if (!b) return;
    if (b.dataset.mm === 'in') zoomCentre(MAPS.zoom.step);
    else if (b.dataset.mm === 'out') zoomCentre(1 / MAPS.zoom.step);
    else if (b.dataset.mm === 'reset') zoomCentre(1 / view.k);
    else fit();
  });

  const ro = new ResizeObserver(() => { if (!moved) fit(); });   // the block was resized (or just became visible)
  ro.observe(box);
  refresh();

  return { refresh, fit, destroy() { ro.disconnect(); box.innerHTML = ''; } };
}
