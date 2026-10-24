# Notes app — roadmap from Phase 6

A plan for everything still to build, split into balanced phases. Nothing here is code yet: it is the map we will build from. Edit it freely; if you change a priority, tell me and I will re-balance the phases.

## How the phases are built

- Every phase has at most two parts (A and B). Phase 6 is only 6A and 6B, Phase 7 is only 7A and 7B, and so on.
- Each part is sized to fit one working session: not too heavy, not too light. Sizes below: S small, M medium, L large.
- Each part delivers only the files that were edited, as separate files, plus an update to the CHANGELOG and CUSTOMIZE.md.
- Every part includes a phone check (touch, narrow screens), so mobile never falls behind. Phase 11 is the dedicated mobile pass on top of that.
- Some of your placements moved so the load stays even. The summary at the end of each phase says what moved and why.

## At a glance

- **Phase 6 — Foundations:** 6A Look, modes and top bar · 6B Code and everyday tools
- **Phase 7 — Find and do:** 7A Search and commands · 7B Tasks and templates
- **Phase 8 — Blocks and links:** 8A Selection and new blocks · 8B Note links and per-note settings
- **Phase 9 — Rich content:** 9A Images and tables · 9B Attachments and OCR search
- **Phase 10 — Organization and safety:** 10A Nested notebooks and tags · 10B Sync reliability and version history
- **Phase 11 — Capture and mobile:** 11A Quick capture · 11B Mobile parity
- **Phase 12 — Smart inbox:** 12A Auto-organization suggestions · 12B Rules and inbox review
- **Phase 13 — Ownership and workspace:** 13A Privacy and full export · 13B Tabs, session restore and web clipper
- **Phase 14 — Connect and finish:** 14A Bring-your-own storage sync · 14B Final polish and release

---

## Phase 6 — Foundations

### 6A — Look, modes and top bar (L)

**Colour clean-up**

- One small base palette in tokens.css; hover, pressed, grip, marker, tag and highlight colours derive from it. Goal: nothing looks different, but each colour is defined once per theme.
- Four fixes found in your files: the sidebar label uses a token that does not exist (--fs-fs, should be --fs-tiny); the dark grip colour on hover equals its background so the dots vanish; dark hover and pressed colours are identical and almost the same as the card; selected rows with a left border shift their text (the border space is reserved instead).

**Edit and Read mode**

- Edit: today's focused writing (other paragraphs dimmed, active line, grip, tag margin).
- Read: read-only, every paragraph in proper text colour, headings a little greyed, no grip. Typing is off until you switch back.
- A new section in tokens.css, "Edit colours / Read colours", collects every prose colour (old and new) so you can map each one yourself.
- The Write / Read switch is always visible in the top bar. The last mode you used is remembered.

**Top bar and the three-dot menu**

- Stays in the top bar: menu button, date created, notebook name (a picker), words written and minutes to read, the Write / Read switch, New, sync status.
- The word count is clickable: words, then characters, then back to words (remembered).
- Three-dot menu (top right): Light / Dark, Font (Sans / Mono), Download all, As text, Copy as Markdown, Export as Markdown (.md), Move to Trash (on note pages), About.
- The Font choice is saved per note and syncs with the note. The interface itself is always Sans.
- Notes in the side pane get a small date and notebook line in their header (no top bar there).
- On phones: Write / Read and the three-dot menu stay visible; date, notebook and word count move under the title.

### 6B — Code and everyday tools (L)

**Code block**

- Available in the "/" menu, the six-dot menu, the selection "…" menu, and by typing three backticks.
- A language dropdown inside the block: JavaScript, TypeScript, JSON, HTML, CSS, Python, Bash, SQL, Markdown, YAML, Plain text.
- Pasted code keeps its indentation; Tab indents; a Copy button.
- A Format button using Prettier, for the languages it supports (JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML). Other languages get colours and a label but no Format button.
- Subtle pastel syntax colours, set as --code-\* tokens in tokens.css for dark and light.
- Technical notes: the colours are drawn with the browser's highlight feature, so no markup is added inside your text. Prettier and the syntax colouring are third-party files kept in a vendor folder, loaded only when you use a code block, and cached for offline use.

**Find in note (Ctrl+F)**

- All matches highlighted, next / previous, a match count; optional replace.

**Pinned section**

- A "Pinned" section in the sidebar above the notebooks, with a chevron to collapse it. Pin from a note's menu or a sidebar row. Pinned notes also sit at the top of Home.

**Undo toast**

- After Move to Trash, Delete or Move to notebook, a small toast with Undo.

*What moved:* Markdown copy and export went into 6A (inside the three-dot menu, as you asked); Markdown import moved to 10A where it pairs with nested notebooks.

---

## Phase 7 — Find and do

### 7A — Search and commands (L)

