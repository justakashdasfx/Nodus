# Changelog

## Phase 8A — Block selection, new blocks, and four small wishes

- **Double-click below the last block** → a new empty block appears there (or the empty one at the end gets the cursor). No need to go back and press Enter.
- **Click "Notebook"** above the notebooks → every notebook closes; click again when none is open → all open.
- **Calendar date picker**: "Pick a date…" in the due-date menu opens a month calendar (Today, Clear, month arrows, Esc). Typing `@fri` etc. still works.
- **Tags page** (sidebar, above Threads): every #tag in alphabetical sections (P under P), as coloured pills with a count. Click a pill → the side pane opens with all blocks carrying that tag.
- **Block selection**: drag in the empty space beside the text to select whole blocks (a plain click there selects the block at that height; Shift+click extends). A bar offers Copy · Cut · Duplicate · Turn into · Tag · move up/down as a group · Delete. Keys: Ctrl/Cmd+C/X/D, Delete, Alt+Shift+↑↓, Esc. Dragging inside text still selects text.
- **New blocks** (in "/" and the six-dot menu): **Divider**, **Callout**, **Toggle** (collapsible; the folded state is saved). Markdown export: divider → `---`, callout → quote, toggle → bold title + content.
- Files: new `js/editor/block-select.js`, `blocks-extra.js`, `js/ui/calendar.js`, `js/views/tags.js`; changed `app.js`, `config.js`, `icons.js`, `utils.js`, `blockindex.js`, `block-ops.js`, `block-menu.js`, `normalize.js`, `editor.js`, `due.js`, `sidebar.js`, the CSS files and `sw.js`.

## Phase 6B — Code block, find in note, pinned, undo

