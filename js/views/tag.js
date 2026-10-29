/* TAG — every block that carries one tag, across all notes. It is the simplest thread (the rule "tag = x");
   "Save as thread" turns it into a saved one you can add words and keywords to. */
import * as store from '../core/store.js';
import { tagHue } from '../core/utils.js';
import { button, viewHead, emptyState } from '../ui/components.js';
import { blockRows } from './blocklist.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function render({ id }) {
  const tag = String(id || '').toLowerCase();
  const hits = store.blocksWithTag(tag);
  const notes = new Set(hits.map(h => h.note.id)).size;
  const titleStyle = `--tag-h:${tagHue(tag)}`; // coloured like the tag everywhere else

  if (!hits.length) {
    return { html: `<div class="view">${viewHead({ title: '#' + tag, titleStyle })}${emptyState({
      title: 'No blocks with this tag',
      text: 'Type #' + tag + ' and a space in any block to tag it.', art: 'tags',
      actionHtml: '<a class="btn btn--solid" href="#/home"><span class="btn__label">Back to Home</span></a>',
    })}</div>` };
  }

  const save = button({ action: 'thread-from-tag', iconName: 'threads', label: 'Save as thread', data: { tag }, title: 'Keep this as a thread you can add more rules to' });
  return { html: `<div class="view">${viewHead({ title: '#' + tag, titleStyle, subtitle: `${plural(hits.length, 'block', 'blocks')} in ${plural(notes, 'note', 'notes')}`, actions: save })}<div class="list">${blockRows(hits)}</div></div>` };
}
