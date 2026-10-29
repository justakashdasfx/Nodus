/* ============================================================================
   MAP DRAG — everything you do by dragging a node:
     · move nodes. The nodes themselves follow the pointer.
         - Free layout, and floating nodes: they simply stay where you drop them.
         - Otherwise drop on a node to make them its children; on its top or bottom edge to put them before / after it (re-order).
           Alt + drop on empty canvas cuts any node loose as a floating one.
     · connect: pull the small handle under a selected node onto another node
     · resize: pull the right edge of a sticky note
   The engine (js/maps/engine.js) hands over a `ctx` with what is needed; nothing here touches the model except through js/maps/model.js.
   ========================================================================== */

import * as M from './model.js';
import { linkPath, edgesSvg } from './render.js';

const THRESHOLD = 5;   // px you must drag before it counts as a drag (a click selects)

export function attachDrag(ctx) {
  const { map, viewport } = ctx;
  let busy = false;
  let cleanups = [];

  const nodeAt = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest('.mm-node') || null;

  /** Listens on the whole window until the gesture ends. */
  function track(onMove, onUp) {
    busy = true;
    const move = (e) => onMove(e);
    const up = (e) => { stop(); onUp(e); };
    const cancel = () => { stop(); onUp(null); };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      busy = false;
      cleanups = cleanups.filter((c) => c !== stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    cleanups.push(stop);
  }

  /** The selected nodes that can move: not the centre, and not children of another selected node (they travel with it). */
  function dragSet(id) {
    const base = (ctx.picked.has(id) ? [...ctx.picked] : [id]).filter((x) => x !== map.root && map.nodes[x]);
    return base.filter((x) => !base.some((o) => o !== x && M.isDescendant(map, x, o)));
  }

  /* ---------- Move ---------- */

  function armMove(e, id, keep) {
    if (busy) return;
    const start = { x: e.clientX, y: e.clientY };
    const w0 = ctx.toWorld(e);
    const free = map.layout === 'free';
    let active = false, ids = [], moving = [], bar = null, hot = null, before = null, live = false, origin = {};

    const clearHot = () => { hot?.classList.remove('is-drop'); hot = null; bar?.remove(); bar = null; };

    function findDrop(ev) {
      if (free) return null;                                                                   // free layout: nodes are placed, not re-parented
      const t = nodeAt(ev);
      if (!t) return null;
      const tid = t.dataset.id;
      if (ids.includes(tid) || ids.some((r) => M.isDescendant(map, tid, r))) return null;     // not into itself
      const box = t.getBoundingClientRect();
      const f = (ev.clientY - box.top) / box.height;
      let mode = 'child';
      if (map.nodes[tid].p) mode = f < 0.28 ? 'before' : f > 0.72 ? 'after' : 'child';        // edges re-order, the middle makes a child
      const side = tid === map.root && map.layout !== 'right' ? (ev.clientX < box.left + box.width / 2 ? 'l' : 'r') : undefined;
      return { tid, mode, side, el: t };
    }

    function show(d) {
      if (d.mode === 'child') { d.el.classList.add('is-drop'); hot = d.el; return; }
      const p = ctx.pos[d.tid];
      bar = document.createElement('div');
      bar.className = 'mm__drop';
      bar.style.cssText = `left:${p.x}px;top:${d.mode === 'before' ? p.y - 5 : p.y + p.h + 2}px;width:${p.w}px`;
      ctx.layer.append(bar);
    }

    /** Move the real nodes with the pointer. live: the model changes as you drag (floating nodes, Free layout);
        otherwise only the picture does, and the model changes when you drop. */
    function follow(dx, dy) {
      if (live) {
        for (const x of ids) {
          const n = map.nodes[x];
          if (n.fl) { n.x = origin[x].a + dx; n.y = origin[x].b + dy; }
          else { n.dx = origin[x].a + dx; n.dy = origin[x].b + dy; }
        }
        ctx.relayout();
        return;
      }
      const p2 = { ...ctx.pos };
      for (const k of moving) {
        const p = ctx.pos[k];
        p2[k] = { ...p, x: p.x + dx, y: p.y + dy, cy: p.cy + dy };
        ctx.els.get(k).style.transform = `translate(${p2[k].x}px, ${p2[k].y}px)`;
      }
      ctx.svg.innerHTML = edgesSvg(map, p2);
    }

    function finish() {
      ids.forEach((x) => ctx.els.get(x)?.classList.remove('is-dragging'));
      moving.forEach((x) => ctx.els.get(x)?.classList.remove('is-dragging'));
      clearHot();
      viewport.classList.remove('is-moving');
    }

    track((ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
        ids = dragSet(id);
        if (!ids.length) return;
        active = true;
        before = ctx.snapshot();
        live = free || ids.every((x) => map.nodes[x].fl);
        for (const x of ids) { const n = map.nodes[x]; origin[x] = n.fl ? { a: n.x, b: n.y } : { a: n.dx || 0, b: n.dy || 0 }; }
        moving = [...ctx.els.keys()].filter((k) => ids.includes(k) || ids.some((r) => M.isDescendant(map, k, r)));
        moving.forEach((x) => ctx.els.get(x)?.classList.add('is-dragging'));
        viewport.classList.add('is-moving');
      }
      if (!active) return;
      const w = ctx.toWorld(ev);
      follow(w.x - w0.x, w.y - w0.y);
      clearHot();
      const d = findDrop(ev);
      if (d) show(d);
    }, (ev) => {
      if (!active) { finish(); if (keep && ev) ctx.select(id, { scroll: false }); return; }
      const target = ev ? findDrop(ev) : null;
      finish();
      const w1 = ev ? ctx.toWorld(ev) : w0;
      const dx = w1.x - w0.x, dy = w1.y - w0.y;
      if (target) {
        M.moveNodes(map, ids, target.tid, target.mode, { side: target.side });
      } else if (!live && ev?.altKey) {                                         // Alt cuts a node loose
        for (const x of ids) { const p = ctx.pos[x]; M.detach(map, x, p.x + dx, p.y + dy); }
      } else if (!live) {                                                       // dropped on nothing: it springs back
        ctx.relayout();
        return;
      } else if (Math.abs(dx) + Math.abs(dy) < 2) { ctx.relayout(); return; }
      ctx.commitHistory(before);
      ctx.afterStructure(ids);
    });
  }

  /* ---------- Connect ---------- */

  function startLink(e, id) {
    if (busy || !ctx.pos[id]) return;
    const A = ctx.pos[id];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'mm-link mm-link--temp');
    ctx.svg.append(path);
    let hot = null;
    const end = () => { path.remove(); hot?.classList.remove('is-drop'); hot = null; };

    track((ev) => {
      const w = ctx.toWorld(ev);
      path.setAttribute('d', linkPath(A, { x: w.x, y: w.y, w: 0, h: 0 }));
      const t = nodeAt(ev);
      const ok = t && t.dataset.id !== id ? t : null;
      if (hot && hot !== ok) hot.classList.remove('is-drop');
      hot = ok;
      hot?.classList.add('is-drop');
    }, (ev) => {
      const t = ev ? nodeAt(ev) : null;
      end();
      const tid = t?.dataset.id;
      if (!tid || tid === id || !map.nodes[tid] || M.hasLink(map, id, tid)) return;
      ctx.snap();
      M.addLink(map, id, tid);
      ctx.afterLink();
    });
  }

  /* ---------- Resize a sticky note ---------- */

  function startResize(e, id) {
    if (busy) return;
    const n = map.nodes[id];
    const el = ctx.els.get(id);
    if (!n || !el) return;
    const before = ctx.snapshot();
    const x0 = e.clientX, w0 = el.offsetWidth;
    let moved = false;
    track((ev) => {
      n.w = Math.round(Math.min(640, Math.max(120, w0 + (ev.clientX - x0) / ctx.view.k)));
      el.style.width = `${n.w}px`;
      moved = true;
      ctx.relayout();
    }, () => { if (moved) ctx.commitHistory(before); });
  }

  return { armMove, startLink, startResize, destroy: () => cleanups.slice().forEach((c) => c()) };
}
