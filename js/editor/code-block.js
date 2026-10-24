/* ============================================================================
   CODE BLOCK — <pre data-lang="js">…plain text…</pre>
   • Make one: "/" menu → Code, the six-dot menu, the selection toolbar's "…", or type ``` (or ```js) and press Enter.
   • Inside it: Enter = new line that keeps the indent (a second Enter on an empty last line leaves the block, Ctrl/Cmd+Enter
     leaves at once) · Tab / Shift+Tab indent and outdent · pasting keeps the code exactly as copied · Backspace at the very
     start of an empty block turns it back into text.
   • A small bar appears at its top-right when you point at it or type in it: language · Format (Prettier) · Copy.
   • Colours: drawn with the browser's highlight feature (CSS.highlights), so nothing is added inside your text.
     Look: --code-* in css/tokens.css (section 9), .prose pre and .code-bar in css/editor.css.
   • Read mode shows the same colours and a Copy button.
   Third-party libraries (Prism, Prettier) load only when needed — js/core/vendor.js.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { loadPrism, PRISM_NAME, canFormat, formatCode, guessLanguage } from '../core/vendor.js';
import { caretBlock } from './normalize.js';

const LANGS = CONFIG.code.languages;                         // [['js', 'JavaScript'], …]
const LANG_IDS = new Set(LANGS.map((l) => l[0]));
const langName = (id) => (LANGS.find((l) => l[0] === id) || LANGS[0])[1];
export const langOf = (pre) => { const v = pre.getAttribute('data-lang'); return LANG_IDS.has(v) ? v : CONFIG.code.defaultLang; };
const toast = (message) => window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));

const FENCE = { js: 'js', javascript: 'js', jsx: 'js', ts: 'ts', typescript: 'ts', tsx: 'ts', json: 'json', html: 'html', xml: 'html', css: 'css',
  py: 'python', python: 'python', bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', sql: 'sql', md: 'markdown', markdown: 'markdown',
  yaml: 'yaml', yml: 'yaml', text: 'plain', txt: 'plain', plain: 'plain' };

/* ---------- Text and caret helpers ---------- */

const preOf = (node) => { const el = node?.nodeType === 1 ? node : node?.parentElement; return el?.closest('pre') || null; };

/** The text of a block's own content: <br> = new line, sub-lists left out. */
function blockText(block) {
  let out = '';
  block.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeName === 'BR') out += '\n';
    else if (n.nodeType === 1 && !/^(UL|OL)$/.test(n.tagName)) out += n.textContent;
  });
  return out.replace(/\u00a0/g, ' ');
}

function caretAtEnd(el) {
  const r = document.createRange();
  if (!el.firstChild || (el.childNodes.length === 1 && el.firstChild.nodeName === 'BR')) r.setStart(el, 0);
  else { r.selectNodeContents(el); r.collapse(false); }
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

const offsetIn = (pre, node, off) => { const r = document.createRange(); r.selectNodeContents(pre); r.setEnd(node, off); return r.toString().length; };

/** [start, end] of the selection as text offsets inside the block, or null if it is not inside it. */
function selectionIn(pre) {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!pre.contains(r.startContainer) || !pre.contains(r.endContainer)) return null;
  return [offsetIn(pre, r.startContainer, r.startOffset), offsetIn(pre, r.endContainer, r.endOffset)];
}

function setSelectionOffsets(pre, a, b = a) {
  const w = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  let pos = 0; let sn = null; let so = 0; let en = null; let eo = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const len = n.data.length;
    if (!sn && a <= pos + len) { sn = n; so = a - pos; }
    if (!en && b <= pos + len) { en = n; eo = b - pos; }
    pos += len;
    if (sn && en) break;
  }
  const r = document.createRange();
  if (!sn) { if (!pre.firstChild || pre.firstChild.nodeName === 'BR') r.setStart(pre, 0); else { r.selectNodeContents(pre); r.collapse(false); } }
  else { r.setStart(sn, so); r.setEnd(en || sn, en ? eo : so); }
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function setCodeText(pre, text, a, b = a) {
  if (text) pre.textContent = text; else pre.innerHTML = '<br>'; // an empty block keeps a <br> so it has a line to sit on
  if (a != null) setSelectionOffsets(pre, a, b);
}

