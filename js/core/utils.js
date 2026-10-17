/* ============================================================================
   UTILS — small helpers with no app knowledge.
   ========================================================================== */

import { CONFIG } from './config.js';

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Delays fn until `ms` after the last call. `.flush()` runs a pending call now. */
export function debounce(fn, ms) {
  let timer = null;
  let lastArgs = null;
  const run = () => { timer = null; const a = lastArgs; lastArgs = null; if (a) fn(...a); };
  const debounced = (...args) => { lastArgs = args; clearTimeout(timer); timer = setTimeout(run, ms); };
  debounced.flush = () => { if (timer) { clearTimeout(timer); run(); } };
  return debounced;
}

export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Dates ---------- */

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const longDate  = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDate = (ts) => shortDate.format(new Date(ts));

/** 'YYYY-MM-DD' → 'Monday, 12 October 2026' */
export function formatJournalDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return longDate.format(new Date(y, m - 1, d));
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- HTML safety ---------- */

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI',
  'B', 'STRONG', 'I', 'EM', 'U', 'BLOCKQUOTE', 'CODE', 'MARK', 'SPAN']);
const ALLOWED_ATTRS = new Set(['data-hl', 'data-tc', 'data-type', 'data-check', 'data-bid', 'data-tags']);

/* Block ids (data-bid) and tags (data-tags) — see core/blockindex.js */
export const BID_RE = /^[a-z0-9]{6,16}$/;
export const TAG_RE = /^\p{L}[\p{L}\p{N}_-]{0,39}$/u;
export const MAX_TAGS_PER_BLOCK = 10;

/**
 * Every tag has one colour, worked out from its name alone: the same tag is the same colour in every note,
 * on every device, with nothing stored or synced. Returns a hue 0–359; saturation / lightness come from
 * --tag-sat / --tag-light in css/tokens.css (separately for dark and light mode).
 */
export function tagHue(tag) {
  let h = 0x811c9dc5;
  for (const ch of String(tag).toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 360;
}

/** 'Todo  work' → ['todo', 'work']  (lower-case, unique, only valid tag characters). */
export function parseTags(value) {
  const out = [];
  for (const t of String(value || '').toLowerCase().split(/\s+/)) if (TAG_RE.test(t) && !out.includes(t)) out.push(t);
  return out.slice(0, MAX_TAGS_PER_BLOCK);
}
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);

/** Keeps only the tags/attributes the editor itself produces. Used on load, save and previews. */
export function sanitizeHtml(html = '') {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body);
  return doc.body.innerHTML;
}

function clean(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === 3) return;
    if (child.nodeType !== 1) { child.remove(); return; }
    if (DROP_TAGS.has(child.tagName)) { child.remove(); return; }
    clean(child);
    if (!ALLOWED_TAGS.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
    // A heading can't sit inside a list item or another heading (repairs notes saved with that bug).
    if (/^H[1-4]$/.test(child.tagName) && /^(LI|H[1-4])$/.test(node.tagName)) { child.replaceWith(...child.childNodes); return; }
    [...child.attributes].forEach(a => { if (!ALLOWED_ATTRS.has(a.name)) child.removeAttribute(a.name); });
    // Only accept the values the editor itself writes.
    for (const name of ['data-hl', 'data-tc']) {
      const v = child.getAttribute(name);
      if (v !== null && !/^[a-z]{3,10}$/.test(v)) child.removeAttribute(name);
    }
    if (child.getAttribute('data-type') !== null && child.getAttribute('data-type') !== 'todo') child.removeAttribute('data-type');
    const bid = child.getAttribute('data-bid');
    if (bid !== null && !BID_RE.test(bid)) child.removeAttribute('data-bid');
    const tags = child.getAttribute('data-tags');
    if (tags !== null) { const ok = parseTags(tags); if (ok.length) child.setAttribute('data-tags', ok.join(' ')); else child.removeAttribute('data-tags'); }
    const dc = child.getAttribute('data-check');
    if (dc !== null && dc !== 'true' && dc !== 'false') child.removeAttribute('data-check');
  });
}

/* ---------- HTML ⇄ text ---------- */

/** Plain text of a note. With `markers`, headings get '#' and list items get '- '. */
export function htmlToText(html = '', { markers = false } = {}) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  doc.body.querySelectorAll('h1,h2,h3,h4,p,div,li,blockquote').forEach(el => {
    if (markers) {
      if (/^H[1-4]$/.test(el.tagName)) el.prepend('#'.repeat(Number(el.tagName[1])) + ' ');
      if (el.tagName === 'LI') {
        const c = el.getAttribute('data-check');
        el.prepend(c === 'true' ? '- [x] ' : c === 'false' ? '- [ ] ' : '- ');
      }
      if (el.tagName === 'BLOCKQUOTE') el.prepend('> ');
      const tags = parseTags(el.getAttribute('data-tags'));   // tags travel with the text: "Buy milk #errands"
      if (tags.length) el.append(' ' + tags.map(t => '#' + t).join(' '));
    }
    el.append('\n');
  });
  return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

/** Plain text / light markdown → editor HTML (used by Import). */
export function textToHtml(text = '') {
  const out = [];
  let list = null; // 'ul' | 'ol' | 'todo'
  const closeList = () => { if (list) { out.push(list === 'ol' ? '</ol>' : '</ul>'); list = null; } };
  const openList = (kind) => {
    if (list === kind) return;
    closeList();
    out.push(kind === 'ol' ? '<ol>' : kind === 'todo' ? '<ul data-type="todo">' : '<ul>');
    list = kind;
  };
  text.replace(/\r\n?/g, '\n').split('\n').forEach(raw => {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { closeList(); return; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { closeList(); out.push(`<h${m[1].length}>${escapeHtml(m[2])}</h${m[1].length}>`); return; }
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { openList('todo'); out.push(`<li data-check="${m[1] === ' ' ? 'false' : 'true'}">${escapeHtml(m[2])}</li>`); return; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { openList('ul'); out.push(`<li>${escapeHtml(m[1])}</li>`); return; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { openList('ol'); out.push(`<li>${escapeHtml(m[1])}</li>`); return; }
    if ((m = line.match(/^>\s?(.*)$/))) { closeList(); out.push(`<blockquote>${escapeHtml(m[1])}</blockquote>`); return; }
    closeList();
    out.push(`<p>${escapeHtml(line)}</p>`);
  });
  closeList();
  return out.join('');
}

/** A note's title is its first non-empty line. */
export function deriveTitle(html = '') {
  const first = htmlToText(html).split('\n').find(l => l.trim());
  return (first || 'Untitled').trim().slice(0, 80);
}

/* ---------- Word count / reading time ---------- */

export const countWords = (text = '') => (text.match(/\S+/g) || []).length;

/** '342 words · 2 min read' */
export function statsLabel(text = '') {
  const words = countWords(text);
  const minutes = words ? Math.max(1, Math.round(words / CONFIG.reading.wpm)) : 0;
  return `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${minutes} min read`;
}

/* ---------- Files ---------- */

export function downloadFile(filename, content, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (s = 'note') => s.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'note';
