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
    prefs: '/api/prefs',            // small synced preferences (recent searches)
  },

  /* ---- localStorage keys (all per-device) ---- */
  storage: {
    cache: 'notes.cache.v1',        // local copy of all notes (offline-first)
    syncKey: 'notes.syncKey',       // the key you type once per device
    theme: 'notes.theme',           // 'dark' | 'light'
    font: 'notes.font',             // (old) global font — fonts are per note now, see note.font
    stats: 'notes.statsMode',       // 'words' | 'chars' — what the top bar's count shows
    pinned: 'notes.pinnedOpen',     // is the sidebar's Pinned section open?
    sidebar: 'notes.sidebar',       // 'open' | 'closed'
    expanded: 'notes.expandedFolders',
    lastHighlight: 'notes.lastHighlight',
    lastTextColor: 'notes.lastTextColor',
    keyPrompted: 'notes.keyPrompted', // the sync-key dialog is only auto-shown once
    topbar: 'notes.topbar',         // 'hidden' when the top bar is switched off
    pane: 'notes.paneWidth',        // width of the side pane, as a fraction of the card (0.5 = half)
    prefs: 'notes.prefs',           // recent searches (also synced, see js/core/prefs.js)
    views: 'notes.viewStyles',      // Gallery or List for each page, on this device
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
    mode: 'edit',        // a note without its own choice opens in 'edit' (Write) or 'read' — each note remembers its own
    noteFont: 'sans',    // font of a note that has none chosen: 'sans' | 'mono' | 'serif'
    statsMode: 'words',  // the top bar count: 'words' or 'chars'
    views: {             // Gallery or List until you choose (a notebook keeps its own choice, set in its Edit dialog)
      home: 'gallery', inbox: 'gallery', notebooks: 'gallery', notebook: 'gallery', journal: 'list',
    },
    /* How strongly non-active paragraphs are muted while writing:
         'subtle' → inactive paragraphs a little dimmer (matches your screenshots)
         'strict' → inactive paragraphs clearly dimmed (focus mode)
         'off'    → no active-paragraph effect                                   */
    focusMode: 'subtle',
    highlight: 'blue',
    textColor: 'blue',
  },

  /* ---- Notebook page: ways to sort the notes ([id, label]); the first is the default ---- */
  notebookSorts: [['edited', 'Last edited'], ['created', 'Date created'], ['name', 'Name (A–Z)']],

  /* ---- Keyboard shortcuts — edit combos here. Format: Mod+Shift+1 (Mod = Ctrl or Cmd) ----
     Note: on layouts where "/" needs Shift (e.g. German), Mod+/ and Mod+Shift+/ collide — remap here. */
  shortcuts: {
    'sidebar.toggle':        'Mod+/',
    'select.all':            'Mod+A',       // selects the text of the block you are in
    'topbar.toggle':         'Mod+Shift+/',
    'mode.toggle':           'Mod+Shift+E', // Write ⇄ Read
    'note.new':              'Mod+N',       // new note in the Inbox (browsers keep Ctrl+N for a new window; it works in the installed app)
    'journal.today':         'Mod+Shift+D', // open today's entry, created if needed
    'save.now':              'Mod+S',       // save this note right now
    'find.open':             'Mod+F',       // find in this note
    'focus.toggle':          'Mod+Alt+/',   // on some European layouts Ctrl+Alt = AltGr — remap here if it clashes
    'search.open':           'Mod+K',       // the search window (also the sidebar's Search box)
    'search.open.p':         'Mod+P',       // …same window. Overrides the browser's Print
    'search.open.k':         'Mod+Shift+K', // …same window (Firefox keeps this one for its own tools)
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
    'task.due':              'Mod+Shift+D', // in a checklist item: change or remove its due date
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

  /* ---- Code blocks (js/editor/code-block.js). Colours: css/tokens.css → section 9 ---- */
  code: {
    tabSize: 2,                  // spaces per Tab, and the width Prettier formats to
    defaultLang: 'plain',        // language of a new block until you (or a paste) choose
    languages: [                 // [id, name shown in the dropdown] — colours need the id in js/core/vendor.js → PRISM_NAME, Format needs it in PRETTIER
      ['plain', 'Plain text'], ['js', 'JavaScript'], ['ts', 'TypeScript'], ['json', 'JSON'], ['html', 'HTML'], ['css', 'CSS'],
      ['python', 'Python'], ['bash', 'Bash'], ['sql', 'SQL'], ['markdown', 'Markdown'], ['yaml', 'YAML'],
    ],
    prettier: { semi: true, singleQuote: true, printWidth: 80, trailingComma: 'es5' }, // how the Format button writes code
  },

  /* ---- Search window (js/ui/search.js, engine js/core/search.js). Look: css/tokens.css → section 10 ---- */
  search: {
    shortcuts: ['search.open', 'search.open.p', 'search.open.k'], // names from `shortcuts` above that open the window
    placeholder: 'Search notes, blocks, tags… or type a command',
    typo: [[4, 1], [8, 2]],   // [word length from, typos forgiven]: 4+ letters → 1 typo, 8+ letters → 2 typos. [[99, 0]] = no typo tolerance
    fuzzyBelow: 8,            // typos are only forgiven when fewer results than this were found without them
    recentMax: 8,             // recent searches kept (they sync between devices)
    typeDelay: 50,            // ms after the last keystroke before results update
    limits: { commands: 5, notes: 6, blocks: 6, tags: 4, notebooks: 4, threads: 4 }, // results shown per group
    emptyCommands: ['note.new', 'journal.today', 'go.inbox', 'go.threads', 'theme.toggle', 'sidebar.toggle'], // shown under Recent in an empty box
  },

  /* ---- Tasks (js/views/tasks.js, js/core/tasks.js). Look: css/tokens.css → section 17 ----
     Dates are typed in a checklist item with "@" (js/editor/due.js). */
  tasks: {
    doneDays: 30,   // the Done group shows tasks from notes changed in the last N days
    doneMax: 50,    // …and at most this many
  },

  /* ---- Templates: the built-in ones in "New from template". Edit freely; add your own by copying a block.
     html: the note as editor HTML — <h1> title, <h2> headings, <p>, <ul> / <ol>, and <ul data-type="todo"> with <li data-check="false"> for checklists.
     "{date}" becomes today's date. Your own templates: ⋯ menu → Save as template. ---- */
  templates: [
    { id: 'meeting', name: 'Meeting', about: 'Attendees, agenda, notes, action items',
      html: '<h1>Meeting notes</h1><p>{date}</p><h2>Attendees</h2><ul><li><br></li></ul><h2>Agenda</h2><ul><li><br></li></ul><h2>Notes</h2><p><br></p><h2>Action items</h2><ul data-type="todo"><li data-check="false"><br></li></ul>' },
    { id: 'weekly', name: 'Weekly review', about: 'Wins, lessons, next week',
      html: '<h1>Weekly review</h1><p>{date}</p><h2>Wins</h2><ul><li><br></li></ul><h2>What did not go well</h2><ul><li><br></li></ul><h2>Lessons</h2><p><br></p><h2>Next week</h2><ul data-type="todo"><li data-check="false"><br></li><li data-check="false"><br></li><li data-check="false"><br></li></ul>' },
    { id: 'daily', name: 'Daily page', about: 'Top three, schedule, notes',
      html: '<h1>{date}</h1><h2>Top three</h2><ul data-type="todo"><li data-check="false"><br></li><li data-check="false"><br></li><li data-check="false"><br></li></ul><h2>Schedule</h2><p><br></p><h2>Notes</h2><p><br></p><h2>End of day</h2><p><br></p>' },
  ],

  /* ---- Commands in the search window ----
     id · label (shown) · words (extra words it is found by) · kind: 'action' (a data-action name from js/app.js), 'go' (a page address)
     or 'event' (a command app.js listens for) · target · icon (name from js/core/icons.js) · key (a name from `shortcuts`, shown as a hint)
     · needs: 'note' (only offered while a note is open) */
  commands: [
    { id: 'note.new',       label: 'New note',            words: 'create add write',            kind: 'action', target: 'note-new',       icon: 'plus' },
    { id: 'journal.today',  label: "Open today's journal", words: 'daily diary entry',          kind: 'action', target: 'journal-today',  icon: 'journal' },
    { id: 'notebook.new',   label: 'New notebook',        words: 'create add folder',           kind: 'action', target: 'notebook-new',   icon: 'folder' },
    { id: 'thread.new',     label: 'New thread',          words: 'create add filter live',      kind: 'action', target: 'thread-new',     icon: 'threads' },
    { id: 'go.home',        label: 'Go to Home',          words: 'open recent',                 kind: 'go',     target: '#/home',         icon: 'home' },
    { id: 'go.inbox',       label: 'Go to Inbox',         words: 'open unfiled',                kind: 'go',     target: '#/inbox',        icon: 'inbox' },
    { id: 'go.journal',     label: 'Go to Journal',       words: 'open diary',                  kind: 'go',     target: '#/journal',      icon: 'journal' },
    { id: 'go.notebooks',   label: 'Go to Notebooks',     words: 'open folders',                kind: 'go',     target: '#/notebooks',    icon: 'notebooks' },
    { id: 'go.threads',     label: 'Go to Threads',       words: 'open filters',                kind: 'go',     target: '#/threads',      icon: 'threads' },
    { id: 'go.tasks',       label: 'Go to Tasks',         words: 'open todo due checklist',     kind: 'go',     target: '#/tasks',        icon: 'tasks' },
    { id: 'template.pick',  label: 'New from template…',  words: 'create note meeting weekly daily', kind: 'action', target: 'template-pick', icon: 'copy' },
    { id: 'go.trash',       label: 'Go to Trash',         words: 'open deleted bin',            kind: 'go',     target: '#/trash',        icon: 'trash' },
    { id: 'theme.toggle',   label: 'Toggle theme',        words: 'dark light mode appearance',  kind: 'action', target: 'theme-toggle',   icon: 'sun' },
    { id: 'sidebar.toggle', label: 'Toggle sidebar',      words: 'show hide menu',              kind: 'action', target: 'sidebar-toggle', icon: 'menu',   key: 'sidebar.toggle' },
    { id: 'topbar.toggle',  label: 'Toggle top bar',      words: 'show hide header',            kind: 'event',  target: 'topbar-toggle',  icon: 'menu',   key: 'topbar.toggle' },
    { id: 'focus.toggle',   label: 'Toggle focus mode',   words: 'distraction free zen',        kind: 'event',  target: 'focus-toggle',   icon: 'pencil', key: 'focus.toggle' },
    { id: 'mode.toggle',    label: 'Switch Write / Read', words: 'edit mode reading',           kind: 'event',  target: 'mode-toggle',    icon: 'pencil', key: 'mode.toggle', needs: 'note' },
    { id: 'import',         label: 'Import a text file',  words: 'upload open markdown',        kind: 'action', target: 'import-text',    icon: 'upload' },
    { id: 'download.all',   label: 'Download all notes',  words: 'export backup json',          kind: 'action', target: 'download-all',   icon: 'download' },
    { id: 'sync.key',       label: 'Sync key',            words: 'sync settings password',      kind: 'action', target: 'sync-key',       icon: 'clock' },
    { id: 'about',          label: 'About',               words: 'info version',                kind: 'action', target: 'about-open',     icon: 'info' },
  ],

  /* ---- Gallery ---- */
  gallery: {
    previewMaxBlocks: 10, // how many blocks of a note are shown in its card
  },

  /* ---- Colour palette ids (values: css/tokens.css → --hl-<id>-bg / --hl-<id>-fg) ---- */
  /* ---- The block menu: one list, used by the six-dot menu, the "/" menu and the selection toolbar's "…" ----
     [kind, label, shortcut name (from `shortcuts` above, or '' for none), extra words the "/" menu also searches] */
  blockTypes: [   // [id, label, shortcut key, search words, icon file name in /icons-ui/]
    ['p',     'Text',          'block.text',  'paragraph plain normal', 'text'],
    ['h1',    'Heading 1',     'block.h1',    'title big h1', 'h1'],
    ['h2',    'Heading 2',     'block.h2',    'h2 subtitle', 'h2'],
    ['h3',    'Heading 3',     'block.h3',    'h3', 'h3'],
    ['h4',    'Heading 4',     'block.h4',    'h4 small', 'h4'],
    ['ul',    'Bulleted list', 'list.bullet', 'bullets unordered ul', 'bullets'],
    ['ol',    'Numbered list', 'list.number', 'numbers ordered ol', 'numbers'],
    ['todo',  'Checklist',     'list.todo',   'todo task check checkbox', 'checklists'],
    ['task',  'Task',          '',            'tasks todo due date action item reminder', 'tasks'],
    ['quote', 'Quote',         '',            'blockquote citation', 'quote'],
    ['code',  'Code Block',          '',            'snippet pre monospace programming', 'code-block'],
    ['divider', 'Divider',     '',            'line rule separator hr horizontal', 'divider'],
    ['callout', 'Callout',     '',            'note tip info box highlight alert', 'callout'],
    ['toggle',  'Toggle',      '',            'collapsible details fold accordion expand', 'toggle'],
    ['thread',  'Threads',     '',            'thread gather collect tag rule search board', 'threads'],
  ],

  /* ---- The (i) button in the top bar opens this. Edit the words freely — it is all plain text.
     Each row is [label, text]. ---- */
  about: {
    title: 'About Notes',
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
