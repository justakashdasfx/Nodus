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
  'B', 'STRONG', 'I', 'EM', 'U', 'BLOCKQUOTE', 'PRE', 'CODE', 'MARK', 'SPAN', 'HR', 'DETAILS', 'SUMMARY']);
const ALLOWED_ATTRS = new Set(['data-hl', 'data-tc', 'data-type', 'data-check', 'data-bid', 'data-tags', 'data-lang', 'data-due', 'data-callout', 'open']);

/* Block ids (data-bid) and tags (data-tags) — see core/blockindex.js */
export const BID_RE = /^[a-z0-9]{6,16}$/;
export const TAG_RE = /^\p{L}[\p{L}\p{N}_-]{0,39}$/u;
export const MAX_TAGS_PER_BLOCK = 10;
export const DUE_RE = /^\d{4}-\d{2}-\d{2}$/;   // a due date on a checklist item: data-due="2026-11-03" (see core/dates.js)

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

/** The text of a code block: <br> = a new line, anything else contributes its text. A block holding only a <br> is empty. */
export function preText(pre) {
  if ([...pre.childNodes].every(n => n.nodeName === 'BR')) return '';
  let t = '';
  pre.childNodes.forEach((n, i, all) => {
    if (n.nodeType === 3) t += n.data;
    else if (n.nodeName === 'BR') { if (i !== all.length - 1) t += '\n'; }
    else t += n.textContent;
  });
  return t;
}

function clean(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === 3) return;
    if (child.nodeType !== 1) { child.remove(); return; }
    if (DROP_TAGS.has(child.tagName)) { child.remove(); return; }
    if (child.tagName === 'PRE') { const t = preText(child); child.textContent = t; if (!t) child.innerHTML = '<br>'; } // code is plain text only
    clean(child);
    if (!ALLOWED_TAGS.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
    if (child.tagName === 'SUMMARY' && node.tagName !== 'DETAILS') { child.replaceWith(...child.childNodes); return; }   // a toggle's title only lives inside its <details>
    // A heading can't sit inside a list item or another heading (repairs notes saved with that bug).
    if (/^H[1-4]$/.test(child.tagName) && /^(LI|H[1-4])$/.test(node.tagName)) { child.replaceWith(...child.childNodes); return; }
    [...child.attributes].forEach(a => { if (!ALLOWED_ATTRS.has(a.name)) child.removeAttribute(a.name); });
    // Only accept the values the editor itself writes.
    for (const name of ['data-hl', 'data-tc']) {
      const v = child.getAttribute(name);
      if (v !== null && !/^[a-z]{3,10}$/.test(v)) child.removeAttribute(name);
    }
    if (child.getAttribute('data-type') !== null && child.getAttribute('data-type') !== 'todo') child.removeAttribute('data-type');
    const lang = child.getAttribute('data-lang');
    if (lang !== null && (child.tagName !== 'PRE' || !/^[a-z]{2,10}$/.test(lang))) child.removeAttribute('data-lang');
    const callout = child.getAttribute('data-callout');
    if (callout !== null && (child.tagName !== 'P' || !/^[a-z]{3,10}$/.test(callout))) child.removeAttribute('data-callout');
    if (child.hasAttribute('open')) { if (child.tagName === 'DETAILS') child.setAttribute('open', ''); else child.removeAttribute('open'); }
    const bid = child.getAttribute('data-bid');
    if (bid !== null && !BID_RE.test(bid)) child.removeAttribute('data-bid');
    const tags = child.getAttribute('data-tags');
    if (tags !== null) { const ok = parseTags(tags); if (ok.length) child.setAttribute('data-tags', ok.join(' ')); else child.removeAttribute('data-tags'); }
    const dc = child.getAttribute('data-check');
    if (dc !== null && dc !== 'true' && dc !== 'false') child.removeAttribute('data-check');
    const due = child.getAttribute('data-due');
    if (due !== null && (child.tagName !== 'LI' || !DUE_RE.test(due))) child.removeAttribute('data-due');
  });
}

/* ---------- HTML ⇄ text ---------- */

/** Plain text of a note. With `markers`, headings get '#' and list items get '- '. */
export function htmlToText(html = '', { markers = false } = {}) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('pre').forEach(pre => {   // code first, so its line breaks are kept as they are
    const t = preText(pre);
    const lang = pre.getAttribute('data-lang');
    pre.replaceWith(doc.createTextNode(markers ? '```' + (lang && lang !== 'plain' ? lang : '') + '\n' + t.replace(/\n$/, '') + '\n```\n' : t + '\n'));
  });
  doc.body.querySelectorAll('hr').forEach(hr => hr.replaceWith(doc.createTextNode(markers ? '---\n' : '')));   // divider
  doc.body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  doc.body.querySelectorAll('h1,h2,h3,h4,p,div,li,blockquote,summary').forEach(el => {
    if (markers) {
      if (el.tagName === 'P' && el.hasAttribute('data-callout')) el.prepend('> ');
      if (/^H[1-4]$/.test(el.tagName)) el.prepend('#'.repeat(Number(el.tagName[1])) + ' ');
      if (el.tagName === 'LI') {
        const c = el.getAttribute('data-check');
        el.prepend(c === 'true' ? '- [x] ' : c === 'false' ? '- [ ] ' : '- ');
      }
      if (el.tagName === 'BLOCKQUOTE') el.prepend('> ');
      const tags = parseTags(el.getAttribute('data-tags'));   // tags travel with the text: "Buy milk #errands"
      if (tags.length) el.append(' ' + tags.map(t => '#' + t).join(' '));
      if (el.tagName === 'LI' && DUE_RE.test(el.getAttribute('data-due') || '')) el.append(' 📅 ' + el.getAttribute('data-due'));   // due date travels with the text
    }
    el.append('\n');
  });
  return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

