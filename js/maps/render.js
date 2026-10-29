/* ============================================================================
   MAP RENDER — turns the model into DOM (nodes) and SVG (lines, connectors).
   Nodes are kept between redraws and only updated, so a node you are typing in never loses focus.
   Styling of both: css/maps.css (structure) and css/tokens.css section 22 (colours, sizes).
   ========================================================================== */

import { MAPS } from './config.js';
import { visible } from './model.js';

/* ---------- Nodes ---------- */

/** Highlights the selected nodes. The connector handle only shows when exactly one node is selected (.is-solo). */
export function paintSelection(els, picked) {
  for (const [id, el] of els) {
    const on = picked.has(id);
    el.classList.toggle('is-sel', on);
    el.classList.toggle('is-solo', on && picked.size === 1);
  }
}

/** Creates, updates and removes the node elements. Returns the list of visible nodes (see model.visible). */
export function buildNodes(layer, map, els, { picked, editing }) {
  const vis = visible(map);
  const live = new Set();
  for (const v of vis) {
    live.add(v.id);
    const node = map.nodes[v.id];
    let el = els.get(v.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'mm-node';
      el.dataset.id = v.id;
      el.innerHTML = '<div class="mm-node__text" spellcheck="false"></div><span class="mm-node__link" title="Drag to another node to connect"></span>';
      layer.append(el);
      els.set(v.id, el);
    }
    el.dataset.level = Math.min(v.level, 3);      // 0 centre · 1 main branch / floating · 2 · 3 and deeper
    el.dataset.side = v.side || '';
    el.dataset.k = v.k;                           // what is coloured: both · fill · border · none
    if (v.ci == null) el.removeAttribute('data-ci'); else el.dataset.ci = v.ci;
    if (v.cs) el.dataset.cs = '1'; else el.removeAttribute('data-cs');
    if (node.fl) el.dataset.fl = '1'; else el.removeAttribute('data-fl');
    const sticky = !!(node.fl && node.sticky);
    if (sticky) el.dataset.sticky = '1'; else el.removeAttribute('data-sticky');
    el.style.width = sticky && node.w ? `${node.w}px` : '';
    el.classList.toggle('is-empty', !node.t);

    const text = el.firstElementChild;
    if (v.id !== editing) {                                                            // never rewrite the node being typed in
      if (node.h) { if (text.__h !== node.h) { text.innerHTML = node.h; text.__h = node.h; } }
      else if (text.__h || text.textContent !== node.t) { text.textContent = node.t; text.__h = null; }
    }

    let grip = el.querySelector('.mm-node__resize');                                  // the edge you pull to make a sticky wider
    if (sticky && !grip) { grip = document.createElement('span'); grip.className = 'mm-node__resize'; el.append(grip); }
    else if (!sticky && grip) grip.remove();

    let fold = el.querySelector('.mm-node__fold');
    if (v.collapsed) {
      if (!fold) { fold = document.createElement('button'); fold.type = 'button'; fold.className = 'mm-node__fold'; fold.tabIndex = -1; fold.title = 'Show branch'; el.append(fold); }
      fold.textContent = v.hidden;
    } else if (fold) fold.remove();
  }
  for (const [id, el] of els) if (!live.has(id)) { el.remove(); els.delete(id); }
  paintSelection(els, picked);
  return vis;
}

/* ---------- Lines ---------- */

const fmt = (n) => Math.round(n * 10) / 10;

/** A curve that is thick at the parent and thin at the child, as one filled shape. */
function taperPath(x1, y1, x2, y2, w1, w2) {
  const dx = (x2 - x1) * 0.5;
  const c1x = x1 + dx, c2x = x2 - dx;
  const N = 18;
  const up = [], down = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const x = mt ** 3 * x1 + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t ** 3 * x2;
    const y = mt ** 3 * y1 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y2;
    const tx = 3 * mt * mt * (c1x - x1) + 6 * mt * t * (c2x - c1x) + 3 * t * t * (x2 - c2x);
    const ty = 6 * mt * t * (y2 - y1);
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;
    const half = (w2 + (w1 - w2) * (1 - t) ** 1.5) / 2;   // thickness falls quickly near the parent, then gently
    up.push(`${fmt(x + nx * half)},${fmt(y + ny * half)}`);
    down.push(`${fmt(x - nx * half)},${fmt(y - ny * half)}`);
  }
  return `M${up.join('L')}L${down.reverse().join('L')}Z`;
}

const curvePath = (x1, y1, x2, y2) => {
  const dx = (x2 - x1) * 0.5;
  return `M${fmt(x1)},${fmt(y1)}C${fmt(x1 + dx)},${fmt(y1)} ${fmt(x2 - dx)},${fmt(y2)} ${fmt(x2)},${fmt(y2)}`;
};

