/* ============================================================================
   MAP ENGINE — the live canvas: pan / zoom, selecting, typing in nodes, shortcuts, undo, saving, styling.

   mountMap(rootElement, note, { readOnly, onSave })  → returns a function that tears everything down.
   It works directly on note.map (see model.js) and calls onSave(map) a moment after every change.
   Dragging nodes / connecting / resizing: js/maps/drag.js.  The icon bar and its panels: js/maps/panel.js.

   Parts (search for the headings):  history · saving · drawing · view · selecting · editing · changing the tree · styling · keys · pointer
   ========================================================================== */

import { MAPS, THEMES, LINES, LAYOUTS, SHAPES } from './config.js';
import * as M from './model.js';
import { computeLayout } from './layout.js';
import { buildNodes, edgesSvg, paintSelection } from './render.js';
import { KEYMAP, HAND_CODE, matchAction } from './keymap.js';
import { attachDrag } from './drag.js';
import { mountPanel } from './panel.js';
import { readNode, format as fmt, colour as colourFmt, toggleList, inList, fixChecklists, normalize } from './richtext.js';
import { outlineText, parseOutline } from './clip.js';
import { mountOutline } from './outline.js';
import { markdownOf, svgOf, pngOf, download } from './export.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const viewKey = (id) => `nodus.mapview.${id}`;   // pan / zoom of each map is remembered on this device only
const modeKey = (id) => `nodus.mapmode.${id}`;   // so is Map view / Outline view
let CLIP = { text: '', trees: [] };              // the last copied branches (kept for the whole session, so they paste into other maps too)

