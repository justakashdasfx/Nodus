/* ============================================================================
   MAP LAYOUT — where every node goes. Pure maths: sizes in, positions out.
   The central node sits at (0, 0). Its main branches go right and left; each parent sits in the middle of its children.
   Distances: js/maps/config.js → layout.
   ========================================================================== */

import { MAPS } from './config.js';
import { sideOf } from './model.js';

/** size: { [id]: { w, h } }  →  { pos: { [id]: { x, y, w, h, cy, dir } }, bbox }   (x, y = top-left corner; dir: 1 right, -1 left, 0 centre) */
export function computeLayout(map, size) {
  const { gapX, gapY, rootGapX, rootGapY } = MAPS.layout;
  const pos = {};
  const heights = {};
  const sz = (id) => size[id] || { w: 80, h: 32 };
  const kids = (id) => { const n = map.nodes[id]; return n.col && id !== map.root ? [] : n.ch; };

  /** Height of a node together with everything under it. */
  const sub = (id) => {
    if (heights[id] != null) return heights[id];
    const ks = kids(id);
    let h = sz(id).h;
    if (ks.length) h = Math.max(h, ks.reduce((sum, c) => sum + sub(c), 0) + gapY * (ks.length - 1));
    return (heights[id] = h);
  };

  /** edge = the node's near edge (its left edge going right, its right edge going left); top = top of the node's slot. */
  const place = (id, dir, edge, top) => {
    const { w, h } = sz(id);
    const ks = kids(id);
    const total = sub(id);
    let cy;
    if (ks.length) {
      const childEdge = dir === 1 ? edge + w + gapX : edge - w - gapX;
      const span = ks.reduce((sum, c) => sum + sub(c), 0) + gapY * (ks.length - 1);
      let y = top + (total - span) / 2;
      for (const c of ks) { place(c, dir, childEdge, y); y += sub(c) + gapY; }
      cy = (pos[ks[0]].cy + pos[ks[ks.length - 1]].cy) / 2;
    } else {
      cy = top + total / 2;
    }
    pos[id] = { x: dir === 1 ? edge : edge - w, y: cy - h / 2, w, h, cy, dir };
  };

  const root = map.root;
  const r = sz(root);
  pos[root] = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h, cy: 0, dir: 0 };
  const ks = kids(root);
  for (const [group, dir] of [[ks.filter((c) => sideOf(map, c) === 'r'), 1], [ks.filter((c) => sideOf(map, c) === 'l'), -1]]) {
    if (!group.length) continue;
    const span = group.reduce((sum, c) => sum + sub(c), 0) + rootGapY * (group.length - 1);
    const edge = dir === 1 ? r.w / 2 + rootGapX : -r.w / 2 - rootGapX;
    let y = -span / 2;
    for (const c of group) { place(c, dir, edge, y); y += sub(c) + rootGapY; }
  }

  /* Floating nodes: each one is laid out like a small tree growing to the right, then moved so the node itself sits at its own x, y */
  for (const n of Object.values(map.nodes)) {
    if (!n.fl) continue;
    place(n.id, 1, 0, 0);
    const dx = n.x - pos[n.id].x, dy = n.y - pos[n.id].y;
    const shift = (id) => { pos[id].x += dx; pos[id].y += dy; pos[id].cy += dy; kids(id).forEach(shift); };
    shift(n.id);
  }

  /* Free layout: the automatic layout is the starting point; every node can be moved by (dx, dy), and its children move with it */
  if (map.layout === 'free') {
    const move = (id, ox, oy) => {
      const n = map.nodes[id];
      const tx = ox + (n.dx || 0), ty = oy + (n.dy || 0);
      pos[id].x += tx; pos[id].y += ty; pos[id].cy += ty;
      kids(id).forEach((c) => move(c, tx, ty));
    };
    move(root, 0, 0);
    for (const n of Object.values(map.nodes)) if (n.fl) move(n.id, 0, 0);
  }

  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of Object.values(pos)) {
    bbox.minX = Math.min(bbox.minX, p.x); bbox.maxX = Math.max(bbox.maxX, p.x + p.w);
    bbox.minY = Math.min(bbox.minY, p.y); bbox.maxY = Math.max(bbox.maxY, p.y + p.h);
  }
  return { pos, bbox };
}
