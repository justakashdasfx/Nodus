/* MIND MAPS — every map as a card (Gallery) or a row (List), with New map. The map itself is js/views/map.js.
   A card shows a small drawing of the map (js/maps/thumb.js). Maps that sit in a notebook show its name. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { countNodes } from '../maps/model.js';
import { thumbSvg } from '../maps/thumb.js';
import { button, viewHead, gallery, viewSwitch, emptyState } from '../ui/components.js';

const folderName = (m) => (m.folderId ? store.getFolder(m.folderId)?.name : '') || '';

function mapCard(m) {
  const folder = folderName(m);
  return `<a class="g-card g-card--map" href="#/map/${m.id}">
    <div class="g-card__preview mm-thumb" data-mm-theme="${escapeHtml(m.map.theme || 'colored')}">${thumbSvg(m.map)}</div>
    <div class="g-card__meta">
      <span class="g-card__titlerow">${icon('mindmap', 16)}<span class="g-card__title">${escapeHtml(m.title || 'Untitled map')}</span></span>
      <span class="g-card__sub"><span>${formatDate(m.updatedAt)}</span>${folder ? `<span class="g-card__folder">${icon('folder', 12)}${escapeHtml(folder)}</span>` : ''}</span>
    </div>
  </a>`;
}

function mapList(maps) {
  return `<div class="list">${maps.map((m) => {
    const folder = folderName(m);
    return `<a class="lrow lrow--note" href="#/map/${m.id}">
      <span class="lrow__lead">${icon('mindmap', 16)}</span>
      <span class="lrow__main"><span class="lrow__title">${escapeHtml(m.title || 'Untitled map')}</span></span>
      <span class="lrow__meta">${folder ? `<span class="row__where">${icon('folder', 12)}${escapeHtml(folder)}</span>` : ''}<span>${countNodes(m.map)} nodes</span><span>${formatDate(m.updatedAt)}</span></span>
    </a>`;
  }).join('')}</div>`;
}

export function render() {
  const maps = store.maps();
  const style = settings.getViewStyle('maps');
  const add = button({ action: 'map-new', iconName: 'plus', label: 'New map', variant: 'button' });
  const fromTemplate = button({ action: 'map-template-pick', iconName: 'copy', label: 'From template' });
  const body = maps.length
    ? (style === 'list' ? mapList(maps) : gallery(maps.map(mapCard)))
    : emptyState({ title: 'No mind maps yet', text: 'Press Enter for a node beside, Tab for a branch under it. Everything else follows.', actionHtml: add });
  const subtitle = maps.length ? `${maps.length} ${maps.length === 1 ? 'map' : 'maps'}` : '';
  return { html: `<div class="view">${viewHead({ title: 'Mind maps', subtitle, actions: (maps.length ? viewSwitch(style, { page: 'maps' }) : '') + fromTemplate + add })}${body}</div>` };
}
