/* THREADS — the list of saved threads. */
import * as store from '../core/store.js';
import { escapeHtml, tagHue } from '../core/utils.js';
import { matchBlocks, ruleCount } from '../core/threads.js';
import { icon } from '../core/icons.js';
import { button, viewHead, emptyState, caretHtml, countText, moreBtn } from '../ui/components.js';

/** Small readable summary of a thread's rules: coloured #tags, then words and keywords. */
export function rulesSummary(rules) {
  const parts = [
    ...rules.tags.map(t => `<span class="rule-chip rule-chip--tag" style="--tag-h:${tagHue(t)}">#${escapeHtml(t)}</span>`),
    ...rules.words.map(w => `<span class="rule-chip">${escapeHtml(w)}</span>`),
    ...rules.keywords.map(k => `<span class="rule-chip rule-chip--keyword">“${escapeHtml(k)}”</span>`),
  ];
  return parts.length ? parts.join('') : '<span class="row__text">No rules yet</span>';
}

export function render() {
  const list = store.threads();
  const notes = store.searchableNotes();
  const add = button({ action: 'thread-new', iconName: 'plus', label: 'New thread', variant: 'button btn--thread-new' });

  if (!list.length) {
    return { html: `<div class="view">${viewHead({ title: 'Threads' })}${emptyState({
      title: 'No threads yet',
      text: 'A thread gathers blocks from all your notes by tag, word or keyword, and keeps them in one place.', art: 'threads',
      actionHtml: add,
    })}</div>` };
  }

  const rows = list.map((t) => {
    const count = t.live ? matchBlocks(notes, t.rules).length : (t.frozen || []).length;
    const state = t.live ? '' : '<span class="badge">Paused</span>';
    return `<a class="lrow lrow--thread" href="#/thread/${t.id}" data-item="thread:${t.id}">
      <span class="lrow__lead">${icon('threads', 16)}</span>
      <span class="lrow__main">
        <span class="lrow__title">${escapeHtml(t.title)}</span>
      </span>
      <span class="lrow__rules">${ruleCount(t.rules) ? rulesSummary(t.rules) : '<span class="lrow__desc">No rules yet</span>'}</span>
      <span class="lrow__meta">${state}<span>${countText(count, 'block', 'blocks')}</span></span>
      ${moreBtn('thread', t.id)}
      ${caretHtml}
    </a>`;
  }).join('');
  return { html: `<div class="view">${viewHead({ title: 'Threads', actions: add })}<div class="list">${rows}</div></div>` };
}
