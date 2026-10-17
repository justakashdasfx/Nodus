/* ============================================================================
   CONFIG — every constant you might want to tweak lives here.
   Colours themselves are defined in css/tokens.css; this file only lists ids.
   ========================================================================== */

export const CONFIG = {
  appName: 'Nodus',

  /* ---- Server endpoints (Vercel serverless functions in /api) ---- */
  api: {
    notes: '/api/notes',
    folders: '/api/folders',
    threads: '/api/threads',
  },

  /* ---- localStorage keys (all per-device) ---- */
  storage: {
    cache: 'notes.cache.v1',        // local copy of all notes (offline-first)
    syncKey: 'notes.syncKey',       // the key you type once per device
    theme: 'notes.theme',           // 'dark' | 'light'
    font: 'notes.font',             // 'sans' | 'mono'
    sidebar: 'notes.sidebar',       // 'open' | 'closed'
    expanded: 'notes.expandedFolders',
    lastHighlight: 'notes.lastHighlight',
    lastTextColor: 'notes.lastTextColor',
    keyPrompted: 'notes.keyPrompted', // the sync-key dialog is only auto-shown once
    topbar: 'notes.topbar',         // 'hidden' when the top bar is switched off
    pane: 'notes.paneWidth',        // width of the side pane, as a fraction of the card (0.5 = half)
  },

  /* ---- Timing (milliseconds) ---- */
  timing: {
    saveDebounce: 600,   // typing pause before the note is saved locally
    pushDebounce: 1200,  // pause before changes are pushed to the server
    pollInterval: 45000, // how often to check the server for changes
  },

  /* ---- Defaults ---- */
  defaults: {
    theme: 'dark',
    font: 'sans',
    /* How strongly non-active paragraphs are muted while writing:
         'subtle' → inactive paragraphs a little dimmer (matches your screenshots)
         'strict' → inactive paragraphs clearly dimmed (focus mode)
         'off'    → no active-paragraph effect                                   */
    focusMode: 'subtle',
    highlight: 'blue',
    textColor: 'blue',
  },

  /* ---- Keyboard shortcuts — edit combos here. Format: Mod+Shift+1 (Mod = Ctrl or Cmd) ----
     Note: on layouts where "/" needs Shift (e.g. German), Mod+/ and Mod+Shift+/ collide — remap here. */
  shortcuts: {
    'sidebar.toggle':        'Mod+/',
    'select.all':            'Mod+A',       // selects the text of the block you are in
    'topbar.toggle':         'Mod+Shift+/',
    'focus.toggle':          'Mod+Alt+/',   // on some European layouts Ctrl+Alt = AltGr — remap here if it clashes
    'search.open':           'Mod+K',       // label only for now; the search itself comes later
    'block.text':            'Mod+Shift+0',
    'block.h1':              'Mod+Shift+1',
    'block.h2':              'Mod+Shift+2',
    'block.h3':              'Mod+Shift+3',
    'block.h4':              'Mod+Shift+4',
    'list.bullet':           'Mod+Shift+5',
    'list.number':           'Mod+Shift+6',
    'list.todo':             'Mod+Shift+7',
    'block.moveUp':          'Alt+Shift+ArrowUp',     // move the block you're in (also Mod+Shift+↑ below)
    'block.moveDown':        'Alt+Shift+ArrowDown',
    'block.moveUp.alt':      'Mod+Shift+ArrowUp',
    'block.moveDown.alt':    'Mod+Shift+ArrowDown',
    'edit.undo':             'Mod+Z',
    'edit.redo':             'Mod+Shift+Z',
    'edit.redo.alt':         'Mod+Y',
    'format.code':           'Mod+E',
    'format.lastHighlight':  'Mod+Shift+H',
  },

  /* ---- Side pane (the second panel beside the page) ----
     Look: css/tokens.css → --pane-min, --pane-divider-*, --block-target-bg. */
  pane: {
    defaultWidth: 0.5,   // share of the card the pane takes at first, and after a double-click on the divider
    keyStep: 0.02,       // ←/→ on the focused divider moves it by this much
  },

  /* ---- Ctrl+A ---- */
  selectAll: {
    expand: true, // first Ctrl+A selects the block you are in; pressing it again selects the whole note (set false to never)
  },

  /* ---- Editor info shown in the top bar ---- */
  reading: {
    wpm: 200, // words per minute used for "min read"
  },

  /* ---- Tags: where they sit (look and colours: css/tokens.css → --tag-*, --rail-*) ---- */
  tags: {
    align: 'center',   // wide layout, vertical position in the margin: 'center' (middle of the block), 'top' (level with its first line) or 'bottom'
    topOffset: 3,      // px below the block's top when align is 'top'
    inlineGap: 10,     // narrow layout: px between the last word and its tags
  },

  /* ---- Gallery ---- */
  gallery: {
    previewMaxBlocks: 10, // how many blocks of a note are shown in its card
  },

  /* ---- Colour palette ids (values: css/tokens.css → --hl-<id>-bg / --hl-<id>-fg) ---- */
  /* ---- The block menu: one list, used by the six-dot menu, the "/" menu and the selection toolbar's "…" ----
     [kind, label, shortcut name (from `shortcuts` above, or '' for none), extra words the "/" menu also searches] */
  blockTypes: [
    ['p',     'Text',          'block.text',  'paragraph plain normal'],
    ['h1',    'Heading 1',     'block.h1',    'title big h1'],
    ['h2',    'Heading 2',     'block.h2',    'h2 subtitle'],
    ['h3',    'Heading 3',     'block.h3',    'h3'],
    ['h4',    'Heading 4',     'block.h4',    'h4 small'],
    ['ul',    'Bulleted list', 'list.bullet', 'bullets unordered ul'],
    ['ol',    'Numbered list', 'list.number', 'numbers ordered ol'],
    ['todo',  'Checklist',     'list.todo',   'todo task check checkbox'],
    ['quote', 'Quote',         '',            'blockquote citation'],
  ],

  /* ---- The (i) button in the top bar opens this. Edit the words freely — it is all plain text.
     Each row is [label, text]. ---- */
  about: {
    title: 'About Nodus',
    tagline: 'A quiet place to write, tag and gather your thoughts.',
    rows: [
      ['Created by',      'Your name here (dummy text — replace in js/core/config.js → about)'],
      ['How it was made', 'Designed and built step by step, one phase at a time, with plain HTML, CSS and JavaScript. No frameworks, so every part stays readable.'],
      ['Why it exists',   'Most note apps do too much. This one keeps writing calm: blocks, tags and threads, and nothing in the way.'],
      ['Built with',      'Claude (add the model name here) · Vercel · a small sync service'],
      ['Version',         '1.0.0 · Phase 5'],
      ['Released',        'October 2026'],
      ['Contact',         'hello@example.com'],
    ],
  },

  colors: [
    { id: 'blue',   label: 'Blue' },
    { id: 'green',  label: 'Green' },
    { id: 'yellow', label: 'Yellow' },
    { id: 'orange', label: 'Orange' },
    { id: 'pink',   label: 'Pink' },
    { id: 'purple', label: 'Purple' },
  ],
};
