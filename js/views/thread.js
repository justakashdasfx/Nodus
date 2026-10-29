/* ============================================================================
   THREAD — one saved thread: a title, the rules, the Live switch and the blocks it gathers.

   Live   → the list follows your notes: new matching blocks appear, edited ones update.
   Rules  → a card with Match Any/All and three fields (Tags · Words · Keywords). The Tags field opens a picker of your existing tags
              (type to filter, ↑ ↓ Enter, or click; "Create" adds a new one). Look: css/tasks-tags.css (.tr-*).
   Settings → open while a thread has no rules yet (and after Edit); Save hides them, Edit brings them back.
              Changes are stored as you make them; Save just closes the panel (and adds any word you typed but did not confirm).
   Paused → the list is frozen as it was when you paused (the blocks stay, with their current text).
            A banner says how many new matching blocks there are; "Update now" refreezes with them,
            "Go live" switches back to following your notes.
   ========================================================================== */

import * as store from '../core/store.js';
import { escapeHtml, tagHue, TAG_RE } from '../core/utils.js';
import { matchBlocks, resolveFrozen, refsOf, newSince, ruleCount } from '../core/threads.js';
import { button, viewHead, emptyState } from '../ui/components.js';
import { blockRows } from './blocklist.js';
import { icon } from '../core/icons.js';

const KINDS = [
  { key: 'tags', label: 'Tags', icon: 'tag', placeholder: 'Search or add a tag', help: '' },
  { key: 'words', label: 'Words', icon: 'font', placeholder: 'Add a word', help: 'whole words, e.g. budget' },
  { key: 'keywords', label: 'Keywords', icon: 'search', placeholder: 'Add a keyword', help: 'anywhere in the text, e.g. deep work, or part of a word' },
];

export function render({ id }) {
  const thread = store.getThread(id);
  if (!thread) {
    return { html: `<div class="view">${viewHead({ title: 'Thread not found' })}${emptyState({
      title: 'This thread does not exist (any more)',
      actionHtml: '<a class="btn btn--solid" href="#/threads"><span class="btn__label">All threads</span></a>',
    })}</div>` };
  }

  const html = `
    <div class="view thread">
      <header class="view-head">
        <div class="thread__titlewrap">
          <input id="thread-title" class="thread__title" type="text" maxlength="120" value="${escapeHtml(thread.title)}" aria-label="Thread title" spellcheck="false">
          <p class="view-head__sub" id="thread-sub"></p>
        </div>
        <div class="view-head__actions">
          <label class="switch" title="Live: follows your notes. Off: the list is frozen.">
            <input type="checkbox" id="thread-live" ${thread.live ? 'checked' : ''}>
            <span class="switch__track"></span><span class="switch__label">Live</span>
          </label>
          <button type="button" class="btn" id="thread-edit" data-thread-act="edit">${icon('pencil')}<span class="btn__label">Edit</span></button>
          ${button({ action: 'thread-delete', iconName: 'trash', label: 'Delete', data: { id: thread.id } })}
        </div>
      </header>
      <section class="tr" id="thread-rules" aria-label="Rules"></section>
      <div id="thread-paused"></div>
      <div class="list" id="thread-list"></div>
    </div>`;

  return { html, mount: (root) => mountThread(root, id) };
}

