# Customize your notes app

A plain-English guide to **what to change, and where**. You never need to touch the logic files for look and feel.

## The three places that matter

| File | What lives there |
|---|---|
| `css/tokens.css` | **Every colour, size and gap.** Start here for 90% of changes. |
| `js/core/config.js` | Lists and words: block types in the menus, highlight colour names, shortcuts, the (i) About text, pane defaults. |
| `js/core/icons.js` | Every icon. Replace the markup string of a name and that icon changes everywhere it is used. |

Two rules for `tokens.css`:
1. **Colours exist twice** — once in the dark block (`:root, [data-theme="dark"]`) and once in the light block. Change the theme you use, or both.
2. Edit a value, save, refresh the page. If nothing changes, the browser kept an old copy — hard refresh (Ctrl/Cmd + Shift + R).

**Finding things yourself:** right-click anything in the app → *Inspect*. The class names you see (like `.block-menu__item`) are searchable in `css/`.

---

## 0. Sidebar rows (hover, pressed, selected)

Three kinds of row, each with its own colours in `tokens.css`:

| Row | Prefix | Where it is |
|---|---|---|
| Nav links (Home, Inbox, Journal, Notebooks, Threads, Trash) | `--nav-*` | `.nav-item` in `layout.css` |
| Notebooks in the tree | `--folder-*` | `.tree-row--folder` |
| Notes under a notebook | `--note-*` | `.tree-note` |

Each prefix has: `-text` (resting), `-hover-bg` / `-hover-text` (pointer over it), `-pressed-bg` (while the mouse button is down), `-active-bg` / `-active-text` (the page you are on). Out of the box they all use the theme's hover and pressed greys; type your own colours to make them differ. If you want the dark and light themes to differ, set them inside each theme block.

## 1. The line beside the paragraph you are writing in

| Change | Where |
|---|---|
| Colour | `--active-marker` (`tokens.css`, dark and light). Set to `transparent` to remove it. |
| Thickness | `--active-marker-width` |
| Distance from the text | `--active-marker-offset` (smaller = closer to the text) |
| Length (shorter / longer than the paragraph) | `css/editor.css` → rule `.editor > .is-active::after` → `top` and `bottom` (currently `0.3em` each) |
| Switch the whole effect off | `config.js` → `defaults.focusMode: 'off'` |
| Hidden on phones | `css/editor.css` → the `@media (max-width: 760px)` line right under the rule |

The line also works for list items (bullets, numbers, checklists); `--li-x` in the same file only exists to pull it back to the same spot.

## 2. The six-dot handle

| Change | Where |
|---|---|
| Colour | `--handle-color` (hover colour: `.block-handle:hover` in `editor.css`) |
| How far left of the text | `--handle-offset` (it never goes further than the page padding allows) |
| Size | `.block-handle` in `editor.css` → `width` / `height` (24px) |
| Icon | `icons.js` → `grip` |
| Drop line colour while dragging | `.drop-line` → `background` (uses `--accent`) |

If the handle and the line beside the paragraph touch, increase `--active-marker-offset` less, or `--handle-offset` more.

## 3. The menus (six-dot menu, "/" menu, selection "…")

All three show **the same list**, and they look the same.

| Change | Where |
|---|---|
| Which block types are offered, their order, names, shortcut hints, search words | `config.js` → `blockTypes`. Each row: `[kind, 'Label', 'shortcut name', 'extra search words']` |
| Look (width, rounded corners, row height, colours) | `editor.css` → `.block-menu`, `.block-menu__item`, `.block-menu__hint` |
| Highlighted row while using ↑ ↓ in the "/" menu | `.block-menu__item.is-active` |
| Extra actions in the six-dot and "/" menu (Duplicate, Move, Delete…) | `js/editor/block-menu.js` → `menuModel()` |
| "Clear formatting" in the selection "…" | `js/editor/selection-toolbar.js` → `moreMenu()` |

**How "/" works:** type `/` at the start of a block or after a space. Keep typing to filter (`/h2`, `/check`, `/del`). ↑ ↓ choose, Enter or Tab applies, Esc closes. `and/or` and web addresses do not trigger it.

## 4. Tags

Each tag gets its own hue **from its name** (the same tag is always the same colour). You set how vivid it is:

| Change | Where |
|---|---|
| How colourful (pastel ↔ strong) | `--tag-sat` (lower = greyer, more muted) |
| How light the text is | `--tag-light` |
| The × when you hover a tag | `--tag-remove` |
| Text size of a tag | `editor.css` → `.tag-chip` → `font-size` (tags have no background; to bring one back, add `background: hsl(var(--tag-h) var(--tag-sat) var(--tag-light) / 0.15)` and a little `padding` / `border-radius` there) |
| Where the tags sit in the right margin — sideways | `--rail-gap` (distance from the text) and `--rail-width` (how wide the tag column is), in `tokens.css` |
| Where the tags sit — up and down | `config.js` → `tags.align`: `'center'` (middle of the block), `'top'` (level with its first line) or `'bottom'`; `tags.topOffset` nudges `'top'` |
| Narrow layout (phone, or beside the side pane) | The tags automatically move to sit right after the last word of their paragraph. Distance from the word: `config.js` → `tags.inlineGap`; spacing between tags: `.tag-rail.is-compact .tag-group` → `gap` in `editor.css` |

