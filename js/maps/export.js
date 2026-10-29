/* ============================================================================
   MAP EXPORT — Markdown outline, SVG and PNG pictures of the map.
   The picture is drawn from what is on screen: each node's real colours, border and font are read from the page, text is wrapped to the
   node's width. Coloured words and lists inside a node come out as plain text of the node's colour. (PNG: the page font may be replaced
   by a system font, because a picture cannot load fonts.)
   ========================================================================== */

import { mapTitle } from './model.js';

export function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** The whole map as an indented Markdown list (floating nodes under their own heading). */
export function markdownOf(map) {
  const out = [`# ${mapTitle(map)}`, ''];
  const walk = (id, depth) => {
    const n = map.nodes[id];
    const [first, ...rest] = (n.t || '').split('\n');
    out.push(`${'  '.repeat(depth)}- ${first}`);
    rest.filter(Boolean).forEach((l) => out.push(`${'  '.repeat(depth + 1)}${l}`));
    n.ch.forEach((c) => walk(c, depth + 1));
  };
  map.nodes[map.root].ch.forEach((c) => walk(c, 0));
  const floats = Object.values(map.nodes).filter((n) => n.fl);
  if (floats.length) { out.push('', '## Floating', ''); floats.forEach((f) => walk(f.id, 0)); }
  return `${out.join('\n')}\n`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap with canvas text measuring. */
function wrap(g, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && g.measureText(next).width > maxW) { lines.push(line.trimEnd()); line = word.trimStart(); } else line = next;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** → { text, w, h }: a standalone SVG of the map as it looks now (call while the map view is showing). */
export function svgOf(map, root, els, pos, bbox, edgesEl) {
  const pad = 48;
  const w = Math.ceil(bbox.maxX - bbox.minX + 2 * pad), h = Math.ceil(bbox.maxY - bbox.minY + 2 * pad);
  const bg = getComputedStyle(root.querySelector('.mm__viewport')).backgroundColor;
  const parts = [`<rect x="${bbox.minX - pad}" y="${bbox.minY - pad}" width="${w}" height="${h}" fill="${bg}"/>`];

  edgesEl.querySelectorAll('path.mm-edge').forEach((p) => {
    const c = getComputedStyle(p);
    parts.push(`<path d="${p.getAttribute('d')}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${p.getAttribute('stroke-width') || c.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${c.opacity}"/>`);
  });
  edgesEl.querySelectorAll('path.mm-link').forEach((p) => {
    const c = getComputedStyle(p);
    parts.push(`<path d="${p.getAttribute('d')}" fill="none" stroke="${c.stroke}" stroke-width="1.6" stroke-dasharray="6 5" stroke-linecap="round"/>`);
  });

  const g = document.createElement('canvas').getContext('2d');
  for (const [id, el] of els) {
    const p = pos[id];
    if (!p) continue;
    const c = getComputedStyle(el);
    const bw = parseFloat(c.borderTopWidth) || 0;
    parts.push(`<rect x="${p.x + bw / 2}" y="${p.y + bw / 2}" width="${p.w - bw}" height="${p.h - bw}" rx="${parseFloat(c.borderTopLeftRadius) || 0}" fill="${c.backgroundColor}" stroke="${bw ? c.borderTopColor : 'none'}" stroke-width="${bw}"/>`);
    const text = map.nodes[id].t || '';
    if (!text) continue;
    g.font = `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
    const padL = parseFloat(c.paddingLeft) + bw, padT = parseFloat(c.paddingTop) + bw;
    const fs = parseFloat(c.fontSize);
    const lh = parseFloat(c.lineHeight) || fs * 1.4;
    const lines = wrap(g, text, p.w - padL - parseFloat(c.paddingRight) - bw);
    const font = esc(`${c.fontWeight} ${c.fontSize} ${c.fontFamily}`.replace(/"/g, "'"));
    lines.forEach((line, i) => {
      parts.push(`<text x="${p.x + padL}" y="${p.y + padT + lh * i + lh / 2}" dominant-baseline="central" fill="${c.color}" style="font:${font}">${esc(line)}</text>`);
    });
  }
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bbox.minX - pad} ${bbox.minY - pad} ${w} ${h}">${parts.join('')}</svg>`;
  return { text, w, h };
}

/** SVG text → PNG blob (2× sharp, but never larger than 8000 px). */
export function pngOf(svgText, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(2, 8000 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const g = canvas.getContext('2d');
      g.scale(scale, scale);
      g.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the PNG'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not draw the map'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });
}