function elbowPath(x1, y1, x2, y2) {
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) return `M${fmt(x1)},${fmt(y1)}H${fmt(x2)}`;
  const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(dy);
  const mx = (x1 + x2) / 2;
  const r = Math.min(MAPS.lines.elbowRadius, Math.abs(dy) / 2, Math.abs(x2 - x1) / 2);
  return `M${fmt(x1)},${fmt(y1)}H${fmt(mx - sx * r)}Q${fmt(mx)},${fmt(y1)} ${fmt(mx)},${fmt(y1 + sy * r)}V${fmt(y2 - sy * r)}Q${fmt(mx)},${fmt(y2)} ${fmt(mx + sx * r)},${fmt(y2)}H${fmt(x2)}`;
}

/** A connector between two boxes ({ x, y, w, h }): leaves the side that faces the other box. B may be a point (w = h = 0). */
export function linkPath(A, B) {
  const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
  let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
  if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
    const right = bx > ax;
    x1 = right ? A.x + A.w : A.x; x2 = right ? B.x : B.x + B.w; y1 = ay; y2 = by;
    const d = (x2 - x1) / 2; c1x = x1 + d; c1y = y1; c2x = x2 - d; c2y = y2;
  } else {
    const down = by > ay;
    y1 = down ? A.y + A.h : A.y; y2 = down ? B.y : B.y + B.h; x1 = ax; x2 = bx;
    const d = (y2 - y1) / 2; c1x = x1; c1y = y1 + d; c2x = x2; c2y = y2 - d;
  }
  return `M${fmt(x1)},${fmt(y1)}C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(x2)},${fmt(y2)}`;
}

/** The SVG for every visible parent → child line and every connector.
    Line style comes from map.line: 'tapered' · 'curved' · 'elbow'. A line takes the colour of the node it leads to.
    opts.links = false: no connectors (thumbnails). opts.selLink: the id of the selected connector. */
export function edgesSvg(map, pos, { links = true, selLink = null } = {}) {
  const style = map.line === 'curved' || map.line === 'elbow' ? map.line : 'tapered';
  const vis = visible(map);
  const by = {};
  vis.forEach((v) => { by[v.id] = v; });
  const out = [];
  for (const v of vis) {
    if (v.collapsed) continue;
    const parent = pos[v.id];
    if (!parent) continue;
    for (const cid of map.nodes[v.id].ch) {
      const child = pos[cid];
      const cv = by[cid];
      if (!child || !cv) continue;
      const right = child.x + child.w / 2 >= parent.x + parent.w / 2;   // (in the Free layout a child can sit on either side)
      const x1 = right ? parent.x + parent.w : parent.x;
      const x2 = right ? child.x : child.x + child.w;
      const kind = v.level === 0 ? 'root' : v.level === 1 ? 'level1' : 'deep';
      const lc = Number.isInteger(map.lineColor) ? map.lineColor : 0;                     // Multicolor lines off: every line has the one colour (-1 = grey)
      const attrs = map.lineMode === 'single' ? (lc >= 0 ? `data-ci="${lc}"` : '') : `data-ci="${cv.ci ?? 0}"${cv.cs ? ' data-cs="1"' : ''}`;
      if (style === 'tapered') {
        const [w1, w2] = MAPS.lines.tapered[kind];
        out.push(`<path class="mm-edge mm-edge--fill" ${attrs} d="${taperPath(x1, parent.cy, x2, child.cy, w1, w2)}"/>`);
      } else {
        const d = style === 'curved' ? curvePath(x1, parent.cy, x2, child.cy) : elbowPath(x1, parent.cy, x2, child.cy);
        out.push(`<path class="mm-edge mm-edge--stroke" ${attrs} stroke-width="${MAPS.lines.stroke[kind]}" d="${d}"/>`);
      }
    }
  }
  if (links && (map.links || []).length) {
    out.push('<defs><marker id="mm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="mm-arrow" d="M1.5,1.5L8.5,5L1.5,8.5"/></marker></defs>');
    for (const l of map.links) {
      const A = pos[l.a], B = pos[l.b];
      if (!A || !B) continue;                                             // one end is folded away
      const d = linkPath(A, B);
      out.push(`<path class="mm-link${l.id === selLink ? ' is-sel' : ''}" d="${d}"${l.arrow === false ? '' : ' marker-end="url(#mm-arrow)"'}/><path class="mm-link-hit" data-link="${l.id}" d="${d}"/>`);
    }
  }
  return out.join('');
}
