/* ============================================================================
   MIND MAPS — numbers you may want to tweak.  (Colours and sizes of the nodes: css/tokens.css → section 22.
   Shortcuts: js/maps/keymap.js.)
   ========================================================================== */

export const MAPS = {
  /* ---- Zoom and movement ---- */
  zoom: {
    min: 0.2, max: 3,
    step: 1.2,          // one press of Ctrl+= / Ctrl+- or one click on + / −
    fitPadding: 80,     // px of air around the map when you press Fit
    fitMax: 1,          // Fit never zooms in past this (1 = 100%)
  },
  wheel: 'pan',         // 'pan': the wheel / two-finger scroll moves the canvas, Ctrl+wheel and pinch zoom.   'zoom': the wheel zooms
  grid: { size: 24 },   // distance between the dots of the grid background (px at 100%)

  /* ---- Layout: distances between nodes (px) ---- */
  layout: {
    gapX: 52,           // between a node and its children
    gapY: 12,           // between siblings
    rootGapX: 70,       // between the central node and its first branches
    rootGapY: 22,       // between two main branches
  },

  /* ---- Lines: [thickness at the parent, thickness at the child] for the Tapered style; width for Curved / Elbow ---- */
  lines: {
    tapered: { root: [14, 3], level1: [9, 2.2], deep: [5.5, 1.6] },
    stroke:  { root: 3.2, level1: 2.6, deep: 2 },
    elbowRadius: 12,
  },

  palette: 8,           // how many pastel branch colours there are (--mm-p1 … --mm-p8 in tokens.css)
  saveDelay: 300,       // ms after the last change before the map is saved
  history: 100,         // undo steps kept
};

/* ---- Choices shown in the ⋯ menu of a map ([id, label]); the first of each is the default ---- */
export const THEMES  = [['colored', 'Colored'], ['neutral', 'Neutral']];
export const LINES   = [['tapered', 'Taper'], ['curved', 'Curve'], ['elbow', 'Elbow']];
export const LAYOUTS = [['both', 'Both'], ['right', 'Right'], ['free', 'Free']];   // both sides of the centre · right side only · free: both sides, and you can drag any node anywhere

export const SHAPES  = [['round', 'Rounded'], ['pill', 'Pill'], ['square', 'Square']];

export const DEFAULTS = { theme: 'colored', line: 'tapered', layout: 'both', shape: 'round' };