export function mountMap(root, note, { readOnly = false, onSave = () => {} } = {}) {
  const map = note.map;
  map.levels = map.levels || {};
  map.links = map.links || [];
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
  let selLink = null;                         // the selected connector
  let spaceDown = false;                      // the hand key is held
  let editing = null;                         // id of the node being typed in
  let editSnap = null, editStart = '', fresh = null, quiet = false;
  let past = [], future = [];
  let dirty = false, saveTimer = 0, viewTimer = 0, raf = 0;
  let panel = null, dnd = null;
  let mode = 'map';                           // 'map' or 'outline'
  let outline = null;
  let hits = [], hitIx = -1, hitSet = new Set(), hitCur = null;   // Find in map

  /* ---------- History (undo / redo): whole-map snapshots, small enough to be instant ---------- */

  const snapshot = () => JSON.stringify({ nodes: map.nodes, nextCi: map.nextCi, levels: map.levels, links: map.links,
    opts: { theme: map.theme, line: map.line, layout: map.layout, shape: map.shape } });
  const restore = (s) => {
    const d = JSON.parse(s);
    map.nodes = d.nodes; map.nextCi = d.nextCi; map.levels = d.levels || {}; map.links = d.links || [];
    Object.assign(map, d.opts);
    applyOpts();
  };
  const snap = () => { past.push(snapshot()); if (past.length > MAPS.history) past.shift(); future = []; };
  const commitHistory = (before) => { past.push(before); if (past.length > MAPS.history) past.shift(); future = []; changed(); };

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
    if (selLink && !map.links.some((l) => l.id === selLink)) selLink = null;
    refresh();
    reveal(sel);
    changed();
    panel?.refresh();
  }

  /** Theme and shape are read by the CSS from attributes on the map's root element. */
  function applyOpts() {
    root.dataset.mmTheme = map.theme || 'colored';
    root.dataset.shape = map.shape || 'round';
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
    svg.innerHTML = edgesSvg(map, pos, { selLink });
    paintHits();
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

  /** Moves the canvas just enough to bring a node into view (never changes the zoom). The right side keeps clear of the icon bar. */
  function reveal(id) {
    const p = pos[id];
    if (!p) return;
    const r = viewport.getBoundingClientRect();
    const m = 70, mr = 90;
    const x1 = view.x + p.x * view.k, x2 = x1 + p.w * view.k;
    const y1 = view.y + p.y * view.k, y2 = y1 + p.h * view.k;
    let dx = 0, dy = 0;
    if (x1 < m) dx = m - x1; else if (x2 > r.width - mr) dx = r.width - mr - x2;
    if (y1 < m) dy = m - y1; else if (y2 > r.height - m) dy = r.height - m - y2;
    if (dx || dy) { view.x += dx; view.y += dy; applyView(); }
  }

  /** Pointer position on screen → position on the map. */
  function toWorld(e) {
    const r = viewport.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }

  /* ---------- Selecting and moving around ---------- */

  function paintSel() {
    paintSelection(els, picked);
    panel?.refresh();
  }

  /** add = true (Shift / Ctrl+click): toggle this node in the selection instead of replacing it. */
  function select(id, { scroll = true, add = false } = {}) {
    if (!map.nodes[id] || !els.has(id)) return;
    selLink = null;
    if (add) {
      if (picked.has(id) && picked.size > 1) picked.delete(id); else picked.add(id);
      sel = picked.has(id) ? id : [...picked][0];
    } else { picked = new Set([id]); sel = id; }
    if (svg.querySelector('.mm-link.is-sel')) refresh(false);
    paintSel();
    if (scroll) reveal(sel);
  }
  function clearSel() {
    const hadLink = !!selLink;
    picked = new Set(); sel = null; selLink = null;
    if (hadLink) refresh(false);
    paintSel();
  }
  function selectLink(id) {
    picked = new Set(); sel = null; selLink = id;
    refresh(false);
    paintSel();
  }
  function selectAll() { picked = new Set(Object.keys(pos)); sel = sel && picked.has(sel) ? sel : map.root; paintSel(); }

  /** After something moved or changed shape: select these nodes and redraw. */
  function afterStructure(ids) {
    picked = new Set(ids.filter((id) => map.nodes[id]));
    sel = [...picked][0] ?? null;
    selLink = null;
    refresh();
    if (sel) reveal(sel);
    changed();
    panel?.refresh();
  }

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
    if (map.nodes[id].h) normalize(text);                       // coloured words become real colours while you type (so they can be recoloured)
    editing = id;
    editSnap = snapshot();
    editStart = JSON.stringify([map.nodes[id].t, map.nodes[id].h || null]);
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
    const r = text ? readNode(text) : { t: n.t, h: n.h || null };
    const value = r.t;
    n.t = value;
    if (r.h) n.h = r.h; else delete n.h;
    if (text) { if (r.h) { text.innerHTML = r.h; text.__h = r.h; } else { text.textContent = value; text.__h = null; } }   // the clean form replaces whatever the browser made
    const sig = JSON.stringify([value, r.h || null]);
    if (!value && !quiet && id !== map.root && !n.ch.length) {
      if (fresh === id) past.pop(); else past.push(editSnap);
      fresh = null;
      sel = M.removeNode(map, id);
      picked = new Set([sel]);
      refresh();
      changed();
    } else {
      if (fresh === id) fresh = null;                            // creating + typing is one undo step (the snapshot before creating)
      else if (sig !== editStart && !quiet) { past.push(editSnap); future = []; }
      refresh();
      if (sig !== editStart) changed();
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

  /** A floating node whose top-left corner is at x, y on the map. */
  function addFloatAt(x, y) {
    if (readOnly) return;
    snap();
    const id = M.addFloat(map, x, y);
    sel = id;
    picked = new Set([id]);
    fresh = id;
    refresh();
    startEdit(id, 'end');
    reveal(id);
    changed();
  }
  function addFloatCenter() {
    const r = viewport.getBoundingClientRect();
    addFloatAt((r.width / 2 - view.x) / view.k - 50, (r.height / 2 - view.y) / view.k - 18);
  }

  function removeSelected() {
    if (readOnly) return;
    if (selLink) {
      snap();
      M.removeLink(map, selLink);
      selLink = null;
      refresh(false);
      changed();
      return;
    }
    const ids = [...picked].filter((id) => id !== map.root && map.nodes[id]);
    if (!ids.length) return;
    snap();
    let next = map.root;
    for (const id of ids) if (map.nodes[id]) next = M.removeNode(map, id);   // a node under an already deleted one is simply gone
    if (!map.nodes[next]) next = map.root;
    sel = next;
    picked = new Set([next]);
    refresh();
    reveal(sel);
    changed();
    panel?.refresh();
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

  /** Cuts the selected nodes loose so they float where they are (a little offset so you see it happen). */
  function detachSelected() {
    if (readOnly) return;
    const ids = [...picked].filter((id) => id !== map.root && map.nodes[id] && !map.nodes[id].fl);
    if (!ids.length) return;
    snap();
    for (const id of ids) { const p = pos[id]; M.detach(map, id, p.x + 36, p.y + 36); }
    afterStructure(ids);
  }

  function toggleSticky() {
    if (readOnly) return;
    const floats = [...picked].map((id) => map.nodes[id]).filter((n) => n?.fl);
    if (!floats.length) return;
    snap();
    const on = !floats.every((n) => n.sticky);
    for (const n of floats) { n.sticky = on; if (on && !n.w) n.w = 200; }
    refresh();
    changed();
    panel?.refresh();
  }

  /* ---------- Styling (the Color, Node and Map panels) ---------- */

  const forSubtree = (id, fn) => { const n = map.nodes[id]; fn(n); n.ch.forEach((c) => forSubtree(c, fn)); };

  /** patch: { k } and / or { c } (null = automatic). scope: 'node' (every selected node) · 'branch' (them and everything under them) ·
      'level' (every node of that level: kept as a rule on the map, so nodes added later follow it, and own styles of that level are cleared). */
  function applyStyle(patch, scope, level) {
    if (readOnly) return;
    const ids = [...picked].filter((id) => map.nodes[id]);
    if (scope !== 'level' && !ids.length) return;
    snap();
    const set = (target) => { for (const [k, v] of Object.entries(patch)) { if (v == null) delete target[k]; else target[k] = v; } };
    const own = (n) => { n.st = n.st || {}; set(n.st); if (!Object.keys(n.st).length) delete n.st; };
    if (scope === 'node') ids.forEach((id) => own(map.nodes[id]));
    else if (scope === 'branch') ids.forEach((id) => forSubtree(id, own));
    else {
      const rule = (map.levels[level] = map.levels[level] || {});
      set(rule);
      if (!Object.keys(rule).length) delete map.levels[level];
      for (const n of Object.values(map.nodes)) {
        if (!n.st || M.levelOf(map, n.id) !== level) continue;
        for (const k of Object.keys(patch)) delete n.st[k];
        if (!Object.keys(n.st).length) delete n.st;
      }
    }
    refresh();
    changed();
    panel?.refresh();
  }

  function setOption(key, value) {
    const lists = { theme: THEMES, line: LINES, layout: LAYOUTS, shape: SHAPES };
    if (readOnly || !lists[key]?.some(([v]) => v === value)) return;
    snap();
    map[key] = value;
    if (key === 'layout' && value === 'both') M.rebalance(map);   // back from Right only: share the branches between the two sides again
    applyOpts();
    refresh();
    changed();
    panel?.refresh();
  }

  function autoBalance() {
    if (readOnly) return;
    snap();
    M.rebalance(map);
    for (const n of Object.values(map.nodes)) { delete n.dx; delete n.dy; }   // and (Free layout) every moved node goes back
    refresh();
    changed();
  }

  /* ---------- Text, lists, copy and paste ---------- */

  /** Reads what the browser made inside a node's text back into the clean { t, h } form. */
  function syncFromDom(id) {
    const el = els.get(id)?.firstElementChild;
    const n = map.nodes[id];
    if (!el || !n) return;
    const r = readNode(el);
    n.t = r.t;
    if (r.h) n.h = r.h; else delete n.h;
  }

  /** Runs a formatting command: on the selected words while typing, otherwise on the whole text of every selected node. */
  function formatText(fn) {
    if (readOnly) return;
    if (editing != null) { fn(); normalize(els.get(editing).firstElementChild); syncFromDom(editing); refreshSoon(); changed(); return; }
    const ids = [...picked].filter((id) => map.nodes[id]);
    if (!ids.length) return;
    snap();
    quiet = true;                                                       // one undo step for all of them; an empty node is not deleted
    for (const id of ids) { startEdit(id, 'all'); fn(); normalize(els.get(id).firstElementChild); syncFromDom(id); commitEdit(); }
    quiet = false;
    picked = new Set(ids);
    sel = ids[0];
    refresh();
    changed();
    panel?.refresh();
  }
  const formatKind = (kind) => formatText(() => (['ul', 'ol', 'todo'].includes(kind) ? toggleList(kind) : fmt(kind)));
  const colourText = (kind, ci) => formatText(() => colourFmt(kind, ci));

  /** A checklist box was clicked (the box sits just left of the item). */
  function toggleCheck(id, li) {
    if (readOnly) return;
    if (editing !== id) { select(id, { scroll: false }); snap(); }
    li.dataset.ck = li.dataset.ck === '1' ? '0' : '1';
    syncFromDom(id);
    if (editing !== id) refresh(false);
    changed();
  }

  /** The selected nodes that can be copied: not the centre, and not children of another selected node (they come along). */
  const topPicked = () => {
    const base = [...picked].filter((id) => id !== map.root && map.nodes[id]);
    return base.filter((x) => !base.some((o) => o !== x && M.isDescendant(map, x, o)));
  };

  function onCopy(e) {
    if (editing != null) return false;
    const ids = topPicked();
    if (!ids.length) return false;
    const trees = ids.map((id) => M.exportTree(map, id));
    const text = outlineText(trees);
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
    CLIP = { text, trees };
    return true;
  }
  function onCut(e) { if (!readOnly && onCopy(e)) removeSelected(); }

  /** Pastes branches (copied here, or any indented text) as children of the selected node. */
  function onPaste(e) {
    if (editing != null || readOnly) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    e.preventDefault();
    const trees = CLIP.text === text ? CLIP.trees : parseOutline(text);
    if (!trees.length) return;
    snap();
    const parent = sel && map.nodes[sel] ? sel : map.root;
    afterStructure(trees.map((t) => M.importTree(map, t, parent)));
  }

  /** A copy of each selected branch right after it (floating nodes: a little down and right). */
  function duplicateSelected() {
    const ids = topPicked();
    if (readOnly || !ids.length) return;
    snap();
    const made = ids.map((id) => {
      const n = map.nodes[id];
      const tree = M.exportTree(map, id);
      return n.fl ? M.importTree(map, tree, null, { floatAt: { x: n.x + 30, y: n.y + 30 } })
        : M.importTree(map, tree, n.p, { index: map.nodes[n.p].ch.indexOf(id) + 1 });
    });
    afterStructure(made);
  }

  /** The "Apply to level" button: the selected node's style becomes the rule of that level. */
  function applyToLevel(level) {
    if (!sel || !map.nodes[sel]) return;
    const st = M.styleOf(map, sel);
    applyStyle({ k: st.k, c: st.c }, 'level', level);
  }

  /* ---------- Keys ---------- */

  const ACTIONS = {
    'node.sibling': () => addNode('sibling'),
    'node.child': () => addNode('child'),
    'node.float': addFloatCenter,
    'node.edit': () => startEdit(sel, 'all'),
    'node.delete': removeSelected,
    'node.collapse': () => toggleFold(sel),
    'node.duplicate': duplicateSelected,
    'find.open': openFind,
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
    'edit.bullets': () => formatKind('ul'),
    'edit.numbers': () => formatKind('ol'),
    'edit.checklist': () => formatKind('todo'),
    'edit.done': commitEdit,
  };

  function onKey(e) {
    if (mode !== 'map' || e.isComposing || document.querySelector('.modal')) return;   // the outline has its own keys
    if (e.target.closest?.('.mm__find')) return;       // typing with an IME, or a dialog / the search window is open
    if (e.target !== document.body && !root.contains(e.target)) return;  // typing somewhere else (a menu, an input)
    const action = matchAction(e, editing != null ? KEYMAP.editing : KEYMAP.canvas);
    if (!action) return;
    if (action === 'edit.next' && inList()) return;                      // Enter inside a list adds an item (on an empty item it leaves the list)
    if (action === 'select.none' && editing == null && !picked.size && !selLink) return;   // nothing to deselect: leave Escape to the rest of the app
    e.preventDefault();
    e.stopPropagation();
    if (editing == null && !sel && /^(node\.(sibling|child|edit|collapse)|nav)/.test(action)) { select(map.root); return; }   // nothing selected: the first key press selects the centre
    ACTIONS[action]?.();
  }

  /* The hand tool: hold the key, drag the canvas */
  function setHand(on) { spaceDown = on; viewport.classList.toggle('is-hand', on); }
  function onHandKey(e) {
    if (mode !== 'map' || e.code !== HAND_CODE || editing != null || e.isComposing || document.querySelector('.modal')) return;
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
    const link = e.target.closest('[data-link]');
    if (link) { if (editing) commitEdit(); e.preventDefault(); selectLink(link.dataset.link); viewport.focus({ preventScroll: true }); return; }

    const nodeEl = e.target.closest('.mm-node');
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (e.target.closest('.mm-node__fold')) { e.preventDefault(); toggleFold(id); return; }
      if (e.target.closest('.mm-node__link')) { if (!readOnly) { e.preventDefault(); dnd.startLink(e, id); } return; }
      if (e.target.closest('.mm-node__resize')) { if (!readOnly) { e.preventDefault(); dnd.startResize(e, id); } return; }
      const box = e.target.closest('li[data-ck]');
      if (box && e.clientX <= box.getBoundingClientRect().left) { e.preventDefault(); toggleCheck(id, box); return; }   // the checklist box
      if (editing === id) return;                                        // clicking inside the text you are typing: normal caret
      if (editing) commitEdit();
      e.preventDefault();
      const keep = picked.has(id) && picked.size > 1 && !add;            // pressing on one of several selected nodes: keep them for a group drag
      if (!keep) select(id, { scroll: false, add });
      viewport.focus({ preventScroll: true });
      if (!readOnly) dnd.armMove(e, id, keep); else if (keep) select(id, { scroll: false });
      return;
    }
    if (editing) commitEdit();                                           // empty canvas: drag draws a selection box
    panel?.close();
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
    selLink = null;
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
    if (nodeEl) { if (!e.target.closest('.mm-node__fold, .mm-node__link, .mm-node__resize')) startEdit(nodeEl.dataset.id, 'end'); return; }
    if (e.target.closest('[data-link]')) return;
    const w = toWorld(e);                                                // double-click on empty canvas: a floating node right there
    addFloatAt(w.x - 40, w.y - 16);
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
    fixChecklists(text);
    syncFromDom(editing);
    els.get(editing).classList.toggle('is-empty', !map.nodes[editing].t);
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

  viewport.addEventListener('copy', onCopy);
  viewport.addEventListener('cut', onCut);
  viewport.addEventListener('paste', onPaste);

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

  /* ---------- Find in map (Ctrl+F) ---------- */

  const findBox = root.querySelector('.mm__find');
  const findInput = findBox?.querySelector('input');
  const findCount = findBox?.querySelector('.mm__find-count');

  function paintHits() {
    for (const [id, el] of els) {
      el.classList.toggle('is-hit', hitSet.has(id));
      el.classList.toggle('is-hit-cur', id === hitCur);
    }
  }

  function showHit() {
    hitSet = new Set(hits);
    hitCur = hitIx >= 0 ? hits[hitIx] : null;
    if (hitCur) {
      let opened = false;                                                       // a match inside a folded branch: open the branch
      for (let n = map.nodes[hitCur]; n && n.p; n = map.nodes[n.p]) {
        const par = map.nodes[n.p];
        if (par.col && par.id !== map.root) { par.col = false; opened = true; }
      }
      if (opened) changed();
      refresh();
      select(hitCur);
    } else paintHits();
    if (findCount) findCount.textContent = hits.length ? `${hitIx + 1} / ${hits.length}` : (findInput.value.trim() ? 'No results' : '');
  }

  function runFind() {
    const q = findInput.value.trim().toLowerCase();
    hits = q ? Object.values(map.nodes).filter((n) => (n.t || '').toLowerCase().includes(q)).map((n) => n.id) : [];
    hitIx = hits.length ? 0 : -1;
    showHit();
  }
  function stepFind(dir) {
    if (!hits.length) return;
    hitIx = (hitIx + dir + hits.length) % hits.length;
    showHit();
  }
  function openFind() {
    if (mode !== 'map' || !findBox) return;
    findBox.hidden = false;
    findInput.focus();
    findInput.select();
  }
  function closeFind() {
    if (!findBox || findBox.hidden) return;
    findBox.hidden = true;
    hits = []; hitIx = -1; hitSet = new Set(); hitCur = null;
    paintHits();
    viewport.focus({ preventScroll: true });
  }
  findInput?.addEventListener('input', runFind);
  findInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  findBox?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-find]');
    if (!b) return;
    if (b.dataset.find === 'next') stepFind(1); else if (b.dataset.find === 'prev') stepFind(-1); else closeFind();
  });

  /* ---------- Map view / Outline view ---------- */

  function setMode(next) {
    if (next === mode) return;
    commitEdit();
    panel?.close();
    closeFind();
    mode = next;
    root.dataset.view = mode;
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === mode));
    try { localStorage.setItem(modeKey(note.id), mode); } catch { /* ignore */ }
    if (mode === 'outline') {
      outline = mountOutline(root.querySelector('.mm__outline'), {
        map, readOnly, snap, changed,
        select: (id) => { sel = id; picked = new Set([id]); selLink = null; },
      });
      outline.render();
      outline.focus(map.nodes[sel] ? sel : map.root);
    } else {
      outline?.destroy();
      outline = null;
      refresh();                                                                // (the map changed while it was hidden)
      paintSel();
      viewport.focus({ preventScroll: true });
      if (sel) reveal(sel);
    }
  }
  root.querySelector('.mm__views')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });

  /* ---------- Export ---------- */

  async function exportAs(kind) {
    const name = (M.mapTitle(map).replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().replace(/\s+/g, '-')) || 'mind-map';
    try {
      if (kind === 'md') { download(`${name}.md`, new Blob([markdownOf(map)], { type: 'text/markdown' })); return; }
      if (mode !== 'map') return;
      const pic = svgOf(map, root, els, pos, bbox, svg);
      if (kind === 'svg') download(`${name}.svg`, new Blob([pic.text], { type: 'image/svg+xml' }));
      else download(`${name}.png`, await pngOf(pic.text, pic.w, pic.h));
    } catch (err) { console.error(err); }
  }

  /* ---------- Parts that need the functions above ---------- */

  dnd = attachDrag({
    map, viewport, layer, svg, els,
    get pos() { return pos; }, get view() { return view; }, get picked() { return picked; },
    toWorld, select, snap, snapshot, commitHistory, afterStructure,
    relayout: refreshSoon,
    afterLink: () => { refresh(false); changed(); },
  });

  panel = mountPanel(root, {
    map, noteId: note.id,
    sel: () => sel,
    picked: () => [...picked].filter((id) => map.nodes[id]),
    node: (id) => map.nodes[id],
    levelOf: (id) => M.levelOf(map, id),
    styleOf: (id) => ({ ...M.styleOf(map, id), ci: meta[id]?.ci ?? null }),
    applyStyle, applyToLevel, setOption, autoBalance, undo, redo,
    format: formatKind, colourText, exportAs,
    addFloat: addFloatCenter, toggleSticky, detach: detachSelected,
  });

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keydown', onHandKey, true);
  document.addEventListener('keyup', onHandKey, true);
  const onBlur = () => setHand(false);
  window.addEventListener('blur', onBlur);
  const onHide = () => { if (document.visibilityState === 'hidden') { commitEdit(); flushSave(); flushView(); } };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  /* ---------- Start ---------- */

  applyOpts();
  refresh();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(viewKey(note.id)) || 'null'); } catch { /* ignore */ }
  if (saved && [saved.x, saved.y, saved.k].every(Number.isFinite)) { view = saved; applyView(); } else fit();
  root.classList.add('is-ready');
  viewport.focus({ preventScroll: true });
  let savedMode = null;
  try { savedMode = localStorage.getItem(modeKey(note.id)); } catch { /* ignore */ }
  if (savedMode === 'outline') setMode('outline');
  else if (!readOnly && !map.nodes[map.root].t) { startEdit(map.root, 'end'); }   // a brand-new map: type its name straight away

  return () => {
    commitEdit();
    flushSave();
    flushView();
    cancelAnimationFrame(raf);
    dnd.destroy();
    panel.destroy();
    outline?.destroy();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keydown', onHandKey, true);
    document.removeEventListener('keyup', onHandKey, true);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onHide);
  };
}
