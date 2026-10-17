/* ============================================================================
   INLINE — wrap / unwrap inline elements (<mark>, <span data-tc>, <code>)
   around the current selection, even when it spans several paragraphs.

   Why not document.execCommand? The built-in highlight/colour commands write
   inline styles with fixed colours, which can't follow the light/dark theme.
   These helpers write semantic attributes instead (data-hl="blue"), and the
   colours live in css/tokens.css.

   Rule of thumb: if you touch part of an existing highlight, the whole
   highlight run is recoloured / removed (keeps the markup flat and clean).
   ========================================================================== */

/** Non-mutating: text nodes overlapping the range, with the overlapping offsets. */
function textRuns(root, range) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const runs = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!range.intersectsNode(node)) continue;
    const parent = node.parentNode;
    if (parent === root || parent.nodeName === 'UL' || parent.nodeName === 'OL') continue; // layout whitespace
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
    if (start < end) runs.push({ node, start, end });
  }
  return runs;
}

/** Splits boundary text nodes so each run is exactly one node. */
const isolate = (runs) => runs.map(({ node, start, end }) => {
  if (end < node.nodeValue.length) node.splitText(end);
  return start > 0 ? node.splitText(start) : node;
});

function reselect(nodes) {
  if (!nodes.length) return;
  const range = document.createRange();
  range.setStartBefore(nodes[0]);
  range.setEndAfter(nodes[nodes.length - 1]);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

const hostOf = (node, root, selector) => {
  const host = node.parentElement?.closest(selector);
  return host && host !== root && root.contains(host) ? host : null;
};

/** True when ALL selected text already sits inside `selector` (e.g. 'code'). */
export function selectionHasInline(root, range, selector) {
  const runs = textRuns(root, range);
  return runs.length > 0 && runs.every(({ node }) => hostOf(node, root, selector));
}

/** spec = { tag, attr?, value? }  e.g. { tag: 'mark', attr: 'data-hl', value: 'blue' } */
export function applyInline(root, range, { tag, attr, value }) {
  const selector = attr ? `${tag}[${attr}]` : tag;
  const touched = [];
  isolate(textRuns(root, range)).forEach((node) => {
    const host = hostOf(node, root, selector);
    if (host) { if (attr) host.setAttribute(attr, value); touched.push(host); return; }
    const el = document.createElement(tag);
    if (attr) el.setAttribute(attr, value);
    node.replaceWith(el);
    el.append(node);
    touched.push(el);
  });
  reselect(touched);
}

export function removeInline(root, range, selector) {
  const touched = [];
  const unwrapped = new Set();
  isolate(textRuns(root, range)).forEach((node) => {
    const host = hostOf(node, root, selector);
    if (host && !unwrapped.has(host)) { unwrapped.add(host); host.replaceWith(...host.childNodes); }
    touched.push(node);
  });
  reselect(touched);
}

/** Highlights, text colours, inline code, then bold/italic/underline. */
export function clearAllInline(root, range) {
  removeInline(root, range, 'mark[data-hl], span[data-tc], code');
  document.execCommand('removeFormat');
}