/* ---------- Turning blocks into code and back (used by the block menus) ---------- */

export function toCode(root, block, lang = CONFIG.code.defaultLang) {
  const pre = document.createElement('pre');
  for (const a of ['data-bid', 'data-tags']) if (block.hasAttribute(a)) pre.setAttribute(a, block.getAttribute(a));
  pre.setAttribute('data-lang', lang);
  const text = blockText(block);
  if (text) pre.textContent = text; else pre.innerHTML = '<br>';
  block.replaceWith(pre);
  root.focus({ preventScroll: true });
  caretAtEnd(pre);
  return pre;
}

export function codeToParagraph(root, pre) {
  const p = document.createElement('p');
  for (const a of ['data-bid', 'data-tags']) if (pre.hasAttribute(a)) p.setAttribute(a, pre.getAttribute(a));
  const lines = pre.textContent.split('\n');
  if (!pre.textContent) p.innerHTML = '<br>';
  else lines.forEach((ln, i) => { if (i) p.append(document.createElement('br')); if (ln) p.append(document.createTextNode(ln)); });
  pre.replaceWith(p);
  root.focus({ preventScroll: true });
  caretAtEnd(p);
  return p;
}

/** Keeps every code block as plain text plus (when empty) its <br>. Called after edits and when a note opens. */
export function tidyCode(root) {
  root.querySelectorAll(':scope > pre').forEach((pre) => {
    const kids = [...pre.childNodes];
    if (!kids.length) { pre.innerHTML = '<br>'; return; }
    if (kids.every((n) => n.nodeType === 3)) { if (kids.length > 1) pre.normalize(); return; }
    if (kids.length === 1 && kids[0].nodeName === 'BR') return;
    let text = '';
    kids.forEach((n, i) => {
      if (n.nodeType === 3) text += n.data;
      else if (n.nodeName === 'BR') { if (i !== kids.length - 1) text += '\n'; } // a lone trailing <br> is only the browser's placeholder
      else text += n.textContent;
    });
    const sel = selectionIn(pre);
    pre.textContent = text;
    if (sel) setSelectionOffsets(pre, Math.min(sel[0], text.length), Math.min(sel[1], text.length));
  });
}

/* ---------- Colours (CSS highlights) ---------- */

const GROUP = {
  comment: 'comment', prolog: 'comment', doctype: 'comment', cdata: 'comment', blockquote: 'comment',
  keyword: 'keyword', atrule: 'keyword', important: 'keyword', rule: 'keyword', title: 'keyword',
  string: 'string', char: 'string', 'attr-value': 'string', url: 'string', regex: 'string', 'template-string': 'string', code: 'string', 'code-snippet': 'string',
  number: 'number', boolean: 'number', constant: 'number', symbol: 'number', null: 'number',
  function: 'function', 'function-variable': 'function', method: 'function',
  'class-name': 'type', builtin: 'type', type: 'type', namespace: 'type', bold: 'type', italic: 'type',
  property: 'property', 'attr-name': 'property', tag: 'property', selector: 'property', variable: 'property', parameter: 'property',
  operator: 'punct', punctuation: 'punct', entity: 'punct', list: 'punct',
};
const GROUPS = ['comment', 'keyword', 'string', 'number', 'function', 'type', 'property', 'punct'];
const groupOf = (t) => {
  if (GROUP[t.type]) return GROUP[t.type];
  const al = Array.isArray(t.alias) ? t.alias : t.alias ? [t.alias] : [];
  for (const a of al) if (GROUP[a]) return GROUP[a];
  return null;
};

const supportsHighlights = () => typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';
const registry = new Map(); // editor → { group: [Range…] } (the highlight registry is shared by every editor on screen)

function applyRegistry() {
  if (!supportsHighlights()) return;
  GROUPS.forEach((g) => {
    const all = [];
    registry.forEach((m) => { if (m[g]) all.push(...m[g]); });
    if (all.length) CSS.highlights.set(`code-${g}`, new Highlight(...all)); else CSS.highlights.delete(`code-${g}`);
  });
}

