/* ============================================================================
   MAP RICH TEXT — the formatted text inside a node: bold · italic · underline · coloured text · coloured text with background · lists.
   A node keeps `t` (plain text) and, when it has any formatting, `h` (clean HTML). Allowed in `h`:
     <b> <i> <u> <br> · <span data-tc="0-7"> text colour · <span data-tb="0-7"> text colour + background
     <ul> <ol> <li> · <ul data-todo> with <li data-ck="0|1"> = checklist
   Colours are stored as palette numbers (not hex), so they follow the theme: the Neutral theme greys them, Colored brings them back.
   While you type, the browser does the editing; readNode() turns what it made into the clean form above.
   ========================================================================== */

import { MAPS } from './config.js';

/* ---------- Palette (the pastel colours from tokens.css) ---------- */

let palette = null;   // [[r, g, b], …]
function rgbOf(value) {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.append(probe);
  const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [0, 0, 0];
  probe.remove();
  return m.slice(0, 3).map(Number);
}
function pal() {
  if (!palette) {
    const cs = getComputedStyle(document.querySelector('.mm') || document.documentElement);
    palette = Array.from({ length: MAPS.palette }, (_, i) => rgbOf(cs.getPropertyValue(`--mm-p${i + 1}`).trim() || '#888'));
  }
  return palette;
}
const matchPalette = (css) => {
  if (!css) return -1;
  const c = rgbOf(css);
  return pal().findIndex((p) => Math.abs(p[0] - c[0]) < 3 && Math.abs(p[1] - c[1]) < 3 && Math.abs(p[2] - c[2]) < 3);
};

/* ---------- Cleaning ---------- */

const KEEP = new Set(['B', 'I', 'U', 'UL', 'OL', 'LI']);

function build(src, out) {
  for (const n of src.childNodes) {
    if (n.nodeType === 3) { out.append(n.textContent); continue; }
    if (n.nodeType !== 1) continue;
    let tag = n.tagName;
    if (tag === 'STRONG') tag = 'B';
    if (tag === 'EM') tag = 'I';
    if (tag === 'BR') { out.append(document.createElement('br')); continue; }
    if (tag === 'DIV' || tag === 'P') {                                  // a line the browser made: keep it as a line break
      if (out.lastChild && out.lastChild.nodeName !== 'BR') out.append(document.createElement('br'));
      build(n, out);
      continue;
    }
    if (tag === 'SPAN' || tag === 'FONT') {
      const el = document.createElement('span');
      const css = n.style?.color || n.getAttribute('color');
      if (css) {                                                         // a colour the browser applied (a new one wins over an old tag) → palette number; any other colour = default
        const ci = matchPalette(css);
        const bg = n.style?.backgroundColor;
        if (ci >= 0) { if (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) el.dataset.tb = ci; else el.dataset.tc = ci; }
      } else if (n.dataset?.tc != null) el.dataset.tc = n.dataset.tc;
      else if (n.dataset?.tb != null) el.dataset.tb = n.dataset.tb;
      build(n, el);
      if (el.dataset.tc != null || el.dataset.tb != null) out.append(el); else out.append(...el.childNodes);      // a span with no colour: keep only its content
      continue;
    }
    if (!KEEP.has(tag)) { build(n, out); continue; }
    const el = document.createElement(tag.toLowerCase());
    if (tag === 'UL' && n.hasAttribute('data-todo')) el.setAttribute('data-todo', '');
    if (tag === 'LI' && n.hasAttribute('data-ck')) el.dataset.ck = n.dataset.ck === '1' ? '1' : '0';
    build(n, el);
    out.append(el);
  }
}

/** Plain text of clean HTML: lists become lines with • / 1. / [ ] markers. */
function plain(node) {
  let s = '';
  for (const c of node.childNodes) {
    if (c.nodeType === 3) s += c.textContent;
    else if (c.tagName === 'BR') s += '\n';
    else if (c.tagName === 'UL' || c.tagName === 'OL') {
      if (s && !s.endsWith('\n')) s += '\n';
      [...c.children].filter((x) => x.tagName === 'LI').forEach((li, i) => {
        const mark = c.tagName === 'OL' ? `${i + 1}. ` : c.hasAttribute('data-todo') ? (li.dataset.ck === '1' ? '[x] ' : '[ ] ') : '• ';
        s += mark + plain(li).replace(/\n+$/, '') + '\n';
      });
    } else s += plain(c);
  }
  return s;
}

/** What the browser made inside a node's text element → { t, h }.  h is null when there is no formatting at all. */
export function readNode(el) {
  const div = document.createElement('div');
  build(el, div);
  while (div.firstChild?.nodeName === 'BR') div.firstChild.remove();      // no empty lines at the start or end
  while (div.lastChild?.nodeName === 'BR') div.lastChild.remove();
  return { t: plain(div).replace(/^\s+|\s+$/g, ''), h: div.querySelector('b,i,u,span,ul,ol') ? div.innerHTML : null };
}