/** Editor HTML → Markdown (headings, quotes, lists, checklists, bold/italic/code/links, #tags). Used by Copy / Export as Markdown. */
export function htmlToMarkdown(html = '') {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  const inline = (node) => {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += n.data.replace(/([\\`*])/g, '\\$1'); return; }
      if (n.nodeType !== 1 || n.tagName === 'UL' || n.tagName === 'OL') return; // sub-lists are handled by the list code
      if (n.tagName === 'BR') { out += '  \n'; return; }
      const inner = inline(n);
      if (!inner) return;
      switch (n.tagName) {
        case 'STRONG': case 'B': out += `**${inner}**`; break;
        case 'EM': case 'I': out += `*${inner}*`; break;
        case 'S': case 'STRIKE': case 'DEL': out += `~~${inner}~~`; break;
        case 'CODE': out += '`' + n.textContent + '`'; break;
        case 'A': out += `[${inner}](${n.getAttribute('href') || ''})`; break;
        default: out += inner; // underline, highlight and colour have no Markdown form: the plain text stays
      }
    });
    return out;
  };
  const dueSuffix = (el) => (DUE_RE.test(el.getAttribute('data-due') || '') ? ' 📅 ' + el.getAttribute('data-due') : '');
  const tagSuffix = (el) => { const t = parseTags(el.getAttribute('data-tags')); return t.length ? ' ' + t.map(x => '#' + x).join(' ') : ''; };

  const lines = [];
  const list = (ul, depth) => {
    const ordered = ul.tagName === 'OL';
    let i = 0;
    [...ul.children].filter(c => c.tagName === 'LI').forEach((li) => {
      i += 1;
      const check = li.getAttribute('data-check');
      const marker = ordered ? `${i}. ` : check === 'true' ? '- [x] ' : check === 'false' ? '- [ ] ' : '- ';
      lines.push(`${'  '.repeat(depth)}${marker}${inline(li).trim()}${tagSuffix(li)}${dueSuffix(li)}`);
      [...li.children].filter(c => c.tagName === 'UL' || c.tagName === 'OL').forEach(sub => list(sub, depth + 1));
    });
  };

  [...doc.body.children].forEach((el) => {
    const tag = el.tagName;
    if (/^H[1-4]$/.test(tag)) { lines.push('', `${'#'.repeat(Number(tag[1]))} ${inline(el).trim()}${tagSuffix(el)}`, ''); return; }
    if (tag === 'UL' || tag === 'OL') { lines.push(''); list(el, 0); lines.push(''); return; }
    if (tag === 'BLOCKQUOTE') { lines.push('', `> ${inline(el).trim()}${tagSuffix(el)}`, ''); return; }
    if (tag === 'HR') { lines.push('', '---', ''); return; }
    if (tag === 'DETAILS') {           // toggle: the title in bold, then what is inside
      const s = el.querySelector(':scope > summary');
      lines.push('', `**${inline(s || el).trim()}**`, '');
      [...el.children].filter(c => c !== s).forEach((c) => {
        if (c.tagName === 'UL' || c.tagName === 'OL') { list(c, 0); lines.push(''); return; }
        const t = inline(c).trim();
        if (t) lines.push(t, '');
      });
      return;
    }
    if (tag === 'PRE') { const lang = el.getAttribute('data-lang'); lines.push('', '```' + (lang && lang !== 'plain' ? lang : ''), preText(el).replace(/\n$/, ''), '```', ''); return; }
    const text = inline(el).trim();
    if (text && el.hasAttribute('data-callout')) { lines.push('', `> ${text}${tagSuffix(el)}`, ''); return; }   // callout → quote
    if (text) lines.push('', text.replace(/^([#>])/, '\\$1') + tagSuffix(el), '');
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
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
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      let text = m[2];
      const dm = text.match(/\s📅\s?(\d{4}-\d{2}-\d{2})\s*$/);   // "Buy milk 📅 2026-11-03" → a due date
      if (dm) text = text.slice(0, dm.index);
      openList('todo');
      out.push(`<li data-check="${m[1] === ' ' ? 'false' : 'true'}"${dm ? ` data-due="${dm[1]}"` : ''}>${escapeHtml(text)}</li>`);
      return;
    }
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

export const countChars = (text = '') => [...text.replace(/\s+/g, ' ').trim()].length; // spaces count, runs of whitespace count once

/** '342 words · 2 min read'  (mode 'chars' → '1,980 characters · 2 min read'; the reading time always follows the words) */
export function statsLabel(text = '', mode = 'words') {
  const words = countWords(text);
  const minutes = words ? Math.max(1, Math.round(words / CONFIG.reading.wpm)) : 0;
  const count = mode === 'chars'
    ? (n => `${n.toLocaleString()} ${n === 1 ? 'character' : 'characters'}`)(countChars(text))
    : `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  return `${count} · ${minutes} min read`;
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
