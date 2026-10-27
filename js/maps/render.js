/* ============================================================================
   MAP RENDER — turns the model into DOM (nodes) and SVG (lines).
   Nodes are kept between redraws and only updated, so a node you are typing in never loses focus.
   Styling of both: css/maps.css (structure) and css/tokens.css section 22 (colours, sizes).
   ========================================================================== */

import { MAPS } from './config.js';
import { visible } from './model.js';

/* ---------- Nodes ---------- */

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
      el.innerHTML = '<div class="mm-node__text" spellcheck="false"></div>';
      layer.append(el);
      els.set(v.id, el);
    }
    el.dataset.level = Math.min(v.level, 3);      // 0 centre · 1 main branch · 2 · 3 and deeper
    el.dataset.side = v.side || '';
    if (v.ci == null) el.removeAttribute('data-ci'); else el.dataset.ci = v.ci;
    el.classList.toggle('is-sel', picked.has(v.id));
    el.classList.toggle('is-empty', !node.t);
    const text = el.firstElementChild;
    if (v.id !== editing && text.textContent !== node.t) text.textContent = node.t;   // never rewrite the node being typed in

    let fold = el.querySelector('.mm-node__fold');
    if (v.collapsed) {
      if (!fold) { fold = document.createElement('button'); fold.type = 'button'; fold.className = 'mm-node__fold'; fold.tabIndex = -1; fold.title = 'Show branch'; el.append(fold); }
      fold.textContent = v.hidden;
    } else if (fold) fold.remove();
  }
  for (const [id, el] of els) if (!live.has(id)) { el.remove(); els.delete(id); }
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

/** The SVG paths for every visible parent → child line. Style comes from map.line: 'tapered' · 'curved' · 'elbow'. */
export function edgesSvg(map, pos) {
  const style = map.line === 'curved' || map.line === 'elbow' ? map.line : 'tapered';
  const out = [];
  for (const v of visible(map)) {
    if (v.collapsed) continue;
    const parent = pos[v.id];
    if (!parent) continue;
    for (const cid of map.nodes[v.id].ch) {
      const child = pos[cid];
      if (!child) continue;
      const x1 = child.dir === 1 ? parent.x + parent.w : parent.x;
      const x2 = child.dir === 1 ? child.x : child.x + child.w;
      const kind = v.level === 0 ? 'root' : v.level === 1 ? 'level1' : 'deep';
      const ci = map.nodes[cid].ci ?? ci_of(map, cid);
      if (style === 'tapered') {
        const [w1, w2] = MAPS.lines.tapered[kind];
        out.push(`<path class="mm-edge mm-edge--fill" data-ci="${ci}" d="${taperPath(x1, parent.cy, x2, child.cy, w1, w2)}"/>`);
      } else {
        const d = style === 'curved' ? curvePath(x1, parent.cy, x2, child.cy) : elbowPath(x1, parent.cy, x2, child.cy);
        out.push(`<path class="mm-edge mm-edge--stroke" data-ci="${ci}" stroke-width="${MAPS.lines.stroke[kind]}" d="${d}"/>`);
      }
    }
  }
  return out.join('');
}

/** Colour index of a deeper node = the one of its main branch. */
function ci_of(map, id) {
  let n = map.nodes[id];
  while (n && n.p && n.p !== map.root) n = map.nodes[n.p];
  return n?.ci ?? 0;
}