- Spotlight-style search window: click the box or press Ctrl/Cmd+K. Groups: Notes, Blocks, Tags, Notebooks, Threads. Arrow keys move, Enter opens, Shift+Enter opens in the side pane.
- Fast and forgiving: whole words and parts of words, typo tolerance, words in any order, recent searches, built for thousands of notes.
- Command palette in the same window: New note, Toggle theme, Go to Inbox, and so on.
- Notebook Icon and View style (the two inactive fields in the Edit dialog).

### 7B — Tasks and templates (M-L)

- Due dates on checklist items (type @tomorrow or pick a date).
- A Tasks page that gathers every checklist item from every note: Overdue, Today, Upcoming, No date, Done. Ticking an item there updates the note. It behaves like a live thread.
- ~~Optional reminders (browser notifications while the app is open or installed).~~ *Skipped by choice; can be added later.*
- Templates: start a note from a template (meeting, weekly review, daily page); save any note as a template.

*What moved:* Tasks stayed in Phase 7 as you asked; templates joined it to balance the part.

---

## Phase 8 — Blocks and links

### 8A — Selection and new blocks (L)

- Block selection: drag in the empty space beside the writing column to select whole blocks; Shift+click extends; copy, cut, delete, duplicate, turn into another type, tag, move as a group. Dragging inside the text still selects text, across blocks too.
- New blocks, all in "/" and the six-dot menu: divider, callout, collapsible toggle.

### 8B — Note links and per-note settings (L)

