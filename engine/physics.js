// The pinball physics: a ball (circle) against walls made of segments, arcs and circles, plus moving
// parts (flippers, plunger). Purpose-built rather than a general library so a fast ball never passes
// through a wall or a flipper: the world runs in fixed steps, and each step is split into sub-steps
// small enough that no ball moves more than 40% of its radius at once.
//
// Units are playfield pixels and seconds. Angles are radians, screen style: 0 points right, +PI/2 points down.
//
// Shape (static unless it has `vel` or is a flipper):
//   { kind: 'seg', a: [x, y], b: [x, y], r }        a line (r = half thickness, so r > 0 is a capsule)
//   { kind: 'arc', c: [x, y], R, a0, a1, r }         part of a circle, from angle a0 round to a1 (a1 > a0)
//   { kind: 'circle', c: [x, y], R }                 a post or bumper
//   { kind: 'flipper', ... }                         see parts/flipper.js
// Shared shape fields: bounce (0..1), friction (0..1), layer (default 0), id, tag,
//   kick (speed a bumper or sling adds), kickMin (impact speed needed to fire), oneWay ([nx, ny]: only
//   collides with a ball on that side), sensor (no collision, reports enter), vel ([vx, vy] surface speed),
//   captiveOnly (only stops a captive ball, one with b.captive set: the walls that keep it in its channel).

export const STEP = 1 / 480;            // fixed physics step (seconds)
const MAX_SPEED = 2600;                 // px/s, a safety cap
const REST_SPEED = 45;                  // impacts slower than this don't bounce (lets a ball settle)

const TAU = Math.PI * 2;

export function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + dx * t, ay + dy * t, t];
}

export function closestOnArc(px, py, s) {
  const [cx, cy] = s.c;
  const th = Math.atan2(py - cy, px - cx);
  const span = s.a1 - s.a0;
  let t = (th - s.a0) % TAU; if (t < 0) t += TAU;
  if (t <= span) return [cx + Math.cos(th) * s.R, cy + Math.sin(th) * s.R];
  const e0 = [cx + Math.cos(s.a0) * s.R, cy + Math.sin(s.a0) * s.R];
  const e1 = [cx + Math.cos(s.a1) * s.R, cy + Math.sin(s.a1) * s.R];
  return (px - e0[0]) ** 2 + (py - e0[1]) ** 2 < (px - e1[0]) ** 2 + (py - e1[1]) ** 2 ? e0 : e1;
}

// Bounding box of a shape, padded by its thickness, for quick rejection.
export function shapeBox(s) {
  const r = s.r || 0;
  if (s.kind === 'seg') return [Math.min(s.a[0], s.b[0]) - r, Math.min(s.a[1], s.b[1]) - r, Math.max(s.a[0], s.b[0]) + r, Math.max(s.a[1], s.b[1]) + r];
  if (s.kind === 'circle') return [s.c[0] - s.R, s.c[1] - s.R, s.c[0] + s.R, s.c[1] + s.R];
  if (s.kind === 'arc') return [s.c[0] - s.R - r, s.c[1] - s.R - r, s.c[0] + s.R + r, s.c[1] + s.R + r];
  return null; // moving shapes are always checked
}

export class Ball {
  constructor(x, y, r = 5) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.r = r;
    this.layer = 0; this.live = true; this.held = false;
    this.touching = new Set(); // sensors currently overlapped
  }
}

export class World {
  constructor({ gravity = 900, damping = 0.02 } = {}) {
    this.gravity = gravity; this.damping = damping;
    this.shapes = []; this.movers = []; this.balls = [];
    this.parts = [];                    // objects with update(h) called every sub-step (flippers, plunger)
    this.onHit = null;                  // (ball, shape, impactSpeed) for shapes with an id
    this.onSensor = null;               // (ball, shape) when a ball enters a sensor
    this.time = 0;
  }
  add(shape) {
    shape.layer ??= 0; shape.bounce ??= 0.35; shape.friction ??= 0.04; shape.r ??= 0;
    shape.box = shape.vel ? null : shapeBox(shape);   // a moving shape has no fixed box
    (shape.box ? this.shapes : this.movers).push(shape);
    return shape;
  }
  addPart(p) { this.parts.push(p); p.shapes?.forEach(s => this.add(s)); return p; }
  addBall(b) { this.balls.push(b); return b; }
  setLayer(b, layer) { if (b.layer !== layer) { b.layer = layer; b.touching.clear(); } }

  // Advance by exactly one fixed step.
  step() {
    let fastest = 0;
    for (const b of this.balls) fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
    for (const p of this.parts) if (p.moving?.()) fastest = Math.max(fastest, p.tipSpeed?.() ?? 0);
    const minR = this.balls.reduce((m, b) => Math.min(m, b.r), 5);
    const n = Math.min(16, Math.max(2, Math.ceil((fastest * STEP) / (minR * 0.4))));
    const h = STEP / n;
    for (let i = 0; i < n; i++) this.substep(h);
    this.time += STEP;
  }