function makeRange(map, s, e) {
  const a = map.find((m) => s < m.end) || map[map.length - 1];
  const b = map.find((m) => e <= m.end) || map[map.length - 1];
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, Math.max(0, Math.min(s - a.start, a.node.data.length)));
  r.setEnd(b.node, Math.max(0, Math.min(e - b.start, b.node.data.length)));
  return r;
}

function walkTokens(tokens, base, inherit, out, map) {
  let pos = base;
  for (const t of tokens) {
    if (typeof t === 'string') {
      if (inherit && t.length) { const r = makeRange(map, pos, pos + t.length); if (r) (out[inherit] = out[inherit] || []).push(r); }
      pos += t.length;
      continue;
    }
    const g = groupOf(t) || inherit;
    const kids = Array.isArray(t.content) ? t.content : (t.content && typeof t.content === 'object' ? [t.content] : null);
    if (kids) walkTokens(kids, pos, g, out, map);
    else if (g && t.length) { const r = makeRange(map, pos, pos + t.length); if (r) (out[g] = out[g] || []).push(r); }
    pos += t.length;
  }
}

/* ---------- Mounting ---------- */

export function mountCode(root, history, { readOnly = false } = {}) {
  tidyCode(root);
  const host = root.parentElement;               // .note__body — the bar floats inside it, never inside your text
  const bar = document.createElement('div');
  bar.className = 'code-bar';
  bar.hidden = true;
  host.append(bar);
  let barPre = null;
  let hovering = false;
  let langMenu = null;
  let run = 0;

  const fire = () => root.dispatchEvent(new Event('input', { bubbles: true }));
  const edit = (fn) => { history?.commit(); fn(); fire(); history?.record(); };

  /* ----- colours ----- */
  async function highlight() {
    if (!supportsHighlights()) return;
    const mine = ++run;
    const res = {};
    const pres = [...root.querySelectorAll(':scope > pre')].filter((p) => PRISM_NAME[langOf(p)] && p.textContent);
    if (pres.length) {
      let Prism;
      try { Prism = await loadPrism(); } catch { return; }
      if (mine !== run) return;
      for (const pre of pres) {
        const grammar = Prism.languages[PRISM_NAME[langOf(pre)]];
        if (!grammar) continue;
        const text = pre.textContent;
        const map = [];
        const w = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
        let pos = 0;
        for (let n = w.nextNode(); n; n = w.nextNode()) { map.push({ node: n, start: pos, end: pos + n.data.length }); pos += n.data.length; }
        if (!map.length) continue;
        try { walkTokens(Prism.tokenize(text, grammar), 0, null, res, map); } catch { /* a grammar hiccup must never break typing */ }
      }
    }
    registry.set(root, res);
    applyRegistry();
  }
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(highlight, 140); };
  const observer = new MutationObserver(later);
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-lang'] });
  highlight();

  /* ----- the bar (language · Format · Copy) ----- */
  function renderBar(pre) {
    const lang = langOf(pre);
    bar.innerHTML =
      (readOnly
        ? `<span class="code-bar__label">${escapeHtml(langName(lang))}</span>`
        : `<button type="button" class="code-bar__btn code-bar__lang" data-code="lang" aria-haspopup="menu">${escapeHtml(langName(lang))}${icon('caret', 12)}</button>`)
      + (!readOnly && canFormat(lang) ? '<button type="button" class="code-bar__btn" data-code="format" title="Format with Prettier">Format</button>' : '')
      + `<button type="button" class="code-bar__btn" data-code="copy" title="Copy code" aria-label="Copy code">${icon('copy', 14)}</button>`;
  }
  function place(pre) {
    const r = pre.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    bar.style.top = `${r.top - h.top + 8}px`;
    bar.style.left = `${Math.max(0, r.right - h.left - bar.offsetWidth - 8)}px`;
  }
  function closeLangMenu() { langMenu?.remove(); langMenu = null; document.removeEventListener('pointerdown', outside, true); }
  const outside = (e) => { if (langMenu && !langMenu.contains(e.target) && !bar.contains(e.target)) closeLangMenu(); };
  function show(pre) { barPre = pre; renderBar(pre); bar.hidden = false; place(pre); }
  function hide() { bar.hidden = true; barPre = null; closeLangMenu(); }
  const caretPre = () => { const s = getSelection(); const p = s.rangeCount ? preOf(s.anchorNode) : null; return p && root.contains(p) ? p : null; };

  const onMove = (e) => {
    const pre = e.target.closest?.('pre');
    if (pre && root.contains(pre)) { if (pre !== barPre) show(pre); }
    else if (!hovering && !caretPre()) hide();
  };
  const onSelection = () => { const p = caretPre(); if (p) { if (p !== barPre) show(p); } else if (!hovering && !langMenu) hide(); };
  bar.addEventListener('pointerenter', () => { hovering = true; });
  bar.addEventListener('pointerleave', () => { hovering = false; });
  host.addEventListener('pointermove', onMove);
  document.addEventListener('selectionchange', onSelection);
  root.addEventListener('input', () => { if (barPre && !bar.hidden) place(barPre); });

  function openLangMenu(btn) {
    closeLangMenu();
    const cur = langOf(barPre);
    langMenu = document.createElement('div');
    langMenu.className = 'block-menu code-lang-menu';
    langMenu.setAttribute('role', 'menu');
    langMenu.innerHTML = LANGS.map(([id, name]) =>
      `<button type="button" role="menuitem" class="block-menu__item${id === cur ? ' is-current' : ''}" data-lang="${id}"><span class="block-menu__icon">${id === cur ? '✓' : ''}</span><span class="block-menu__label">${escapeHtml(name)}</span></button>`).join('');
    document.body.append(langMenu);
    const r = btn.getBoundingClientRect();
    langMenu.style.top = `${Math.max(8, Math.min(r.bottom + 6, innerHeight - langMenu.offsetHeight - 8))}px`;
    langMenu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - langMenu.offsetWidth - 8))}px`;
    langMenu.addEventListener('click', (e) => {
      const it = e.target.closest('[data-lang]');
      if (!it || !barPre) return;
      const pre = barPre;
      edit(() => pre.setAttribute('data-lang', it.dataset.lang));
      closeLangMenu();
      show(pre);
    });
    document.addEventListener('pointerdown', outside, true);
  }

  async function format(pre) {
    const text = pre.textContent;
    if (!text.trim()) return;
    try {
      const out = (await formatCode(langOf(pre), text)).replace(/\n+$/, '');
      if (out === text) { toast('Already formatted'); return; }
      edit(() => setCodeText(pre, out, 0));
      toast('Formatted');
    } catch (err) {
      toast(`Couldn’t format: ${String(err?.message || err).split('\n')[0].slice(0, 90)}`);
    }
  }

  bar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the caret where it is
  bar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-code]');
    if (!b || !barPre) return;
    const pre = barPre;
    if (b.dataset.code === 'lang') openLangMenu(b);
    else if (b.dataset.code === 'format') await format(pre);
    else if (b.dataset.code === 'copy') {
      try { await navigator.clipboard.writeText(pre.textContent); const old = b.innerHTML; b.textContent = '✓'; setTimeout(() => { b.innerHTML = old; }, 1200); }
      catch { toast('Could not copy'); }
    }
  });

  /* ----- editing (not in Read mode) ----- */
  function exitCode(pre, trimNewline) {
    const text = pre.textContent;
    if (!text.replace(/\n/g, '')) { // empty block: it simply becomes text again
      history?.commit(); codeToParagraph(root, pre); fire(); history?.record(); return;
    }
    history?.commit();
    if (trimNewline && text.endsWith('\n')) setCodeText(pre, text.slice(0, -1));
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    pre.after(p);
    caretAtEnd(p);
    fire();
    history?.record();
  }

  function apply(pre, text, a, b = a) { edit(() => setCodeText(pre, text, a, b)); }

  function onEnter(pre) {
    const sel = selectionIn(pre);
    if (!sel) return;
    const text = pre.textContent;
    const [a, b] = sel;
    if (a === b && a === text.length && (text === '' || text.endsWith('\n'))) { exitCode(pre, true); return; } // second Enter on an empty last line
    const lineStart = text.lastIndexOf('\n', a - 1) + 1;
    const indent = /^[ \t]*/.exec(text.slice(lineStart, a))[0];
    const extra = a === b && /[{([:]/.test(text[a - 1] || '') ? ' '.repeat(CONFIG.code.tabSize) : '';
    apply(pre, `${text.slice(0, a)}\n${indent}${extra}${text.slice(b)}`, a + 1 + indent.length + extra.length);
  }

  function onTab(pre, shift) {
    const sel = selectionIn(pre);
    if (!sel) return;
    const text = pre.textContent;
    const [a, b] = sel;
    const size = CONFIG.code.tabSize;
    const unit = ' '.repeat(size);
    if (!shift && a === b) { apply(pre, text.slice(0, a) + unit + text.slice(b), a + size); return; }
    const start = text.lastIndexOf('\n', a - 1) + 1;
    const nl = text.indexOf('\n', b);
    const end = nl === -1 ? text.length : nl;
    let da = 0; let db = 0;
    const out = text.slice(start, end).split('\n').map((ln, i) => {
      if (!shift) { if (i === 0) da = size; db += size; return unit + ln; }
      const m = /^( {1,2}|\t)/.exec(ln);
      const cut = m ? m[0].length : 0;
      if (i === 0) da = -cut;
      db -= cut;
      return ln.slice(cut);
    });
    apply(pre, text.slice(0, start) + out.join('\n') + text.slice(end), Math.max(start, a + da), Math.max(start, b + db));
  }

  const stop = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const pre = caretPre();
    if (!pre) {
      // ``` (or ```js) + Enter on its own line makes a code block
      if (e.key !== 'Enter' || e.shiftKey || mod || e.altKey || e.isComposing) return;
      const s = getSelection();
      if (!s.rangeCount || !s.isCollapsed) return;
      const block = caretBlock(root);
      if (!block || block.tagName !== 'P') return;
      const m = /^```\s*([A-Za-z+#]*)\s*$/.exec(block.textContent.trim());
      if (!m) return;
      stop(e);
      history?.commit();
      toCode(root, block, FENCE[m[1].toLowerCase()] || (m[1] ? 'plain' : CONFIG.code.defaultLang));
      fire();
      history?.record();
      return;
    }
    if (mod && e.shiftKey && /^[0-9]$/.test(e.key)) { stop(e); return; }          // block-type shortcuts do not apply inside code
    if (mod && !e.shiftKey && !e.altKey && /^[biu]$/i.test(e.key)) { stop(e); return; } // no bold / italic / underline in code
    if (e.key === 'Enter') { stop(e); if (mod) exitCode(pre, false); else onEnter(pre); return; }
    if (e.key === 'Tab' && !mod && !e.altKey) { stop(e); onTab(pre, e.shiftKey); return; }
    const sel = selectionIn(pre);
    if (e.key === 'Backspace' && !mod && sel && sel[0] === 0 && sel[1] === 0) {   // at the very start: never merge into the block above
      stop(e);
      if (!pre.textContent) edit(() => codeToParagraph(root, pre));
      return;
    }
    if (e.key === 'Delete' && !mod && sel && sel[0] === pre.textContent.length && sel[1] === sel[0]) stop(e);
  };

  const onBeforeInput = (e) => {                    // phone keyboards: Enter arrives here instead of as a key press
    if (e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') return;
    const pre = caretPre();
    if (!pre) return;
    e.preventDefault();
    onEnter(pre);
  };

  const onPaste = (e) => {
    const pre = caretPre();
    if (!pre) return;
    stop(e);
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    if (!text) return;
    const cur = pre.textContent;
    const [a, b] = selectionIn(pre) || [cur.length, cur.length];
    edit(() => {
      if (!cur && langOf(pre) === 'plain') pre.setAttribute('data-lang', guessLanguage(text));
      setCodeText(pre, cur.slice(0, a) + text + cur.slice(b), a + text.length);
    });
  };

  if (!readOnly) {
    root.addEventListener('keydown', onKeyDown, true);   // before the editor's own Enter / Tab / shortcut handling
    root.addEventListener('beforeinput', onBeforeInput, true);
    root.addEventListener('paste', onPaste, true);
  }

  return () => {
    clearTimeout(timer);
    observer.disconnect();
    host.removeEventListener('pointermove', onMove);
    document.removeEventListener('selectionchange', onSelection);
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('beforeinput', onBeforeInput, true);
    root.removeEventListener('paste', onPaste, true);
    closeLangMenu();
    bar.remove();
    registry.delete(root);
    applyRegistry();
  };
}
