// Draws a table in pixel style. The fixed parts of the playfield (walls, rails, slingshots) are drawn
// once from the same shapes the physics uses, so what you see is exactly where the ball goes. Moving
// and lit parts (flippers, plunger, bumpers, lamps, balls) are drawn every frame.

import { drawText, glyph } from './font.js';
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
// `art` holds the table's decoded images (ui/art.js): a `playfield` backdrop, and any sprites named by parts
// (bumper `art`, drop bank `art`, target `art`) or by `decals: [{ art, c }]` in the config.
export function buildPlayfield(cfg, art = {}) {
  const [W, H] = cfg.size;
  const col = cfg.colours;
  const [cv, ctx] = canvasOf(W, H);
  if (art.playfield) ctx.drawImage(art.playfield, 0, 0);
  else {
    // plain field with a faint 16px dot grid so scrolling reads clearly
    ctx.fillStyle = col.field; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) ctx.fillRect(x, y, 1, 1);
  }
  for (const d of cfg.decals ?? []) { const im = art[d.art]; if (im) ctx.drawImage(im, Math.round(d.c[0] - im.width / 2), Math.round(d.c[1] - im.height / 2)); }
  ctx.fillStyle = '#0c0f18'; ctx.fillRect(cfg.lane.x0, cfg.lane.yTop, cfg.lane.x1 - cfg.lane.x0, H - cfg.lane.yTop);
  drawText(ctx, cfg.name.toUpperCase(), W / 2 - 6, cfg.nameY ?? 470, col.name ?? 'rgba(255,255,255,0.10)', { scale: 2, align: 'center' });

  // slingshot plastics
  const sl = mask(W, H);
  for (const s of cfg.slings ?? []) sl.tri(...s.points);
  sl.paint(ctx, col.sling ?? '#3a6fd8', col.slingDark ?? '#1b2f66', col.slingHi ?? '#7aa2ff');
  // walls and rails
  const wm = mask(W, H);
  for (const w of cfg.walls ?? []) {
    if (w.layer || w.id) continue;   // raised walls are drawn on the overlay; ones that move, as they are
    const rad = Math.max(1.2, w.r ?? 1);
    if (w.path) for (let i = 0; i + 1 < w.path.length; i++) wm.line(w.path[i], w.path[i + 1], rad);
    if (w.arc) wm.arc(w.arc.c, w.arc.R, w.arc.from * D, w.arc.to * D, rad);
  }
  for (const g of cfg.gates ?? []) wm.line(g.a, g.b, 0.8);
  for (const r of cfg.ramps ?? []) for (const [a, b] of r.funnelWalls ?? []) wm.line(a, b, 1.5);
  for (const p of cfg.posts ?? []) if (!p.id) wm.stamp(p.c[0], p.c[1], p.R + 0.5);
  wm.paint(ctx, col.wall, col.wallDark, col.wallHi ?? '#e4e8f2');
  // rubber kicking faces of the slings
  const rb = mask(W, H);
  for (const s of cfg.slings ?? []) rb.line(s.points[0], s.points[2], 1.6);
  rb.paint(ctx, col.rubber, '#777', null);
  // saucer holes and drop target slots are part of the playfield
  for (const sc of cfg.saucers ?? []) for (const c of sc.exit ? [sc.c, sc.exit] : [sc.c]) { disc(ctx, c[0], c[1], 8, '#0a0c12', '#6a7080'); disc(ctx, c[0], c[1], 5, '#000', null); }
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

