/* ============================================================================
   MAP THUMBNAIL — a small drawing of a map for its card on the Mind maps page.
   Uses the same layout and lines as the real canvas, with rounded bars instead of text. Only the first 3 levels (and at most 60 nodes) are drawn.
   Colours: css/maps.css → .mmt-*  (they follow the map's theme through data-ci).
   ========================================================================== */

import { computeLayout } from './layout.js';
import { edgesSvg } from './render.js';

const LEVELS = 3;
const MAX_NODES = 60;

/** A cut-down copy of the map: just what the drawing needs. */
function lite(map) {
  const nodes = {};
  let count = 0;
  const walk = (id, level) => {
    const n = map.nodes[id];
    if (!n || count >= MAX_NODES) return;
    count += 1;
    nodes[id] = { id, p: n.p, t: n.t, ci: n.ci, side: n.side, col: n.col, ch: [] };
    if (n.col || level >= LEVELS) return;
    for (const c of n.ch) { walk(c, level + 1); if (nodes[c]) nodes[id].ch.push(c); }
  };
  walk(map.root, 0);
  return { ...map, nodes };
}

export function thumbSvg(source) {
  if (!source?.nodes?.[source.root]) return '';
  const map = lite(source);
  const size = {};
  const level = {};
  const walk = (id, l) => { level[id] = l; map.nodes[id].ch.forEach((c) => walk(c, l + 1)); };
  walk(map.root, 0);
  for (const id of Object.keys(map.nodes)) {
    const len = Math.max(3, Math.min(22, (map.nodes[id].t || '').length));
    size[id] = { w: level[id] === 0 ? 74 : 12 + len * 5.2, h: level[id] === 0 ? 30 : 20 };
  }
  const { pos, bbox } = computeLayout(map, size);
  const pad = 26;
  const x = bbox.minX - pad, y = bbox.minY - pad, w = bbox.maxX - bbox.minX + 2 * pad, h = bbox.maxY - bbox.minY + 2 * pad;
  const rects = Object.keys(map.nodes).map((id) => {
    const p = pos[id];
    const l = level[id];
    const ci = l === 0 ? '' : (map.nodes[id].ci ?? branchCi(map, id));
    return `<rect class="mmt-n ${l === 0 ? 'mmt-root' : l === 1 ? 'mmt-l1' : 'mmt-deep'}"${ci === '' ? '' : ` data-ci="${ci}"`} x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="${l === 0 ? 10 : 7}"/>`;
  }).join('');
  return `<svg viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${edgesSvg(map, pos)}${rects}</svg>`;
}

function branchCi(map, id) {
  let n = map.nodes[id];
  while (n && n.p && n.p !== map.root) n = map.nodes[n.p];
  return n?.ci ?? 0;
}
