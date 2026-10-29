/* ============================================================================
   EMPTY-STATE ART — small line illustrations for the "nothing here yet" pages.
   Used by emptyState() in js/ui/components.js:  emptyState({ title, text, actionHtml, art: 'notes' }).
   Each drawing is 120 x 96, one line weight, drawn with currentColor (so it follows the theme); the parts with class="a" use the
   accent colour, class="bg" parts are filled with the card colour so shapes can overlap.
   Colours, size and line weight: css/components.css → ".empty__art".
   ========================================================================== */

const ART = {
  /* a page with lines and a small "+" */
  notes: `<rect x="40" y="12" width="50" height="64" rx="7"/>
    <rect class="bg" x="26" y="22" width="50" height="64" rx="7"/>
    <path d="M37 42h26M37 53h26M37 64h14"/>
    <circle class="a" cx="80" cy="76" r="12"/><path class="a-line" d="M80 70v12M74 76h12"/>`,

  /* an inbox tray */
  inbox: `<path d="M34 46l6-18a5 5 0 0 1 4.7-3.4h30.6A5 5 0 0 1 80 28l6 18"/>
    <path d="M52 36h16" class="a-line"/>
    <path d="M24 56a10 10 0 0 1 10-10h52a10 10 0 0 1 10 10v16a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8z"/>
    <path d="M24 58h22a4 4 0 0 1 4 4 10 10 0 0 0 20 0 4 4 0 0 1 4-4h22"/>`,

  /* two notebooks with a bookmark */
  notebooks: `<rect x="42" y="10" width="50" height="66" rx="7"/>
    <rect class="bg" x="28" y="20" width="50" height="66" rx="7"/>
    <path d="M40 20v66"/><path d="M50 44h16M50 54h12"/>
    <path class="a" d="M62 20v17l5.5-4 5.5 4V20"/>`,

  /* a tag */
  tags: `<g transform="translate(60 48) rotate(-45)">
      <path d="M-36 0l16-16h50a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7h-50z"/>
      <circle class="a" cx="-14" cy="0" r="4.5"/>
      <path d="M2 -5h22M2 5h14"/>
    </g>`,

  /* a thread: lines strung on one line */
  threads: `<path d="M34 28v40" stroke-dasharray="3 4"/>
    <path d="M46 28h46M46 48h52M46 68h32"/>
    <circle class="bg" cx="34" cy="28" r="6"/><circle class="a" cx="34" cy="48" r="6"/><circle class="bg" cx="34" cy="68" r="6"/>`,

  /* a checklist */
  tasks: `<rect x="30" y="12" width="60" height="72" rx="8"/>
    <rect x="40" y="26" width="11" height="11" rx="3"/><path d="M59 31.5h20"/>
    <rect class="a" x="40" y="45" width="11" height="11" rx="3"/><path class="a-line" d="M42.5 50.5l2.5 2.5 4-5"/><path d="M59 50.5h14"/>
    <rect x="40" y="64" width="11" height="11" rx="3"/><path d="M59 69.5h18"/>`,

  /* a small mind map */
  maps: `<path d="M32 48h12"/><path d="M76 48c6 0 6-22 12-22M76 48c6 0 6 22 12 22"/>
    <rect class="bg" x="8" y="42" width="24" height="12" rx="6"/>
    <rect class="a" x="44" y="38" width="32" height="20" rx="10"/>
    <rect class="bg" x="88" y="20" width="24" height="12" rx="6"/>
    <rect class="bg" x="88" y="64" width="24" height="12" rx="6"/>`,

  /* a calendar page */
  journal: `<rect x="28" y="20" width="64" height="60" rx="9"/>
    <path d="M28 38h64"/><path d="M45 13v13M75 13v13"/>
    <circle class="a" cx="60" cy="58" r="8"/>
    <path d="M42 58h.01M78 58h.01M42 70h.01M60 70h.01M78 70h.01"/>`,

  /* a bin */
  trash: `<path d="M30 30h60"/><path d="M50 30v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6"/>
    <path d="M36 30l3 46a7 7 0 0 0 7 6.5h28a7 7 0 0 0 7-6.5l3-46"/>
    <path class="a-line" d="M53 44v26M67 44v26"/>`,

  /* a magnifier: not found / no results */
  notfound: `<circle cx="54" cy="42" r="22"/><path d="M71 59l19 19"/>
    <path class="a-line" d="M44 42a10 10 0 0 1 10-10"/>`,
};

/** The <svg> for a key (falls back to the notes drawing). */
export function emptyArt(key) {
  return `<svg viewBox="0 0 120 96" aria-hidden="true" focusable="false">${ART[key] || ART.notes}</svg>`;
}