- Type \[\[ to link another note (search as you type; create a new note from the link). Links are stored by id, so renaming a note never breaks them.
- A "Linked from" panel (backlinks) on every note, and a hover preview.
- Per-note settings in the three-dot menu: text size, column width (narrow / wide), spellcheck language (English, German and others). The font choice from 6A lives here too.

---

## Phase 9 — Rich content

### 9A — Images and tables (L)

- Images: paste, drop or upload; resize; caption; thumbnails in gallery cards. This needs a place to store files, because the sync store is small (see decisions below).
- Tables: insert from "/", add and remove rows and columns, Tab moves between cells, header row, paste from a spreadsheet.

### 9B — Attachments and OCR search (M-L)

- Attach PDFs and other files with an inline preview.
- OCR: text inside images and PDFs is read on the device and added to search, so search can find words inside attachments.
- A storage meter.

---

## Phase 10 — Organization and safety

### 10A — Nested notebooks and tags (L)

- Nested notebooks: drag to nest, breadcrumbs, a tree in the sidebar.
- Nested tags (#work/clients), a tag tree, and a tag manager (rename, merge, set a colour).
- Drag notes between notebooks; select several notes in a list and move or trash them together.
- Notebook icons from your own SVG folder: an icon picker in the notebook Edit dialog (Icon field), an icon list in its own file, and a small script that scans the folder and updates that list. *(Moved here from 7A; reminder at the start of 7B.)*
- Import Markdown and text files, or a whole folder of them as a notebook.

### 10B — Sync reliability and version history (L)

- Conflict handling: if two devices edit the same note, keep both (a conflict copy) instead of silently overwriting. First step: check how sync behaves today.
- A visible "waiting to sync" queue, so offline edits are never a mystery.
- Selective sync: choose which notebooks sync to this device, and make local-only notebooks.
- Version history per note: snapshots, compare, restore.
- Trash retention setting.

---

## Phase 11 — Capture and mobile

Both parts start with a short strategy step: we decide the approach together before any code.

### 11A — Quick capture (M-L)

- Build the options you choose from the list in the decisions section below. Likely core: a quick-add bar into the Inbox, a link format that creates a note from text (for phone automations), install-as-app with share target and long-press shortcut, and a dictation button.

### 11B — Mobile parity (L)

- A full audit on a real phone, then fixes: a formatting bar above the keyboard, swipe gestures, touch block selection (long-press), search and command palette on a small screen, performance with large notes, install-as-app polish.
- Option to evaluate: a bottom navigation bar on phones.

---

## Phase 12 — Smart inbox

### 12A — Auto-organization suggestions (L)

- For notes in the Inbox, suggest a notebook, tags and related notes ("File to Personal? Add #productivity? Related: …"), based on meaning rather than exact words. You accept or dismiss each suggestion.
- Default is on-device so nothing leaves your machine; a cloud model is an opt-in choice (see decisions).

### 12B — Rules and inbox review (M)

- Filing rules you define (if the text contains X, add tag Y or file to notebook Z).
- An inbox review screen to file items quickly with the keyboard or a swipe; suggestions improve as you accept them.
- A weekly "inbox review" reminder.

---

## Phase 13 — Ownership and workspace

### 13A — Privacy and full export (L)

- End-to-end encryption: a passphrase; notes are encrypted on your device before they leave it; a recovery key.
- Local-first option: use the app fully without any sync account.
- Complete export: Markdown (a zip with folders), PDF, and JSON, so you are never locked in.

### 13B — Tabs, session restore and web clipper (L)

- Tabs inside the app, and full session restore: open notes, side pane, scroll position and mode come back after a restart.
- Web clipper: a browser extension to clip a selection, a clean article or a whole page into the Inbox with its source link.

---

## Phase 14 — Connect and finish

### 14A — Bring-your-own storage (L)

- Sync through storage you already own: start with one or two providers (for example Google Drive and an S3-compatible bucket), then add more. Data is encrypted before upload (builds on 13A).

### 14B — Final polish and release (M)

- Performance with thousands of notes, an accessibility pass (keyboard, screen readers, contrast), install-as-app polish, a backup and restore test, a refresh of CUSTOMIZE.md, and a release checklist.

---

## Decisions and strategy for you

### Quick capture options (pick what fits how you work)

- Quick-add bar on Home and Inbox: type, press Enter, it lands in the Inbox. Effort S; works everywhere.
- A shortcut that opens a new note instantly while the app is open (for example Ctrl+Alt+N). Effort S. A true system-wide shortcut is not possible in a browser; it needs a desktop wrapper app.
- A link that creates a note from text, for example #/new?text=…, so phone shortcuts and automations can send text in. Effort S.
- Install as an app with a share target (Android: share text or links from any app into the Inbox) and a long-press "New note" shortcut on the app icon. Effort M. iPhone support is more limited.
- Dictation button using the browser's speech recognition. Effort S-M.
- Home-screen widgets: not possible for a web app; needs a native wrapper. Effort L, so likely out.
- Email-to-Inbox or a chat bot that forwards messages: needs a small server. Effort M-L.
- The web clipper (Phase 13B) is also a capture path.

### Mobile approach

- Keep one app and improve it everywhere (planned), or also build a phone-specific layout (bottom bar, swipes)? Decide at the start of 11B after you have used 6A and 6B on your phone.
- What breaks first on your phone today? Writing a short list of the three worst moments will steer 11B.

### Smart inbox and privacy

- On-device suggestions are private but smaller and slower; a cloud model is better but sends note text out. With end-to-end encryption in Phase 13, a cloud model would only ever see what you choose to send. Decide the default before 12A.

### Images and attachments storage

- Files do not fit in the current sync store. Phase 9 needs a file storage service (small cost). Decide a size limit per file and an overall cap before 9A.

### Order check

- End-to-end encryption comes late (Phase 13), as you asked. Until then notes are stored on the server as plain text. If that bothers you, it can move up after Phase 10.

---

## Where each wish-list item lands

**Your picks**

- Find in note, pinned section, undo toast: 6B
- Tasks view with due dates: 7B
- Markdown copy and export in the three-dot menu: 6A (import 10A, full exports 13A)
- More blocks (divider, callout, toggle): 8A
- Per-note settings: 8B (font per note already in 6A)
- &#91;\[ note links and backlinks: 8B
- Command palette: 7A
- Templates: 7B
- Version history: 10B
- Spellcheck language per note: 8B
- Images: 9A
- Tables: 9A

**From other sources**

- Reliable offline and fast sync, selective sync: 10B
- Folders and tags, ideally nested: 10A
- Excellent full-text search, including attachments and OCR: 7A and 9B
- Instant search and dynamic tagging: 7A and 10A
- Quick capture: 11A (strategy first)
- Privacy and data ownership (end-to-end encryption, local-first, export): 13A
- Tabs and session restore: 13B
- Mobile experience that matches desktop: every part, and 11B
- Bi-directional linking: 8B
- Tasks and check-offs rolling up into one view: 7B
- Code block with syntax highlighting: 6B
- Web clipper: 13B
- Context-aware automatic organization (listed twice in your notes; merged): 12A and 12B
- Bring-your-own storage sync: 14A

**Parked (not scheduled)**

- Handwriting, drawing and an infinite canvas; databases; real-time collaboration; publishing a read-only link; writing streaks; typewriter scrolling.

---

## Notes

Quick synthesis from the sources

- Reddit wishlists (especially the "Ultimate note taking app wishlist" and perfect-app threads) heavily emphasize lightweight + offline + cross-platform + folders/tags + Markdown/WYSIWYG + drawing + good search.
- Common frustrations: Notion is powerful but online-only and heavy; Obsidian is local and flexible but plugin-dependent and weaker on mobile/handwriting/databases; Apple Notes is polished but locked to Apple and missing templates, Markdown, and strong export; UpNote/Joplin/Standard Notes get praise for balance but still lack collaboration, advanced drawing, or certain polish.
- Privacy-focused users push hard for E2EE + local-first; students and creatives push for handwriting + infinite canvas; power users want bidirectional links, backlinks, and databases without bloat.
