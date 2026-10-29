/* ============================================================================
   MAP MODEL — the data of one mind map and the pure functions that change it. No DOM in here.

   map  = { v, theme, line, layout, shape, root, nextCi, nodes: { [id]: node }, levels: { [n]: style }, links: [link] }
   node = { id, p (parent id; null for the centre and for floating nodes), t (plain text), h (formatted text as HTML, only when it has formatting or lists),
            ch [child ids in order], col (collapsed), dx + dy (how far you moved it in the Free layout),
            ci (colour index: main branches and floating nodes), side ('r' | 'l': main branches),
            fl + x + y (a floating node and where it sits), sticky + w (sticky-note look and its width), st (own style) }
   style = { k: 'both' | 'fill' | 'border' | 'none'  (what is coloured: the fill, the border, both, or neither),
             c: colour index 0…7 }                    (missing = automatic: the colour of the branch)
   Style order: the node's own `st` → the rule of its level (map.levels[level]) → the default (levels 0–1 'both', deeper 'none').
   link = { id, a, b, arrow }   a connector between any two nodes.
   The map lives in a note of type 'map' (note.map), so it syncs, goes to Trash and moves between notebooks like a note.
   ========================================================================== */

import { uid } from '../core/utils.js';
import { MAPS, DEFAULTS } from './config.js';

export function newMap() {
  const id = uid();
  return { v: 1, ...DEFAULTS, root: id, nextCi: 0, levels: {}, links: [], nodes: { [id]: { id, p: null, t: '', ch: [] } } };
}

/** The name of the map = the first line of its central node. */
export const mapTitle = (map) => (map?.nodes?.[map.root]?.t || '').split('\n')[0].trim().slice(0, 120) || 'Untitled map';
export const countNodes = (map) => Object.keys(map?.nodes || {}).length;

/* ---------- Where a node belongs ---------- */

/** The main branch (or floating node) a node sits under; null for the centre. */
export function topOf(map, id) {
  let n = map.nodes[id];
  if (!n || id === map.root) return null;
  while (n.p && n.p !== map.root) n = map.nodes[n.p];
  return n;
}

/** 'r' or 'l' (which side of the centre); null for the centre. Floating nodes and 'Right only' layouts grow to the right. */
export function sideOf(map, id) {
  const top = topOf(map, id);
  if (!top) return null;
  return top.fl || map.layout === 'right' ? 'r' : (top.side === 'l' ? 'l' : 'r');
}

/** 0 = the centre, 1 = main branches and floating nodes, 2 = their children … */
export function levelOf(map, id) {
  let n = map.nodes[id], l = 0;
  while (n && n.p) { l += 1; n = map.nodes[n.p]; }
  return n?.fl ? l + 1 : l;
}

export function isDescendant(map, id, ancestor) {
  for (let n = map.nodes[id]; n && n.p; n = map.nodes[n.p]) if (n.p === ancestor) return true;
  return false;
}

const weight = (map, id) => 1 + map.nodes[id].ch.reduce((sum, c) => sum + weight(map, c), 0);

/** Side with fewer nodes so far: new main branches go there (this is the auto-balance). */
function lighterSide(map) {
  let r = 0, l = 0;
  for (const c of map.nodes[map.root].ch) { if (map.nodes[c].side === 'l') l += weight(map, c); else r += weight(map, c); }
  return l < r ? 'l' : 'r';
}

/** Hands the main branches out to the two sides again, balancing by size (keeps their order). */
export function rebalance(map) {
  let r = 0, l = 0;
  for (const c of map.nodes[map.root].ch) {
    const w = weight(map, c);
    if (r <= l) { map.nodes[c].side = 'r'; r += w; } else { map.nodes[c].side = 'l'; l += w; }
  }
}

const nextColour = (map) => { const ci = (map.nextCi || 0) % MAPS.palette; map.nextCi = (map.nextCi || 0) + 1; return ci; };

/** A node that sits right under the centre: it needs a colour and a side. */
function asMainBranch(map, node, side) {
  if (node.ci == null) node.ci = nextColour(map);
  node.side = side || (map.layout === 'right' ? 'r' : lighterSide(map));
}

/* ---------- Changing the tree ---------- */

export function addChild(map, parentId, { index, side } = {}) {
  const parent = map.nodes[parentId];
  const id = uid();
  const node = { id, p: parentId, t: '', ch: [] };
  if (parentId === map.root) asMainBranch(map, node, side);
  map.nodes[id] = node;
  parent.ch.splice(index ?? parent.ch.length, 0, id);
  parent.col = false;                                // adding under a collapsed node opens it
  return id;
}

/** A new node on the same level, right after this one. On the centre and on floating nodes it adds a branch instead. */
export function addSibling(map, id) {
  const n = map.nodes[id];
  if (!n.p) return addChild(map, id);
  return addChild(map, n.p, { index: map.nodes[n.p].ch.indexOf(id) + 1, side: n.side });
}

/** A floating node: not part of the tree, it sits where you put it (x, y = its top-left corner). */
export function addFloat(map, x, y) {
  const id = uid();
  map.nodes[id] = { id, p: null, t: '', ch: [], fl: true, x, y, ci: nextColour(map) };
  return id;
}

