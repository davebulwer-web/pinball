// A pinball game on one table: builds the physics world from a table config, runs balls, players,
// the plunger, ball save, locks and multiball, nudging and tilt, bonus, and the table's rules
// (engine/rules.js). It reports what happens as events for the screen and sound. No drawing code here,
// so it runs headless in tests.
//
// Table config (tables/parts/config.js uses every part):
//   size: [w, h], gravity, ballRadius, balls (per game), ballSave (seconds), drainY, maxBonusX
//   lane: { x0, x1, yTop }                     the shooter lane (tells when a ball has been launched)
//   plunger: { x0, x1, y, maxPull, minSpeed, maxSpeed }
//   flippers: [{ id, pivot, side, length, ... }]   style: 'pistol' draws a six-shooter (ui/render.js)
//   walls:    [{ path: [[x, y], ...] } | { arc: { c, R, from, to } }]   (degrees; plus r, bounce, friction, layer)
//   posts:    [{ c, R }]
//   walls and posts with an `id` can be raised and lowered by the rules (['post', id, 1 | 0]): diverters
//               and up-posts. `down: true` starts them lowered.
//   bumpers:  [{ id, c, R, kick, score }]
//   slings:   [{ id, points: [A, B, C], kick, score }]          kicking face is A to C
//   targets:  [{ id, a, b, score }]                             standups: solid, score when hit
//               art: a picture drawn on it (artOffset: [dx, dy]; bar: false leaves out the target strip)
//               move: { by: [dx, dy], secs } makes a moving target: it slides to and fro by up to `by`
//               either side, once every `secs` (game.targetAt(id) is where it is now)
//               move: { follow: true, reach, speed, sight, secs } makes a goalkeeper: it slides across to get in
//               front of a ball coming at it from below (within `sight` pixels), and paces about otherwise
//   fields:   [{ id, kind: 'vortex' | 'magnet', c, R, strength, ... }]   forces on the ball (no collision)
//               vortex: swirls a ball passing within R round the centre (spin: 1 clockwise, -1 anticlockwise);
//               fires `field:id` as a ball enters it. lamp: 'id' makes it work only while that lamp is lit
//               magnet: while switched on (['magnet', id, secs]) pulls a ball in, holds it for `hold` seconds
//               (fires `magnet:id`), then throws it out along `eject: { dir, speed }`
//   captives: [{ id, c }]                                       a captive ball: a ball that stays on the table,
//               kept in its channel by walls with captiveOnly: true (which a ball in play passes through)
//   dropBanks:[{ id, targets: [[a, b], ...], score, resetDelay }]  drop when hit; bankDown when all are down;
//               resetDelay: null keeps the bank down until a rule resets it
//   lanes:    [{ id, a, b, score }]                             rollovers (sensors)
//   spinners: [{ id, a, b, score }]                             spin by the ball's speed, score per turn
//   saucers:  [{ id, c, R, hold, eject: { dir, speed }, score }] catch the ball (centre within R + ball radius), then kick it out
//               exit: [x, y] makes it a scoop with a subway: the ball vanishes and is kicked out at the exit
//   kickbacks:[{ id, a, b, dir, speed }]                        fire the ball back out while lamp `id` is lit
//   ramps:    [{ id, path, width, mouth, taper, layer, style: 'ramp' | 'wire', minSpeed, assist, score, funnel }]
//               the ball enters at path[0] (going along the path) if fast enough, rides on its own layer
//               between two rails, and drops back to the playfield at the last point
//   gates:    [{ a, b, oneWay: [nx, ny] }]                      one-way walls
//   inserts:  [{ id, c, r, label, colour, lit }]                lamps painted on the playfield (drawing only);
//               lit(game) => 0 | 1 | 2 lights one from game state instead of lamp `id`
//   toys:     [{ art, at: game => [x, y] | null }]            moving pictures placed by the game state (drawing only)
//               or { draw(ctx, game, t, art) } for a toy that draws itself
//   rules, lampGroups, modes: see engine/rules.js. `script(game)` may return extra hooks for odd tables
//               ({ start, tick, or a trigger type such as ramp }). game.lookAt = y asks the screen to show that
//               part of the table (High Noon's Quick Draw), null to follow the ball again.
//               game.video = { draw(api, t) } takes over the dot matrix for a game played on it (Cup Final's
//               penalty shootout); the rules read the flipper buttons with flip:left and flip:right.
//   status(game) => 'TEXT' | null   a line the dot matrix shows under the score (a match score, say)

