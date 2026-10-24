# Notes

A minimal personal notes app. Static front end (HTML / CSS / JS modules) plus three tiny
Vercel serverless functions that sync to Upstash Redis with a key you type once per device.

```
notes-app/
├─ index.html                 page shell (only containers + script/style links)
├─ sw.js                      service worker: the app keeps opening offline (network first)
├─ manifest.webmanifest       makes the app installable (name, colours, icons)
├─ icons/                     placeholder app icons — replace the files, keep the names
├─ fonts/                     Geist + Geist Mono (variable, Latin), bundled for offline use
├─ css/
│  ├─ fonts.css               @font-face rules for the bundled fonts
│  ├─ tokens.css              ← START HERE: colours, fonts, sizes, radii, motion
│  ├─ base.css                reset, scrollbars, icon defaults
│  ├─ layout.css              sidebar tree + search box, topbar, the rounded card, focus mode, mobile overlay
│  ├─ components.css          buttons, Sans|Mono switch, sync status, modal
│  ├─ gallery.css             page headers, gallery cards, journal/trash rows
│  └─ editor.css              writing typography, focus effect, selection toolbar
├─ js/
│  ├─ app.js                  wiring: routes, store events, all click actions
│  ├─ core/
│  │  ├─ config.js            constants: timing, defaults, colour ids, storage keys
│  │  ├─ store.js             notes/notebooks data + local-first persistence
│  │  ├─ blockindex.js        block ids, the per-note block index, migration of old notes
│  │  ├─ threads.js           the matching engine for tag pages and threads
│  │  ├─ sync.js              push/pull to the server, sync status
│  │  ├─ settings.js          theme, font, sidebar, last-used colours
│  │  ├─ keys.js              keyboard combo matching (shortcuts live in config.js)
│  │  ├─ router.js            #/home #/notebooks #/notebook/id #/journal #/trash #/note/id
│  │  ├─ actions.js           data-action click delegation
│  │  ├─ icons.js             inline SVG icons (swap by name)
│  │  └─ utils.js             helpers, HTML sanitising, text import/export
│  ├─ ui/                     sidebar.js · topbar.js · components.js · modal.js
│  ├─ views/                  home · notebooks · notebook · journal · trash · note · tag · threads · thread · blocklist
│  └─ editor/                 editor.js · selection-toolbar.js · inline.js · shortcuts.js · blocks.js · normalize.js · history.js · block-handle.js · block-ops.js · tags.js · tag-suggest.js · lists.js · paste.js · focus.js
└─ api/
   ├─ _lib.js                 Redis REST helper + sync-key check
   ├─ notes.js                GET / PUT / DELETE notes
   ├─ folders.js              GET / PUT notebooks
   └─ threads.js              GET / PUT threads
```

## Set up (about 5 minutes)

