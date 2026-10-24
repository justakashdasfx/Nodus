/* ============================================================================
   ICONS — every icon is a file: /icons-ui/<name>.svg   (24×24 grid, 1.5px line, Phosphor-style)
   Use:  icon('plus')   or   icon('plus', 16)

   TO SWAP AN ICON   replace its file in /icons-ui/ (same name). Nothing else changes.
   TO ADD AN ICON    drop  my-icon.svg  into /icons-ui/ and call icon('my-icon').
                     Export from Figma at 24×24 with a visible stroke or fill; the colour inside the file is
                     ignored — the icon always takes the text colour of the place it sits in.
   The size and the mask are in css/base.css (.icon). Add new files to SHELL in sw.js to have them offline on first load.
   ========================================================================== */

export function icon(name, size = 18) {
  return `<span class="icon" aria-hidden="true" style="--icon:url(/icons-ui/${name}.svg);width:${size}px;height:${size}px"></span>`;
}
