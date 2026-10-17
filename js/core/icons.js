/* ============================================================================
   ICONS — inline SVG, 24×24 grid, drawn as 1.5px line icons (Phosphor-style).
   To swap an icon, replace the markup string for that name. Nothing else
   in the app needs to change.  Usage: icon('plus')  or  icon('plus', 16)
   ========================================================================== */

const PATHS = {
  menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home:      '<path d="M3.5 11 12 3.5 20.5 11M5.5 9.5V20h5v-6h3v6h5V9.5"/>',
  journal:   '<path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4zM6 18a2 2 0 0 1 2-2h11M10 8h5"/>',
  notebooks: '<path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/>',
  folder:    '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10z"/>',
  note:      '<path d="M6 3.5h8l4.5 4.5V20.5H6zM14 3.5V8h4.5M9 13h6M9 16.5h6"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  upload:    '<path d="M12 16V4.5M7.5 9 12 4.5 16.5 9M4.5 19.5h15"/>',
  download:  '<path d="M12 4.5V16M7.5 11.5 12 16l4.5-4.5M4.5 19.5h15"/>',
  fileDown:  '<path d="M6 3.5h8l4.5 4.5V20.5H6zM14 3.5V8h4.5M12 11.5v5.5M9.75 14.75 12 17l2.25-2.25"/>',
  sun:       '<circle cx="12" cy="12" r="3.75"/><path d="M12 2.5v2M12 19.5v2M4.7 4.7l1.4 1.4M17.9 17.9l1.4 1.4M2.5 12h2M19.5 12h2M4.7 19.3l1.4-1.4M17.9 6.1l1.4-1.4"/>',
  moon:      '<path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2z"/>',
  trash:     '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 12.5h9.4L17.5 7M9 7V4.5h6V7"/>',
  restore:   '<path d="M4.5 4.5V9H9M5 9a8 8 0 1 1-.5 3.5"/>',
  caret:     '<path d="m9.5 6 6 6-6 6"/>',
  more:      '<g fill="currentColor" stroke="none"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></g>',
  italic:    '<path d="M10 5h8M6 19h8M14.5 5 9.5 19"/>',
  bold:      '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z"/>',
  underline: '<path d="M7 4.5v7a5 5 0 0 0 10 0v-7M5 20h14"/>',
  quote:     '<path d="M9.5 7H6v5h3.5v1a2.5 2.5 0 0 1-2.5 2.5M18 7h-3.5v5H18v1a2.5 2.5 0 0 1-2.5 2.5"/>',
  code:      '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/>',
  brush:     '<path d="m14.5 4.5 5 5-8.5 8.5H6v-5zM13 6l5 5M4 21h7"/>',
  pencil:    '<path d="M4.5 19.5h4L19 9l-4-4L4.5 15.5zM13 7l4 4"/>',
  close:     '<path d="m6 6 12 12M18 6 6 18"/>',
  check:     '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  font:      '<path d="M3.5 19 8.5 6l5 13M5.5 14h6M16.5 19v-5.5M16.5 14a2.75 2.75 0 0 1 5 0V19"/>',
  clear:     '<path d="M5 5l14 14M9 5h9M12.5 5 10 12M7 19h6"/>',
  bullets:   '<path d="M9.5 7H20M9.5 12H20M9.5 17H20"/><g fill="currentColor" stroke="none"><circle cx="4.5" cy="7" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="17" r="1.2"/></g>',
  threads:   '<path d="M4 7h16M4 12h11M4 17h16"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  clock:     '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>',
  grip:      '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></g>',
  copy:      '<path d="M8.5 8.5h10v11h-10zM15.5 8.5v-3h-10v11h3"/>',
  arrowUp:   '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
  arrowLeft: '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
  external:  '<path d="M14 5h5v5M19 5l-8 8M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10"/>',
  dividerGrip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></g>',
  info:      '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.75h.01"/>',
  inbox:     '<path d="M4 13.5 6.5 5.5h11l2.5 8M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  tag:       '<path d="M4 12.5V5a1 1 0 0 1 1-1h7.5L20 11.5 12.5 19zM8.5 8.5h.01"/>',
  search:    '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  numbers:   '<path d="M10 7h10M10 12h10M10 17h10M4 6l1.5-1v4M4 15.5c0-1 1.8-1 1.8 0 0 1.5-1.8 2-1.8 3h2"/>',
};

export function icon(name, size = 18) {
  const body = PATHS[name] || '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
