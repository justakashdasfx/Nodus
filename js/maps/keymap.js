/* ============================================================================
   MAP SHORTCUTS — change any combo here. Format: 'Mod+Shift+Z' (Mod = Ctrl, or Cmd on a Mac).
   Several combos for one action: list them. An empty list switches the action off.
   Keys: Enter · Tab · Space · Escape · Delete · Backspace · F2 · ArrowUp/Down/Left/Right · letters · digits · = · -
   Two scopes: `canvas` (a node is selected) and `editing` (you are typing inside a node).
   ========================================================================== */

import { matches } from '../core/keys.js';

export const KEYMAP = {
  canvas: {
    'node.sibling':  ['Enter'],                       // a new node on the same level (on the centre it adds a branch)
    'node.child':    ['Tab'],                         // a new branch under the selected node
    'node.float':    ['Mod+Enter'],                   // a new floating node in the middle of the screen (or double-click empty canvas)
    'find.open':     ['Mod+F'],                       // find text in the map
    'node.duplicate': ['Mod+D'],                      // a copy of the selected branches right after them (Ctrl+C / X / V copy, cut and paste)
    'node.edit':     ['F2'],                          // type in the selected node (or double-click it)
    'node.delete':   ['Delete', 'Backspace'],         // delete the node and everything under it
    'node.collapse': ['Mod+.'],                       // fold / unfold the branch (Space is the hand tool now)
    'select.all':    ['Mod+A'],
    'select.none':   ['Escape'],
    'nav.up':        ['ArrowUp'],
    'nav.down':      ['ArrowDown'],
    'nav.left':      ['ArrowLeft'],
    'nav.right':     ['ArrowRight'],
    'edit.undo':     ['Mod+Z'],
    'edit.redo':     ['Mod+Shift+Z', 'Mod+Y'],
    'view.fit':      ['Mod+0'],                       // fit the whole map on screen
    'view.reset':    ['Mod+1'],                       // back to 100%
    'view.zoomIn':   ['Mod+='],
    'view.zoomOut':  ['Mod+-'],
  },
  editing: {
    'edit.next':      ['Enter'],                      // finish this node, start a new one on the same level
    'edit.nextChild': ['Tab'],                        // finish this node, start a branch under it
    'edit.newline':   ['Shift+Enter'],                // a line break inside the node. (Inside a list, Enter adds an item instead.)
    'edit.bullets':   ['Mod+Shift+8'],                // lists (Ctrl+B / I / U for bold, italic, underline work by themselves)
    'edit.numbers':   ['Mod+Shift+7'],
    'edit.checklist': ['Mod+Shift+9'],
    'edit.done':      ['Escape', 'Mod+Enter'],        // finish typing (an empty new node is removed)
  },
};

/** Hold this key and drag to move the canvas (the middle mouse button always does). Any KeyboardEvent.code: 'Space', 'AltLeft' … */
export const HAND_CODE = 'Space';
export const HAND_LABEL = 'Space';

/** The action a key press triggers in a scope, or null. */
export function matchAction(e, scope) {
  for (const [action, combos] of Object.entries(scope)) {
    for (const combo of combos) {
      if (matches(e, combo.replace(/(^|\+)Space$/, '$1 '))) return action;   // keys.js sees the space bar as ' '
    }
  }
  return null;
}