// A flipper drawn as a six-shooter (flipper style: 'pistol'): the barrel is the bat, the cylinder and frame sit
// over the pivot, and the wooden grip hangs below. Drawn pixel by pixel in the flipper's own frame, so it
// turns with the bat. A flash at the muzzle and a puff of smoke follow each press.
const STEEL = ['#111217', '#3c414e', '#6e778a', '#bcc4d4'], WOOD = ['#2a1206', '#7a3a16', '#b0682e', '#e0a060'];
function pistolPart(u, v, L) {
  // returns [palette, shade] or null
  if (u >= 12 && u <= L + 1 && v >= -3 && v <= 2) return [STEEL, u > L - 1 ? 1 : v < -1.5 ? 3 : v < 0.8 ? 2 : 1];        // barrel
  if (u >= L - 4 && u <= L - 1 && v >= -5 && v < -3) return [STEEL, 1];                                            // front sight
  if (u >= 12 && u <= 26 && v > 2 && v <= 4) return [STEEL, 1];                                                    // ejector rod
  const cu = (u - 4.5) / 8.5, cv = v / 6.8;
  if (cu * cu * cu * cu + cv * cv <= 1) {                                                                          // cylinder, with its chambers
    const hole = Math.hypot(u - 4.5, v - 2.6) < 1.4 || Math.hypot(u - 4.5, v + 2.6) < 1.4;
    return [STEEL, hole ? 0 : Math.abs(v) < 0.6 ? 1 : v < -4 ? 3 : 2];
  }
  if (u >= -9 && u < -3 && v >= -5 && v <= 4) return [STEEL, v < -3 ? 3 : 2];                                         // frame
  if (u >= -12 && u < -7 && v >= -8 && v < -4.5) return [STEEL, 1];                                                // hammer
  const gu = u + (v - 3) * 0.5;
  if (v > 3 && v <= 17 && gu >= -12 && gu <= -2 && Math.hypot(Math.max(0, v - 14), gu + 7) <= 5.5) {                 // grip, rounded at the butt
    return [WOOD, gu < -10.5 ? 1 : (Math.round(v) % 3 === 0 && gu > -9 && gu < -4) ? 1 : gu > -4 ? 3 : 2];
  }
  const dg = Math.hypot(u - 2.5, v - 7);
  if (v > 4.5 && dg >= 2.6 && dg <= 3.8) return [STEEL, 2];                                                        // trigger guard
  if (u >= 1.5 && u <= 2.8 && v > 5 && v <= 8.5) return [STEEL, 3];                                                // trigger
  return null;
}
function drawPistol(ctx, f, t, flashAt) {
  const L = f.len, ca = Math.cos(f.angle), sa = Math.sin(f.angle);
  const [nx, ny] = f.side === 'left' ? [-sa, ca] : [sa, -ca];   // "down" across the gun, toward the bottom of the table
  const R = L + 22, x0 = Math.floor(f.px - R), y0 = Math.floor(f.py - R);
  const part = (i, j) => { const dx = i + 0.5 - f.px, dy = j + 0.5 - f.py; return pistolPart(dx * ca + dy * sa, dx * nx + dy * ny, L); };
  for (let j = y0; j <= y0 + 2 * R; j++) for (let i = x0; i <= x0 + 2 * R; i++) {
    const p = part(i, j); if (!p) continue;
    const edge = !part(i - 1, j) || !part(i + 1, j) || !part(i, j - 1) || !part(i, j + 1);
    ctx.fillStyle = edge ? p[0][0] : p[0][p[1]];
    ctx.fillRect(i, j, 1, 1);
  }
  const since = t - (flashAt ?? -9);
  const mx = f.px + ca * (L + 3), my = f.py + sa * (L + 3);
  if (since < 0.07) {   // muzzle flash
    disc(ctx, mx + ca * 3, my + sa * 3, 4.5, '#ffb020', null);
    disc(ctx, mx + ca * 2, my + sa * 2, 2.5, '#fff8d0', null);
    for (const k of [-0.6, 0.6]) { const c2 = Math.cos(f.angle + k), s2 = Math.sin(f.angle + k); ctx.fillStyle = '#ffd040'; ctx.fillRect(Math.round(mx + c2 * 8), Math.round(my + s2 * 8), 2, 2); }
  } else if (since < 0.6) {   // smoke, drifting up and fading
    ctx.globalAlpha = 0.5 * (1 - since / 0.6);
    disc(ctx, mx + ca * 6, my + sa * 6 - since * 30, 2 + since * 6, '#c8c8c8', null);
    ctx.globalAlpha = 1;
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

// Light bulbs every `spacing` pixels along the config's `bulbs.paths` (worked out once per config).
const bulbCache = new WeakMap();
function bulbPoints(b) {
  if (!bulbCache.has(b)) {
    const pts = [], gap = b.spacing ?? 9;
    for (const path of b.paths) {
      let carry = 0;
      for (let i = 0; i + 1 < path.length; i++) {
        const [a, c] = [path[i], path[i + 1]], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        for (let d = carry; d < len; d += gap) pts.push([Math.round(a[0] + (c[0] - a[0]) * d / len), Math.round(a[1] + (c[1] - a[1]) * d / len)]);
        carry = (carry - len) % gap; if (carry < 0) carry += gap;
      }
    }
    bulbCache.set(b, pts);
  }
  return bulbCache.get(b);
}
// Bulbs chase round slowly in play, quickly in attract mode, and all flash in multiball or a mode.
function drawBulbs(ctx, game, t) {
  const b = game.cfg.bulbs; if (!b) return;
  const pts = bulbPoints(b), on = b.colour ?? '#ffd36a', off = b.dim ?? '#4a3410';
  const party = game.liveBalls?.() > 1 || Object.keys(game.modes ?? {}).length > 0;
  const step = Math.floor(t * (game.state === 'attract' || game.state === 'over' ? 14 : 5));
  pts.forEach(([x, y], i) => {
    const lit = party ? Math.floor(t * 6) % 2 === 0 : (i + step) % 4 !== 0;
    ctx.fillStyle = lit ? on : off; ctx.fillRect(x - 1, y - 1, 2, 2);
    if (lit) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(x - 1, y - 1, 1, 1); }
  });
}

// Everything that moves or lights, drawn on top of the playfield. `t` is game time in seconds.
export function drawDynamic(ctx, game, sprites, t) {
  const cfg = game.cfg, col = cfg.colours;
  drawBulbs(ctx, game, t);
  // top lane lamps
  for (const l of cfg.lanes ?? []) {
    const cx = (l.a[0] + l.b[0]) / 2, cy = l.a[1] + 14;
    const lit = game.lamps[l.id];
    if (l.marquee) { if (l.label) marquee(ctx, l.label, cx, cy + 6, lit === 1 || (lit === 2 && Math.floor(t * 5) % 2 === 0)); continue; }
    disc(ctx, cx, cy, 5, lit ? col.lamp : '#3b3420', lit ? '#a07010' : '#22201a');
    if (l.label) drawText(ctx, l.label, cx - 2, cy - 3, lit ? '#3a2400' : '#6d6450');
  }
  // lamp inserts
  for (const ins of cfg.inserts ?? []) {
    const v = ins.lit ? ins.lit(game) : game.lamps[ins.id], on = v === 1 || (v === 2 && Math.floor(t * 5) % 2 === 0);
    const c = ins.colour ?? col.lamp;
    const im = sprites.art?.[ins.art];
    if (im) {   // a picture lamp: full colour with a soft glow when lit, dark when not
      if (on) { ctx.globalAlpha = 0.35; disc(ctx, ins.c[0], ins.c[1], Math.max(im.width, im.height) / 2 + 2, c, null); ctx.globalAlpha = 1; }
      ctx.drawImage(on ? im : darkened(im), Math.round(ins.c[0] - im.width / 2), Math.round(ins.c[1] - im.height / 2));
      continue;
    }
    if (ins.marquee) { marquee(ctx, ins.label, ins.c[0], ins.c[1], on); continue; }
    disc(ctx, ins.c[0], ins.c[1], ins.r ?? 5, on ? c : shade(c, 0.28), on ? shade(c, 0.6) : '#15171c');
    if (ins.label) drawText(ctx, ins.label, ins.c[0] - 2, ins.c[1] - 3, on ? '#1a1206' : shade(c, 0.55));
  }
  // posts and diverters that rise and fall: chrome when up, a dark socket when down
  for (const w of [...(cfg.walls ?? []), ...(cfg.posts ?? [])]) if (w.id) {
    const up = game.posts?.[w.id]?.up;
    if (w.c) { if (up) { disc(ctx, w.c[0], w.c[1] + 1, w.R + 1, '#000', null); disc(ctx, w.c[0], w.c[1], w.R + 0.5, col.wall, col.wallDark); disc(ctx, w.c[0] - 1, w.c[1] - 1, 1, '#fff', null); } else disc(ctx, w.c[0], w.c[1], 2, '#05060a', col.wallDark); continue; }
    for (let i = 0; i + 1 < (w.path?.length ?? 0); i++) thickLine(ctx, w.path[i], w.path[i + 1], up ? 2 : 1, up ? col.wall : 'rgba(0,0,0,0.6)');
  }
  // toys: pictures that move with the game (a race, a moving target)
  for (const toy of cfg.toys ?? []) {
    const at = toy.at?.(game, t), im = sprites.art?.[typeof toy.art === 'function' ? toy.art(game, t) : toy.art];
    if (toy.draw) { toy.draw(ctx, game, t, sprites.art ?? {}); continue; }   // a toy that draws itself
    if (!at) continue;
    if (im) ctx.drawImage(im, Math.round(at[0] - im.width / 2), Math.round(at[1] - im.height / 2));
    else disc(ctx, at[0], at[1], 4, toy.colour ?? col.lamp, '#000');
  }
  // drop targets: up, or a dark slot when down
  for (const bank of cfg.dropBanks ?? []) bank.targets.forEach(([a, b], i) => {
    const s = game.banks?.[bank.id]?.shapes[i]; const down = s?.disabled;
    const im = sprites.art?.[bank.art];
    if (im && !down) ctx.drawImage(im, Math.round((a[0] + b[0]) / 2 - im.width / 2), Math.round((a[1] + b[1]) / 2 - im.height + 2));
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
  // vortexes: dots spiralling in; magnets: rings that pulse inward while it is on
  for (const f of cfg.fields ?? []) {
    if (f.kind === 'vortex') {
      const on = !f.lamp || game.lamps[f.lamp], sp = f.spin ?? 1;
      for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 14; k++) {
        const r = f.R * (1 - k / 14), a = sp * (t * 2.2 + k * 0.35) + arm * 2.094;
        ctx.globalAlpha = (on ? 0.85 : 0.35) * (1 - k / 18);
        ctx.fillStyle = k > 10 ? '#ffffff' : k > 5 ? '#d08aff' : '#7a3ad8';
        ctx.fillRect(Math.round(f.c[0] + Math.cos(a) * r), Math.round(f.c[1] + Math.sin(a) * r), 2, 2);
      }
      ctx.globalAlpha = 1; disc(ctx, f.c[0], f.c[1], 3, '#000', '#3a1a6a');
    } else if (f.kind === 'sand') {
      // a bunker: raked sand, unless the backdrop already has one (draw: false)
      if (f.draw === false) continue;
      disc(ctx, f.c[0], f.c[1], f.R, '#e8d39a', '#c8ac68');
      ctx.fillStyle = '#c8ac68';
      for (let y = -f.R + 4; y < f.R - 2; y += 4) { const w = Math.sqrt(f.R * f.R - y * y) - 3; for (let x = -w; x < w; x += 3) ctx.fillRect(Math.round(f.c[0] + x), Math.round(f.c[1] + y), 2, 1); }
    } else if (f.kind === 'wind') {
      // wind: streaks blowing across while it's on
      if (f.lamp && !game.lamps[f.lamp]) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 12; i++) {
        const along = ((t * 90 + i * 37) % (2 * f.R)) - f.R, across = ((i * 53) % (2 * f.R)) - f.R;
        const x = f.c[0] + f.dir[0] * along - f.dir[1] * across, y = f.c[1] + f.dir[1] * along + f.dir[0] * across;
        if (Math.hypot(x - f.c[0], y - f.c[1]) > f.R) continue;
        for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x - f.dir[0] * k), Math.round(y - f.dir[1] * k), 1, 1);
      }
    } else if (f.kind === 'magnet' && (game.fieldOn?.[f.id] > t || [...(game.saucerBalls?.values() ?? [])].some(h => h.saucer.id === f.id))) {
      for (let i = 0; i < 3; i++) {
        const r = f.R * (1 - ((t * 1.5 + i / 3) % 1));
        ctx.globalAlpha = 0.6 * (1 - r / f.R);
        for (let a = 0; a < 6.28; a += 0.25) { ctx.fillStyle = '#fff36a'; ctx.fillRect(Math.round(f.c[0] + Math.cos(a) * r), Math.round(f.c[1] + Math.sin(a) * r), 1, 1); }
      }
      ctx.globalAlpha = 1;
    }
  }
  // kickbacks: a small plunger at the bottom of the lane
  for (const k of cfg.kickbacks ?? []) {
    const fired = t - (game.flashes[k.id] ?? -9) < 0.15;
    const x0 = Math.ceil(Math.min(k.a[0], k.b[0])) + 1, w = Math.floor(Math.abs(k.b[0] - k.a[0])) - 2, y = Math.round(k.a[1]) + (fired ? -4 : 2);
    ctx.fillStyle = '#c03030'; ctx.fillRect(x0, y, w, 2);
    ctx.fillStyle = '#8a8f9a'; ctx.fillRect(x0 + w / 2 - 1, y + 2, 2, 12);
  }
  // standup targets
  for (const tg0 of cfg.targets ?? []) {
    const tg = tg0.move ? { ...tg0, ...(([a, b]) => ({ a, b }))(game.targetAt(tg0.id)) } : tg0;   // a moving target, where it is now
    const lit = game.lamps[tg.id], fl = t - (game.flashes[tg.id] ?? -9) < 0.12;
    const im = sprites.art?.[tg.art];
    if (im) ctx.drawImage(im, Math.round((tg.a[0] + tg.b[0]) / 2 - im.width / 2 + (tg.artOffset?.[0] ?? 0)), Math.round((tg.a[1] + tg.b[1]) / 2 - im.height + (tg.artOffset?.[1] ?? 0) + (fl ? -1 : 0)));
    if (im && tg.bar === false) continue;   // the picture is the target (Star Siege's mothership)
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
    const im = sprites.art?.[b.art];
    if (im) {
      ctx.globalAlpha = 0.4; disc(ctx, b.c[0] + 1, b.c[1] + 2, b.R, '#000', null); ctx.globalAlpha = 1;
      if (fl) disc(ctx, b.c[0], b.c[1], b.R + 2, '#fff3a0', '#ffcc33');
      ctx.drawImage(im, Math.round(b.c[0] - im.width / 2), Math.round(b.c[1] - im.height / 2) - (fl ? 1 : 0));
      continue;
    }
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
  for (const f of game.flippers) if (f.cfg.style === 'pistol') drawPistol(ctx, f, t, game.flashes[f.id]); else drawFlipper(ctx, f);
  for (const b of game.world.balls) if (!b.layer && !b.hidden) ctx.drawImage(sprites.ball, Math.round(b.x - b.r), Math.round(b.y - b.r));
  // ramps and wires over the playfield, then balls riding on them (with a shadow)
  if (sprites.overlay) ctx.drawImage(sprites.overlay, 0, 0);
  for (const b of game.world.balls) if (b.layer) {
    ctx.globalAlpha = 0.35; disc(ctx, b.x + 2, b.y + 3, b.r, '#000', null); ctx.globalAlpha = 1;
    ctx.drawImage(sprites.ball, Math.round(b.x - b.r), Math.round(b.y - b.r));
  }
}