- **Code block** (`/code`, the six-dot menu, the selection “…”, or type ``` + Enter): Enter keeps the indent (a second Enter on an empty last line leaves the block, Ctrl/Cmd+Enter leaves at once), Tab / Shift+Tab indent, pasted code keeps its layout, a language dropdown (11 languages), **Format** with Prettier (JS, TS, JSON, CSS, HTML, Markdown, YAML), **Copy**, subtle pastel syntax colours (`--code-*`, tokens section 9). Works in Read mode too (colours + Copy). Text export and Markdown export write fenced code.
- **Find in note** (Ctrl/Cmd+F): highlights every match, count, next / previous, Replace and Replace all.
- **Pinned**: a collapsible Pinned section above the notebooks; pin from the ⋯ menu or the pin button on a note row; pinned notes also lead Home.
- **Undo toast** after Move to Trash (note or notebook) and after moving a note to another notebook.
- **Notebook picker** has a search box (type to filter, Enter picks the first match).
- Third-party files in `vendor/` (Prism for colours, Prettier for Format), loaded only when needed, with their licences.
- New: `js/editor/code-block.js`, `js/ui/find.js`, `js/core/vendor.js`, `vendor/*`. Changed: tokens, editor, layout, components CSS; app, config, store, settings, icons, utils, blockindex; editor modules (normalize, block-ops, block-menu, focus, shortcuts, slash-menu, tags, tag-suggest, selection-toolbar, editor); sidebar, more-menu, home; sw.js.

## Phase 6A.1 — Fixes after 6A

- **Notebook picker restyled.** It is now a bordered button (icon, name, small arrow) that opens a menu listing the Inbox and every notebook, with the current one ticked. It appears in the top bar and in the note's own bar (phone, side pane).
- **Write | Read is saved per note** (like the font), syncs with the note, and the switch shows only on note pages. A note opens in `defaults.mode` until you choose.
- **Writing colours organized:** `tokens.css` section 7 is now four groups with identical names and order (dark/light × Write/Read), plus a ticked-items colour. See CUSTOMIZE.md section B.
- **⋯ menu:** Light | Dark and the font choice sit side by side like Write | Read, and stay open so you see the highlight move.
- **New font: Serif (Merriweather)**, bundled for offline use. Fonts are Sans / Mono / Serif per note.
- **Removed the thin line beside the paragraph you are writing in** (CSS, tokens and docs). The brighter active paragraph stays.
- **Files:** new `fonts/merriweather-*.woff2`, `fonts/MERRIWEATHER-LICENSE.txt`; changed `css/tokens.css`, `css/editor.css`, `css/fonts.css`, `js/app.js`, `js/core/config.js`, `js/core/settings.js`, `js/core/store.js`, `js/ui/topbar.js`, `js/ui/more-menu.js`, `js/ui/note-meta.js`, `js/views/note.js`, `index.html`, `sw.js`, docs.

## Phase 6A — Modes, top bar and a calmer colour system

**Write and Read**
- A **Write | Read** switch in the top bar (Ctrl/Cmd+Shift+E). Write is the focused writing you know. Read opens notes read-only, in proper text colours with slightly softer headings and no dimming. The last mode you used is remembered.
- A new colour section in `tokens.css` (7. Writing colours) with `--edit-*` and `--read-*` tokens, so every writing colour can be mapped by hand for each mode.

**Top bar**
- Date created, the notebook picker and the word count moved from the page into the top bar. **Click the count** to switch between words and characters (remembered).
- A **⋯ menu** at the right: Light / Dark, Font for this note, Download all, Download as text, Copy as Markdown, Export as Markdown (.md), Move to Trash (or Restore / Delete forever, Restore notebook), About. The Font, Theme, Download and (i) buttons left the bar.
- On phones the note's details (date, notebook, count) sit at the top of the page instead, and the sync chip shows just its dot.
- **Fonts are per note.** Sans or Mono is saved on the note and syncs with it; the interface itself is always Sans.

**Colours**
- One **base palette** per theme (`--p-*` in `tokens.css`). Hover, pressed, grip, marker, selection, scrollbar, tag-remove and the highlight tints are now mixed from it, so each colour is typed once. Look is unchanged except the fixes below.
- Fixed: hover and pressed were the same colour (pressed is now one step stronger; selected rows keep their old look).
- Fixed: the grip dots vanished on hover in dark mode.
- Fixed: `.sidebar__label` used a token that does not exist (`--fs-fs`).
- Fixed: choosing a sidebar row moved its text 2–4px (the selected bar's space is now reserved).
- Fixed: filled buttons used a hard-coded dark colour (also in light mode) and an invalid border colour.
- The light theme now has a selected-row bar colour (`--p-steel`).

**Files**
- New: `js/ui/more-menu.js`, `js/ui/note-meta.js`
- Changed: `css/tokens.css`, `css/layout.css`, `css/components.css`, `css/editor.css`, `js/app.js`, `js/core/config.js`, `js/core/settings.js`, `js/core/utils.js`, `js/core/store.js`, `js/editor/editor.js`, `js/ui/topbar.js`, `js/ui/pane.js`, `js/views/note.js`, `index.html`, `sw.js`

## Phase 5B — Menus, phone sheet, touch, Inbox, About

**Menus**
- **"/" menu.** Type `/` at the start of a block (or after a space) and the block menu opens under the caret. Keep typing to filter (`/h2`), ↑ ↓ choose, Enter or Tab apply, Esc closes. `and/or` and web addresses don't trigger it. (`js/editor/slash-menu.js`)
- **One menu, three doors.** The six-dot menu, the "/" menu and the selection toolbar's "…" now share one list (`config.js` → `blockTypes`) and one look (`js/editor/block-menu.js`). The "…" is the same "Turn into" list plus Clear formatting.

**Side pane**
- **Two cards with a gap.** The page and the pane are separate rounded cards; the gap is the divider. Pointing at it shows a grip icon (`icons.js` → `dividerGrip`). Drag, double-click and ←/→ work as before. Tokens: `--pane-divider-w`, `--pane-grip-*`.
- **Phone sheet.** On phones the pane is a full-screen sheet. Tap a block in a thread or tag list to open it; ← closes (or goes back to the list); the phone's back gesture closes it too.
- Fixed: auto-scroll while dragging a block inside the pane.

**Touch**
- The six-dot grip now works on phones and tablets: it appears beside the block you tap, and dragging it with a finger moves the block. Tap it for the menu.
- The divider has a wider grab area on touch screens (`@media (pointer: coarse)` in `tokens.css`).

**Writing**
- The line beside the active paragraph moved closer to the text (`--active-marker-offset`) so it no longer overlaps the six-dot grip, and it now also shows on list items (bullets, numbers, checklists).
- Tags are plain pastel text — no background (`--tag-sat` / `--tag-light`).
- On narrow layouts (phones, or beside the side pane) a block's tags sit right after its last word instead of below it. If the last line is too full, only that block's text wraps a little earlier. In the wide layout they stay in the right margin, vertically centred on their block (`config.js` → `tags.align`: center / top / bottom). Fixed: the bottom of letters like g and y was cut off in tags.

**Sidebar**
- Nav links, notebooks and the notes under them now have their own hover, pressed and selected colours (`--nav-*`, `--folder-*`, `--note-*` in `tokens.css`). Defaults look the same as before.

**Threads**
- The settings panel has a **Save** button that hides it, and an **Edit** button next to Live and Delete brings it back. A thread with no rules yet opens with its settings showing.

**Lists**
- Every block in a thread or tag list ends with a note icon + note name and a folder icon + notebook name (the normal `note` and `folder` icons; Journal and Inbox use `journal` and `inbox`).

**New**
- **Inbox.** Notes without a notebook live in the Inbox (sidebar, with a count). It replaces the loose "Notes" list in the sidebar. The note's notebook picker now says "Inbox" instead of "No notebook". (`js/views/inbox.js`)
- **About (i)** button at the right of the top bar. Opens a window with who made it, how, why, version and more, from `config.js` → `about` (dummy text for now).
- **`CUSTOMIZE.md`**: what to change and where (colours, sizes, placement).

**Files**
- New: `js/editor/block-menu.js`, `js/editor/slash-menu.js`, `js/views/inbox.js`, `CUSTOMIZE.md`
- Changed: `sw.js`, `README.md`, `CHANGELOG.md`, `css/tokens.css`, `css/layout.css`, `css/editor.css`, `css/gallery.css`, `css/components.css`, `js/app.js`, `js/core/config.js`, `js/core/icons.js`, `js/core/router.js`, `js/ui/pane.js`, `js/ui/modal.js`, `js/ui/sidebar.js`, `js/ui/topbar.js`, `js/views/blocklist.js`, `js/views/note.js`, `js/editor/block-handle.js`, `js/editor/editor.js`, `js/editor/selection-toolbar.js`

## Phase 5A — Side-by-side panel

**Side pane**
- A second panel beside the page (`js/ui/pane.js`). Two full editors can now be open at once; each has its own floating toolbar, block handle, tag margin and undo history.
- **Opens from:** Shift+click on any note link (sidebar, galleries, lists); Shift+click on a tag chip in a note (the pane lists every block with that tag); a plain click on a block in a thread or tag list.
- Inside the pane, clicking a block of a tag list swaps the pane to that note, with **←** back to the list. The header also has **Open full page** and **Close**.
- A note is never open twice: if it is already the page (or in the pane) you are taken to the block instead. Opening a note as the page that the pane shows closes the pane.
- **Draggable divider:** drag to resize, double-click for 50/50, ←/→ when focused. Width is remembered (`notes.paneWidth`); each side keeps at least `--pane-min` (320px). The pane itself closes on reload.
- The top bar's words · min read and "As text" follow the editor you last wrote in.
- Phones (≤760px): notes still open as full pages. The full-screen sheet comes in 5B.

**Soft highlight**
- The block you jump to (from a thread, tag list, pane or full page) gets a subtle tint that stays until you click or type (`--block-target-bg`). The old 2-second flash is gone.

**Fixes**
- Thread and tag rows no longer squeeze the block text to nothing when the page is narrow; the note name wraps under the text instead.
- Editors no longer share one remembered caret block (`normalize.js`), which two open editors needed.

**Files**
- New: `js/ui/pane.js`
- Changed: `index.html`, `sw.js`, `README.md`, `CHANGELOG.md`, `css/tokens.css`, `css/layout.css`, `css/editor.css`, `css/gallery.css`, `js/app.js`, `js/core/config.js`, `js/core/icons.js`, `js/ui/topbar.js`, `js/views/note.js`, `js/editor/editor.js`, `js/editor/normalize.js`, `js/editor/tags.js`, `js/editor/block-ops.js`

## Phase 4B — Threads, and Ctrl+A

**Threads**
- New **Threads** item in the sidebar (under Notebooks), a Threads list page (`#/threads`) and a thread page (`#/thread/<id>`).
- Thread page: renamable title, rule editor (tags, words, keywords; **Any / All**), **Live** switch, and the matching blocks with their note names. Click a block to open its note scrolled to it.
- Rules: tags = the block carries the tag; words = whole words, case-insensitive; keywords = anywhere in the text (phrases, parts of words). Word and keyword rules read the full block text, not just the 160-character index.
- **Live** follows your notes. **Paused** freezes the list (blocks stay, showing their current text); a banner counts new matching blocks, with *Update now* and *Go live*.
- The tag page and threads share one matching engine (`js/core/threads.js`). The tag page gets **Save as thread**.
- Storage and sync like notebooks: whole list, newest write wins, deletions kept as markers. New endpoint `api/threads.js` (key `notesapp:threads`). A server without the endpoint is tolerated: threads just stay on the device until it is deployed.
- Threads are in "Download all"; they never change your notes.

**Ctrl+A**
- Selects the text of the block you are in instead of the whole note. Press it again to select the whole note (`selectAll.expand` in `config.js`, `select.all` shortcut).

**Files**
- New: `api/threads.js`, `js/core/threads.js`, `js/views/threads.js`, `js/views/thread.js`, `js/views/blocklist.js`
- Changed: `api/_lib.js`, `sw.js`, `README.md`, `CHANGELOG.md`, `css/gallery.css`, `css/components.css`, `js/app.js`, `js/core/config.js`, `js/core/icons.js`, `js/core/store.js`, `js/core/sync.js`, `js/ui/sidebar.js`, `js/views/tag.js`, `js/editor/normalize.js`, `js/editor/shortcuts.js`

## Phase 4A — Block handle, tag colours, tag suggestions

**Block handle**
- A six-dot grip appears beside the hovered block. Click: menu with Turn into (Text, Heading 1–4, Bulleted, Numbered, Checklist, Quote), Duplicate, Move up / down, Remove tags (only on tagged blocks) and Delete. Drag: a line shows the drop spot; list items take their sub-items along and can move between lists or become their own list between paragraphs.
- Alt+Shift+↑/↓ (or Mod+Shift+↑/↓) moves the block you are in. Duplicates get new ids and no tags; ids and tags travel with moved blocks.
- Hidden on phones (touch dragging comes with the phone polish in Phase 5).

**Undo / redo**
- The editor now has its own history (`js/editor/history.js`) so every move, delete, duplicate, turn-into and tag removal is exactly one Ctrl+Z step, and Ctrl+Shift+Z / Ctrl+Y redo it. Typing is grouped by pauses, Enter and format changes.

**Tags**
- Every tag has its own colour, worked out from its name: the same tag is always the same colour (margin chips, suggestions, tag page title). `--tag-sat`, `--tag-light`, `--tag-bg-alpha`, `--tag-remove` in `css/tokens.css` (the old `--tag-bg` / `--tag-text` are gone).
- Typing `#` and letters shows matching tags (starts-with first, then contains; most used first), with colour dot and use count. ↑/↓ choose; Tab accepts; Enter accepts only after ↑/↓; Esc closes; Space still creates the tag as typed.
- Fixed: after a tag was moved to the margin, the space before it was swallowed when you typed the next word ("para #a #b" lost the second tag).

**Files**
- New: `js/editor/history.js`, `js/editor/block-ops.js`, `js/editor/block-handle.js`, `js/editor/tag-suggest.js`
- Changed: `sw.js`, `README.md`, `CHANGELOG.md`, `css/tokens.css`, `css/editor.css`, `css/gallery.css`, `js/core/config.js`, `js/core/utils.js`, `js/core/store.js`, `js/core/icons.js`, `js/ui/components.js`, `js/views/tag.js`, `js/editor/editor.js`, `js/editor/tags.js`

## Phase 3 fixes — tags

**Fixed**
- Tags showed as plain text at the bottom of the note. Cause: `css/editor.css` ended with an unclosed rule (it was already that way in the original file), so the tag styles added after it were ignored. The rule is closed now; tags sit in the right margin next to their own block.

**Changed**
- Clicking a tag's name opens a **tag page** (`#/tag/<name>`): every block carrying that tag across your notes, with the note and notebook name. Click a block to open its note scrolled to that block (it flashes briefly).
- Removing a tag is now the **×** that appears when you hover the tag.
- `#/note/<id>/<blockId>` links scroll to a block. Tag colours: `--tag-text-hover-label` (name) and `--tag-text-hover` (×).

**Files**
- New: `js/views/tag.js`
- Changed: `css/editor.css`, `css/gallery.css`, `css/tokens.css`, `js/app.js`, `js/core/router.js`, `js/core/store.js`, `js/editor/tags.js`, `js/views/note.js`, `sw.js`, `README.md`, `CHANGELOG.md`

## Phase 3 — Blocks and tags

**Blocks**
- Every paragraph, heading, quote and list item gets a permanent id (`data-bid`). Enter creates a new block with a new id; Shift+Enter stays in the same block. Turning a block into a heading / bullet / quote keeps its id and tags.
- After every edit the editor tidies itself (`js/editor/normalize.js`): loose text and stray `<div>`s become paragraphs, ids stay unique, and copies made by Enter get a fresh id.
- Each note keeps a small block index: `note.blocks = [{ id, t, text, tags? }]` (type, first 160 characters, tags). It is rebuilt on every save and synced with the note.
- Existing notes are migrated automatically on load. Ids come from note id + position, so all your devices produce the same ids; nothing is re-synced just for the migration.

**Tags**
- `#tag` + space moves the tag into the right margin. Tags start with a letter, are case-insensitive, and a block can have several (max 10). Click a tag to remove it. With no room beside the text (narrow windows) they sit under their block.
- Tags are stored on the block (`data-tags`) and listed in the block index. "Download as text" writes them back as `#tag`.

**Looks**
- The side line beside the active paragraph is brighter and 3px thick (`--active-marker`, `--active-marker-width`).
- Notebook cards in the Notebooks view show the notebook's description (3 lines).
- `css/tokens.css` starts with a COLOUR GUIDE: which variable changes which colour.

**Files**
- New: `js/core/blockindex.js`, `js/editor/normalize.js`, `js/editor/tags.js`
- Changed: `sw.js`, `README.md`, `CHANGELOG.md`, `css/tokens.css`, `css/editor.css`, `css/gallery.css`, `js/core/store.js`, `js/core/utils.js`, `js/editor/editor.js`, `js/editor/blocks.js`, `js/editor/shortcuts.js`, `js/editor/selection-toolbar.js`, `js/ui/components.js`, `js/views/note.js`

## Phase 2 — Sidebar, notebooks, top bar and offline

**Sidebar**
- Notebook rows now read: chevron · icon · name · note count on the right (the + button replaces the count while you hover). Open notebooks get a 1.5px guide line under the chevron (`--tree-guide-*` in `css/tokens.css`).
- Search box under the app name with a `Ctrl K` / `⌘K` hint. It looks finished but does nothing yet, and the key is not captured.

**Notebooks**
- The notebook page shows the note count and a description under the name ("Add a description" when empty).
- **Edit** opens a panel: Name and Description work; Icon and View style are shown but inactive. The old Rename button is replaced by Edit.
- Description syncs with the notebook list (new `description` field; existing notebooks are untouched).

**Top bar**
- `│ 342 words · 2 min read` beside the menu button while a note is open, live as you type (200 wpm, `reading.wpm`).
- Ctrl+Shift+/ hides / shows the top bar (remembered). Ctrl+Alt+/ enters focus mode: sidebar and top bar hide, other paragraphs dim; Esc or the same keys leave it. All in `config.js` → `shortcuts`.

**Offline**
- Service worker (`sw.js`), network first: always the newest files online, saved copy offline or when the network is slow. Never touches `/api`.
- Installable: `manifest.webmanifest` + placeholder icons in `icons/`.
- Geist and Geist Mono are bundled in `fonts/` (Google Fonts is no longer used).
- Sync chip text when offline: "Offline, will sync when back".

**Files**
- New: `sw.js`, `manifest.webmanifest`, `css/fonts.css`, `fonts/*`, `icons/*`
- Changed: `index.html`, `README.md`, `CHANGELOG.md`, `css/tokens.css`, `css/layout.css`, `css/components.css`, `css/gallery.css`, `js/app.js`, `js/core/config.js`, `js/core/settings.js`, `js/core/store.js`, `js/core/utils.js`, `js/core/icons.js`, `js/ui/sidebar.js`, `js/ui/topbar.js`, `js/ui/modal.js`, `js/ui/components.js`, `js/views/notebook.js`, `js/editor/editor.js`

## Phase 1 fixes — block shortcuts inside lists

**Fixed**
- Ctrl+Shift+1–4 / 0 on a bullet, numbered or checklist item now takes the item out of the list and changes it (no more heading-inside-bullet, and no text that grows each time you press it). Press the heading key again to get normal text.
- Ctrl+Shift+0 (normal text) now always works: if the browser's own command doesn't change the block, the editor swaps the tag itself.
- The floating toolbar's heading / text / quote buttons use the same logic.
- Notes already damaged by the old bug (a heading inside a bullet or inside another heading) are repaired when opened.

**Files**
- New: `js/editor/blocks.js`
- Changed: `js/editor/shortcuts.js`, `js/editor/selection-toolbar.js`, `js/editor/lists.js`, `js/core/utils.js`, `CHANGELOG.md`

## Phase 1 — Fixes, safety and checklists

**Fixed**
- Pasting from websites / Google Docs / Notion now keeps headings, lists (nested too), bold, italic, underline, code and quotes. Fonts, colours, images and links are dropped (link text stays). Mod+Shift+V pastes plain text.
- The sidebar folder toggle works while a note from that folder is open. The folder opens once when you arrive, then stays however you leave it.

**Safer deleting**
- Moving a note to Trash asks first.
- Deleting a notebook asks first, and the notebook goes to Trash together with its notes. Trash lists Notebooks and Notes separately; Restore brings a notebook back with its notes, Delete forever removes it and its notes.
- A note whose notebook is in Trash is read-only, with a "Restore notebook" button.

**Shortcuts**
- All shortcuts now live in one table: `js/core/config.js` → `shortcuts`.
- Mod+Shift+1–4 headings, 0 text, 5 bullets, 6 numbers, 7 checklist. Mod+/ toggles the sidebar. (The old Mod+\ and Mod+Alt+digit keys are gone.)
- The "More" menu shows each shortcut.

**Checklists**
- Create with `[] `, `[x] `, `- [ ] `, the More menu or Mod+Shift+7. Click the squircle to tick, or Mod+Enter.
- Ticked items grey out with a see-through strike-through. Enter starts a new unchecked item; Enter on an empty one leaves the list.
- Import (.txt/.md) understands `- [ ]` / `- [x]`; "Download as text" writes them back.

**Data**
- Notebooks gain a `deletedAt` field (existing notebooks are untouched).

**Files**
- New: `js/core/keys.js`, `js/editor/paste.js`, `js/editor/lists.js`, `CHANGELOG.md`
- Changed: `js/app.js`, `js/core/config.js`, `js/core/store.js`, `js/core/utils.js`, `js/editor/editor.js`, `js/editor/selection-toolbar.js`, `js/editor/shortcuts.js`, `js/ui/sidebar.js`, `js/views/trash.js`, `js/views/notebook.js`, `js/views/note.js`, `css/editor.css`, `css/gallery.css`, `README.md`