function mountThread(root, id) {
  const $ = (sel) => root.querySelector(sel);
  const hostNote = root.dataset?.hostNote || '';   // set when this thread sits inside a note (js/editor/thread-block.js)

  function hitsFor(thread) {
    const notes = store.searchableNotes().filter((n) => n.id !== hostNote);   // a thread inside a note never lists that note's own blocks
    const current = matchBlocks(notes, thread.rules);
    return thread.live
      ? { hits: current, fresh: 0 }
      : { hits: resolveFrozen(notes, thread.frozen), fresh: newSince(thread.frozen, current) };
  }

  function rulesHtml(thread) {
    const r = thread.rules;
    const x = (kind, value) => `<button type="button" class="tr-chip__x" data-remove="${kind}" data-value="${escapeHtml(value)}" aria-label="Remove ${escapeHtml(value)}">${icon('close', 10)}</button>`;
    const chip = (kind, value) => kind === 'tags'
      ? `<span class="tr-chip tr-chip--tag" style="--tag-h:${tagHue(value)}"><span class="tr-chip__label">${escapeHtml(value)}</span>${x(kind, value)}</span>`
      : `<span class="tr-chip"><span class="tr-chip__label">${kind === 'keywords' ? `“${escapeHtml(value)}”` : escapeHtml(value)}</span>${x(kind, value)}</span>`;
    return `
      <div class="tr-head">
        <span class="tr-label">Match</span>
        <div class="tr-seg" role="group" aria-label="Match any or all">
          <button type="button" class="tr-seg__btn" data-mode="any" aria-pressed="${r.mode === 'any'}">Any</button>
          <button type="button" class="tr-seg__btn" data-mode="all" aria-pressed="${r.mode === 'all'}">All</button>
        </div>
        <span class="tr-hint">${r.mode === 'any' ? 'a block counts if it fits at least one rule' : 'a block must fit every rule'}</span>
      </div>
      ${KINDS.map(k => `
        <div class="tr-field">
          <span class="tr-label">${icon(k.icon, 14)}${k.label}</span>
          <div class="tr-box" data-box="${k.key}">
            ${r[k.key].map(v => chip(k.key, v)).join('')}
            <input class="rule-input tr-input" type="text" data-kind="${k.key}" placeholder="${k.placeholder}" autocomplete="off" spellcheck="false" maxlength="60">
            ${k.key === 'tags' ? '<div class="tr-pick" role="listbox" hidden></div>' : ''}
          </div>
          ${k.help ? `<p class="tr-help">${k.help}</p>` : ''}
        </div>`).join('')}
      <div class="tr-foot"><button type="button" class="btn btn--primary" data-thread-act="save"><span class="btn__label">Save</span></button></div>`;
  }

  /* ---- The tag picker: your existing tags under the Tags field (replaces the browser's own list) ---- */
  let pickActive = 0;
  const pickEl = () => $('.tr-pick');
  const tagInput = () => $('.rule-input[data-kind="tags"]');

  function pickItems(q) {
    const have = new Set(store.getThread(id)?.rules.tags || []);
    const needle = q.trim().replace(/^#/, '').toLowerCase();
    const counts = store.tagCounts();
    const items = [...counts].filter(([t]) => !have.has(t) && (!needle || t.includes(needle)))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => ({ tag }));
    if (needle && TAG_RE.test(needle) && !counts.has(needle) && !have.has(needle)) items.push({ tag: needle, create: true });
    return items;
  }

  function openPick() {
    const pop = pickEl(), input = tagInput();
    if (!pop || !input) return;
    const items = pickItems(input.value);
    if (!items.length) { pop.hidden = true; return; }
    pickActive = Math.max(0, Math.min(pickActive, items.length - 1));
    pop.innerHTML = items.map((it, i) =>
      `<button type="button" role="option" class="tr-pick__item${i === pickActive ? ' is-active' : ''}" data-pick="${escapeHtml(it.tag)}" style="--tag-h:${tagHue(it.tag)}">`
      + `<span class="tr-pick__dot"></span><span class="tr-pick__name">${escapeHtml(it.tag)}</span>${it.create ? '<span class="tr-pick__meta">Create</span>' : ''}</button>`).join('');
    pop.hidden = false;
    pop.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }
  const closePick = () => { const pop = pickEl(); if (pop) pop.hidden = true; };

  function pickTag(tag) {
    if (addTerm('tags', tag)) { pickActive = 0; paint(); tagInput()?.focus(); }   // focusing reopens the picker, so you can add several in a row
  }

  let editing = !ruleCount(store.getThread(id)?.rules || { tags: [], words: [], keywords: [] }); // a new thread starts with its settings open

  function paint() {
    const thread = store.getThread(id);
    if (!thread) return;
    const { hits, fresh } = hitsFor(thread);
    const notes = new Set(hits.map(h => h.note.id)).size;
    $('#thread-sub').textContent = `${hits.length} ${hits.length === 1 ? 'block' : 'blocks'} in ${notes} ${notes === 1 ? 'note' : 'notes'}${thread.live ? '' : ' · paused'}`;
    $('#thread-live').checked = thread.live;
    $('#thread-rules').hidden = !editing;
    $('#thread-edit').hidden = editing;
    if (editing) $('#thread-rules').innerHTML = rulesHtml(thread);

    $('#thread-paused').innerHTML = thread.live ? '' : `
      <div class="thread__banner">
        ${icon('clock', 16)}
        <span>Paused — this list is frozen as it was.${fresh ? ` <strong>${fresh} new matching ${fresh === 1 ? 'block' : 'blocks'}</strong> since.` : ''}</span>
        <span class="thread__banner-actions">
          ${fresh ? '<button type="button" class="btn" data-thread-act="refresh">Update now</button>' : ''}
          <button type="button" class="btn btn--solid" data-thread-act="live">Go live</button>
        </span>
      </div>`;

    $('#thread-list').innerHTML = hits.length
      ? blockRows(hits)
      : emptyState({
          title: ruleCount(thread.rules) ? 'No blocks match yet' : 'Add a rule to start',
          text: ruleCount(thread.rules)
            ? (thread.live ? 'Blocks that fit the rules will appear here as you write.' : 'Nothing was matching when this thread was paused.')
            : 'Add a tag, a word or a keyword above and the matching blocks from all your notes will gather here.', art: 'threads',
        });
  }

  /* ---- Editing ---- */

  const title = $('#thread-title');
  title.addEventListener('change', () => { store.updateThread(id, { title: title.value }); title.value = store.getThread(id)?.title ?? title.value; });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });

  $('#thread-live').addEventListener('change', (e) => setLive(e.target.checked));

  function setLive(on) {
    const thread = store.getThread(id);
    if (!thread) return;
    if (on) store.updateThread(id, { live: true, frozen: null });
    else store.updateThread(id, { live: false, frozen: refsOf(matchBlocks(store.searchableNotes(), thread.rules)) });
    paint();
  }

  function addTerm(kind, raw) {
    const thread = store.getThread(id);
    let value = String(raw).trim();
    if (kind === 'tags') value = value.replace(/^#/, '').toLowerCase();
    if (!value || (kind === 'tags' && !TAG_RE.test(value))) return false;
    store.updateThread(id, { rules: { [kind]: [...thread.rules[kind], value] } });
    return true;
  }

  root.addEventListener('keydown', (e) => {
    const input = e.target.closest?.('.rule-input');
    if (!input) return;
    const kind = input.dataset.kind;
    const pop = kind === 'tags' ? pickEl() : null;
    if (pop && !pop.hidden) {                                   // the picker is open
      const n = pop.querySelectorAll('.tr-pick__item').length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pickActive = (pickActive + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; openPick(); return; }
      if (e.key === 'Escape') { e.preventDefault(); closePick(); return; }
      if (e.key === 'Enter') { e.preventDefault(); const it = pop.querySelectorAll('.tr-pick__item')[pickActive]; if (it) pickTag(it.dataset.pick); return; }
    }
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    if (addTerm(kind, input.value)) { paint(); root.querySelector(`.rule-input[data-kind="${kind}"]`)?.focus(); }
  });

  root.addEventListener('focusin', (e) => { if (e.target.closest?.('.rule-input[data-kind="tags"]')) { pickActive = 0; openPick(); } });
  root.addEventListener('input', (e) => { if (e.target.closest?.('.rule-input[data-kind="tags"]')) { pickActive = 0; openPick(); } });
  root.addEventListener('mousedown', (e) => { if (e.target.closest?.('.tr-pick')) e.preventDefault(); });   // clicking a tag must not take focus away from the field
  const outside = (e) => { if (!e.composedPath().some((n) => n.matches?.('.tr-box[data-box="tags"]'))) closePick(); };
  document.addEventListener('pointerdown', outside, true);

  root.addEventListener('click', (e) => {
    const thread = store.getThread(id);
    if (!thread) return;
    const pick = e.target.closest('[data-pick]');
    if (pick) { pickTag(pick.dataset.pick); return; }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const kind = remove.dataset.remove;
      store.updateThread(id, { rules: { [kind]: thread.rules[kind].filter(v => v !== remove.dataset.value) } });
      paint();
      return;
    }
    const mode = e.target.closest('[data-mode]');
    if (mode) { store.updateThread(id, { rules: { mode: mode.dataset.mode } }); paint(); return; }
    const act = e.target.closest('[data-thread-act]')?.dataset.threadAct;
    if (act === 'save') {
      for (const input of root.querySelectorAll('.rule-input')) if (input.value.trim()) addTerm(input.dataset.kind, input.value); // typed but not confirmed
      editing = false;
      paint();
      return;
    }
    if (act === 'edit') { editing = true; paint(); root.querySelector('.rule-input[data-kind="tags"]')?.focus(); return; }
    if (act === 'live') setLive(true);
    if (act === 'refresh') { store.updateThread(id, { frozen: refsOf(matchBlocks(store.searchableNotes(), thread.rules)) }); paint(); }
  });

  paint();
  if (!store.getThread(id)?.title || store.getThread(id).title === 'Untitled thread') { title.focus(); title.select(); }
  return () => { document.removeEventListener('pointerdown', outside, true); };
}