function thickLine(ctx, a, b, w, colour) {
  ctx.fillStyle = colour;
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
  for (let k = 0; k <= n; k++) ctx.fillRect(Math.round(a[0] + (b[0] - a[0]) * k / n - w / 2), Math.round(a[1] + (b[1] - a[1]) * k / n - w / 2), w, w);
}

// An unlit lamp picture: the same image, darkened (made once per image).
const darkCache = new WeakMap();
function darkened(im) {
  if (!darkCache.has(im)) {
    const [cv, c] = canvasOf(im.width, im.height);
    c.drawImage(im, 0, 0);
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(8,6,14,0.55)'; c.fillRect(0, 0, im.width, im.height);
    darkCache.set(im, cv);
  }
  return darkCache.get(im);
}

// A letter made of light bulbs, like a fairground sign: each dot of the 5x7 font is a bulb, 2 pixels apart,
// centred on (cx, cy).
export function marquee(ctx, ch, cx, cy, lit) {
  const rows = glyph(ch), x0 = Math.round(cx - 4), y0 = Math.round(cy - 6);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (rows[r] & (0x10 >> c)) {
    ctx.fillStyle = lit ? '#ffcf4a' : '#7a5a24'; ctx.fillRect(x0 + c * 2, y0 + r * 2, 1, 1);
    if (lit) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffb020'; ctx.fillRect(x0 + c * 2 - 1, y0 + r * 2, 3, 1); ctx.fillRect(x0 + c * 2, y0 + r * 2 - 1, 1, 3); ctx.globalAlpha = 1; }
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