import { World, Ball, STEP } from './physics.js';
import { Flipper } from './parts/flipper.js';
import { Plunger } from './parts/plunger.js';
import { Rules } from './rules.js';
import { offsetPath, rampHalfWidths, densify } from './geom.js';

const D = Math.PI / 180;

export class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.world = new World({ gravity: cfg.gravity ?? 900 });
    this.events = [];
    this.state = 'attract';             // attract | ready (ball on plunger) | play | over
    this.players = [];
    this.current = 0;
    this.attractLamps = {};
    this.flashes = {};                  // part id -> time it last fired (for drawing)
    this.timeLeftSave = 0;
    this.nudges = [];
    this.tilted = false;
    this.acc = 0;
    this.modes = {};                    // running timed modes
    this.lastTrigger = {};              // trigger name -> time (for combos)
    this.timers = [];
    this.launchQueue = 0;               // balls waiting to be auto-launched (multiball, ball save)
    this.nextLaunch = 0;
    this.spin = {};                     // spinner id -> { angle, rate }
    this.banks = {};                    // drop bank id -> { shapes, resetAt }
    this.saucerBalls = new Map();       // ball -> { saucer, releaseAt } (a magnet holds balls the same way)
    this.fieldOn = {};                  // magnet id -> time it switches off
    this.posts = {};                    // raisable wall or post id -> { shapes, up }
    this.build();
    this.world.onHit = (b, s, impact, fired) => this.hit(b, s, impact, fired);
    this.world.onSensor = (b, s) => this.sensor(b, s);
    this.rules = new Rules(this, cfg);
    this.script = cfg.script ? cfg.script(this) : {};
  }

  // lamps belong to the player whose turn it is
  get lamps() { return this.player?.lamps ?? this.attractLamps; }
  get player() { return this.players[this.current]; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  after(secs, fn) { this.timers.push({ at: this.world.time + secs, fn }); }
  // balls in play (not a captive ball)
  liveBalls() { return this.world.balls.filter(b => b.live && !b.captive).length; }
  inPlay(b) { return b.live && !b.captive; }

  // ---------- building ----------
  build() {
    const w = this.world, c = this.cfg;
    const mat = (o, d) => ({ r: o.r ?? d.r ?? 1, bounce: o.bounce ?? d.bounce, friction: o.friction ?? d.friction, layer: o.layer ?? 0 });
    // a wall or post with an id can be raised and lowered by the rules
    const raisable = (o, shape) => {
      if (!o.id) return shape;
      const p = (this.posts[o.id] ??= { shapes: [], up: !o.down, def: o });
      shape.disabled = !p.up; p.shapes.push(shape);
      return shape;
    };
    for (const wall of c.walls ?? []) {
      const m = { ...mat(wall, { r: 1, bounce: 0.35 }), ...(wall.oneWay ? { oneWay: wall.oneWay } : {}), ...(wall.captiveOnly ? { captiveOnly: true } : {}) };
      if (wall.path) for (let i = 0; i + 1 < wall.path.length; i++) raisable(wall, w.add({ kind: 'seg', a: wall.path[i], b: wall.path[i + 1], ...m, tag: 'wall' }));
      if (wall.arc) raisable(wall, w.add({ kind: 'arc', c: wall.arc.c, R: wall.arc.R, a0: wall.arc.from * D, a1: wall.arc.to * D, ...m, tag: 'wall' }));
    }
    for (const p of c.posts ?? []) raisable(p, w.add({ kind: 'circle', c: p.c, R: p.R, bounce: p.bounce ?? 0.5, layer: p.layer ?? 0, tag: 'post' }));
    for (const b of c.bumpers ?? []) w.add({ kind: 'circle', c: b.c, R: b.R, bounce: 0.3, kick: b.kick ?? 420, kickMin: 0, id: b.id, tag: 'bumper', part: b });
    for (const s of c.slings ?? []) {
      const [A, B, C] = s.points;
      w.add({ kind: 'seg', a: A, b: B, r: 1, bounce: 0.5, tag: 'slingside' });
      w.add({ kind: 'seg', a: B, b: C, r: 1, bounce: 0.5, tag: 'slingside' });
      w.add({ kind: 'seg', a: A, b: C, r: 1.5, bounce: s.bounce ?? 0.4, kick: s.kick ?? 260, kickMin: s.kickMin ?? 110, id: s.id, tag: 'sling', part: s });
    }
    this.moving = [];
    for (const t of c.targets ?? []) {
      const s = w.add({ kind: 'seg', a: [...t.a], b: [...t.b], r: 1.5, bounce: 0.45, id: t.id, tag: 'target', part: t, hitMin: 60, ...(t.move ? { vel: [0, 0] } : {}) });
      if (t.move) this.moving.push(s);
    }
    for (const bank of c.dropBanks ?? []) {
      const shapes = bank.targets.map(([a, b], i) => w.add({ kind: 'seg', a, b, r: 1.5, bounce: 0.3, id: `${bank.id}:${i}`, tag: 'drop', bank: bank.id, part: bank, hitMin: 40 }));
      this.banks[bank.id] = { shapes, resetAt: null, def: bank };
    }
    for (const l of c.lanes ?? []) w.add({ kind: 'seg', a: l.a, b: l.b, r: 0, sensor: true, id: l.id, tag: 'lane', part: l });
    for (const sp of c.spinners ?? []) { w.add({ kind: 'seg', a: sp.a, b: sp.b, r: 0, sensor: true, id: sp.id, tag: 'spinner', part: sp }); this.spin[sp.id] = { angle: 0, rate: 0, acc: 0 }; }
    for (const sc of c.saucers ?? []) w.add({ kind: 'circle', c: sc.c, R: sc.R ?? 0, r: 0, sensor: true, id: sc.id, tag: 'saucer', part: sc });
    for (const k of c.kickbacks ?? []) w.add({ kind: 'seg', a: k.a, b: k.b, r: 0, sensor: true, id: k.id, tag: 'kickback', part: k });
    for (const g of c.gates ?? []) w.add({ kind: 'seg', a: g.a, b: g.b, r: 1, oneWay: g.oneWay, bounce: 0.2, layer: g.layer ?? 0, tag: 'gate' });
    for (const r of c.ramps ?? []) this.buildRamp(r);
    this.flippers = (c.flippers ?? []).map(f => w.addPart(new Flipper(f)));
    this.plunger = c.plunger ? w.addPart(new Plunger(c.plunger)) : null;
    this.addCaptives();
  }
  addCaptives() {
    for (const cb of this.cfg.captives ?? []) { const b = this.world.addBall(new Ball(cb.c[0], cb.c[1], this.cfg.ballRadius ?? 5)); b.captive = cb.id ?? true; }
  }

  // vortexes and magnets push the balls near them
  pushFields() {
    const t = this.world.time;
    for (const f of this.cfg.fields ?? []) {
      if (f.lamp && !this.lamps[f.lamp]) continue;
      if (f.kind === 'magnet' && !(this.fieldOn[f.id] > t)) continue;
      for (const b of this.world.balls) {
        if (!this.inPlay(b) || b.held || b.layer !== 0) continue;
        const dx = b.x - f.c[0], dy = b.y - f.c[1], d = Math.hypot(dx, dy);
        const inside = d < f.R;
        b.inField ??= {};
        if (inside && !b.inField[f.id] && f.kind === 'vortex') this.trigger('field', f.id, f.score ?? 100);
        b.inField[f.id] = inside;
        if (!inside || d < 0.01) continue;
        // (a vortex fades out towards its edge; a magnet pulls evenly, harder than gravity, so it can lift a ball)
        const k = (f.strength ?? 1500) * (f.kind === 'magnet' ? 1 : 1 - d / f.R) * STEP, nx = dx / d, ny = dy / d;
        if (f.kind === 'vortex') { const s = f.spin ?? 1; b.vx += -ny * s * k; b.vy += nx * s * k; }
        else {
          b.vx -= nx * k; b.vy -= ny * k;
          b.vx *= 0.99; b.vy *= 0.99;   // damped, so it settles in
          if (d < 6 && Math.hypot(b.vx, b.vy) < 450 && !this.saucerBalls.has(b)) {
            b.held = true; b.vx = b.vy = 0; b.x = f.c[0]; b.y = f.c[1];
            this.saucerBalls.set(b, { saucer: { id: f.id, R: 0, part: { eject: f.eject ?? { dir: [0, -1], speed: 600 } } }, releaseAt: t + (f.hold ?? 1) });
            this.fieldOn[f.id] = 0;
            this.trigger('magnet', f.id, f.score ?? 1000);
          }
        }
      }
    }
  }

  // moving targets slide to and fro
  moveTargets() {
    const t = this.world.time;
    for (const s of this.moving) {
      const m = s.part.move;
      if (m.follow) { this.follow(s, m); continue; }
      const w = (2 * Math.PI) / (m.secs ?? 4), k = Math.sin(t * w), dk = Math.cos(t * w) * w;
      s.a[0] = s.part.a[0] + m.by[0] * k; s.a[1] = s.part.a[1] + m.by[1] * k;
      s.b[0] = s.part.b[0] + m.by[0] * k; s.b[1] = s.part.b[1] + m.by[1] * k;
      s.vel[0] = m.by[0] * dk; s.vel[1] = m.by[1] * dk;
    }
  }
  // a goalkeeper: slides across (up to `reach` either side, at most `speed` px/s) to get in line with the
  // nearest ball coming at it from below, and paces to and fro along his line (once every `secs`) when there is none
  follow(s, m) {
    const cx = (s.part.a[0] + s.part.b[0]) / 2, y = (s.part.a[1] + s.part.b[1]) / 2;
    let best = null;
    for (const b of this.world.balls) if (this.inPlay(b) && !b.held && b.layer === 0 && b.y > y && b.y - y < (m.sight ?? 260) && (!best || b.y < best.y)) best = b;
    const idle = m.reach * Math.sin(this.world.time * 2 * Math.PI / (m.secs ?? 3));   // pacing his line
    const want = best ? Math.max(-m.reach, Math.min(m.reach, best.x - cx)) : idle;
    s.off ??= 0;
    const max = m.speed * STEP;
    const d = Math.max(-max, Math.min(max, want - s.off));
    s.off += d;
    s.a[0] = s.part.a[0] + s.off; s.b[0] = s.part.b[0] + s.off;
    s.a[1] = s.part.a[1]; s.b[1] = s.part.b[1];
    s.vel[0] = d / STEP; s.vel[1] = 0;
  }
  // where a target is now: [a, b]
  targetAt(id) {
    const s = this.moving.find(x => x.id === id);
    if (s) return [s.a, s.b];
    const t = this.cfg.targets?.find(x => x.id === id);
    return t ? [t.a, t.b] : null;
  }

  // A ramp or wire rail: two rails on its own layer, a lip on the playfield at the mouth that turns back
  // balls too slow to climb, and sensors that move a ball between layers at each end.
  buildRamp(r) {
    const w = this.world, L = r.layer ?? 1;
    if (!r.shaped) { r.path = densify(r.path, 10); r.shaped = true; }   // once, even if the config is reused
    const p = r.path, n = p.length;
    const half = rampHalfWidths(p, r.width ?? 16, r.mouth ?? r.width ?? 16, r.taper ?? 30);
    r.left = offsetPath(p, half); r.right = offsetPath(p, half.map(h => -h));
    for (const rail of [r.left, r.right]) for (let i = 0; i + 1 < rail.length; i++)
      w.add({ kind: 'seg', a: rail[i], b: rail[i + 1], r: 1, bounce: 0.25, friction: 0.02, layer: L, tag: 'rail' });
    const dir = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const din = dir(p[0], p[1]), dout = dir(p[n - 2], p[n - 1]);
    const across = (pt, d, out = 0) => [[pt[0] + r.left[0][0] - p[0][0] + d[0] * out, pt[1] + r.left[0][1] - p[0][1] + d[1] * out], [pt[0] + r.right[0][0] - p[0][0] + d[0] * out, pt[1] + r.right[0][1] - p[0][1] + d[1] * out]];
    const [m0, m1] = across(p[0], din);
    r.mouthLine = [m0, m1];
    // on the playfield: entry sensor at the mouth, and the lip just inside it
    w.add({ kind: 'seg', a: m0, b: m1, r: 0, sensor: true, layer: 0, tag: 'rampIn', ramp: r, dir: din });
    const [l0, l1] = across(p[0], din, 6);
    w.add({ kind: 'seg', a: l0, b: l1, r: 1, bounce: 0.3, layer: 0, tag: 'lip' });
    // optional funnel: two short playfield walls flaring out from the mouth toward the player
    if (r.funnel) {
      const [fl, fs] = Array.isArray(r.funnel) ? r.funnel : [r.funnel, r.funnel * 0.45];
      const nx = din[1], ny = -din[0];               // left of the travel direction
      const wall = (m, side) => [m, [m[0] - din[0] * fl + nx * fs * side, m[1] - din[1] * fl + ny * fs * side]];
      r.funnelWalls = [wall(m0, 1), wall(m1, -1)];
      for (const [a, b] of r.funnelWalls) w.add({ kind: 'seg', a, b, r: 1.5, bounce: 0.3, layer: 0, tag: 'wall' });
    }
    // on the ramp: a ball rolling back out of the mouth drops to the playfield
    w.add({ kind: 'seg', a: m0, b: m1, r: 0, sensor: true, layer: L, tag: 'rampBack', ramp: r, dir: [-din[0], -din[1]] });
    // the far end: drops the ball back to the playfield
    const e0 = r.left[n - 1], e1 = r.right[n - 1];
    w.add({ kind: 'seg', a: e0, b: e1, r: 0, sensor: true, layer: L, tag: 'rampOut', ramp: r, dir: dout });
  }

  // ---------- game flow ----------
  // hold the ball in a saucer for longer (a rule can do this while the player picks something)
  holdSaucer(id, secs) {
    for (const h of this.saucerBalls.values()) if (h.saucer.id === id) h.releaseAt = Math.max(h.releaseAt, this.world.time + secs);
  }
  // a hurry-up mode's value now (0 if it isn't running)
  hurryValue(id) {
    const m = this.modes[id]; if (!m?.def.hurry) return 0;
    const [from, to] = m.def.hurry, secs = m.def.secs ?? 20;
    return Math.round((to + (from - to) * Math.max(0, m.left) / secs) / 10) * 10;
  }
  // let a held ball go now
  releaseSaucer(id) {
    for (const h of this.saucerBalls.values()) if (h.saucer.id === id) h.releaseAt = this.world.time;
  }
  saucerHolding(id) { return [...this.saucerBalls.values()].some(h => h.saucer.id === id); }

  start(players = 1) {
    this.players = Array.from({ length: players }, (_, i) => ({ n: i + 1, score: 0, ball: 1, lamps: {}, counts: {}, locks: 0, bonus: 0, bonusX: 1, extra: 0 }));
    this.current = 0;
    this.world.balls.length = 0;
    this.addCaptives();
    this.modes = {}; this.timers = []; this.launchQueue = 0; this.saucerBalls.clear(); this.fieldOn = {};
    for (const id of Object.keys(this.banks)) this.resetBank(id, true);
    for (const [id, p] of Object.entries(this.posts)) this.setPost(id, !p.def.down);
    for (const [id, on] of Object.entries(this.cfg.startLamps ?? {})) for (const p of this.players) p.lamps[id] = on;
    this.script.start?.(this);
    this.emit('start', { players });
    this.rules.fire('start');
    this.serve();
  }

  serve() {
    this.addBallAtPlunger();
    this.state = 'ready';
    this.tilted = false; this.nudges = [];
    this.flippers.forEach(f => (f.enabled = true));
    this.timeLeftSave = 0; this.saveArmed = true;
    this.emit('serve', { player: this.player.n, ball: this.player.ball });
    this.rules.fire('serve');
  }

  addBallAtPlunger() {
    const c = this.cfg;
    const [x, y] = c.ballStart ?? [(c.plunger.x0 + c.plunger.x1) / 2, c.plunger.y - (c.ballRadius ?? 5) - 1];
    return this.world.addBall(new Ball(x, y, c.ballRadius ?? 5));
  }

  addScore(n) {
    if (!this.player || this.tilted || this.state === 'over') return;
    this.player.score += Math.round(n);
  }

  // a scoring event from a part: score it (with any mode multiplier), tell the screen, run the rules
  trigger(type, id, base, data = {}) {
    const k = this.rules.multiplier(type, id);
    if (base) this.addScore(base * k);
    this.emit(type, { id, ...data, x: k });
    this.rules.fire(type, id);
    this.script[type]?.(id, this);
  }

  // a ball sitting in the shooter lane, ready for the plunger
  ballInLane() {
    const l = this.cfg.lane;
    return this.world.balls.some(b => this.inPlay(b) && b.x > l.x0 && b.y > l.yTop);
  }

  // ---------- locks and multiball ----------
  lock() {
    this.player.locks++;
    this.emit('locked', { locks: this.player.locks });
  }
  multiball(total) {
    const want = Math.max(0, total - this.liveBalls() - this.launchQueue);
    this.launchQueue += want;
    this.nextLaunch = this.world.time + 0.6;
    this.player.locks = 0;
    this.timeLeftSave = Math.max(this.timeLeftSave, this.cfg.multiballSave ?? 10);
    this.emit('multiball', { balls: total });
    this.rules.fire('multiballStart');
  }
  // put a ball in the shooter lane and fire it, if the lane is clear
  autoLaunch() {
    const l = this.cfg.lane;
    if (this.world.balls.some(b => b.live && b.x > l.x0 && b.y > l.yTop - 20)) return false;
    const b = this.addBallAtPlunger();
    b.vy = -(this.plunger?.maxSpeed ?? 1300) * 0.97;
    this.emit('launch', { power: 1, auto: true });
    return true;
  }

  // ---------- drop targets ----------
  // drop a whole bank without scoring (to open a shot behind it); it stays down until reset
  dropBank(id) {
    const bank = this.banks[id]; if (!bank) return;
    bank.shapes.forEach(s => (s.disabled = true));
    bank.resetAt = null;
  }
  resetBank(id, quiet = false) {
    const bank = this.banks[id]; if (!bank) return;
    bank.shapes.forEach(s => (s.disabled = false));
    bank.resetAt = null;
    if (!quiet) this.emit('bankReset', { id });
  }

  // ---------- raisable posts and diverters ----------
  // a post only rises when no ball is in the way (it would trap the ball); it tries again shortly
  setPost(id, up) {
    const p = this.posts[id]; if (!p) return;
    p.want = up;
    if (!up) { p.up = false; p.shapes.forEach(s => (s.disabled = true)); return; }
    const clear = this.world.balls.every(b => p.shapes.every(s => this.world.distance(s, b) > b.r + 1));
    if (clear) { p.up = true; p.shapes.forEach(s => (s.disabled = false)); }
    else this.after(0.1, () => { if (p.want) this.setPost(id, true); });
  }

  // ---------- player input ----------
  flip(side, down) {
    let pressed = false;   // one press, however many flippers are on that side (an upper flipper too)
    for (const f of this.flippers) if (f.side === side) {
      const was = f.held; f.set(down && !this.tilted);
      if (f.held && !was) pressed = true;
    }
    if (pressed) {
      for (const f of this.flippers) if (f.side === side && f.held) this.flashes[f.id] = this.world.time;   // (a pistol's muzzle flash)
      this.emit('flip', { side }); if (this.state === 'play' || this.state === 'ready') this.rules.flip(side); }
  }
  pull(p) { if (this.plunger && this.state !== 'over') this.plunger.setPull(p); }
  launch() {
    if (!this.plunger) return;
    const power = this.plunger.release();
    if (power > 0) this.emit('launch', { power });
  }
  nudge(dx, dy) {
    if (this.state !== 'play' || this.tilted) return;
    const t = this.world.time;
    this.nudges = this.nudges.filter(n => t - n < 4);
    this.nudges.push(t);
    for (const b of this.world.balls) if (b.live && b.layer === 0 && !b.held) { b.vx += dx * 110; b.vy += dy * 130; }
    this.emit('nudge', { dx, dy });
    const warn = this.cfg.tiltWarnings ?? 3;
    if (this.nudges.length > warn) {
      this.tilted = true;
      this.flippers.forEach(f => { f.enabled = false; f.set(false); });
      this.emit('tilt');
    } else if (this.nudges.length === warn) this.emit('danger');
  }

  // ---------- physics callbacks ----------
  hit(ball, s, impact) {
    const t = this.world.time;
    switch (s.tag) {
      case 'bumper': case 'sling':
        this.flashes[s.id] = t;
        this.trigger(s.tag, s.id, s.part.score ?? (s.tag === 'bumper' ? 100 : 10));
        break;
      case 'target':
        this.flashes[s.id] = t;
        this.trigger('hit', s.id, s.part.score ?? 250);
        break;
      case 'drop': {
        s.disabled = true; this.flashes[s.id] = t;
        const bank = this.banks[s.bank];
        this.trigger('drop', s.bank, bank.def.score ?? 500, { target: s.id });
        if (bank.shapes.every(x => x.disabled)) {
          this.trigger('bankDown', s.bank, bank.def.bankScore ?? 0);
          if (bank.def.resetDelay !== null) bank.resetAt = t + (bank.def.resetDelay ?? 2);
        }
        break;
      }
      default:
        if (!s.id && impact > 220) this.emit('knock', { impact });
    }
  }

  sensor(ball, s) {
    const speedAlong = d => ball.vx * d[0] + ball.vy * d[1];
    switch (s.tag) {
      case 'lane': this.trigger('lane', s.id, s.part.score ?? 50); break;
      case 'spinner': {
        const sp = this.spin[s.id];
        sp.rate = Math.min(60, sp.rate + Math.hypot(ball.vx, ball.vy) / 40); // turns a second
        break;
      }
      case 'saucer':
        if (this.saucerBalls.size && [...this.saucerBalls.values()].some(v => v.saucer === s)) return; // already full
        ball.held = true; ball.vx = ball.vy = 0; ball.x = s.c[0]; ball.y = s.c[1];
        if (s.part.exit) { ball.hidden = true; ball.x = s.part.exit[0]; ball.y = s.part.exit[1]; }   // gone down the subway (the camera follows it to the exit)
        this.saucerBalls.set(ball, { saucer: s, releaseAt: this.world.time + (s.part.hold ?? 1.2) });
        this.trigger('saucer', s.id, s.part.score ?? 1000);
        break;
      case 'kickback':
        if (!this.lamps[s.id] || this.tilted) return;
        ball.vx = s.part.dir[0] * (s.part.speed ?? 900); ball.vy = s.part.dir[1] * (s.part.speed ?? 900);
        this.lamps[s.id] = 0;
        this.flashes[s.id] = this.world.time;
        this.trigger('kickback', s.id, 0);
        break;
      case 'rampIn':
        if (speedAlong(s.dir) >= (s.ramp.minSpeed ?? 380)) {
          this.world.setLayer(ball, s.ramp.layer ?? 1);
          // assist: a ball that clears the lip is lined up with the ramp and helped up the climb (like a real
          // ramp entrance funnelling it in), so the lip decides make or miss rather than a glancing rail hit
          if (s.ramp.assist) {
            const v = Math.max(Math.hypot(ball.vx, ball.vy), s.ramp.assist);
            ball.vx = s.dir[0] * v; ball.vy = s.dir[1] * v;
          }
          this.emit('rampEnter', { id: s.ramp.id });
        }
        break;
      case 'rampBack':
        if (speedAlong(s.dir) > 0) { this.world.setLayer(ball, 0); this.trigger('rampFail', s.ramp.id, 0); }
        break;
      case 'rampOut':
        if (speedAlong(s.dir) > 0) { this.world.setLayer(ball, 0); this.trigger('ramp', s.ramp.id, s.ramp.score ?? 1000, { style: s.ramp.style }); }
        break;
    }
  }

  // ---------- time ----------
  update(dt) {
    this.acc += Math.min(dt, 0.1);   // after a long pause, don't try to catch up
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(); }
  }

  tick() {
    if (this.moving.length) this.moveTargets();
    if (this.cfg.fields) this.pushFields();
    this.world.step();
    const t = this.world.time;
    // spinners turn down; each whole turn scores
    for (const [id, sp] of Object.entries(this.spin)) if (sp.rate > 0.05) {
      sp.angle += sp.rate * STEP * Math.PI * 2;
      sp.acc += sp.rate * STEP;
      sp.rate *= Math.exp(-STEP * 1.6);
      while (sp.acc >= 1) { sp.acc -= 1; if (this.state === 'play') this.trigger('spin', id, this.cfg.spinners.find(x => x.id === id).score ?? 100); }
    } else sp.rate = 0;
    // timers, modes, drop bank resets
    if (this.timers.length) for (const tm of [...this.timers]) if (t >= tm.at) { this.timers.splice(this.timers.indexOf(tm), 1); tm.fn(); }
    this.rules.tick(STEP);
    this.script.tick?.();
    for (const [id, bank] of Object.entries(this.banks)) if (bank.resetAt !== null && t >= bank.resetAt) this.resetBank(id);
    // saucers kick their balls out
    for (const [b, h] of this.saucerBalls) if (t >= h.releaseAt) {
      const e = h.saucer.part.eject ?? { dir: [0, 1], speed: 300 };
      const l = Math.hypot(e.dir[0], e.dir[1]);
      b.held = false; b.hidden = false; b.vx = e.dir[0] / l * e.speed + (Math.random() - 0.5) * 20; b.vy = e.dir[1] / l * e.speed;
      if (h.saucer.part.exit) { b.x = h.saucer.part.exit[0]; b.y = h.saucer.part.exit[1]; b.vx = e.dir[0] / l * e.speed; }   // up from the subway
      else {
        const out = (h.saucer.R ?? 0) + b.r + 2;   // clear of the hole, so it isn't caught again
        b.x += b.vx / e.speed * out; b.y += b.vy / e.speed * out;
      }
      this.saucerBalls.delete(b);
      this.emit('eject', { id: h.saucer.id });
    }
    if (this.state === 'attract' || this.state === 'over') return;
    // queued auto-launches (multiball, saved balls)
    if (this.launchQueue > 0 && t >= this.nextLaunch && this.autoLaunch()) { this.launchQueue--; this.nextLaunch = t + 1.2; }
    const c = this.cfg, l = c.lane;
    // launched: the ball has left the shooter lane
    if (this.state === 'ready' && !this.ballInLane() && this.world.balls.some(b => this.inPlay(b) && b.y < l.yTop)) {
      this.state = 'play';
      if (this.saveArmed) { this.timeLeftSave = Math.max(this.timeLeftSave, c.ballSave ?? 6); this.saveArmed = false; this.emit('saveOn'); }
    }
    // a weak launch that fell back: the ball is back on the plunger and can be launched again
    if (this.state === 'play' && this.launchQueue === 0 && this.world.balls.length && this.world.balls.some(b => this.inPlay(b)) && this.world.balls.every(b => !this.inPlay(b) || (b.x > l.x0 && b.y > l.yTop + 40))) this.state = 'ready';
    if (this.timeLeftSave > 0) { this.timeLeftSave -= STEP; if (this.timeLeftSave <= 0) this.emit('saveOff'); }
    // drained balls
    const drainY = c.drainY ?? c.size[1] + 10;
    const before = this.liveBalls();
    for (const b of this.world.balls) if (b.live && (b.y > drainY || b.x < -20 || b.x > c.size[0] + 20 || b.y < -40)) {
      b.live = false;
      if (b.y < drainY) this.emit('lost'); // escaped the table: a physics bug, reported so tests catch it
    }
    if (this.world.balls.some(b => !b.live)) {
      this.world.balls = this.world.balls.filter(b => b.live);
      const lost = before - this.world.balls.length;
      const multi = before + this.launchQueue > 1;
      if (this.timeLeftSave > 0 && !this.tilted) {
        // ball save: single ball goes back on the plunger; in multiball it is launched again
        this.emit('saved');
        if (multi) { this.launchQueue += lost; this.nextLaunch = Math.min(this.nextLaunch, t + 0.5); }
        else { this.addBallAtPlunger(); this.state = 'ready'; this.timeLeftSave = 0; this.saveArmed = true; }
        return;
      }
      if (multi && this.liveBalls() + this.launchQueue === 1) { this.emit('multiballEnd'); this.rules.fire('multiballEnd'); }
      if (this.liveBalls() + this.launchQueue === 0) this.drained();
    }
  }

  drained() {
    const p = this.player;
    for (const id of Object.keys(this.modes)) this.rules.endMode(id);
    this.emit('drain', { tilted: this.tilted });
    this.rules.fire('drain');
    if (!this.tilted && p.bonus > 0) {
      const total = p.bonus * p.bonusX;
      this.emit('bonus', { bonus: p.bonus, x: p.bonusX, total });
      p.score += total;
    }
    p.bonus = 0; p.bonusX = 1;
    if (p.extra > 0) { p.extra--; this.emit('shootAgain'); this.serve(); return; }
    p.ball++;
    const maxBalls = this.cfg.balls ?? 3;
    // next player still in the game, or game over
    for (let i = 1; i <= this.players.length; i++) {
      const q = this.players[(this.current + i) % this.players.length];
      if (q.ball <= maxBalls) { this.current = this.players.indexOf(q); this.serve(); return; }
    }
    this.state = 'over';
    this.flippers.forEach(f => f.set(false));
    this.emit('over', { scores: this.players.map(q => q.score) });
  }
}