/** Cuts a node (and everything under it) loose from its parent and lets it float at x, y. A floating node just moves there. */
export function detach(map, id, x, y) {
  const n = map.nodes[id];
  if (!n || id === map.root) return;
  if (n.p) { const parent = map.nodes[n.p]; parent.ch.splice(parent.ch.indexOf(id), 1); n.p = null; }
  n.fl = true; n.x = x; n.y = y;
  delete n.side;
  if (n.ci == null) n.ci = nextColour(map);
}

/** Moves nodes (with everything under them). mode: 'child' (last child of the target) · 'before' / 'after' (a sibling of the target).
    side: for the centre as target, which side the new main branches go to. */
export function moveNodes(map, ids, targetId, mode, { side } = {}) {
  const target = map.nodes[targetId];
  let parentId = mode === 'child' ? targetId : target.p;
  if (!parentId) { mode = 'child'; parentId = targetId; }
  let ref = targetId;
  for (const id of ids) {
    const n = map.nodes[id];
    if (n.p) { const old = map.nodes[n.p]; old.ch.splice(old.ch.indexOf(id), 1); }
    n.fl = false; delete n.x; delete n.y;
    n.p = parentId;
    const parent = map.nodes[parentId];
    const index = mode === 'child' ? parent.ch.length : parent.ch.indexOf(ref) + (mode === 'after' ? 1 : 0);
    parent.ch.splice(index, 0, id);
    parent.col = false;
    if (parentId === map.root) asMainBranch(map, n, side ?? target.side);
    else delete n.side;
    if (mode === 'after') ref = id;                  // several nodes keep their order
  }
}

/** Deletes a node and everything under it (and the connectors that touched them). Returns the node to select next. */
export function removeNode(map, id) {
  const n = map.nodes[id];
  if (!n || id === map.root) return id;
  let next = map.root;
  if (n.p) {
    const parent = map.nodes[n.p];
    const i = parent.ch.indexOf(id);
    parent.ch.splice(i, 1);
    next = parent.ch[i] ?? parent.ch[i - 1] ?? parent.id;
  }
  const drop = (x) => {
    map.nodes[x].ch.forEach(drop);
    delete map.nodes[x];
    map.links = (map.links || []).filter((l) => l.a !== x && l.b !== x);
  };
  drop(id);
  return next;
}

/* ---------- Copying branches ---------- */

/** A node and everything under it as plain data (no ids), for copy / paste / duplicate. */
export function exportTree(map, id) {
  const n = map.nodes[id];
  const o = { t: n.t, ch: n.ch.map((c) => exportTree(map, c)) };
  if (n.h) o.h = n.h;
  if (n.st) o.st = { ...n.st };
  if (n.col) o.col = true;
  if (n.sticky) { o.sticky = true; o.w = n.w; }
  return o;
}

/** Builds a copied tree as a new child of parentId (at index), or as a floating node at floatAt. Returns the new node's id. */
export function importTree(map, tree, parentId, { index, floatAt } = {}) {
  const id = floatAt ? addFloat(map, floatAt.x, floatAt.y) : addChild(map, parentId, { index });
  const n = map.nodes[id];
  n.t = tree.t || '';
  if (tree.h) n.h = tree.h;
  if (tree.st) n.st = { ...tree.st };
  if (tree.col) n.col = true;
  if (floatAt && tree.sticky) { n.sticky = true; n.w = tree.w; }
  (tree.ch || []).forEach((c) => importTree(map, c, id));
  return id;
}

/* ---------- Connectors ---------- */

export const hasLink = (map, a, b) => (map.links || []).some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
export function addLink(map, a, b) {
  if (a === b || hasLink(map, a, b)) return null;
  map.links = map.links || [];
  const link = { id: uid(), a, b, arrow: true };
  map.links.push(link);
  return link;
}
export const removeLink = (map, id) => { map.links = (map.links || []).filter((l) => l.id !== id); };

/* ---------- Style ---------- */

export const STYLE_KINDS = ['both', 'fill', 'border', 'none'];

/** The style a node really has: its own, else its level's rule, else the default. */
export function styleOf(map, id, level = levelOf(map, id)) {
  const n = map.nodes[id];
  const rule = map.levels?.[level] || {};
  return { k: n.st?.k ?? rule.k ?? (level <= 1 ? 'both' : 'none'), c: n.st?.c ?? rule.c ?? null };
}

/* ---------- Reading the tree ---------- */

const descendants = (map, id) => map.nodes[id].ch.reduce((sum, c) => sum + 1 + descendants(map, c), 0);

/** Every node that can be seen (nodes under a collapsed node are skipped): the centre's tree, then each floating node's tree.
    ci = the colour it shows (its own choice, else its branch); cs = true when the colour was chosen, not automatic. */
export function visible(map) {
  const out = [];
  const walk = (id, level, branch, side) => {
    const n = map.nodes[id];
    const collapsed = level > 0 && !!n.col && n.ch.length > 0;
    const base = level === 1 ? n.ci : branch;
    const st = styleOf(map, id, level);
    const s = level === 1 ? sideOf(map, id) : side;
    out.push({ id, level, k: st.k, cs: st.c != null, ci: st.c ?? (level === 0 ? null : base), side: level === 0 ? '' : s, collapsed, hidden: collapsed ? descendants(map, id) : 0 });
    if (!collapsed) n.ch.forEach((child) => walk(child, level + 1, base, s));
  };
  walk(map.root, 0, null, '');
  for (const n of Object.values(map.nodes)) if (n.fl) walk(n.id, 1, n.ci, 'r');
  return out;
}