/* ---------- Commands (work on the selection inside the node being typed in) ---------- */

const exec = (cmd, value) => document.execCommand(cmd, false, value);

export function format(kind) {
  if (kind === 'bold') exec('bold');
  else if (kind === 'italic') exec('italic');
  else if (kind === 'underline') exec('underline');
  else if (kind === 'clear') exec('removeFormat');
}

/** kind: 'tc' (coloured text) or 'tb' (coloured text with a tinted background). ci: palette number, or -1 = back to the default colour.
    (The default is applied as a marker colour that readNode() then throws away.) */
export function colour(kind, ci) {
  exec('styleWithCSS', true);                                                // colours need CSS; bold / italic must stay plain tags (off again below)
  if (ci < 0) { exec('foreColor', 'rgb(1, 2, 3)'); exec('hiliteColor', 'transparent'); }
  else {
    const [r, g, b] = pal()[ci];
    exec('foreColor', `rgb(${r}, ${g}, ${b})`);
    exec('hiliteColor', kind === 'tb' ? `rgba(${r}, ${g}, ${b}, 0.24)` : 'transparent');
  }
  exec('styleWithCSS', false);
}

/* ---------- Keeping the editing DOM tidy ----------
   While a node is being typed in, its coloured words are real inline colours (so the browser can recolour, split and clear them properly);
   when typing ends they become palette tags again. normalize() makes that switch and keeps the selection where it was. */

function charOffsets(root) {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const upTo = (node, off) => { const g = document.createRange(); g.selectNodeContents(root); g.setEnd(node, off); return g.toString().length; };
  return [upTo(r.startContainer, r.startOffset), upTo(r.endContainer, r.endOffset)];
}
function place(root, offset) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n, left = offset;
  while ((n = w.nextNode())) { if (left <= n.length) return [n, left]; left -= n.length; }
  return [root, root.childNodes.length];
}
function inlineColours(div) {
  div.querySelectorAll('[data-tc], [data-tb]').forEach((s) => {
    const tb = s.dataset.tb != null;
    const [r, g, b] = pal()[Number(tb ? s.dataset.tb : s.dataset.tc)] || [136, 136, 136];
    s.style.color = `rgb(${r}, ${g}, ${b})`;
    if (tb) s.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.24)`;
    delete s.dataset.tc; delete s.dataset.tb;
  });
}
export function normalize(el) {
  const saved = charOffsets(el);
  const div = document.createElement('div');
  build(el, div);
  inlineColours(div);
  el.innerHTML = div.innerHTML;
  if (saved) {
    const [sn, so] = place(el, saved[0]);
    const [en, eo] = place(el, saved[1]);
    const r = document.createRange();
    r.setStart(sn, so); r.setEnd(en, eo);
    const s = getSelection();
    s.removeAllRanges(); s.addRange(r);
  }
}

const caretLi = () => {
  const n = getSelection()?.anchorNode;
  return (n?.nodeType === 1 ? n : n?.parentElement)?.closest('li') || null;
};
export const inList = () => !!caretLi();

/** kind: 'ul' (bullets) · 'ol' (numbers) · 'todo' (checklist). The same button again takes the list away. */
export function toggleList(kind) {
  const li = caretLi();
  const list = li?.parentElement;
  const todo = !!list?.hasAttribute('data-todo');
  if (kind === 'todo') {
    if (list?.tagName === 'UL' && !todo) { markTodo(list, true); return; }   // bullets → checklist
    exec('insertUnorderedList');
    const l = caretLi()?.parentElement;
    if (l && l.tagName === 'UL') markTodo(l, true);                         // (no list left = it was a checklist and is now plain)
    return;
  }
  if (kind === 'ul' && todo) { markTodo(list, false); return; }              // checklist → bullets
  exec(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
  const l = caretLi()?.parentElement;
  if (l?.hasAttribute?.('data-todo') && l.tagName === 'OL') markTodo(l, false);
}

function markTodo(list, on) {
  if (on) list.setAttribute('data-todo', ''); else list.removeAttribute('data-todo');
  list.querySelectorAll(':scope > li').forEach((li) => { if (on) li.dataset.ck = li.dataset.ck || '0'; else li.removeAttribute('data-ck'); });
}

/** After typing: a new checklist item (Enter) must start unticked, even when it was copied from a ticked one. */
export function fixChecklists(el) {
  el.querySelectorAll('ul[data-todo] > li').forEach((li) => {
    if (!li.dataset.ck) li.dataset.ck = '0';
    else if (li.dataset.ck === '1' && !li.textContent.trim()) li.dataset.ck = '0';
  });
}
