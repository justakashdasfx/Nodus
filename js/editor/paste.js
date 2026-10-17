/* ============================================================================
   PASTE — turns clipboard HTML (from a website, Google Docs, Notion, …) into
   the clean structure this editor understands.

   Kept:    headings (h1–h6 → H1–H4), paragraphs, bulleted/numbered lists
            (nested too), task lists, quotes, bold, italic, underline, code,
            and this app's own highlights / text colours.
   Dropped: fonts, colours, classes, images, scripts, links (the link text stays).
   Tables become one line per row, cells separated by " | ".

   Returns { html, inline }. inline = true means "a single paragraph", which
   the editor inserts into the current line instead of as a new block.
   ========================================================================== */

import { escapeHtml } from '../core/utils.js';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'IMG', 'PICTURE', 'VIDEO',
  'AUDIO', 'CANVAS', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'HEAD', 'META', 'LINK', 'TITLE', 'TEMPLATE']);
const BLOCKS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'FIGURE', 'FIGCAPTION',
  'DETAILS', 'SUMMARY', 'NAV', 'FORM', 'FIELDSET', 'DL', 'DT', 'DD', 'ADDRESS', 'HGROUP', 'CENTER', 'LI']);

/** Which inline formats apply inside `node`, given those already active. */
function formatsOf(node, fmt) {
  const f = { ...fmt };
  const tag = node.tagName;
  const st = node.style || {};
  const w = String(st.fontWeight || '');
  const weight = w === 'bold' || w === 'bolder' ? 700 : Number(w) || 0;

  if (!fmt.noBold) { // inside headings bold is redundant, so it is never added
    if (tag === 'B' || tag === 'STRONG') { if (!(w && (w === 'normal' || (weight && weight < 600)))) f.b = true; }
    else if (weight >= 600) f.b = true;
  }
  if (tag === 'I' || tag === 'EM' || tag === 'CITE' || tag === 'DFN' || st.fontStyle === 'italic') f.i = true;
  if (tag === 'U' || tag === 'INS' || String(st.textDecorationLine || st.textDecoration || '').includes('underline')) f.u = true;
  if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') f.code = true;

  const hl = node.getAttribute?.('data-hl');
  const tc = node.getAttribute?.('data-tc');
  if (hl && /^[a-z]{3,10}$/.test(hl)) f.hl = hl;
  if (tc && /^[a-z]{3,10}$/.test(tc)) f.tc = tc;
  return f;
}

function wrap(text, f) {
  let h = escapeHtml(text);
  if (f.code) h = `<code>${h}</code>`;
  if (f.tc) h = `<span data-tc="${f.tc}">${h}</span>`;
  if (f.hl) h = `<mark data-hl="${f.hl}">${h}</mark>`;
  if (f.u) h = `<u>${h}</u>`;
  if (f.i) h = `<i>${h}</i>`;
  if (f.b) h = `<b>${h}</b>`;
  return h;
}

const trimInline = (s) => s.replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, '');
const hasText = (html) => html.replace(/<[^>]+>/g, '').trim().length > 0;

/** inlineOnly = inside a list item: block tags become line breaks, nested lists are collected. */
function makeConverter(inlineOnly = false) {
  const out = [];
  const nested = [];
  let inline = '';

  const flush = (tag = 'p') => {
    const h = trimInline(inline);
    inline = '';
    if (hasText(h)) out.push(`<${tag}>${h}</${tag}>`);
  };

  const addText = (raw, f) => {
    const t = raw.replace(/[\s\u00a0]+/g, ' ');
    if (!t) return;
    if (t === ' ') { if (inline && !/(\s|<br>)$/.test(inline)) inline += ' '; return; }
    inline += wrap(t, f);
  };

  const walkChildren = (node, f) => node.childNodes.forEach(c => walk(c, f));

  function walk(node, fmt) {
    if (node.nodeType === 3) { addText(node.nodeValue, fmt); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (SKIP.has(tag)) return;
    if (tag === 'BR') { inline += '<br>'; return; }
    if (tag === 'HR') { if (!inlineOnly) flush(); return; }

    const f = formatsOf(node, fmt);

    if (tag === 'UL' || tag === 'OL') {
      const html = listHtml(node, f);
      if (inlineOnly) nested.push(html); else { flush(); if (html) out.push(html); }
      return;
    }
    if (inlineOnly) {
      if (/^H[1-6]$/.test(tag) || BLOCKS.has(tag) || tag === 'BLOCKQUOTE' || tag === 'PRE') {
        if (inline && !/<br>$/.test(inline)) inline += '<br>';
        walkChildren(node, f);
        return;
      }
      walkChildren(node, f);
      return;
    }

    if (/^H[1-6]$/.test(tag)) {
      flush();
      walkChildren(node, { ...f, b: false, noBold: true }); // headings are already bold
      flush(`h${Math.min(Number(tag[1]), 4)}`);
      return;
    }
    if (tag === 'BLOCKQUOTE') {
      flush();
      const start = out.length;
      walkChildren(node, f);
      flush();
      for (let i = start; i < out.length; i++) out[i] = out[i].replace(/^<p>([\s\S]*)<\/p>$/, '<blockquote>$1</blockquote>');
      return;
    }
    if (tag === 'PRE') {
      flush();
      node.textContent.replace(/\r/g, '').split('\n').forEach(l => { if (l.trim()) out.push(`<p><code>${escapeHtml(l)}</code></p>`); });
      return;
    }
    if (tag === 'TABLE') {
      flush();
      node.querySelectorAll('tr').forEach(tr => {
        const cells = [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (cells.length) out.push(`<p>${escapeHtml(cells.join(' | '))}</p>`);
      });
      return;
    }
    if (BLOCKS.has(tag)) { flush(); walkChildren(node, f); flush(); return; }

    walkChildren(node, f); // inline wrappers: span, a, font, label …
  }

  return { walk, walkChildren, flush, out, nested, inlineHtml: () => trimInline(inline) };
}

function listHtml(list, fmt) {
  const tag = list.tagName === 'OL' ? 'ol' : 'ul';
  const items = [];
  let todo = list.getAttribute('data-type') === 'todo';

  for (const li of list.children) {
    if (li.tagName !== 'LI') continue;
    const box = [...li.children].find(c => c.tagName === 'INPUT' && c.type === 'checkbox');
    const attr = li.getAttribute('data-check');
    const sub = makeConverter(true);
    sub.walkChildren(li, fmt);
    const html = sub.inlineHtml() + sub.nested.join('');
    if (!hasText(html) && !sub.nested.length) continue;
    let check = null;
    if (box) check = box.hasAttribute('checked');
    else if (attr === 'true' || attr === 'false') check = attr === 'true';
    if (check !== null) todo = true;
    items.push({ html, check });
  }
  if (!items.length) return '';
  const lis = items.map(i => `<li${todo && tag === 'ul' ? ` data-check="${i.check ? 'true' : 'false'}"` : ''}>${i.html}</li>`).join('');
  return `<${tag}${todo && tag === 'ul' ? ' data-type="todo"' : ''}>${lis}</${tag}>`;
}

export function cleanPastedHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const c = makeConverter();
  c.walkChildren(doc.body, {});
  c.flush();
  if (!c.out.length) return { html: '', inline: false };
  if (c.out.length === 1 && /^<p>[\s\S]*<\/p>$/.test(c.out[0])) return { html: c.out[0].slice(3, -4), inline: true };
  return { html: c.out.join(''), inline: false };
}
