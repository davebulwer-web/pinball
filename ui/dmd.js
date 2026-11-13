// The dot-matrix score strip across the top of the screen: 160 dots wide and 16 tall (or 32 tall for a table
// that sets dmd: { rows: 32 }, for more detailed pictures), two screen pixels per dot.
// It shows the score, player and ball, and plays messages over them (`show`), which time out.
// A message can be an animated scene: show(lines, { scene }) where scene(api, p, lines, t) draws one frame
// with api = { set(x, y, v), text(s, x, y, { sc, align, v, clip: [x0, x1] }), lines(lines, opts), W, H } and p running
// 0..1 over the message. lines() writes one or two lines of a message centred, as large as they fit.

import { glyph, commas } from './font.js';

export const DMD_W = 160;

export function createDmd({ rows = 16, on = [255, 150, 30], mid = [150, 80, 15], off = [52, 26, 8], bg = [16, 8, 4] } = {}) {
  const DMD_H = rows, tall = rows >= 32;
  const dots = new Uint8Array(DMD_W * DMD_H);   // 0 off, 1 dim, 2 lit
  let img = null;
  const queue = [];                               // messages: { lines, big, until, blink }
  let now = 0;

  const clear = () => dots.fill(0);
  const set = (x, y, v = 2) => { if (x >= 0 && x < DMD_W && y >= 0 && y < DMD_H) dots[y * DMD_W + x] = Math.max(dots[y * DMD_W + x], v); };
  const width = (s, sc = 1) => (String(s).length * 6 - 1) * sc;
  function text(s, x, y, { sc = 1, align = 'left', v = 2, clip = null } = {}) {
    s = String(s);
    let cx = align === 'center' ? Math.round(x - width(s, sc) / 2) : align === 'right' ? x - width(s, sc) : x;
    for (const ch of s) {
      const rows = glyph(ch);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
        if (rows[r] & (0x10 >> c)) for (let i = 0; i < sc; i++) for (let j = 0; j < sc; j++) { const px = cx + c * sc + i; if (!clip || (px >= clip[0] && px < clip[1])) set(px, y + r * sc + j, v); }
      cx += 6 * sc;
    }
  }

  // one or two lines, centred, each as large as fits (a tall display has room for double-size letters)
  function lines(ls, { v = 2, clip = null, big = false } = {}) {
    if (!Array.isArray(ls)) ls = [ls];
    const fit = (s, max) => { for (let sc = max; sc > 1; sc--) if (width(s, sc) <= DMD_W) return sc; return 1; };
    if (ls.length > 1) {
      const half = DMD_H / 2;
      ls.slice(0, 2).forEach((s, i) => {
        const sc = tall ? fit(s, 2) : 1;
        text(s, DMD_W / 2, i * half + Math.floor((half - 7 * sc) / 2) + (tall ? 0 : i), { sc, align: 'center', v, clip });
      });
    } else {
      const sc = fit(ls[0], tall ? 3 : big ? 2 : 1);
      text(ls[0], DMD_W / 2, Math.floor((DMD_H - 7 * sc) / 2), { sc, align: 'center', v, clip });
    }
  }

  const api = { set, text, lines, W: DMD_W, H: DMD_H };

  // queue a message. lines: one or two strings; big: one line at double size
  function show(lines, { secs = 2, big = false, blink = false, scene = null } = {}) {
    if (!Array.isArray(lines)) lines = [lines];
    queue.push({ lines, big, blink, secs, scene, start: null });
    if (queue.length > 4) queue.splice(0, queue.length - 4);
  }
  const busy = () => queue.length > 0;

  function frame(t, state) {
    now = t;
    clear();
    let m = queue[0];
    if (m && m.start === null) m.start = t;
    if (m && t - m.start > m.secs) { queue.shift(); m = queue[0]; if (m) m.start = t; }
    if (m?.scene) { m.scene(api, Math.min(1, (t - m.start) / m.secs), m.lines, t - m.start); return; }
    if (m) {
      const visible = !m.blink || Math.floor((t - m.start) * 6) % 2 === 0;
      if (visible) {
        lines(m.big ? [m.lines[0]] : m.lines, { big: true });
      }
      return;
    }
    // the normal score screen
    const s = state();
    if (s.entry) {
      const e = s.entry, blink = Math.floor(t * 3) % 3 === 2;
      const name = [...e.name].map((c, i) => (i === e.slot && blink ? ' ' : c === ' ' ? '_' : c)).join('');
      lines([e.players > 1 ? `PLAYER ${e.player} HIGH SCORE` : 'NEW HIGH SCORE', `NAME ${name}`]);
      return;
    }
    if (s.attract) {
      const phase = Math.floor(t / 2.5) % 4;
      if (phase === 0) { lines([s.title, '']); lines(['', s.touch ? 'TAP TO PLAY' : 'PRESS SPACE'], { v: Math.floor(t * 2) % 2 ? 2 : 1 }); }
      else if (phase === 1 && s.champion) lines(['HIGH SCORE', `${s.champion[0]}  ${commas(s.champion[1])}`]);
      else if (phase === 2 || phase === 1) lines(['LAST SCORE', commas(s.lastScore ?? 0)]);
      else lines(['1 TO 4 PLAYERS', s.touch ? 'RULES: TAP ?' : 'RULES: PRESS H']);
      return;
    }
    const low = DMD_H - 7;
    text(`P${s.player}`, 0, 0, { v: 1 });
    if (s.mode) text(s.mode, 0, low, { v: Math.floor(t * 4) % 2 ? 2 : 1 }); else text(`B${s.ball}`, 0, low, { v: 1 });
    const sc = commas(s.score);
    const size = [tall ? 3 : 2, 2, 1].find(k => k === 1 || width(sc, k) <= DMD_W - 16);
    text(sc, DMD_W - 1, Math.max(1, Math.floor((DMD_H - 7 * size) / 2)), { sc: size, align: 'right' });
  }

  // paint the dots into a w x h block of screen pixels (2x2 per dot, with a dark corner for the grid look)
  function paint(ctx, x0, y0) {
    if (!img) img = ctx.createImageData(DMD_W * 2, DMD_H * 2);
    const d = img.data, W = DMD_W * 2;
    const cols = [off, mid, on];
    for (let y = 0; y < DMD_H; y++) for (let x = 0; x < DMD_W; x++) {
      const c = cols[dots[y * DMD_W + x]];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const p = ((y * 2 + j) * W + x * 2 + i) * 4;
        const col = i === 1 && j === 1 ? bg : c;
        d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  return { show, busy, frame, paint, clearQueue: () => (queue.length = 0), W: DMD_W, H: DMD_H, rows: DMD_H * 2 };
}
