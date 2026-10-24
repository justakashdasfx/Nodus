# Customize Nodus

Almost everything visual lives in **`css/tokens.css`**. Edit it, save, hard refresh (Ctrl/Cmd+Shift+R).

## 1. Colours are grey steps
The Radix gray scale is typed once, in section 11 (`--grey-50` … `--grey-1200`, dark and light).
Everything else points at a step. To recolour something, change which step a **role** uses (section 13):

| Role | What it colours | Now |
|---|---|---|
| `--bg-app` / `--bg-card` / `--bg-raised` | page + sidebar / writing card / menus, dialogs, gallery cards | 100 / 200 / 300 |
| `--search-bg` / `--toggle-bg` | sidebar search box / Write·Read toggle | 200 / 50 |
| `--border` / `--border-strong` | all outlines and dividers / inputs | 500 / 700 |
| `--bg-hover` / `--bg-pressed` | hover / pressed and selected | 500 / 600 |
| `--text` / `--text-dim` / `--text-muted` / `--text-faint` | main / secondary / counts + icons / placeholders | 1200 / 1100 / 1000 / 900 |
| `--handle-color` (+ `-hover`) | six-dot handle | 900 (1200) |

Accent colours (accent, steel, danger, ok, warn) are the only hex values: section 12.
The light theme keeps the previous palette until you send Radix light values; its role overrides are the
`:root[data-theme="light"]` blocks.

## 2. The note
Section 17: Write mode (focused / unfocused text and headings, quote, inline code, ticked items, focus dimming)
and Read mode (body, headings, quote, code, ticked). All are grey steps.
Code blocks: section 19 (`--code-*`; the syntax colours stay pastel hex).

## 3. Sizes, radius, spacing
Type: section 2 (`--fs-ui`, `--fs-small`, `--fs-tiny`, `--fs-title`, prose sizes).
Spacing scale: section 3 (`--space-1` … `--space-8` = 4 8 12 16 24 32 40 48).
Radius scale: section 4 (`--r-xs` 4, `--r-sm` 6, `--r-md` 12, `--r-lg` 16, `--r-card`, `--r-search`, `--r-toggle`, `--r-pill`).
Layout (sidebar, top bar, card, writing column, tag rail, side pane): section 5.

## 4. Sidebar rows
Bar width and the **selected indent** are in section 6 of tokens.css:
`--nav-active-indent`, `--folder-active-indent`, `--note-active-indent` (3px now; set `0px` to turn the indent off).
Row colours (one set for all three kinds): section 15, the `--row-*` lines.

## 5. Gallery
Section 7: `--gallery-min`, `--gallery-gap`, `--gallery-preview-h` (192), `--gallery-meta-h` (64), note-name size, notebook/date size.
Card height = preview + info + 2px outline = 258px.

## 6. Menus: slash "/" menu, six-dot menu, selection toolbar
- **Height of a row**: `--menu-item-h` (section 8). Phones: `--menu-item-h-touch`.
- **Width / max height / padding / icon size / gap**: `--menu-w`, `--menu-max-h`, `--menu-pad`, `--menu-icon-size`, `--menu-gap`.
- **Highlight under the pointer or arrow keys**: `--menu-item-hover-bg`, `--menu-item-hover-text` (section 16).
- **Icon, hint and heading colours**: `--menu-icon-color`, `--menu-hint-color`, `--menu-title-color`.
- **Toolbar over selected text (B I U …)**: size `--toolbar-btn-size`, colours `--toolbar-icon-color`, `--toolbar-btn-hover-bg`, `--toolbar-btn-on-bg`.
- **Which icon a block type shows**: the last item of its row in `js/core/config.js` → `blockTypes` (a file name in `/icons-ui/`).
- Styles: `.block-menu*`, `.sel-toolbar`, `.sel-btn`, `.sel-pop` in `css/editor.css`.

## 7. Icons live in `/icons-ui/`
One file per icon: `/icons-ui/<name>.svg` (24×24). Use `icon('name', size)` from `js/core/icons.js`.
- **Swap**: replace the file, keep the name.
- **Add**: drop `my-icon.svg` in the folder, call `icon('my-icon')`. The colour inside the file is ignored; the icon takes the text colour of where it sits.
- Add new files to `SHELL` in `sw.js` (and bump `CACHE`) so they are there offline on first load.

## 8. Buttons
`.btn--primary` and `.btn--secondary` (css/components.css); their colours, sheen and shadows are section 14 of tokens.css.
Primary = dark fill + blue sheen + inner highlight/shade + thin ring. `.btn--solid` (the current filled button) uses `--bg-solid`.

## Checklist when you add a file
Add it to `SHELL` in `sw.js` and bump `CACHE`, so the offline copy refreshes.
