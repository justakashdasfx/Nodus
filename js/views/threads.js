/* THREADS — the list of saved threads. */
import * as store from '../core/store.js';
import { escapeHtml, tagHue } from '../core/utils.js';
import { matchBlocks, ruleCount } from '../core/threads.js';
import { button, viewHead, emptyState } from '../ui/components.js';

/** Small readable summary of a thread's rules: coloured #tags, then words and keywords. */
export function rulesSummary(rules) {
  const parts = [
    ...rules.tags.map(t => `<span class="rule-chip rule-chip--tag" style="--tag-h:${tagHue(t)}">${escapeHtml(t)}</span>`),
    ...rules.words.map(w => `<span class="rule-chip">${escapeHtml(w)}</span>`),
    ...rules.keywords.map(k => `<span class="rule-chip rule-chip--keyword">“${escapeHtml(k)}”</span>`),
  ];
  return parts.length ? parts.join('') : '<span class="row__text">No rules yet</span>';
}

export function render() {
  const list = store.threads();
  const notes = store.searchableNotes();
  const add = button({ action: 'thread-new', iconName: 'plus', label: 'New thread', variant: 'button' });

  if (!list.length) {
    return { html: `<div class="view">${viewHead({ title: 'Threads' })}${emptyState({
      title: 'No threads yet',
      text: 'A thread gathers blocks from all your notes by tag, word or keyword, and keeps them in one place.',
      actionHtml: add,
    })}</div>` };
  }

  const rows = list.map((t) => {
    const count = t.live ? matchBlocks(notes, t.rules).length : (t.frozen || []).length;
    const state = t.live ? '' : '<span class="badge">Paused</span>';
    return `<a class="row thread-row" href="#/thread/${t.id}">
      <span class="row__title">${escapeHtml(t.title)}</span>
      <span class="thread-row__rules">${ruleCount(t.rules) ? rulesSummary(t.rules) : '<span class="row__text">No rules yet</span>'}</span>
      <span class="thread-row__meta">${state}<span class="row__text">${count} ${count === 1 ? 'block' : 'blocks'}</span></span>
    </a>`;
  }).join('');
  return { html: `<div class="view">${viewHead({ title: 'Threads', subtitle: `${list.length} ${list.length === 1 ? 'thread' : 'threads'}`, actions: add })}<div class="list">${rows}</div></div>` };
}
