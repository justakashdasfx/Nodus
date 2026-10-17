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
        control = `<div class="seg seg--field" role="group">${(f.options || []).map((o, i) =>
          `<button type="button" class="seg__btn ${(f.value ? f.value === o : i === 0) ? 'is-on' : ''}"${dis}>${escapeHtml(o)}</button>`).join('')}</div>`;
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
    formEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA') { e.preventDefault(); formEl.requestSubmit(); }
    });
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {};
      for (const f of fields) {
        if (!f.name || f.disabled) continue;
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