1. **Database.** In Vercel: Storage → Marketplace → *Upstash* → create a Redis database.
   Connect it to this project. It adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`; both names work).
2. **Sync key.** Project → Settings → Environment Variables → add `SYNC_KEY`
   with a long random value.
3. **Deploy.** Push this folder to a Git repo and import it in Vercel (no build step needed),
   or run `vercel --prod` from the folder.
4. **First open on each device:** paste the sync key when asked. It is stored only on that device.
   Click the status chip (top right) any time to change it.

Local testing needs the API too, so use `vercel dev` (copy `.env.example` to `.env.local`).
Opening `index.html` straight from disk won't work because the app uses ES modules.

**Install / offline.** On the deployed (https) site your browser offers *Install* (address bar or menu). The service worker (`sw.js`)
needs https or `localhost`, so it is active on Vercel and under `vercel dev`, not when opening files from disk.
If you add or rename a JS/CSS file, add it to the `SHELL` list in `sw.js` (and bump `CACHE`) so it is also saved for the first offline load.

## How it behaves

- **Local first.** Everything saves to the browser instantly; the server copy follows a moment later.
  Offline edits are kept and uploaded when you're back online.
- **Sync.** Pushes your changes, then pulls others'. Runs after edits, when the tab regains focus,
  and every 45 seconds. The newest edit of a note wins.
- **Offline.** The app itself (pages, scripts, fonts) is saved by the service worker, so it opens without a connection. It is *network first*: online, you always get the newest deploy; offline (or if the network takes over 4 s), the saved copy is used. The status chip then reads "Offline, will sync when back".
- **Notebooks** have a description (shown under the name) and an Edit panel. Icon and view style are shown there but not active yet.
- **Top bar** shows `words · min read` for the open note (200 words a minute, `reading.wpm` in `config.js`).
- **Blocks.** Every paragraph, heading, quote and list item has a permanent id (`data-bid`). Enter starts a new block with a new id; Shift+Enter adds a line inside the same block. Changing a block's type (text → heading → bullet) keeps its id. Each note stores a small index of its blocks (`note.blocks`: id, type, first 160 characters, tags). Notes written earlier are migrated automatically when the app loads, with ids derived from the note and position, so every device gets the same ids.
- **Tags.** Type `#tag` and a space in any block: the tag moves to the right margin. A tag starts with a letter (so `#1` stays text), can contain letters, digits, `_` and `-`, and is case-insensitive. A block can have up to 10. Click a tag's name to see every block with that tag, across all notes (the tag page); click a block there to open its note at that block. Click the × that appears on hover to remove the tag from the block. On narrow windows the tags sit under their block instead. "Download as text" writes them back as `#tag`.
- **Block handle.** Hover a block and a six-dot grip appears in the left margin. Click it for a menu (turn into text / headings / lists / checklist / quote, duplicate, move up / down, remove tags, delete). Drag it to move the block; a line shows where it will land. A list item takes its sub-items along and can go into another list, or between paragraphs where it becomes its own list. Alt+Shift+↑/↓ (or Mod+Shift+↑/↓) moves the block you are in. On phones and tablets the grip appears beside the block you tap and can be dragged with a finger.
- **Undo / redo** is the editor's own (`js/editor/history.js`), so moves, deletes, tag removal and menu actions each undo in one step; typing is grouped by pauses, Enter and format changes. Mod+Z / Mod+Shift+Z / Mod+Y.
- **Tag colours.** Every tag has one colour derived from its name, so `#hustle` is the same colour everywhere (chips, suggestions, tag page). Tags are plain pastel text (no background); vividness: `--tag-sat`, `--tag-light`. On narrow layouts a block's tags sit right after its last word instead of in the margin.
- **Tag suggestions.** Type `#` and a few letters: your existing tags pop up (starts-with first, most used first). ↑/↓ choose, Tab accepts, Enter accepts after ↑/↓, Esc closes. A space still creates the tag exactly as typed.
- **"/" menu.** Type `/` at the start of a block or after a space: the block menu opens under the caret (turn into, duplicate, move, delete). Keep typing to filter (`/h2`), ↑ ↓ choose, Enter/Tab apply, Esc closes. It is the same menu as the six-dot grip's, and its "Turn into" list is also in the selection toolbar's "…". Edit the list in `config.js` → `blockTypes`.
- **Inbox.** Notes without a notebook live in the Inbox (sidebar). New notes start there unless created inside a notebook; choose a notebook at the top of a note to file it.
- **About** is in the ⋯ menu at the right of the top bar: edit the text in `config.js` → `about`.
- **Write | Read.** The switch in the top bar (Ctrl/Cmd+Shift+E), saved **per note**. Read opens a note read-only in proper text colours; the colours for both modes are in `css/tokens.css` section 7.
- **Top bar and ⋯ menu.** On a note the top bar shows date created, notebook and the word count (click it for characters). The ⋯ menu holds Light | Dark and Sans | Mono | Serif side by side (the font is saved per note), Download all, As text, Copy / Export as Markdown, Move to Trash and About.
- **Customizing:** see `CUSTOMIZE.md` for what to change and where.
- **Side pane** (desktop). A second panel to the right of the page, with its own editor, floating toolbar, block handle and tag margin. Open it with **Shift+click** on any note link (sidebar, galleries, lists) or on a tag chip in a note (shows every block with that tag). In a thread or tag list a plain click on a block opens it in the pane, scrolled to the block with a soft highlight that stays until you click or type. Inside the pane, clicking a block of a tag list swaps it to that note; ← goes back. The header has *Open full page* and *Close*. Drag the divider to resize (double-click = 50/50, or use ←/→ when it is focused); the width is remembered, the pane itself closes on reload. A note is never open twice: if it is already the page or in the pane you are just taken to the block. The page and the pane are two cards with a gap; pointing at the gap shows a grip. On phones the pane is a full-screen sheet (tap a block in a thread or tag list); the back gesture closes it. Settings: `config.js` → `pane`, `css/tokens.css` → `--pane-*`, `--block-target-bg`.
- **Threads** (sidebar, under Notebooks) gather blocks from all your notes by rule. Rules: **tags** (the block carries the tag), **words** (whole words, case-insensitive), **keywords** (anywhere in the text: phrases and parts of words), combined with **Any** (fits at least one rule) or **All** (fits every rule). The thread page has a renamable title, the rule editor, a **Live** switch and the list of blocks with their note names; click a block to open its note at that block. **Live** follows your notes. **Paused** freezes the list as it was (blocks keep their current text); a banner counts new matching blocks, with *Update now* and *Go live*. The tag page (`#/tag/x`) is the simplest thread; *Save as thread* turns it into a saved one. Threads sync like notebooks (`/api/threads`) and are never stored in the notes themselves.
- **Ctrl+A** selects the text of the block you are in; press it again for the whole note (`selectAll.expand` in `config.js`).
- **Notes** are stored as clean HTML (only the tags the editor makes). Titles come from the first line.
- **Journal** has one entry per day, titled with the date. **Trash** keeps deleted notes until you
  delete them one by one (or empty it). Deleting a notebook moves it, with its notes, to Trash; restoring the notebook brings them all back.
