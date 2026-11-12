// Draws a table in pixel style. The fixed parts of the playfield (walls, rails, slingshots) are drawn
// once from the same shapes the physics uses, so what you see is exactly where the ball goes. Moving
// and lit parts (flippers, plunger, bumpers, lamps, balls) are drawn every frame.

import { drawText } from './font.js';
import { offsetPath } from '../engine/geom.js';

const D = Math.PI / 180;

// A pixel mask the size of the playfield: stamp shapes into it, then colour it with an outline.
function mask(w, h) {
  const m = new Uint8Array(w * h);
  const stamp = (x, y, rad) => {
    const r2 = (rad + 0.35) ** 2;
    for (let j = Math.floor(y - rad - 1); j <= Math.ceil(y + rad + 1); j++)
      for (let i = Math.floor(x - rad - 1); i <= Math.ceil(x + rad + 1); i++)
        if (i >= 0 && j >= 0 && i < w && j < h && (i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2 <= r2) m[j * w + i] = 1;
  };
  const line = (a, b, rad) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let k = 0; k <= n; k++) stamp(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, rad);
  };
  const arc = (c, R, a0, a1, rad) => {
    const n = Math.max(2, Math.ceil(R * (a1 - a0) * 2));
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; stamp(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, rad); }
  };
  const tri = (A, B, C) => {
    const minX = Math.floor(Math.min(A[0], B[0], C[0])), maxX = Math.ceil(Math.max(A[0], B[0], C[0]));
    const minY = Math.floor(Math.min(A[1], B[1], C[1])), maxY = Math.ceil(Math.max(A[1], B[1], C[1]));
    const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) {
      const P = [i + 0.5, j + 0.5];
      const d1 = s(P, A, B), d2 = s(P, B, C), d3 = s(P, C, A);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) && i >= 0 && j >= 0 && i < w && j < h) m[j * w + i] = 1;
    }
  };
  // colour: edge pixels dark, the rest light, a highlight on the upper-left edge for a rounded look
  const paint = (ctx, light, dark, hi) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!m[j * w + i]) continue;
      const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
      const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      ctx.fillStyle = edge ? dark : (hi && (!at(i - 1, j - 1) || !at(i, j - 2)) ? hi : light);
      ctx.fillRect(i, j, 1, 1);
    }
  };
  return { stamp, line, arc, tri, paint };
}

const canvasOf = (w, h) => {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  return [c, ctx];
};

// The fixed playfield picture.
export function buildPlayfield(cfg) {
  const [W, H] = cfg.size;
  const col = cfg.colours;
  const [cv, ctx] = canvasOf(W, H);
  // backdrop: plain field with a faint 16px dot grid so scrolling reads clearly
  ctx.fillStyle = col.field; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = '#0c0f18'; ctx.fillRect(cfg.lane.x0, cfg.lane.yTop, cfg.lane.x1 - cfg.lane.x0, H - cfg.lane.yTop);
  drawText(ctx, cfg.name.toUpperCase(), W / 2 - 6, cfg.nameY ?? 470, 'rgba(255,255,255,0.10)', { scale: 2, align: 'center' });

  // slingshot plastics
  const sl = mask(W, H);
  for (const s of cfg.slings ?? []) sl.tri(...s.points);
  sl.paint(ctx, '#3a6fd8', '#1b2f66', '#7aa2ff');
  // walls and rails
  const wm = mask(W, H);
  for (const w of cfg.walls ?? []) {
    if (w.layer) continue;   // raised walls are drawn on the overlay
    const rad = Math.max(1.2, w.r ?? 1);
    if (w.path) for (let i = 0; i + 1 < w.path.length; i++) wm.line(w.path[i], w.path[i + 1], rad);
    if (w.arc) wm.arc(w.arc.c, w.arc.R, w.arc.from * D, w.arc.to * D, rad);
  }
  for (const g of cfg.gates ?? []) wm.line(g.a, g.b, 0.8);
  for (const r of cfg.ramps ?? []) for (const [a, b] of r.funnelWalls ?? []) wm.line(a, b, 1.5);
  for (const p of cfg.posts ?? []) wm.stamp(p.c[0], p.c[1], p.R + 0.5);
  wm.paint(ctx, col.wall, col.wallDark, '#e4e8f2');
  // rubber kicking faces of the slings
  const rb = mask(W, H);
  for (const s of cfg.slings ?? []) rb.line(s.points[0], s.points[2], 1.6);
  rb.paint(ctx, col.rubber, '#777', null);
  // saucer holes and drop target slots are part of the playfield
  for (const sc of cfg.saucers ?? []) { disc(ctx, sc.c[0], sc.c[1], 8, '#0a0c12', '#6a7080'); disc(ctx, sc.c[0], sc.c[1], 5, '#000', null); }
  return { base: cv, overlay: buildOverlay(cfg) };
}

