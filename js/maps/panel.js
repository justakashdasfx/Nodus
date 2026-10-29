/* ============================================================================
   MAP PANEL — the floating icon bar on the right and the little panels it opens (Text · Color · Node · Map).
   Markup of the bar: js/views/map.js. Styling: css/maps.css section 7. The engine gives this file an `api` (see js/maps/engine.js).

   Text panel : bold · italic · underline · clear · bullets / numbers / checklist · coloured text · coloured text with background.
                With a node selected (not being typed in) it formats the whole node; while typing it formats the selected words.
   Color panel: Fill and Border switch on and off by clicking; the colour is one of your pastels, or Auto (the branch's colour).
                These change the selected nodes. "Apply to level N" copies the selected node's style to every node of that level,
                and to the ones you add later.
   ========================================================================== */

import { icon } from '../core/icons.js';
import { MAPS, THEMES, LINES, LAYOUTS, SHAPES } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hasFill = (k) => k === 'both' || k === 'fill';
const hasBorder = (k) => k === 'both' || k === 'border';
const kindOf = (fill, border) => (fill && border ? 'both' : fill ? 'fill' : border ? 'border' : 'none');

export function mountPanel(root, api) {
  const bar = root.querySelector('.mm__bar');
  const panel = root.querySelector('.mm__panel');
  let open = null;                 // 'text' | 'color' | 'node' | 'map' | null
  let level = 1;                   // the level "Apply to level" will use (starts as the level of the selected node)
  let lastSel = null;

  const chips = (key, list, current) => `<div class="mm-chips">${list.map(([v, label]) =>
    `<button type="button" class="mm-chip mm-chip--text${current === v ? ' is-on' : ''}" data-opt="${key}" data-v="${v}">${label}</button>`).join('')}</div>`;
  const swatchRow = (attr, current) => Array.from({ length: MAPS.palette }, (_, i) =>
    `<button type="button" class="mm-sw${current === i ? ' is-on' : ''}" ${attr}="${i}" data-ci="${i}" aria-label="Colour ${i + 1}"></button>`).join('');

  /* ---------- Text ---------- */
  function textHtml() {
    const btn = (fmt, name, label) => `<button type="button" class="mm-tool" data-fmt="${fmt}" title="${label}" aria-label="${label}">${icon(name, 18)}</button>`;
    const tsw = (attr, i, tb) => `<button type="button" class="mm-tsw${tb ? ' mm-tsw--bg' : ''}" ${attr}="${i}" data-ci="${i}" aria-label="Colour ${i + 1}">A</button>`;
    return `
      <p class="mm-panel__label">Format</p>
      <div class="mm-tools">${btn('bold', 'bold', 'Bold')}${btn('italic', 'italic', 'Italic')}${btn('underline', 'underline', 'Underline')}${btn('clear', 'clear', 'Clear formatting')}</div>
      <p class="mm-panel__label">List</p>
      <div class="mm-tools">${btn('ul', 'bullets', 'Bullets')}${btn('ol', 'numbers', 'Numbers')}${btn('todo', 'checklists', 'Checklist')}</div>
      <p class="mm-panel__label">Text color</p>
      <div class="mm-swatches mm-swatches--text"><button type="button" class="mm-tsw mm-tsw--default" data-tc="default" title="Default color" aria-label="Default color">A</button>${Array.from({ length: MAPS.palette }, (_, i) => tsw('data-tc', i, false)).join('')}</div>
      <p class="mm-panel__label">Text color with background</p>
      <div class="mm-swatches mm-swatches--text"><button type="button" class="mm-tsw mm-tsw--default" data-tb="default" title="Default color" aria-label="Default color">A</button>${Array.from({ length: MAPS.palette }, (_, i) => tsw('data-tb', i, true)).join('')}</div>
      <p class="mm-panel__note">Select words while typing, or select a node to change all of it. Ctrl+B / I / U work too.</p>`;
  }

  /* ---------- Color ---------- */
  function colorHtml() {
    const sel = api.sel();
    if (sel !== lastSel) { lastSel = sel; if (sel) level = api.levelOf(sel); }
    const st = sel ? api.styleOf(sel) : { k: 'both', c: null, ci: null };
    const pv = (kind) => `<span class="mm-pv mm-pv--${kind}"${st.ci == null ? '' : ` data-ci="${st.ci}"`}><i>Aa</i></span>`;
    const multi = (api.map.lineMode || 'multi') === 'multi';
    const lc = Number.isInteger(api.map.lineColor) ? api.map.lineColor : 0;
    const lineSwatches = `<button type="button" class="mm-sw mm-sw--grey${lc === -1 ? ' is-on' : ''}" data-linecolor="-1" title="Grey" aria-label="Grey"></button>`
      + Array.from({ length: MAPS.palette }, (_, i) => `<button type="button" class="mm-sw${lc === i ? ' is-on' : ''}" data-linecolor="${i}" data-ci="${i}" aria-label="Colour ${i + 1}"></button>`).join('');
    const swatches = `<button type="button" class="mm-sw mm-sw--auto${st.c == null ? ' is-on' : ''}" data-c="auto" title="Auto: follows the branch"></button>` + swatchRow('data-c', st.c);
    return `
      <p class="mm-panel__label">Style</p>
      <div class="mm-chips mm-chips--two">
        <button type="button" class="mm-chip${hasFill(st.k) ? ' is-on' : ''}" data-toggle="fill" title="Fill">${pv('fill')}<span>Fill</span></button>
        <button type="button" class="mm-chip${hasBorder(st.k) ? ' is-on' : ''}" data-toggle="border" title="Border">${pv('border')}<span>Border</span></button>
      </div>
      <p class="mm-panel__label">Color</p>
      <div class="mm-swatches">${swatches}</div>
      <p class="mm-panel__label">Lines</p>
      <button type="button" class="mm-switch-row" role="switch" aria-checked="${multi}" data-lines="toggle"><span>Multicolor lines</span><span class="mm-switch${multi ? ' is-on' : ''}"></span></button>
      ${multi ? '' : `<div class="mm-swatches">${lineSwatches}</div>`}
      <p class="mm-panel__note">${multi ? 'Every main branch has its own color.' : 'Every line has the same color.'}</p>
      <p class="mm-panel__label">Whole level</p>
      <div class="mm-level">
        <button type="button" class="mm-level__step" data-step="-1" aria-label="Previous level">‹</button>
        <button type="button" class="mm-level__apply" data-act="applylevel"${sel ? '' : ' disabled'}>Apply to level ${level}</button>
        <button type="button" class="mm-level__step" data-step="1" aria-label="Next level">›</button>
      </div>
      <p class="mm-panel__note">${sel ? `Copies this node's style to every level ${level} node, and to the ones you add later.` : 'Select a node first.'}</p>`;
  }

  /* ---------- Node ---------- */
  function nodeHtml() {
    const sel = api.sel();
    const n = sel ? api.node(sel) : null;
    const rows = [];
    rows.push(`<p class="mm-panel__label">Shape</p>${chips('shape', SHAPES, api.map.shape || 'round')}`);
    rows.push('<p class="mm-panel__label">Floating</p>');
    rows.push(`<button type="button" class="mm-row" data-act="float">${icon('plus', 16)}<span>New floating node</span></button>`);
    if (n && n.fl) rows.push(`<button type="button" class="mm-row${n.sticky ? ' is-on' : ''}" data-act="sticky">${icon('sticky', 16)}<span>Sticky note look</span></button>`);
    if (n && !n.fl && sel !== api.map.root) rows.push(`<button type="button" class="mm-row" data-act="detach">${icon('mindmap', 16)}<span>Detach to floating</span></button>`);
    rows.push('<p class="mm-panel__note">Pull the small handle under a selected node onto another node to connect them. Alt + drag cuts a node loose.</p>');
    return rows.join('');
  }

  /* ---------- Map ---------- */
  function mapHtml() {
    const m = api.map;
    return `
      <p class="mm-panel__label">Theme</p>${chips('theme', THEMES, m.theme || 'colored')}
      <p class="mm-panel__label">Lines</p>${chips('line', LINES, m.line || 'tapered')}
      <p class="mm-panel__label">Layout</p>${chips('layout', LAYOUTS, m.layout || 'both')}
      <button type="button" class="mm-row" data-act="balance">${icon('mindmap', 16)}<span>Auto balance and tidy</span></button>
      <p class="mm-panel__note">Free: drag any node anywhere and it stays there. Auto balance puts every node back.</p>
      <div class="mm-panel__sep"></div>
      <p class="mm-panel__label">Export</p>
      <div class="mm-chips">
        <button type="button" class="mm-chip mm-chip--text" data-exp="md">Markdown</button>
        <button type="button" class="mm-chip mm-chip--text" data-exp="png">PNG</button>
        <button type="button" class="mm-chip mm-chip--text" data-exp="svg">SVG</button>
      </div>
      <div class="mm-panel__sep"></div>
      <button type="button" class="mm-row" data-action="map-template-save" data-id="${api.noteId}">${icon('copy', 16)}<span>Save as template</span></button>
      <p class="mm-panel__note">Saves the colours, level styles, lines, layout and the map itself.</p>`;
  }

  const BODY = { text: textHtml, color: colorHtml, node: nodeHtml, map: mapHtml };
  const TITLE = { text: 'Text', color: 'Color', node: 'Node', map: 'Map' };

  function refresh() {
    bar.querySelectorAll('[data-bar]').forEach((b) => b.classList.toggle('is-on', b.dataset.bar === open));
    panel.hidden = !open;
    if (!open) return;
    panel.innerHTML = `<p class="mm-panel__title">${TITLE[open]}</p>${BODY[open]()}`;
  }
  function close() { if (open) { open = null; refresh(); } }

  /* Buttons must not take the focus away from the node being typed in, or its selected words would be lost */
  const keepFocus = (e) => { if (e.target.closest('button')) e.preventDefault(); };
  bar.addEventListener('mousedown', keepFocus);
  panel.addEventListener('mousedown', keepFocus);

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bar]');
    if (!b) return;
    const k = b.dataset.bar;
    if (k === 'undo') api.undo();
    else if (k === 'redo') api.redo();
    else { open = open === k ? null : k; refresh(); }
  });

  panel.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-fmt]'))) api.format(b.dataset.fmt);
    else if ((b = t.closest('[data-tc]'))) api.colourText('tc', b.dataset.tc === 'default' ? -1 : Number(b.dataset.tc));
    else if ((b = t.closest('[data-tb]'))) api.colourText('tb', b.dataset.tb === 'default' ? -1 : Number(b.dataset.tb));
    else if ((b = t.closest('[data-toggle]'))) {
      const sel = api.sel();
      const k = sel ? api.styleOf(sel).k : 'both';
      const fill = b.dataset.toggle === 'fill' ? !hasFill(k) : hasFill(k);
      const border = b.dataset.toggle === 'border' ? !hasBorder(k) : hasBorder(k);
      api.applyStyle({ k: kindOf(fill, border) }, 'node');
    }
    else if ((b = t.closest('[data-c]'))) api.applyStyle({ c: b.dataset.c === 'auto' ? null : Number(b.dataset.c) }, 'node');
    else if ((b = t.closest('[data-step]'))) { level = clamp(level + Number(b.dataset.step), 1, 9); refresh(); }
    else if ((b = t.closest('[data-lines]'))) api.setOption('lineMode', (api.map.lineMode || 'multi') === 'multi' ? 'single' : 'multi');
    else if ((b = t.closest('[data-linecolor]'))) api.setOption('lineColor', Number(b.dataset.linecolor));
    else if ((b = t.closest('[data-opt]'))) api.setOption(b.dataset.opt, b.dataset.v);
    else if ((b = t.closest('[data-exp]'))) api.exportAs(b.dataset.exp);
    else if ((b = t.closest('[data-act]'))) {
      const a = b.dataset.act;
      if (a === 'applylevel') api.applyToLevel(level);
      else if (a === 'float') api.addFloat();
      else if (a === 'sticky') api.toggleSticky();
      else if (a === 'detach') api.detach();
      else if (a === 'balance') api.autoBalance();
    }
  });

  refresh();
  return { refresh: () => { if (open) refresh(); }, close, destroy() {} };
}
