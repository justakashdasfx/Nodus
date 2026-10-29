/* ============================================================================
   FOCUS — marks the paragraph you are writing in with .is-active.
   CSS (editor.css) makes that block brighter and the rest muted.
   The class is stripped before saving (see sanitizeHtml), so it never persists.
   ========================================================================== */

const BLOCKS = 'li, p, div, h1, h2, h3, h4, blockquote, pre';

export function initFocusTracking(root) {
  const update = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !root.contains(sel.anchorNode)) return;
    const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const block = el?.closest(BLOCKS);
    if (!block || block === root || !root.contains(block)) return;
    root.querySelectorAll('.is-active').forEach((old) => { if (old !== block) old.classList.remove('is-active'); });   // all of them: a duplicated / turned / moved block can leave a second one
    if (!block.classList.contains('is-active')) block.classList.add('is-active');
  };
  let frame = 0;
  const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
  const mo = new MutationObserver(later);              // turning into a heading, moving, duplicating: the blocks change but the selection event may not come
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('selectionchange', update);
  return () => { document.removeEventListener('selectionchange', update); mo.disconnect(); cancelAnimationFrame(frame); };
}
