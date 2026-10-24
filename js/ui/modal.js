/* ============================================================================
   MODAL — promise-based prompt() and confirm() dialogs.
     const name = await prompt({ title: 'New notebook', label: 'Name' });   // string | null
     const ok   = await confirm({ title: 'Delete?', message: '…', danger: true }); // boolean
   ========================================================================== */

import { escapeHtml } from '../core/utils.js';

function open({ title, message = '', input = null, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__scrim" data-close></div>
      <form class="modal__box" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${message ? `<p class="modal__text">${escapeHtml(message)}</p>` : ''}
        ${input ? `<input class="modal__input" type="${input.type || 'text'}" value="${escapeHtml(input.value || '')}"
                    placeholder="${escapeHtml(input.placeholder || '')}" aria-label="${escapeHtml(input.label || title)}"
                    autocomplete="off" spellcheck="false">` : ''}
        <div class="modal__actions">
          <button type="button" class="btn" data-close>${escapeHtml(cancelLabel)}</button>
          <button type="submit" class="btn btn--solid ${danger ? 'btn--danger' : ''}">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>`;

    const field = wrap.querySelector('.modal__input');
    const close = (value) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(input ? null : false); };

    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(input ? null : false); });
    wrap.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); close(input ? field.value : true); });
    document.addEventListener('keydown', onKey);

    document.getElementById('modal-root').append(wrap);
    (field || wrap.querySelector('[type=submit]')).focus();
    field?.select();
  });
}

/**
 * A dialog with several fields.   const values = await form({ title, fields: [...] })  // object | null
 * Field: { name, label, type: 'text' | 'textarea' | 'select' | 'segmented', value, placeholder, maxlength,
 *          required, options: [...], disabled, hint }
 * Disabled fields are shown but not editable and are left out of the result.
 * In a textarea, Enter adds a new line; Ctrl/Cmd+Enter saves.
 */
export function form({ title, fields = [], confirmLabel = 'Save', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';

    const fieldHtml = (f) => {
      const dis = f.disabled ? ' disabled' : '';
      const name = f.name ? ` name="${escapeHtml(f.name)}"` : '';
      let control = '';
      if (f.type === 'textarea') {
        control = `<textarea class="modal__input modal__textarea"${name}${dis} rows="4" maxlength="${f.maxlength || 500}"
                     placeholder="${escapeHtml(f.placeholder || '')}" spellcheck="true">${escapeHtml(f.value || '')}</textarea>`;
      } else if (f.type === 'select') {
        control = `<select class="modal__input modal__select"${name}${dis}>${(f.options || []).map(o => `<option>${escapeHtml(o)}</option>`).join('')}</select>`;
      } else if (f.type === 'segmented') {
        control = `<div class="seg seg--field" role="group" data-seg="${escapeHtml(f.name || '')}">${(f.options || []).map((o, i) =>
          `<button type="button" class="seg__btn ${(f.value ? f.value === o : i === 0) ? 'is-on' : ''}" data-value="${escapeHtml(o)}"${dis}>${escapeHtml(o)}</button>`).join('')}</div>`;
      } else {
        control = `<input class="modal__input" type="text"${name}${dis} value="${escapeHtml(f.value || '')}"
                     placeholder="${escapeHtml(f.placeholder || '')}" maxlength="${f.maxlength || 120}" autocomplete="off">`;
      }
      return `<label class="modal__field ${f.disabled ? 'is-disabled' : ''}">
        <span class="modal__label">${escapeHtml(f.label || '')}${f.hint ? `<em class="modal__hint">${escapeHtml(f.hint)}</em>` : ''}</span>${control}</label>`;
    };

    wrap.innerHTML = `
      <div class="modal__scrim" data-close></div>
      <form class="modal__box" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${fields.map(fieldHtml).join('')}
        <div class="modal__actions">
          <button type="button" class="btn" data-close>${escapeHtml(cancelLabel)}</button>
          <button type="submit" class="btn btn--solid">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>`;

    const formEl = wrap.querySelector('form');
    const close = (value) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };

    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(null); });
    wrap.addEventListener('click', (e) => {   // a segmented field: the clicked choice turns on
      const b = e.target.closest('.seg--field .seg__btn');
      if (b && !b.disabled) b.parentElement.querySelectorAll('.seg__btn').forEach(x => x.classList.toggle('is-on', x === b));
    });
    formEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') { e.preventDefault(); formEl.requestSubmit(); }
    });
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {};
      for (const f of fields) {
        if (!f.name || f.disabled) continue;
        if (f.type === 'segmented') { values[f.name] = formEl.querySelector(`[data-seg="${f.name}"] .is-on`)?.dataset.value || ''; continue; }
        const control = formEl.elements[f.name];
        values[f.name] = control.value;
        if (f.required && !control.value.trim()) { control.focus(); return; }
      }
      close(values);
    });
    document.addEventListener('keydown', onKey);

    document.getElementById('modal-root').append(wrap);
    const first = formEl.querySelector('input:not([disabled]), textarea:not([disabled])');
    first?.focus();
    first?.select?.();
  });
}

/**
 * A list to choose from.   const res = await pick({ title, sections: [{ label, items: [{ id, label, sub, removable }] }] })
 * → { id } when one is chosen · { remove: id } when its × is pressed (only items with removable) · null when cancelled.
 */
export function pick({ title, sections = [] }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    const row = (it) => `<div class="pick__row"><button type="button" class="pick__item" data-pick="${escapeHtml(it.id)}"><span class="pick__name">${escapeHtml(it.label)}</span>${it.sub ? `<span class="pick__sub">${escapeHtml(it.sub)}</span>` : ''}</button>`
      + `${it.removable ? `<button type="button" class="pick__x" data-remove="${escapeHtml(it.id)}" aria-label="Move ${escapeHtml(it.label)} to Trash" title="Move to Trash">×</button>` : ''}</div>`;
    wrap.innerHTML = `
      <div class="modal__scrim" data-close></div>
      <div class="modal__box modal__box--pick" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${sections.map(s => `<p class="pick__label">${escapeHtml(s.label)}</p>${s.items.map(row).join('')}`).join('')}
        <div class="modal__actions"><button type="button" class="btn" data-close>Cancel</button></div>
      </div>`;
    const close = (value) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(value); };
    const buttons = () => [...wrap.querySelectorAll('.pick__item')];
    const onKey = (e) => {
      if (e.key === 'Escape') { close(null); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const b = buttons();
      const i = b.indexOf(document.activeElement);
      b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus();
    };
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { close(null); return; }
      const x = e.target.closest('[data-remove]');
      if (x) { close({ remove: x.dataset.remove }); return; }
      const p = e.target.closest('[data-pick]');
      if (p) close({ id: p.dataset.pick });
    });
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-root').append(wrap);
    buttons()[0]?.focus();
  });
}

export const prompt  = (opts) => open({ ...opts, input: { type: opts.type, value: opts.value, placeholder: opts.placeholder, label: opts.label } });
export const confirm = (opts) => open(opts);

/** The (i) dialog: a title, a line under it, and rows of [label, text]. Content: js/core/config.js → about. */
export function about({ title = 'About', tagline = '', rows = [] }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__scrim" data-close></div>
      <div class="modal__box modal__box--about" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${tagline ? `<p class="modal__text">${escapeHtml(tagline)}</p>` : ''}
        <dl class="about">${rows.map(([k, v]) => `<div class="about__row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
        <div class="modal__actions"><button type="button" class="btn btn--solid" data-close>Close</button></div>
      </div>`;
    const close = () => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-root').append(wrap);
    wrap.querySelector('.btn--solid').focus();
  });
}
