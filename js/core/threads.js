/* ============================================================================
   THREADS — the matching engine. Pure functions: give it notes and rules, get blocks back.
   The tag page (#/tag/x) is just the rule "tag = x"; a saved thread adds more rules.

   rules = { tags: ['hustle'], words: ['budget'], keywords: ['deep work'], mode: 'any' | 'all' }
     tags      the block carries this tag
     words     the block text contains this as a whole word (case-insensitive)
     keywords  the block text contains this anywhere (phrases and parts of words too)
     mode      'any': at least one of the conditions · 'all': every one of them
   ========================================================================== */

import { sanitizeHtml, parseTags } from './utils.js';
import { blocksOf, ownText, blockType } from './blockindex.js';
import { BID_RE } from './utils.js';

export const emptyRules = () => ({ tags: [], words: [], keywords: [], mode: 'any' });

const MAX_TERMS = 20;
function terms(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = String(raw).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out.slice(0, MAX_TERMS);
}

export function normalizeRules(r = {}) {
  return {
    tags: parseTags((Array.isArray(r.tags) ? r.tags : []).join(' ')),
    words: terms(r.words),
    keywords: terms(r.keywords),
    mode: r.mode === 'all' ? 'all' : 'any',
  };
}

export const ruleCount = (r) => r.tags.length + r.words.length + r.keywords.length;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(rules) {
  const tests = [];
  for (const t of rules.tags) tests.push((b) => b.tags.includes(t));
  for (const w of rules.words) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(w)}(?![\\p{L}\\p{N}_])`, 'iu');
    tests.push((b) => re.test(b.text));
  }
  for (const k of rules.keywords) {
    const needle = k.toLowerCase();
    tests.push((b) => b.text.toLowerCase().includes(needle));
  }
  return tests;
}

/* Full block text needs the note's HTML; it is parsed once per note version. The saved index
   only keeps the first 160 characters, which is enough for tags but not for word / keyword rules. */
const parsed = new Map();
function fullBlocks(note) {
  const hit = parsed.get(note.id);
  if (hit && hit.stamp === note.updatedAt) return hit.blocks;
  const body = new DOMParser().parseFromString(`<body>${sanitizeHtml(note.html || '')}</body>`, 'text/html').body;
  const blocks = [];
  for (const el of blocksOf(body)) {
    const id = el.getAttribute('data-bid');
    if (!id || !BID_RE.test(id)) continue;
    const text = ownText(el);
    const tags = parseTags(el.getAttribute('data-tags'));
    if (text || tags.length) blocks.push({ id, t: blockType(el), text, tags });
  }
  parsed.set(note.id, { stamp: note.updatedAt, blocks });
  return blocks;
}

const indexBlocks = (note) => (note.blocks || []).map((b) => ({ id: b.id, t: b.t, text: b.text || '', tags: b.tags || [] }));

const byRecent = (a, b) => b.updatedAt - a.updatedAt;

/** Blocks matching the rules, newest note first, in document order inside a note. → [{ note, block }] */
export function matchBlocks(notes, rules) {
  const r = normalizeRules(rules);
  const tests = compile(r);
  if (!tests.length) return [];
  const needsText = r.words.length || r.keywords.length;
  const pass = r.mode === 'all' ? (b) => tests.every((t) => t(b)) : (b) => tests.some((t) => t(b));
  const out = [];
  for (const note of [...notes].sort(byRecent)) {
    for (const block of needsText ? fullBlocks(note) : indexBlocks(note)) if (pass(block)) out.push({ note, block });
  }
  return out;
}

/** What a paused thread shows: the blocks it had when it was paused, with their current text. */
export function resolveFrozen(notes, frozen) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const out = [];
  for (const ref of frozen || []) {
    const note = byId.get(ref.noteId);
    const block = note && fullBlocks(note).find((b) => b.id === ref.blockId);
    if (block) out.push({ note, block });
  }
  return out;
}

export const refsOf = (hits) => hits.map(({ note, block }) => ({ noteId: note.id, blockId: block.id }));

/** How many of the current matches are not in the frozen list. */
export function newSince(frozen, hits) {
  const had = new Set((frozen || []).map((r) => `${r.noteId}:${r.blockId}`));
  return hits.filter(({ note, block }) => !had.has(`${note.id}:${block.id}`)).length;
}
