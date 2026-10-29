/* ============================================================================
   MAP CLIPBOARD — copied branches as text, and text (an outline, bullets, a numbered list) turned back into nodes.
   Copy writes an indented outline, so it pastes into any text app too. Pasting that same outline back into a map brings the
   exact branches (with their styles); any other indented text becomes new nodes, one per line, nested by indentation.
   ========================================================================== */

/** [{ t, ch }] → "- text" lines, two spaces per level. */
export function outlineText(trees) {
  const lines = [];
  const walk = (tree, depth) => {
    lines.push(`${'  '.repeat(depth)}- ${(tree.t || '').replace(/\s*\n\s*/g, ' ')}`);
    (tree.ch || []).forEach((c) => walk(c, depth + 1));
  };
  trees.forEach((t) => walk(t, 0));
  return lines.join('\n');
}

/** Text → [{ t, ch }]. Understands indentation (spaces or tabs), bullets (- * • +), numbers (1. 1)) and [ ] / [x] boxes. */
export function parseOutline(text) {
  const roots = [];
  const stack = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (!raw.trim()) continue;
    const m = raw.match(/^([ \t]*)(?:[-*•+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?(.*)$/);
    const indent = m[1].replace(/\t/g, '    ').length;
    const t = m[2].trim();
    if (!t) continue;
    const node = { t, ch: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    (stack.length ? stack[stack.length - 1].node.ch : roots).push(node);
    stack.push({ indent, node });
  }
  return roots;
}
