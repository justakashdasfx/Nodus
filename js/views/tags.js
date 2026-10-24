/* TAGS — every #tag you use, in alphabetical sections (all the tags starting with P under P).
   Each tag is a pill in its own colour; click one to open the side pane with all the blocks that carry it.
   Pill look: .tag-pill in css/gallery.css · colours: --tagpill-* in css/tokens.css (the hue comes from the tag's name, like everywhere else). */
import * as store from '../core/store.js';
import { escapeHtml, tagHue } from '../core/utils.js';
import { viewHead, emptyState } from '../ui/components.js';

/** 'p…' → 'P' · digits and symbols → '#' (shown last). */
const letterOf = (tag) => {
  const c = String(tag).charAt(0).toLocaleUpperCase();
  return /\p{L}/u.test(c) ? c : '#';
};

export function render() {
  const counts = store.tagCounts();
  if (!counts.size) {
    return { html: `<div class="view">${viewHead({ title: 'Tags' })}${emptyState({
      title: 'No tags yet',
      text: 'Type # and a word in any block (for example #idea) and press space. Every tag you use will be listed here.',
    })}</div>` };
  }

  const groups = new Map();
  for (const tag of [...counts.keys()].sort((a, b) => a.localeCompare(b))) {
    const k = letterOf(tag);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(tag);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));

  const pill = (tag) => `<button type="button" class="tag-pill" style="--tag-h:${tagHue(tag)}" data-action="tag-pane" data-tag="${escapeHtml(tag)}" title="Show the blocks tagged #${escapeHtml(tag)}">
      <span class="tag-pill__name">#${escapeHtml(tag)}</span><span class="tag-pill__count">${counts.get(tag)}</span></button>`;

  const body = letters.map((l) => `<section class="tags-page__section">
      <h2 class="tags-page__letter">${escapeHtml(l)}</h2>
      <div class="tags-page__pills">${groups.get(l).map(pill).join('')}</div>
    </section>`).join('');

  return { html: `<div class="view">${viewHead({ title: 'Tags', subtitle: `${counts.size} ${counts.size === 1 ? 'tag' : 'tags'}` })}${body}</div>` };
}
