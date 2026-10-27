/* ============================================================================
   MAP MODEL — the data of one mind map and the pure functions that change it. No DOM in here.

   map = { v, theme, line, layout, root, nextCi, nodes: { [id]: node } }
   node = { id, p (parent id or null), t (text), ch [child ids, in order], col (collapsed),
            ci (colour index, main branches only), side ('r' | 'l', main branches only) }
   The map lives in a note of type 'map' (note.map), so it syncs, goes to Trash and moves between notebooks like a note.
   ========================================================================== */

import { uid } from '../core/utils.js';
import { MAPS, DEFAULTS } from './config.js';

export function newMap() {
  const id = uid();
  return { v: 1, ...DEFAULTS, root: id, nextCi: 0, nodes: { [id]: { id, p: null, t: '', ch: [] } } };
}

/** The name of the map = the first line of its central node. */
export const mapTitle = (map) => (map?.nodes?.[map.root]?.t || '').split('\n')[0].trim().slice(0, 120) || 'Untitled map';
export const countNodes = (map) => Object.keys(map?.nodes || {}).length;

/* ---------- Where a node belongs ---------- */

/** The main branch (child of the central node) a node sits under; null for the central node itself. */
export function topOf(map, id) {
  let n = map.nodes[id];
  if (!n || !n.p) return null;
  while (n.p && n.p !== map.root) n = map.nodes[n.p];
  return n;
}

/** 'r' or 'l' (which side of the centre); null for the central node. 'Right only' layout puts everything on the right. */
export function sideOf(map, id) {
  const top = topOf(map, id);
  if (!top) return null;
  return map.layout === 'right' ? 'r' : (top.side === 'l' ? 'l' : 'r');
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

/* ---------- Changing the tree ---------- */

export function addChild(map, parentId, { index, side } = {}) {
  const parent = map.nodes[parentId];
  const id = uid();
  const node = { id, p: parentId, t: '', ch: [] };
  if (parentId === map.root) {                       // a new main branch: next colour, and a side
    node.ci = (map.nextCi || 0) % MAPS.palette;
    map.nextCi = (map.nextCi || 0) + 1;
    node.side = side || (map.layout === 'right' ? 'r' : lighterSide(map));
  }
  map.nodes[id] = node;
  parent.ch.splice(index ?? parent.ch.length, 0, id);
  parent.col = false;                                // adding under a collapsed node opens it
  return id;
}

/** A new node on the same level, right after this one. On the central node it adds a branch instead. */
export function addSibling(map, id) {
  const n = map.nodes[id];
  if (!n.p) return addChild(map, id);
  return addChild(map, n.p, { index: map.nodes[n.p].ch.indexOf(id) + 1, side: n.side });
}

/** Deletes a node and everything under it. Returns the node to select next. */
export function removeNode(map, id) {
  const n = map.nodes[id];
  if (!n || !n.p) return id;
  const parent = map.nodes[n.p];
  const i = parent.ch.indexOf(id);
  parent.ch.splice(i, 1);
  const drop = (x) => { map.nodes[x].ch.forEach(drop); delete map.nodes[x]; };
  drop(id);
  return parent.ch[i] ?? parent.ch[i - 1] ?? parent.id;
}

/* ---------- Reading the tree ---------- */

const descendants = (map, id) => map.nodes[id].ch.reduce((sum, c) => sum + 1 + descendants(map, c), 0);

/** Every node that can be seen (nodes under a collapsed node are skipped), parents before children. */
export function visible(map) {
  const out = [];
  const walk = (id, level, ci, side) => {
    const n = map.nodes[id];
    const collapsed = level > 0 && !!n.col && n.ch.length > 0;
    const c = level === 1 ? n.ci : ci;
    const s = level === 1 ? sideOf(map, id) : side;
    out.push({ id, level, ci: level === 0 ? null : c, side: level === 0 ? '' : s, collapsed, hidden: collapsed ? descendants(map, id) : 0 });
    if (!collapsed) n.ch.forEach((child) => walk(child, level + 1, c, s));
  };
  walk(map.root, 0, null, '');
  return out;
}