- **Download all** saves a JSON backup of everything. **As text** saves the open note as `.txt`.

## Editing the look

| I want to change…                         | Edit                                             |
|-------------------------------------------|--------------------------------------------------|
| Colours, fonts, sizes, radii, spacing     | `css/tokens.css`                                 |
| Sidebar guide line (width / position)     | `--tree-guide-width`, `--tree-guide-indent`, `--tree-guide` |
| Which font files are bundled              | `css/fonts.css` + `fonts/`                       |
| Reading speed for "min read"              | `reading.wpm` in `js/core/config.js`             |
| Card corner radius / gallery card radius  | `--card-radius` / `--radius-gallery`             |
| Writing size, line height, heading sizes  | `--prose-*` in `css/tokens.css`                  |
| Muted vs bright text while writing        | `--prose-text`, `--prose-heading`, `--prose-text-active` |
| Tag chips and the margin column           | `--tag-*`, `--rail-width`, `--rail-gap`          |
| Which colour is used where                | the COLOUR GUIDE at the top of `css/tokens.css`  |
| How strong the active-paragraph effect is | `defaults.focusMode` in `js/core/config.js`      |
| Highlight / text colour palette           | `--hl-*` in `css/tokens.css` (+ ids in `config.js`) |
| Icons                                     | `js/core/icons.js`                               |
| Autosave / sync timing                    | `timing` in `js/core/config.js`                  |

## Shortcuts

Edit any of these in `js/core/config.js` → `shortcuts`. "Mod" is Ctrl (or Cmd on a Mac).

| Type / press                       | Result                              |
|------------------------------------|-------------------------------------|
| `#` `##` `###` `####` + space      | Heading 1–4                         |
| `-` or `*` + space                 | Bulleted list                       |
| `1.` + space                       | Numbered list                       |
| `[]` + space (or `[x]`)            | Checklist (also inside a bullet item) |
| `>` + space                        | Quote                               |
| Mod + Shift + 1 / 2 / 3 / 4        | Heading 1–4 (press again → text)    |
| Mod + Shift + 0                    | Normal text                         |
| Mod + Shift + 5 / 6 / 7            | Bulleted / numbered / checklist     |
| Mod + Enter (in a checklist)       | Tick / untick the item              |
| Mod + B / I / U                    | Bold / italic / underline           |
| Mod + E                            | Inline code                         |
| Mod + Shift + H                    | Re-apply the last highlight colour  |
| Mod + A                            | Select the block's text (again: whole note) |
| Mod + Shift + V                    | Paste as plain text                 |
| Alt + Shift + ↑ / ↓  (or Mod + Shift + ↑ / ↓) | Move the current block up / down |
| Mod + Z / Mod + Shift + Z (or Mod + Y) | Undo / redo (the editor's own)  |
| `#tag` + space                     | Move the tag into the right margin  |
| Enter / Shift + Enter              | New block / new line in the same block |
| Tab / Shift + Tab (in a list)      | Indent / outdent                    |
| Mod + /                            | Toggle sidebar                      |
| Mod + Shift + /                    | Show / hide the top bar (desktop)   |
| Mod + Alt + /                      | Focus mode: hides sidebar + top bar, dims other paragraphs. Esc or the same keys leave it |
| Mod + K                            | Search box hint only — search comes later (the key is not captured yet) |

The "hidden top bar" choice is remembered on this device; focus mode is not (it ends when you reload).

Select text to get the floating toolbar: italic, bold, underline, quote, code, colour (brush), more (…).

## Good to know

- Formatting uses the browser's built-in `document.execCommand`. It is deprecated on paper but works
  in every browser; highlights, colours and code use custom helpers (`js/editor/inline.js`).
- Touching part of a highlight recolours or removes the whole highlighted run.
- Pasting keeps headings, lists, bold/italic/underline/code and quotes, and drops fonts, colours, images and links (the link text stays). Mod + Shift + V pastes plain text.
- Ctrl+Alt+/ is the same as AltGr+/ on some European keyboards; remap `focus.toggle` in `config.js` if it clashes.
- Free Upstash plans cap request size (about 1 MB); a single note is far below that.
