import { esc } from './util.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function toast(msg, type = '') {
  const root = document.getElementById('toast-root');
  const t = el(`<div class="toast ${esc(type)}">${esc(msg)}</div>`);
  root.append(t);
  setTimeout(() => t.remove(), 3800);
}

export function confirmDialog({ title, body, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = el(`<div class="modal-backdrop"></div>`);
    const modal = el(`<div class="modal">
      <h3>${esc(title)}</h3>
      <div>${body}</div>
      <div class="modal-actions">
        <button class="btn" data-act="cancel">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(confirmLabel)}</button>
      </div>
    </div>`);
    backdrop.append(modal);
    root.append(backdrop);
    const close = (val) => { backdrop.remove(); resolve(val); };
    modal.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    modal.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
  });
}

export function promptDialog({ title, label, value = '', placeholder = '', inputType = 'text' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = el(`<div class="modal-backdrop"></div>`);
    const modal = el(`<div class="modal">
      <h3>${esc(title)}</h3>
      <label class="fld"><span>${esc(label)}</span>
        <input type="${esc(inputType)}" value="${esc(value)}" placeholder="${esc(placeholder)}">
      </label>
      <div class="modal-actions">
        <button class="btn" data-act="cancel">Annuler</button>
        <button class="btn primary" data-act="ok">Valider</button>
      </div>
    </div>`);
    backdrop.append(modal);
    root.append(backdrop);
    const input = modal.querySelector('input');
    input.focus(); input.select();
    const close = (val) => { backdrop.remove(); resolve(val); };
    modal.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value));
    modal.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); });
  });
}

export function field(label, input, { hint = '', required = false } = {}) {
  return h('label', { class: 'fld' },
    h('span', {}, label, required ? h('span', { class: 'req' }, ' *') : null),
    input,
    hint ? h('div', { class: 'hint' }, hint) : null
  );
}

export function textInput(value = '', attrs = {}) {
  return h('input', { type: 'text', value, ...attrs });
}
export function numInput(value = '', attrs = {}) {
  return h('input', { type: 'number', step: 'any', value, ...attrs });
}
export function dateInput(value = '') { return h('input', { type: 'date', value }); }
export function timeInput(value = '') { return h('input', { type: 'time', value }); }
export function textarea(value = '', attrs = {}) {
  const t = h('textarea', attrs);
  t.value = value;
  return t;
}
export function select(options, value = '', attrs = {}) {
  const s = h('select', attrs);
  for (const o of options) {
    const opt = h('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    s.append(opt);
  }
  return s;
}

export function chipStatut(statut, labels) {
  if (!statut) return '';
  return `<span class="chip ${esc(statut)}">${esc(labels[statut] || statut)}</span>`;
}

/* Champ texte avec bouton microphone (dictée vocale hors ligne). */
export function micField({ value = '', placeholder = '', onText, multiline = true, voice }) {
  const input = multiline ? textarea(value, { placeholder }) : textInput(value, { placeholder });
  const mic = h('button', { class: 'mic-btn', type: 'button', title: 'Dictée vocale (hors connexion)' }, '🎙️');
  const live = h('div', { class: 'dictation-live' });
  const wrap = h('div', {}, h('div', { class: 'field-with-mic' }, input, mic), live);
  const apply = (txt) => {
    if (!txt) return;
    const sep = input.value && !/[.!?\s]$/.test(input.value) ? ' ' : '';
    input.value = (input.value ? input.value.replace(/\s+$/, '') + sep : '') + txt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (onText) onText(input.value);
  };
  mic.addEventListener('click', async () => {
    if (!voice) { toast("Module vocal indisponible.", 'err'); return; }
    if (mic.classList.contains('recording')) { voice.stop(); return; }
    mic.classList.add('recording');
    live.textContent = 'Chargement du moteur vocal hors ligne…';
    try {
      await voice.start({
        onPartial: (t) => { live.textContent = t; },
        onResult: (t) => { live.textContent = ''; apply(t); },
        onEnd: () => { mic.classList.remove('recording'); live.textContent = ''; },
        onError: (e) => { mic.classList.remove('recording'); live.textContent = ''; toast('Dictée : ' + e, 'err'); },
      });
      live.textContent = 'Écoute en cours — parlez…';
    } catch (e) {
      mic.classList.remove('recording'); live.textContent = '';
      toast('Dictée : ' + (e.message || e), 'err');
    }
  });
  return wrap;
}
