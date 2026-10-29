/* ============================================================================
   MAP THUMBNAIL — a small drawing of a map for its card on the Mind maps page.
   Uses the same layout and lines as the real canvas, with rounded bars instead of text. Only the first 3 levels (and at most 60 nodes) are drawn.
   Colours: css/maps.css → .mmt-*  (they follow the map's theme and colours through data-ci / data-cs).
   ========================================================================== */

import { computeLayout } from './layout.js';
import { edgesSvg } from './render.js';
import { visible } from './model.js';

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
    nodes[id] = { id, p: n.p, t: n.t, ci: n.ci, side: n.side, col: n.col, fl: n.fl, x: n.x, y: n.y, dx: n.dx, dy: n.dy, st: n.st, ch: [] };
    if (n.col || level >= LEVELS) return;
    for (const c of n.ch) { walk(c, level + 1); if (nodes[c]) nodes[id].ch.push(c); }
  };
  walk(map.root, 0);
  for (const n of Object.values(map.nodes)) if (n.fl) walk(n.id, 1);
  return { ...map, nodes, links: [] };
}

export function thumbSvg(source) {
  if (!source?.nodes?.[source.root]) return '';
  const map = lite(source);
  const vis = visible(map);
  const by = {};
  vis.forEach((v) => { by[v.id] = v; });
  const size = {};
  for (const v of vis) {
    const len = Math.max(3, Math.min(22, (map.nodes[v.id].t || '').length));
    size[v.id] = { w: v.level === 0 ? 74 : 12 + len * 5.2, h: v.level === 0 ? 30 : 20 };
  }
  const { pos, bbox } = computeLayout(map, size);
  const pad = 26;
  const x = bbox.minX - pad, y = bbox.minY - pad, w = bbox.maxX - bbox.minX + 2 * pad, h = bbox.maxY - bbox.minY + 2 * pad;
  const rects = vis.map((v) => {
    const p = pos[v.id];
    const cls = v.level === 0 ? 'mmt-root' : v.level === 1 ? 'mmt-l1' : 'mmt-deep';
    return `<rect class="mmt-n ${cls}"${v.ci == null ? '' : ` data-ci="${v.ci}"`}${v.cs ? ' data-cs="1"' : ''} x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="${v.level === 0 ? 10 : 7}"/>`;
  }).join('');
  return `<svg viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${edgesSvg(map, pos, { links: false })}${rects}</svg>`;
}
