/* ============================================================================
   VENDOR — loads the two third-party libraries only when a code block needs them.
     • Prism    (vendor/prism.min.js)       → splits code into coloured pieces (see js/editor/code-block.js)
     • Prettier (vendor/prettier/*.js)      → the Format button
   Both are plain files in the vendor/ folder (licences next to them). The service worker keeps a copy after the
   first use, so code blocks colour and format offline too.
   Languages: js/core/config.js → code.languages.
   ========================================================================== */

import { CONFIG } from './config.js';

const loaded = new Map();

export function loadScript(src) {
  if (loaded.has(src)) return loaded.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
  loaded.set(src, p);
  p.catch(() => loaded.delete(src)); // a failed load can be tried again
  return p;
}

/* ---- Colouring ---- */

/** Our language id → Prism's grammar name. A language missing here gets no colours. */
export const PRISM_NAME = { js: 'javascript', ts: 'typescript', json: 'json', html: 'markup', css: 'css', python: 'python', bash: 'bash', sql: 'sql', markdown: 'markdown', yaml: 'yaml' };

export async function loadPrism() {
  await loadScript('/vendor/prism.min.js');
  return window.Prism;
}

/* ---- Formatting (Prettier supports these; other languages simply get no Format button) ---- */

const PRETTIER = {
  js:       { parser: 'babel',    plugins: ['babel', 'estree'] },
  ts:       { parser: 'babel-ts', plugins: ['babel', 'estree'] },
  json:     { parser: 'json',     plugins: ['babel', 'estree'] },
  css:      { parser: 'css',      plugins: ['postcss'] },
  html:     { parser: 'html',     plugins: ['html'] },
  markdown: { parser: 'markdown', plugins: ['markdown'] },
  yaml:     { parser: 'yaml',     plugins: ['yaml'] },
};

export const canFormat = (lang) => lang in PRETTIER;

export async function formatCode(lang, text) {
  const spec = PRETTIER[lang];
  if (!spec) throw new Error('There is no formatter for this language');
  await loadScript('/vendor/prettier/standalone.js');
  await Promise.all(spec.plugins.map((n) => loadScript(`/vendor/prettier/${n}.js`)));
  const prettier = window.prettier || globalThis.prettier;
  const plugins = spec.plugins.map((n) => window.prettierPlugins[n]);
  return prettier.format(text, { parser: spec.parser, plugins, tabWidth: CONFIG.code.tabSize, ...CONFIG.code.prettier });
}

/* ---- A quick guess at the language of pasted code (only used for a new, empty block) ---- */

export function guessLanguage(text) {
  const t = text.trim();
  if (!t) return 'plain';
  if (/^[[{]/.test(t)) { try { JSON.parse(t); return 'json'; } catch { /* not JSON */ } }
  if (/^<!doctype html|^<html|^<(div|span|body|head|section|ul|p|a|main|header|footer)\b/i.test(t)) return 'html';
  if (/^(#!\/bin\/(ba)?sh|\$ |sudo |apt |npm |git |cd |ls |echo |curl |chmod |mkdir )/m.test(t)) return 'bash';
  if (/^\s*(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE|WITH)\b/i.test(t)) return 'sql';
  if (/^\s*(def |class \w+(\(|:)|import \w+|from \w+ import|print\()/m.test(t) && !/[;{}]\s*$/m.test(t)) return 'python';
  if (/(^|\n)\s*(const|let|var|function|import|export|class)\b|=>|console\.log/.test(t)) return /:\s*(string|number|boolean)\b|interface\s+\w+/.test(t) ? 'ts' : 'js';
  if (/^[\w.#:[\]*>~+ ,-]+\s*\{[^}]*:[^}]*\}/m.test(t) || /@media|@import/.test(t)) return 'css';
  if (t.split('\n').length > 1 && /^\s*[\w-]+:(\s+\S.*)?$/m.test(t) && !/[{};]/.test(t)) return 'yaml';
  return 'plain';
}