// Ramps and wire rails, drawn above the playfield and any ball on it.
function buildOverlay(cfg) {
  const [W, H] = cfg.size, col = cfg.colours;
  const [cv, ctx] = canvasOf(W, H);
  for (const r of cfg.ramps ?? []) {
    const left = r.left ?? offsetPath(r.path, (r.width ?? 16) / 2), right = r.right ?? offsetPath(r.path, -(r.width ?? 16) / 2);
    if (r.style !== 'wire') {
      // the ramp floor, with a darker band every 8 pixels along it
      const fl = mask(W, H);
      for (let i = 0; i + 1 < r.path.length; i++) { fl.tri(left[i], right[i], right[i + 1]); fl.tri(left[i], right[i + 1], left[i + 1]); }
      fl.paint(ctx, col.ramp ?? '#5a7fb8', col.rampDark ?? '#2a3f66', null);
      ctx.fillStyle = col.rampDark ?? '#2a3f66';
      let dist = 0;
      for (let i = 0; i + 1 < r.path.length; i++) {
        const seg = Math.hypot(r.path[i + 1][0] - r.path[i][0], r.path[i + 1][1] - r.path[i][1]);
        for (let d = (8 - dist % 8) % 8; d < seg; d += 8) {
          const t = d / seg;
          const a = [left[i][0] + (left[i + 1][0] - left[i][0]) * t, left[i][1] + (left[i + 1][1] - left[i][1]) * t];
          const b = [right[i][0] + (right[i + 1][0] - right[i][0]) * t, right[i][1] + (right[i + 1][1] - right[i][1]) * t];
          const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
          for (let k = 1; k < n; k++) ctx.fillRect(Math.floor(a[0] + (b[0] - a[0]) * k / n), Math.floor(a[1] + (b[1] - a[1]) * k / n), 1, 1);
        }
        dist += seg;
      }
      const rails = mask(W, H);
      for (const rail of [left, right]) for (let i = 0; i + 1 < rail.length; i++) rails.line(rail[i], rail[i + 1], 1.5);
      rails.paint(ctx, col.wall, col.wallDark, '#e4e8f2');
    } else {
      // wire rail: two thin chrome wires with ties across
      ctx.fillStyle = '#3a3f4a';
      for (let i = 0; i < r.path.length; i += 2) {
        const a = left[i], b = right[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
        for (let k = 0; k <= n; k++) ctx.fillRect(Math.floor(a[0] + (b[0] - a[0]) * k / n), Math.floor(a[1] + (b[1] - a[1]) * k / n), 1, 1);
      }
      const wires = mask(W, H);
      for (const rail of [left, right]) for (let i = 0; i + 1 < rail.length; i++) wires.line(rail[i], rail[i + 1], 0.9);
      wires.paint(ctx, col.wire ?? '#d8dce6', '#5a606e', null);
    }
  }
  // raised walls
  const wm = mask(W, H);
  let any = false;
  for (const w of cfg.walls ?? []) if (w.layer) { any = true; for (let i = 0; i + 1 < (w.path?.length ?? 0); i++) wm.line(w.path[i], w.path[i + 1], Math.max(1.2, w.r ?? 1)); }
  if (any) wm.paint(ctx, col.wall, col.wallDark, '#e4e8f2');
  return cv;
}

// Ball sprite: an 11x11 shaded steel ball.
export function ballSprite(r = 5) {
  const n = r * 2 + 1;
  const [cv, ctx] = canvasOf(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i - r, y = j - r, d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    const lx = (x + r * 0.35) / r, ly = (y + r * 0.35) / r;
    const shade = 1 - Math.min(1, Math.hypot(lx, ly) * 0.85);
    const v = Math.round(90 + 165 * shade);
    ctx.fillStyle = d > r - 0.7 ? '#3a3f4a' : `rgb(${v},${v},${Math.min(255, v + 12)})`;
    ctx.fillRect(i, j, 1, 1);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(r - 2, r - 2, 2, 1); ctx.fillRect(r - 2, r - 1, 1, 1);
  return cv;
}

function disc(ctx, cx, cy, R, fill, edge) {
  for (let j = Math.floor(cy - R - 1); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R - 1); i <= Math.ceil(cx + R); i++) {
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
    if (d > R + 0.3) continue;
    ctx.fillStyle = edge && d > R - 1 ? edge : fill;
    ctx.fillRect(i, j, 1, 1);
  }
}

function drawFlipper(ctx, f) {
  const [tx, ty] = f.tip();
  const x0 = Math.floor(Math.min(f.px, tx) - f.r1 - 1), x1 = Math.ceil(Math.max(f.px, tx) + f.r1 + 1);
  const y0 = Math.floor(Math.min(f.py, ty) - f.r1 - 1), y1 = Math.ceil(Math.max(f.py, ty) + f.r1 + 1);
  const dx = tx - f.px, dy = ty - f.py, L2 = dx * dx + dy * dy;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const px = i + 0.5, py = j + 0.5;
    let t = ((px - f.px) * dx + (py - f.py) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(px - f.px - dx * t, py - f.py - dy * t);
    const rad = f.r1 + (f.r2 - f.r1) * t;
    if (d > rad + 0.3) continue;
    ctx.fillStyle = d > rad - 1 ? '#7a1414' : d > rad - 2.2 ? '#d83a2a' : '#f2f2ee';
    ctx.fillRect(i, j, 1, 1);
  }
  disc(ctx, f.px, f.py, 1.6, '#999', null);
}

// Everything that moves or lights, drawn on top of the playfield. `t` is game time in seconds.
export function drawDynamic(ctx, game, sprites, t) {
  const cfg = game.cfg, col = cfg.colours;
  // top lane lamps
  for (const l of cfg.lanes ?? []) {
    const cx = (l.a[0] + l.b[0]) / 2, cy = l.a[1] + 14;
    const lit = game.lamps[l.id];
    disc(ctx, cx, cy, 5, lit ? col.lamp : '#3b3420', lit ? '#a07010' : '#22201a');
    if (l.label) drawText(ctx, l.label, cx - 2, cy - 3, lit ? '#3a2400' : '#6d6450');
  }
  // lamp inserts
  for (const ins of cfg.inserts ?? []) {
    const v = game.lamps[ins.id], on = v === 1 || (v === 2 && Math.floor(t * 5) % 2 === 0);
    const c = ins.colour ?? col.lamp;
    disc(ctx, ins.c[0], ins.c[1], ins.r ?? 5, on ? c : shade(c, 0.28), on ? shade(c, 0.6) : '#15171c');
    if (ins.label) drawText(ctx, ins.label, ins.c[0] - 2, ins.c[1] - 3, on ? '#1a1206' : shade(c, 0.55));
  }
  // drop targets: up, or a dark slot when down
  for (const bank of cfg.dropBanks ?? []) bank.targets.forEach(([a, b], i) => {
    const s = game.banks?.[bank.id]?.shapes[i]; const down = s?.disabled;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let k = 0; k <= n; k++) {
      const x = Math.floor(a[0] + (b[0] - a[0]) * k / n), y = Math.floor(a[1] + (b[1] - a[1]) * k / n);
      if (down) { ctx.fillStyle = '#07080c'; ctx.fillRect(x, y, 1, 2); }
      else { ctx.fillStyle = '#fff2c0'; ctx.fillRect(x, y - 1, 1, 1); ctx.fillStyle = '#e07a20'; ctx.fillRect(x, y, 1, 2); ctx.fillStyle = '#6a3410'; ctx.fillRect(x, y + 2, 1, 1); }
    }
  });
  // spinners: a flag that turns
  for (const sp of cfg.spinners ?? []) {
    const ang = game.spin?.[sp.id]?.angle ?? 0, h = Math.abs(Math.cos(ang)) * 3;
    const n = Math.ceil(Math.hypot(sp.b[0] - sp.a[0], sp.b[1] - sp.a[1]));
    for (let k = 0; k <= n; k++) {
      const x = Math.floor(sp.a[0] + (sp.b[0] - sp.a[0]) * k / n), y = Math.floor(sp.a[1] + (sp.b[1] - sp.a[1]) * k / n);
      ctx.fillStyle = '#dfe3ec'; ctx.fillRect(x, Math.round(y - h), 1, Math.max(1, Math.round(h * 2)));
    }
    disc(ctx, sp.a[0], sp.a[1], 1.5, '#777', null); disc(ctx, sp.b[0], sp.b[1], 1.5, '#777', null);
  }
  // kickbacks: a small plunger at the bottom of the lane
  for (const k of cfg.kickbacks ?? []) {
    const fired = t - (game.flashes[k.id] ?? -9) < 0.15;
    const x0 = Math.ceil(Math.min(k.a[0], k.b[0])) + 1, w = Math.floor(Math.abs(k.b[0] - k.a[0])) - 2, y = Math.round(k.a[1]) + (fired ? -4 : 2);
    ctx.fillStyle = '#c03030'; ctx.fillRect(x0, y, w, 2);
    ctx.fillStyle = '#8a8f9a'; ctx.fillRect(x0 + w / 2 - 1, y + 2, 2, 12);
  }
  // standup targets
  for (const tg of cfg.targets ?? []) {
    const lit = game.lamps[tg.id], fl = t - (game.flashes[tg.id] ?? -9) < 0.12;
    ctx.strokeStyle = 'transparent';
    const n = Math.ceil(Math.hypot(tg.b[0] - tg.a[0], tg.b[1] - tg.a[1]));
    for (let k = 0; k <= n; k++) {
      const x = Math.floor(tg.a[0] + (tg.b[0] - tg.a[0]) * k / n), y = Math.floor(tg.a[1] + (tg.b[1] - tg.a[1]) * k / n);
      ctx.fillStyle = fl ? '#fff' : lit ? '#ffd23a' : '#c07a20'; ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = '#5a3a10'; ctx.fillRect(x, y + 2, 1, 1);
    }
  }
  // pop bumpers: flash and swell when they fire
  for (const b of cfg.bumpers ?? []) {
    const since = t - (game.flashes[b.id] ?? -9), fl = since < 0.1;
    disc(ctx, b.c[0], b.c[1] + 1, b.R, '#2a2a33', null);
    disc(ctx, b.c[0], b.c[1], b.R + (fl ? 1 : 0), '#d8d8e0', '#555');
    disc(ctx, b.c[0], b.c[1], b.R - 3, fl ? '#fff3a0' : col.bumper, fl ? '#ffcc33' : '#6a1d1d');
    disc(ctx, b.c[0] - 2, b.c[1] - 2, 2, fl ? '#fff' : '#ff8a7a', null);
  }
  // slingshot flash
  for (const s of cfg.slings ?? []) if (t - (game.flashes[s.id] ?? -9) < 0.08) {
    const [A, , C] = s.points;
    const n = Math.ceil(Math.hypot(C[0] - A[0], C[1] - A[1]));
    ctx.fillStyle = '#fff6b0';
    for (let k = 0; k <= n; k++) ctx.fillRect(Math.floor(A[0] + (C[0] - A[0]) * k / n), Math.floor(A[1] + (C[1] - A[1]) * k / n), 2, 2);
  }
  // plunger rod and spring
  const p = game.plunger;
  if (p) {
    const x0 = Math.ceil(p.x0) + 2, w = Math.floor(p.x1 - p.x0) - 4, y = Math.round(p.y);
    ctx.fillStyle = '#c03030'; ctx.fillRect(x0, y, w, 3);
    ctx.fillStyle = '#8a8f9a'; ctx.fillRect(x0 + w / 2 - 1, y + 3, 3, 40);
    ctx.fillStyle = '#c8ccd6';
    for (let k = y + 5; k < y + 40; k += 3) ctx.fillRect(x0 + 2, k, w - 4, 1);
  }
  for (const f of game.flippers) drawFlipper(ctx, f);
  for (const b of game.world.balls) if (!b.layer) ctx.drawImage(sprites.ball, Math.round(b.x - b.r), Math.round(b.y - b.r));
  // ramps and wires over the playfield, then balls riding on them (with a shadow)
  if (sprites.overlay) ctx.drawImage(sprites.overlay, 0, 0);
  for (const b of game.world.balls) if (b.layer) {
    ctx.globalAlpha = 0.35; disc(ctx, b.x + 2, b.y + 3, b.r, '#000', null); ctx.globalAlpha = 1;
    ctx.drawImage(sprites.ball, Math.round(b.x - b.r), Math.round(b.y - b.r));
  }
}

// a colour darkened toward black (k = 0..1 of the original brightness)
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Collision shapes drawn over everything (debug overlay).
export function drawDebug(ctx, game) {
  ctx.save();
  ctx.lineWidth = 0.5;
  for (const s of [...game.world.shapes, ...game.world.movers]) {
    if (s.disabled) continue;
    ctx.strokeStyle = s.sensor ? '#ff0' : s.kick ? '#f0f' : s.oneWay ? '#0ff' : s.layer ? '#f80' : '#0f0';
    ctx.beginPath();
    if (s.kind === 'seg') { ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); }
    else if (s.kind === 'arc') ctx.arc(s.c[0], s.c[1], s.R, s.a0, s.a1);
    else if (s.kind === 'circle') ctx.arc(s.c[0], s.c[1], Math.max(s.R, 1), 0, Math.PI * 2);
    else if (s.kind === 'flipper') { const f = s.part, [tx, ty] = f.tip(); ctx.moveTo(f.px, f.py); ctx.lineTo(tx, ty); }
    ctx.stroke();
  }
  ctx.strokeStyle = '#f80';
  for (const b of game.world.balls) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.vx * 0.05, b.y + b.vy * 0.05); ctx.stroke();
  }
  ctx.restore();
}
