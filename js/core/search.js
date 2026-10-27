/* ============================================================================
   SEARCH ENGINE — finds notes, blocks, tags, notebooks, threads and commands.
   Whole words, parts of words, any word order, accents ignored, typos tolerated.
   Active notes only (Trash is never searched). Tuning: js/core/config.js → search.

   The index is built the first time the window opens after something changed
   (never while you type in a note), so editing stays fast.
   ========================================================================== */

import { CONFIG } from './config.js';
import * as store from './store.js';
import { formatJournalDate } from './utils.js';

/* ---------- Words ---------- */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const wordsOf = (s) => norm(s).match(/[\p{L}\p{N}_-]+/gu) || [];
const uniqueWords = (s) => [...new Set(wordsOf(s))];

/* ---------- Typo tolerance (edit distance, swapped neighbours count as one) ---------- */

const tolerance = (len) => { let max = 0; for (const [min, n] of CONFIG.search.typo) if (len >= min) max = n; return max; };

function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/* ---------- Scoring ---------- */

/** How well one search word matches a list of words: 1 exact · .85 start of a word · .6 inside a word · ≤.5 typo. */
function termScore(t, ws, fuzzy, max) {
  let best = 0;
  for (const w of ws) {
    if (w === t) return 1;
    let s = 0;
    if (w.startsWith(t)) s = 0.85;
    else if (t.length >= 3 && w.includes(t)) s = 0.6;
    else if (fuzzy && max) {
      const d = Math.min(distance(t, w, max), w.length > t.length ? distance(t, w.slice(0, t.length), max) : max + 1);
      if (d <= max) s = 0.5 - 0.1 * d;
    }
    if (s > best) best = s;
  }
  return best;
}

/** fields: [[words, weight], …]. Every search word must match somewhere (any order); 0 = no match. */
function scoreItem(terms, fields, fuzzy) {
  let total = 0;
  for (const t of terms) {
    const max = tolerance(t.length);
    let best = 0;
    for (const [ws, k] of fields) { const s = termScore(t, ws, fuzzy, max) * k; if (s > best) best = s; }
    if (!best) return 0;
    total += best;
  }
  return total / terms.length;
}

function top(list, terms, fuzzy, limit) {
  const out = [];
  for (const item of list) { const s = scoreItem(terms, item.f, fuzzy); if (s) out.push({ ...item, s }); }
  return out.sort((a, b) => b.s - a.s || (b.t || 0) - (a.t || 0)).slice(0, limit);
}

/* ---------- Index ---------- */

let idx = null;
store.subscribe((kind) => { if (kind !== 'dirty') idx = null; });   // rebuilt the next time the window opens

function build() {
  const notes = [];
  const blocks = [];
  for (const n of store.searchableNotes()) {
    const journal = n.type === 'journal' && n.date;
    const title = journal ? formatJournalDate(n.date) : (n.title || 'Untitled');
    const folder = n.folderId ? store.getFolder(n.folderId) : null;
    const where = journal ? 'Journal' : folder ? folder.name : 'Inbox';
    const bl = n.blocks || [];
    const tagWords = [...new Set(bl.flatMap(b => b.tags || []))];
    notes.push({ kind: 'note', id: n.id, journal: !!journal, title, sub: where, t: n.updatedAt,
      f: [[uniqueWords(title), 3], [tagWords, 1.5], [uniqueWords(bl.map(b => b.text).join(' ')), 1]] });
    bl.forEach((b, i) => {
      if (i === 0 && b.text === title) return;   // the title line is the note itself
      if (!b.text && !(b.tags || []).length) return;
      blocks.push({ kind: 'block', id: b.id, noteId: n.id, title: b.text || '(tags only)', sub: `${title} · ${where}`, t: n.updatedAt,
        f: [[uniqueWords(b.text), 1], [b.tags || [], 0.8]] });
    });
  }
  const tags = [...store.tagCounts()].map(([tag, count]) => ({ kind: 'tag', id: tag, title: '#' + tag, sub: `${count} ${count === 1 ? 'block' : 'blocks'}`, f: [[[tag], 1]] }));
  const notebooks = store.folders().map(f => {
    const c = store.noteCount(f.id);
    return { kind: 'notebook', id: f.id, title: f.name, sub: `${c} ${c === 1 ? 'note' : 'notes'}`, t: f.createdAt, f: [[uniqueWords(f.name), 3], [uniqueWords(f.description), 0.8]] };
  });
  const threads = store.threads().map(t => ({ kind: 'thread', id: t.id, title: t.title || 'Untitled thread', sub: 'Thread', t: t.updatedAt, f: [[uniqueWords(t.title), 3]] }));
  const maps = store.maps().map(m => {
    const folder = m.folderId ? store.getFolder(m.folderId) : null;
    return { kind: 'map', id: m.id, title: m.title || 'Untitled map', sub: `Mind map${folder ? ' · ' + folder.name : ''}`, t: m.updatedAt, f: [[uniqueWords(m.title), 3]] };   // the title only, not the text inside the map
  });
  return { notes, blocks, tags, notebooks, threads, maps };
}

/** Results for the typed text: { notes, blocks, tags, notebooks, threads } (each sorted, limited), or null for an empty query. */
export function search(query) {
  const terms = wordsOf(query);
  if (!terms.length) return null;
  idx = idx || build();
  const L = CONFIG.search.limits;
  const run = (fuzzy) => ({
    notes: top(idx.notes, terms, fuzzy, L.notes),
    blocks: top(idx.blocks, terms, fuzzy, L.blocks),
    tags: top(idx.tags, terms, fuzzy, L.tags),
    notebooks: top(idx.notebooks, terms, fuzzy, L.notebooks),
    threads: top(idx.threads, terms, fuzzy, L.threads),
    maps: top(idx.maps, terms, fuzzy, L.maps),
  });
  const exact = run(false);
  const found = exact.notes.length + exact.blocks.length + exact.tags.length + exact.notebooks.length + exact.threads.length + exact.maps.length;
  return found >= CONFIG.search.fuzzyBelow ? exact : run(true);   // typos are only forgiven when little is found
}

/* ---------- Commands ---------- */

const TEMPLATE_COMMANDS = CONFIG.templates.map(t => ({ id: 'template.' + t.id, label: `From template: ${t.name}`, words: 'new note create', kind: 'action', target: 'template-new', data: { id: 'b:' + t.id }, icon: 'copy' }));
const COMMANDS = [...CONFIG.commands, ...TEMPLATE_COMMANDS].map(c => ({ ...c, f: [[uniqueWords(c.label), 3], [uniqueWords(c.words), 1]] }));

/** ctx: { onNote } — commands marked needs:'note' only show on a note page. query null → the short list for an empty box. */
export function commandsFor(query, ctx = {}) {
  const usable = COMMANDS.filter(c => c.needs !== 'note' || ctx.onNote);
  const terms = wordsOf(query);
  if (!terms.length) return CONFIG.search.emptyCommands.map(id => usable.find(c => c.id === id)).filter(Boolean).map(c => ({ ...c, kind: 'command', run: { kind: c.kind, target: c.target, data: c.data } }));
  const limit = CONFIG.search.limits.commands;
  const hit = (fuzzy) => top(usable, terms, fuzzy, limit);
  const exact = hit(false);
  return (exact.length ? exact : hit(true)).map(c => ({ ...c, kind: 'command', run: { kind: c.kind, target: c.target, data: c.data } }));
}
