/* TAGS — every #tag you use. Two ways to look at them (switch at the top, remembered until you reload):
     A–Z        alphabetical sections, the letter on the left (all the tags starting with P under P)
     Most used  one list, the most-used tag first
   Type in the filter box to narrow the list. Each tag is a chip: white ALL-CAPS mono text on a background in the tag's own colour
   (no # and no number). Click a chip to open the side pane with all the blocks that carry it.
   Look: css/tasks-tags.css (.tg-*) — the colour depth is --tagsolid-sat / --tagsolid-light; the hue comes from the tag's name. */
import * as store from '../core/store.js';
import { escapeHtml, tagHue } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { viewHead, emptyState } from '../ui/components.js';

let sortMode = 'az';         // 'az' | 'used'

/** 'p…' → 'P' · digits and symbols → '#' (shown last). */
const letterOf = (tag) => {
  const c = String(tag).charAt(0).toLocaleUpperCase();
  return /\p{L}/u.test(c) ? c : '#';
};

// Sort switch: no redraw, CSS shows the matching list.
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('[data-tg-sort]');
  if (!btn) return;
  const root = btn.closest('.tg');
  if (!root) return;
  sortMode = btn.dataset.tgSort;
  root.dataset.sort = sortMode;
  root.querySelectorAll('[data-tg-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
});

// Filter box: hides the chips that do not match, and any letter left empty.
document.addEventListener('input', (e) => {
  const input = e.target.closest?.('[data-tg-search]');
  if (!input) return;
  const root = input.closest('.tg');
  if (!root) return;
  const q = input.value.trim().toLowerCase().replace(/^#/, '');
  root.querySelectorAll('.tg-chip').forEach((c) => { c.hidden = !!q && !c.dataset.tag.toLowerCase().includes(q); });
  root.querySelectorAll('.tg-group').forEach((s) => { s.hidden = !s.querySelector('.tg-chip:not([hidden])'); });
  const any = root.querySelector('.tg-az .tg-chip:not([hidden])');
  root.querySelector('.tg-none').hidden = !!any;
});

export function render() {
  const counts = store.tagCounts();
  if (!counts.size) {
    return { html: `<div class="view">${viewHead({ title: 'Tags' })}${emptyState({
      title: 'No tags yet',
      text: 'Type # and a word in any block (for example #idea) and press space. Every tag you use will be listed here.', art: 'tags',
    })}</div>` };
  }

  const tags = [...counts.keys()];


// 27.10.26
const chip = (tag) => `<button type="button" class="tg-chip" style="--tag-h:${tagHue(tag)}" data-tag="${escapeHtml(tag)}" data-action="tag-pane" title="Show the blocks tagged ${escapeHtml(tag)}">
      <span class="tg-chip__name">${escapeHtml(tag)}</span><span class="tg-chip__count">${counts.get(tag)}</span></button>`;




  // A–Z
  const groups = new Map();
  for (const tag of [...tags].sort((a, b) => a.localeCompare(b))) {
    const k = letterOf(tag);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(tag);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
  const az = letters.map((l) => `<section class="tg-group">
      <h2 class="tg-letter">${escapeHtml(l)}</h2>
      <div class="tg-chips">${groups.get(l).map(chip).join('')}</div>
    </section>`).join('');

  // Most used
  const used = [...tags].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));

  const sortBtn = (key, label) => `<button type="button" class="tg-sort__btn" data-tg-sort="${key}" aria-pressed="${sortMode === key}">${label}</button>`;

  return { html: `<div class="view tg" data-sort="${sortMode}">
    ${viewHead({ title: 'Tags', subtitle: `${counts.size} ${counts.size === 1 ? 'tag' : 'tags'}` })}
    <div class="tg-bar">
      <label class="tg-search">${icon('search', 14)}<input type="search" class="tg-search__input" data-tg-search placeholder="Filter tags" autocomplete="off" spellcheck="false" aria-label="Filter tags"></label>
      <div class="tg-sort" role="group" aria-label="Sort tags">${sortBtn('az', 'A–Z')}${sortBtn('used', 'Most used')}</div>
    </div>
    <div class="tg-az">${az}</div>
    <div class="tg-used"><div class="tg-chips">${used.map(chip).join('')}</div></div>
    <p class="tg-none" hidden>No tags match.</p>
  </div>` };
}
