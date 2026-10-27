/* ============================================================================
   MAP ENGINE — the live canvas: pan / zoom, selecting, typing in nodes, shortcuts, undo, saving.

   mountMap(rootElement, note, { readOnly, onSave })  → returns a function that tears everything down.
   It works directly on note.map (see model.js) and calls onSave(map) a moment after every change.

   Parts (search for the headings):  history · drawing · view · selecting · editing · changing the tree · keys · pointer
   ========================================================================== */

import { MAPS } from './config.js';
import * as M from './model.js';
import { computeLayout } from './layout.js';
import { buildNodes, edgesSvg } from './render.js';
import { KEYMAP, HAND_CODE, matchAction } from './keymap.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const viewKey = (id) => `nodus.mapview.${id}`;   // pan / zoom of each map is remembered on this device only

export function mountMap(root, note, { readOnly = false, onSave = () => {} } = {}) {
  const map = note.map;
  const viewport = root.querySelector('.mm__viewport');
  const world = root.querySelector('.mm__world');
  const svg = root.querySelector('.mm__edges');
  const layer = root.querySelector('.mm__nodes');
  const zoomLabel = root.querySelector('[data-mm-zoom]');
  const countLabel = root.querySelector('[data-mm-count]');

  const els = new Map();                      // node id → element
  let meta = {};                              // node id → { level, … } for the visible nodes
  let pos = {};                               // node id → { x, y, w, h, cy, dir }
  let bbox = { minX: -60, minY: -30, maxX: 60, maxY: 30 };
  let view = { x: 0, y: 0, k: 1 };
  let sel = map.root;                         // the main selected node (null = nothing selected)
  let picked = new Set([map.root]);           // every selected node (box select / Shift+click can pick several)
  let spaceDown = false;                      // the hand key is held
  let editing = null;                         // id of the node being typed in
  let editSnap = null, editStart = '', fresh = null;
  let past = [], future = [];
  let dirty = false, saveTimer = 0, viewTimer = 0, raf = 0;

  /* ---------- History (undo / redo): whole-tree snapshots, small enough to be instant ---------- */

  const snapshot = () => JSON.stringify({ nodes: map.nodes, nextCi: map.nextCi });
  const restore = (s) => { const d = JSON.parse(s); map.nodes = d.nodes; map.nextCi = d.nextCi; };
  const snap = () => { past.push(snapshot()); if (past.length > MAPS.history) past.shift(); future = []; };

  function undo() {
    if (!past.length || readOnly) return;
    future.push(snapshot());
    restore(past.pop());
    afterHistory();
  }
  function redo() {
    if (!future.length || readOnly) return;
    past.push(snapshot());
    restore(future.pop());
    afterHistory();
  }
  function afterHistory() {
    picked = new Set([...picked].filter((id) => map.nodes[id]));
    if (!map.nodes[sel]) sel = [...picked][0] ?? map.root;
    if (!picked.size) picked.add(sel);
    refresh();
    reveal(sel);
    changed();
  }

  /* ---------- Saving ---------- */

  function changed() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, MAPS.saveDelay);
  }
  function flushSave() {
    clearTimeout(saveTimer);
    if (!dirty) return;
    dirty = false;
    onSave(map);
  }
  const saveViewSoon = () => {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(flushView, 400);
  };
  function flushView() {
    clearTimeout(viewTimer);
    try { localStorage.setItem(viewKey(note.id), JSON.stringify(view)); } catch { /* storage unavailable */ }
  }

  /* ---------- Drawing ---------- */

  function measure() {
    const size = {};
    for (const [id, el] of els) size[id] = { w: el.offsetWidth, h: el.offsetHeight };   // layout size: not affected by zoom
    return size;
  }

  /** rebuild = false: only measure and move (used while typing, so the node being typed in is left alone). */
  function refresh(rebuild = true) {
    if (rebuild) {
      const vis = buildNodes(layer, map, els, { picked, editing });
      meta = {};
      vis.forEach((v) => { meta[v.id] = v; });
    }
    ({ pos, bbox } = computeLayout(map, measure()));
    for (const [id, el] of els) {
      const p = pos[id];
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    svg.innerHTML = edgesSvg(map, pos);
    if (countLabel) countLabel.textContent = `${M.countNodes(map)} ${M.countNodes(map) === 1 ? 'node' : 'nodes'}`;
  }
  const refreshSoon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => refresh(false)); };

  /* ---------- View: pan and zoom ---------- */

  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    let step = MAPS.grid.size * view.k;
    while (step < 14) step *= 2;              // far away the grid thins out instead of turning into noise
    viewport.style.backgroundSize = `${step}px ${step}px`;
    viewport.style.backgroundPosition = `${view.x - step / 2}px ${view.y - step / 2}px`;   // the dots sit on the grid lines, not between
    if (zoomLabel) zoomLabel.textContent = `${Math.round(view.k * 100)}%`;
    saveViewSoon();
  }

  function zoomAt(factor, cx, cy) {
    const k = clamp(view.k * factor, MAPS.zoom.min, MAPS.zoom.max);
    const r = k / view.k;
    view.x = cx - (cx - view.x) * r;
    view.y = cy - (cy - view.y) * r;
    view.k = k;
    applyView();
  }
  const zoomStep = (dir) => {
    const r = viewport.getBoundingClientRect();
    zoomAt(MAPS.zoom.step ** dir, r.width / 2, r.height / 2);
  };
  function zoomReset() {
    const r = viewport.getBoundingClientRect();
    zoomAt(1 / view.k, r.width / 2, r.height / 2);
  }

  function fit() {
    const r = viewport.getBoundingClientRect();
    const w = bbox.maxX - bbox.minX, h = bbox.maxY - bbox.minY;
    const pad = MAPS.zoom.fitPadding;
    const k = clamp(Math.min((r.width - 2 * pad) / w, (r.height - 2 * pad) / h, MAPS.zoom.fitMax), MAPS.zoom.min, MAPS.zoom.max);
    view = { k, x: r.width / 2 - (bbox.minX + w / 2) * k, y: r.height / 2 - (bbox.minY + h / 2) * k };
    applyView();
  }

  /** Moves the canvas just enough to bring a node into view (never changes the zoom). */
  function reveal(id) {
    const p = pos[id];
    if (!p) return;
    const r = viewport.getBoundingClientRect();
    const m = 70;
    const x1 = view.x + p.x * view.k, x2 = x1 + p.w * view.k;
    const y1 = view.y + p.y * view.k, y2 = y1 + p.h * view.k;
    let dx = 0, dy = 0;
    if (x1 < m) dx = m - x1; else if (x2 > r.width - m) dx = r.width - m - x2;
    if (y1 < m) dy = m - y1; else if (y2 > r.height - m) dy = r.height - m - y2;
    if (dx || dy) { view.x += dx; view.y += dy; applyView(); }
  }

  /* ---------- Selecting and moving around ---------- */

  function paintSel() { for (const [id, el] of els) el.classList.toggle('is-sel', picked.has(id)); }

  /** add = true (Shift / Ctrl+click): toggle this node in the selection instead of replacing it. */
  function select(id, { scroll = true, add = false } = {}) {
    if (!map.nodes[id] || !els.has(id)) return;
    if (add) {
      if (picked.has(id) && picked.size > 1) picked.delete(id); else picked.add(id);
      sel = picked.has(id) ? id : [...picked][0];
    } else { picked = new Set([id]); sel = id; }
    paintSel();
    if (scroll) reveal(sel);
  }
  function clearSel() { picked = new Set(); sel = null; paintSel(); }
  function selectAll() { picked = new Set(Object.keys(pos)); sel = sel && picked.has(sel) ? sel : map.root; paintSel(); }

  /** Arrow keys. Left / right follow the tree (towards the children on the side the branch grows, otherwise back to the parent);
      up / down jump to the nearest node above or below in the same column. */
  function nav(dir) {
    const n = map.nodes[sel];
    let to = null;
    if (dir === 'left' || dir === 'right') {
      const want = dir === 'right' ? 'r' : 'l';
      const side = M.sideOf(map, sel);
      if (sel === map.root) to = n.ch.find((c) => M.sideOf(map, c) === want) || null;
      else if (side === want) {
        if (n.col && n.ch.length) { snap(); n.col = false; refresh(); changed(); }   // moving into a folded branch opens it
        to = n.ch[0] || null;
      } else to = n.p;
    } else {
      const me = pos[sel];
      if (!me || sel === map.root) return;
      let best = Infinity;
      for (const [id, p] of Object.entries(pos)) {
        if (id === sel || p.dir !== me.dir || meta[id]?.level !== meta[sel]?.level) continue;
        const d = dir === 'down' ? p.cy - me.cy : me.cy - p.cy;
        if (d > 0.5 && d < best) { best = d; to = id; }
      }
    }
    if (to) select(to);
  }

  /* ---------- Editing text in a node ---------- */

  function startEdit(id, mode = 'end') {
    if (readOnly || !els.has(id)) return;
    if (editing && editing !== id) commitEdit();
    select(id, { scroll: false });
    const el = els.get(id);
    const text = el.firstElementChild;
    editing = id;
    editSnap = snapshot();
    editStart = map.nodes[id].t;
    text.contentEditable = 'true';
    el.classList.add('is-edit');
    text.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(text);
    if (mode === 'end') range.collapse(false);                  // 'all' keeps everything selected
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(range);
  }

  /** Ends typing. A node left empty is removed (a brand-new one leaves no trace in the undo history). */
  function commitEdit() {
    if (editing == null) return;
    const id = editing;
    editing = null;
    const el = els.get(id);
    const text = el?.firstElementChild;
    if (text) { text.contentEditable = 'false'; text.blur(); el.classList.remove('is-edit'); }
    const n = map.nodes[id];
    if (!n) { fresh = null; return; }
    const value = (text ? text.textContent : n.t).replace(/^\s+|\s+$/g, '');
    n.t = value;
    if (!value && id !== map.root && !n.ch.length) {
      if (fresh === id) past.pop(); else past.push(editSnap);
      fresh = null;
      sel = M.removeNode(map, id);
      picked = new Set([sel]);
      refresh();
      changed();
    } else {
      if (fresh === id) fresh = null;                            // creating + typing is one undo step (the snapshot before creating)
      else if (value !== editStart) { past.push(editSnap); future = []; }
      refresh();
      if (value !== editStart) changed();
    }
    viewport.focus({ preventScroll: true });
  }
  const editingEmpty = () => !els.get(editing)?.firstElementChild.textContent.trim();

  /* ---------- Changing the tree ---------- */

  /** kind: 'sibling' (Enter) or 'child' (Tab). The new node opens for typing straight away. */
  function addNode(kind) {
    if (readOnly || !sel) return;
    snap();
    const id = kind === 'child' ? M.addChild(map, sel) : M.addSibling(map, sel);
    sel = id;
    picked = new Set([id]);
    fresh = id;
    refresh();
    startEdit(id, 'end');
    reveal(id);
    changed();
  }

  function removeSelected() {
    const ids = [...picked].filter((id) => id !== map.root && map.nodes[id]);
    if (readOnly || !ids.length) return;
    snap();
    let next = map.root;
    for (const id of ids) if (map.nodes[id]) next = M.removeNode(map, id);   // a node under an already deleted one is simply gone
    if (!map.nodes[next]) next = map.root;
    sel = next;
    picked = new Set([next]);
    refresh();
    reveal(sel);
    changed();
  }

  function toggleFold(id) {
    const n = map.nodes[id];
    if (readOnly || !n || id === map.root || !n.ch.length) return;
    snap();
    n.col = !n.col;
    sel = id;
    picked = new Set([id]);
    refresh();
    reveal(id);
    changed();
  }

  /* ---------- Keys ---------- */

  const ACTIONS = {
    'node.sibling': () => addNode('sibling'),
    'node.child': () => addNode('child'),
    'node.edit': () => startEdit(sel, 'all'),
    'node.delete': removeSelected,
    'node.collapse': () => toggleFold(sel),
    'select.all': selectAll,
    'select.none': clearSel,
    'nav.up': () => nav('up'),
    'nav.down': () => nav('down'),
    'nav.left': () => nav('left'),
    'nav.right': () => nav('right'),
    'edit.undo': undo,
    'edit.redo': redo,
    'view.fit': fit,
    'view.reset': zoomReset,
    'view.zoomIn': () => zoomStep(1),
    'view.zoomOut': () => zoomStep(-1),
    // while typing
    'edit.next': () => { if (!editingEmpty()) { commitEdit(); addNode('sibling'); } },
    'edit.nextChild': () => { if (!editingEmpty()) { commitEdit(); addNode('child'); } },
    'edit.newline': () => document.execCommand('insertText', false, '\n'),
    'edit.done': commitEdit,
  };

  function onKey(e) {
    if (e.isComposing || document.querySelector('.modal')) return;       // typing with an IME, or a dialog / the search window is open
    if (e.target !== document.body && !root.contains(e.target)) return;  // typing somewhere else (a menu, an input)
    const action = matchAction(e, editing != null ? KEYMAP.editing : KEYMAP.canvas);
    if (!action) return;
    if (action === 'select.none' && editing == null && !picked.size) return;   // nothing to deselect: leave Escape to the rest of the app
    e.preventDefault();
    e.stopPropagation();
    if (editing == null && !sel && /^(node|nav)\./.test(action)) { select(map.root); return; }   // nothing selected: the first key press selects the centre
    ACTIONS[action]?.();
  }

  /* The hand tool: hold the key, drag the canvas */
  function setHand(on) { spaceDown = on; viewport.classList.toggle('is-hand', on); }
  function onHandKey(e) {
    if (e.code !== HAND_CODE || editing != null || e.isComposing || document.querySelector('.modal')) return;
    if (e.target !== document.body && !root.contains(e.target)) return;
    e.preventDefault();
    setHand(e.type === 'keydown');
  }

  /* ---------- Pointer: select, pan, zoom, type ---------- */

  let drag = null;      // moving the canvas
  let band = null;      // drawing a selection box
  let bandEl = null;

  const startPan = (e) => {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-panning');
  };

  viewport.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });   // no auto-scroll circle on a middle click

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1 || spaceDown) {                                   // middle button, or hand key + drag: move the canvas
      if (editing) commitEdit();
      e.preventDefault();
      startPan(e);
      return;
    }
    const nodeEl = e.target.closest('.mm-node');
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (nodeEl) {
      if (e.target.closest('.mm-node__fold')) { e.preventDefault(); toggleFold(nodeEl.dataset.id); return; }
      if (editing === nodeEl.dataset.id) return;                         // clicking inside the text you are typing: normal caret
      if (editing) commitEdit();
      e.preventDefault();
      select(nodeEl.dataset.id, { scroll: false, add });
      viewport.focus({ preventScroll: true });
      return;
    }
    if (editing) commitEdit();                                           // empty canvas: drag draws a selection box
    e.preventDefault();
    viewport.focus({ preventScroll: true });
    const r = viewport.getBoundingClientRect();
    band = { x0: e.clientX - r.left, y0: e.clientY - r.top, x1: 0, y1: 0, add, base: new Set(picked), moved: false };
    band.x1 = band.x0; band.y1 = band.y0;
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (drag) {
      view.x = drag.vx + (e.clientX - drag.x);
      view.y = drag.vy + (e.clientY - drag.y);
      applyView();
      return;
    }
    if (!band) return;
    const r = viewport.getBoundingClientRect();
    band.x1 = e.clientX - r.left;
    band.y1 = e.clientY - r.top;
    if (!band.moved && Math.hypot(band.x1 - band.x0, band.y1 - band.y0) < 4) return;
    band.moved = true;
    if (!bandEl) { bandEl = document.createElement('div'); bandEl.className = 'mm__marquee'; viewport.append(bandEl); }
    const x = Math.min(band.x0, band.x1), y = Math.min(band.y0, band.y1);
    const w = Math.abs(band.x1 - band.x0), h = Math.abs(band.y1 - band.y0);
    Object.assign(bandEl.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const hit = [];
    for (const [id, p] of Object.entries(pos)) {                         // every node the box touches
      const nx = view.x + p.x * view.k, ny = view.y + p.y * view.k;
      if (nx < x + w && nx + p.w * view.k > x && ny < y + h && ny + p.h * view.k > y) hit.push(id);
    }
    picked = band.add ? new Set([...band.base, ...hit]) : new Set(hit);
    sel = hit[0] ?? [...picked][0] ?? null;
    paintSel();
  });

  const endPointer = () => {
    if (band && !band.moved && !band.add) clearSel();                    // a plain click on empty canvas: select nothing
    bandEl?.remove();
    bandEl = null;
    band = null;
    drag = null;
    viewport.classList.remove('is-panning');
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  viewport.addEventListener('dblclick', (e) => {
    const nodeEl = e.target.closest('.mm-node');
    if (nodeEl && !e.target.closest('.mm-node__fold')) startEdit(nodeEl.dataset.id, 'end');
  });

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || MAPS.wheel === 'zoom') {
      const speed = e.ctrlKey && Math.abs(e.deltaY) < 50 ? 0.01 : 0.0025;   // a trackpad pinch reports small steps, a mouse wheel big ones
      zoomAt(Math.exp(-e.deltaY * speed), e.clientX - r.left, e.clientY - r.top);
    } else {
      view.x -= e.shiftKey ? e.deltaY : e.deltaX;
      view.y -= e.shiftKey ? 0 : e.deltaY;
      applyView();
    }
  }, { passive: false });

  /* Typing inside a node */
  layer.addEventListener('input', (e) => {
    if (editing == null) return;
    const text = e.target.closest('.mm-node__text');
    if (!text) return;
    map.nodes[editing].t = text.textContent;
    els.get(editing).classList.toggle('is-empty', !text.textContent);
    refreshSoon();                                                      // the node grows or shrinks: move its neighbours
    changed();
  });
  layer.addEventListener('paste', (e) => {                              // plain text only
    if (editing == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, ''));
  });
  layer.addEventListener('focusout', (e) => {                           // clicking away finishes the node
    const nodeEl = e.target.closest('.mm-node');
    if (nodeEl && nodeEl.dataset.id === editing) commitEdit();
  });

  /* Zoom buttons (bottom left) */
  root.querySelector('.mm__zoom')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mm]');
    if (!b) return;
    if (b.dataset.mm === 'in') zoomStep(1);
    else if (b.dataset.mm === 'out') zoomStep(-1);
    else if (b.dataset.mm === 'reset') zoomReset();
    else if (b.dataset.mm === 'fit') fit();
    viewport.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keydown', onHandKey, true);
  document.addEventListener('keyup', onHandKey, true);
  window.addEventListener('blur', () => setHand(false));
  const onHide = () => { if (document.visibilityState === 'hidden') { commitEdit(); flushSave(); flushView(); } };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  /* ---------- Start ---------- */

  refresh();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(viewKey(note.id)) || 'null'); } catch { /* ignore */ }
  if (saved && [saved.x, saved.y, saved.k].every(Number.isFinite)) { view = saved; applyView(); } else fit();
  root.classList.add('is-ready');
  viewport.focus({ preventScroll: true });
  if (!readOnly && !map.nodes[map.root].t) { startEdit(map.root, 'end'); }   // a brand-new map: type its name straight away

  return () => {
    commitEdit();
    flushSave();
    flushView();
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keydown', onHandKey, true);
    document.removeEventListener('keyup', onHandKey, true);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
}