  substep(h) {
    for (const p of this.parts) p.update?.(h);
    const damp = 1 - this.damping * h;
    for (const b of this.balls) {
      if (!b.live || b.held) continue;       // a held ball (in a saucer) doesn't move
      b.vy += this.gravity * h;
      b.vx *= damp; b.vy *= damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
      // two passes settle a ball wedged in a corner between two walls
      for (let pass = 0; pass < 2; pass++) {
        for (const s of this.shapes) this.collide(b, s);
        for (const s of this.movers) this.collide(b, s);
      }
    }
    this.ballBall();
  }

  // distance from a ball's centre to a wall's surface (for checking a raisable post won't trap a ball)
  distance(s, b) {
    let q;
    if (s.kind === 'seg') q = closestOnSeg(b.x, b.y, s.a[0], s.a[1], s.b[0], s.b[1]);
    else if (s.kind === 'arc') q = closestOnArc(b.x, b.y, s);
    else if (s.kind === 'circle') return Math.max(0, Math.hypot(b.x - s.c[0], b.y - s.c[1]) - s.R - (s.r ?? 0));
    else return Infinity;
    return Math.max(0, Math.hypot(b.x - q[0], b.y - q[1]) - (s.r ?? 0));
  }

  collide(b, s) {
    if (s.layer !== b.layer || s.disabled || (s.captiveOnly && !b.captive)) return;
    if (s.box && (b.x + b.r < s.box[0] || b.x - b.r > s.box[2] || b.y + b.r < s.box[1] || b.y - b.r > s.box[3])) {
      if (s.sensor) b.touching.delete(s);
      return;
    }
    let qx, qy, rad = s.r, svx = 0, svy = 0;
    if (s.kind === 'seg') [qx, qy] = closestOnSeg(b.x, b.y, s.a[0], s.a[1], s.b[0], s.b[1]);
    else if (s.kind === 'arc') [qx, qy] = closestOnArc(b.x, b.y, s);
    else if (s.kind === 'circle') {
      const dx = b.x - s.c[0], dy = b.y - s.c[1], d = Math.hypot(dx, dy) || 1;
      qx = s.c[0] + (dx / d) * s.R; qy = s.c[1] + (dy / d) * s.R;
    } else if (s.kind === 'flipper') {
      const c = s.part.contact(b.x, b.y);
      qx = c.x; qy = c.y; rad = c.rad; svx = c.vx; svy = c.vy;
    }
    let nx = b.x - qx, ny = b.y - qy;
    const dist = Math.hypot(nx, ny);
    const reach = b.r + rad;
    if (dist >= reach) { if (s.sensor) b.touching.delete(s); return; }
    if (s.sensor) {
      if (!b.touching.has(s)) { b.touching.add(s); this.onSensor?.(b, s); }
      return;
    }
    if (dist < 1e-6) { nx = 0; ny = -1; } else { nx /= dist; ny /= dist; }
    if (s.kind === 'circle' && Math.hypot(b.x - s.c[0], b.y - s.c[1]) < s.R) { nx = -nx; ny = -ny; } // centre inside a post: push out
    if (s.oneWay && (b.x - qx) * s.oneWay[0] + (b.y - qy) * s.oneWay[1] < 0) return;
    if (s.vel) { svx = s.vel[0]; svy = s.vel[1]; }

    // push the ball out of the wall
    const depth = reach - dist;
    b.x += nx * depth; b.y += ny * depth;

    // velocity relative to the (possibly moving) surface
    let rvx = b.vx - svx, rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;               // already separating
    const impact = -vn;
    const e = impact < REST_SPEED ? 0 : s.bounce;
    rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
    // friction on the tangential part, scaled by how hard the hit was
    const f = s.friction * Math.min(1, impact / 400);
    const tvx = rvx - (rvx * nx + rvy * ny) * nx, tvy = rvy - (rvx * nx + rvy * ny) * ny;
    rvx -= tvx * f; rvy -= tvy * f;
    b.vx = rvx + svx; b.vy = rvy + svy;

    if (s.kick && impact >= (s.kickMin ?? 0) && this.time >= (s.cooldownUntil ?? 0)) {
      // a bumper or slingshot fires: make sure the ball leaves at least `kick` speed along the normal
      const out = b.vx * nx + b.vy * ny;
      const add = Math.max(s.kick * 0.5, s.kick - out);
      b.vx += nx * add; b.vy += ny * add;
      s.cooldownUntil = this.time + 0.08;
      s.firedAt = this.time;
      this.onHit?.(b, s, impact, true);
    } else if (s.id && impact > (s.hitMin ?? 30)) {
      this.onHit?.(b, s, impact, false);
    } else if (impact > 220) {
      this.onHit?.(b, s, impact, false);  // plain wall knocks, for sound
    }
  }

  ballBall() {
    const bs = this.balls;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (!a.live || !b.live || a.held || b.held || a.layer !== b.layer) continue;
      let nx = b.x - a.x, ny = b.y - a.y; const d = Math.hypot(nx, ny), reach = a.r + b.r;
      if (d >= reach || d < 1e-6) continue;
      nx /= d; ny /= d;
      const push = (reach - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      const j2 = -(1 + 0.9) * vn / 2;
      a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
    }
  }
}