Currently soft and muted, colour only: dark `--tag-sat: 30%`, `--tag-light: 70%`; light `26%` / `44%`. For stronger colours raise `--tag-sat` (about `60%` is vivid).

## 5. Highlight and text colours

The palette is used by the highlighter and the text-colour picker.

| Change | Where |
|---|---|
| Colour of a highlight tint / the text colour | `tokens.css` section 7: `--hl-<name>-bg` (tint behind the text) and `--hl-<name>-fg` (the text colour and the swatch). Once for dark, once for light |
| Names shown on the swatches | `config.js` → `colors` |
| Which colour is used first | `config.js` → `defaults.highlight` / `defaults.textColor` |

**Adding a colour (three places):**
1. `config.js` → `colors`: add `{ id: 'teal', label: 'Teal' }`. The id must be **3 to 10 lowercase letters** (otherwise it is dropped when saving).
2. `tokens.css` section 7: add `--hl-teal-bg` and `--hl-teal-fg` in the dark block and in the light block.
3. `css/editor.css`: copy the two rules for an existing colour (`mark[data-hl="blue"]` and `span[data-tc="blue"]`) and change the name.

## 6. The block you jumped to (soft highlight)

When a thread, tag list or the side pane takes you to a block, it gets a subtle tint that stays until you click or type.

| Change | Where |
|---|---|
| Colour / strength | `--block-target-bg` (dark and light) |
| Glow size around the block | `editor.css` → `.editor .is-target` → `box-shadow: 0 0 0 6px …` |

## 7. The side pane (two cards with a gap)

| Change | Where |
|---|---|
| Gap between the page and the pane (also the grab area) | `--pane-divider-w` (bigger on touch screens: the `pointer: coarse` line under it) |
| Narrowest either card may get | `--pane-min` |
| Width the pane starts at, and after a double-click | `config.js` → `pane.defaultWidth` (0.5 = half) |
| Keyboard resize step (← → on the divider) | `config.js` → `pane.keyStep` |
| The grip that appears when you point at the gap | colours: `--pane-grip-bg`, `--pane-grip-color`, `--pane-grip-color-hover`. Icon: `icons.js` → `dividerGrip`. Size: `.divider__grip` in `layout.css` |
| Pane card corners and colour | they follow the page card: `--card-radius` and `--bg-card` |
| Pane header height | `.pane__head` in `layout.css` |
| Inner side padding of the pane | `.pane` in `layout.css` → `--view-pad` (the handle and the line beside the paragraph need room — keep it above about 40px) |

**Opening it:** Shift+click a note link; Shift+click a tag in a note; or click a block in a thread or tag list. On a phone it opens as a full-screen sheet (tap a block in a thread or tag list); the back gesture closes it.

## 8. The writing page

| Change | Where |
|---|---|
| Text size / line height | `--prose-fs`, `--prose-lh` |
| Heading sizes | `--prose-h1` … `--prose-h4` (relative to `--prose-fs`) |
| Width of the writing column | `--editor-width` |
| Space above / below the text | `--editor-pad-top`, `--editor-pad-bottom` |
| Space between paragraphs | `--prose-block-gap` |
| Brightness of the paragraph you are in / the others | `--prose-text-active` / `--prose-text` |
| Dimming in focus mode | `--prose-text-strict` |
| Fonts | `--font-sans`, `--font-mono` |

## 9. The floating toolbar over selected text

Layout and look: `.sel-toolbar`, `.sel-btn`, `.sel-pop` in `editor.css`. Buttons: `js/editor/selection-toolbar.js`. The "…" menu is described in section 3; the colour swatches in section 5.

## 10. Icons in thread and tag rows

Each row ends with a note icon + note name, and a folder icon + notebook name. They use the normal icons:

| Shown | Icon name in `icons.js` |
|---|---|
| Note | `note` |
| Notebook | `folder` |
| Journal entry | `journal` |
| Note with no notebook | `inbox` |

Replace the markup of those names and they change everywhere (the sidebar uses them too). Row layout: `.block-row__where`, `.where__item` in `css/gallery.css`.

## 11. The (i) About window

Everything in it is plain text in `config.js` → `about`: `title`, `tagline`, and `rows` (each row is `['Label', 'Text']`). Add, remove or reorder rows freely. Look: `.modal__box--about`, `.about` in `css/components.css`.

## 12. Inbox

The Inbox lists every note that has no notebook (journal entries are not included). New notes start there unless you create them inside a notebook. To file a note, choose a notebook in the bar at the top of the note; to bring it back, choose **Inbox**.

## 13. Shortcuts

All in `config.js` → `shortcuts`. Format: `Mod+Shift+1` (Mod = Ctrl on Windows/Linux, Cmd on Mac). On a German layout, `/` needs Shift, so remap `sidebar.toggle` and `topbar.toggle` if they clash.

## Checklist when you add a new file

If you create a new `.js` or `.css` file, add its path to the `SHELL` list in `sw.js` and bump `CACHE` (for example `notes-app-v8`), so the offline copy updates.
