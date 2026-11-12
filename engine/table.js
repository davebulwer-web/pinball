// A pinball game on one table: builds the physics world from a table config, runs balls, players,
// the plunger, ball save, nudging and tilt, and reports what happens as events for the screen and sound.
// No drawing code here, so it runs headless in tests.
//
// Table config (see tables/test/config.js for a full example):
//   size: [w, h], gravity, ballRadius, balls (per game), ballSave (seconds), drainY
//   lane: { x0, x1, yTop }                     the shooter lane (used to tell when a ball is launched)
//   plunger: { x0, x1, y, maxPull, minSpeed, maxSpeed }
//   flippers: [{ id, pivot, side, length, ... }]
//   walls:   [{ path: [[x, y], ...] } | { arc: { c, R, from, to } }]   (degrees; plus r, bounce, friction)
//   posts:   [{ c, R }]
//   bumpers: [{ id, c, R, kick, score }]
//   slings:  [{ id, points: [A, B, C], kick, score }]   kicking face is A to C
//   targets: [{ id, a, b, score }]            solid, scores when hit
//   lanes:   [{ id, a, b, score }]            sensors, score when rolled over
//   gates:   [{ a, b, oneWay: [nx, ny] }]     one-way walls (solid only from the side oneWay points to)
//   rules(game): optional table rules, returns { hit(id, game), sensor(id, game), flip(side, game) }

import { World, Ball, STEP } from './physics.js';
import { Flipper } from './parts/flipper.js';
import { Plunger } from './parts/plunger.js';

const D = Math.PI / 180;

export class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.world = new World({ gravity: cfg.gravity ?? 900 });
    this.events = [];
    this.state = 'attract';             // attract | ready (ball on plunger) | play | over
    this.players = [];
    this.current = 0;
    this.lamps = {};                    // lamp id -> 0 off, 1 on, 2 blinking (drawn by the screen)
    this.flashes = {};                  // part id -> time it last fired (for drawing)
    this.timeLeftSave = 0;
    this.nudges = [];
    this.tilted = false;
    this.acc = 0;
    this.build();
    this.world.onHit = (b, s, impact, fired) => this.hit(b, s, impact, fired);
    this.world.onSensor = (b, s) => this.sensor(b, s);
    this.rules = cfg.rules ? cfg.rules(this) : {};
  }

  // ---------- building ----------
  build() {
    const w = this.world, c = this.cfg;
    const mat = (o, d) => ({ r: o.r ?? d.r ?? 1, bounce: o.bounce ?? d.bounce, friction: o.friction ?? d.friction, layer: o.layer ?? 0 });
    for (const wall of c.walls ?? []) {
      const m = mat(wall, { r: 1, bounce: 0.35 });
      if (wall.path) for (let i = 0; i + 1 < wall.path.length; i++) w.add({ kind: 'seg', a: wall.path[i], b: wall.path[i + 1], ...m, tag: 'wall' });
      if (wall.arc) w.add({ kind: 'arc', c: wall.arc.c, R: wall.arc.R, a0: wall.arc.from * D, a1: wall.arc.to * D, ...m, tag: 'wall' });
    }
    for (const p of c.posts ?? []) w.add({ kind: 'circle', c: p.c, R: p.R, bounce: p.bounce ?? 0.5, tag: 'post' });
    for (const b of c.bumpers ?? []) w.add({ kind: 'circle', c: b.c, R: b.R, bounce: 0.3, kick: b.kick ?? 420, kickMin: 0, id: b.id, tag: 'bumper', part: b });
    for (const s of c.slings ?? []) {
      const [A, B, C] = s.points;
      w.add({ kind: 'seg', a: A, b: B, r: 1, bounce: 0.5, tag: 'slingside' });
      w.add({ kind: 'seg', a: B, b: C, r: 1, bounce: 0.5, tag: 'slingside' });
      w.add({ kind: 'seg', a: A, b: C, r: 1.5, bounce: s.bounce ?? 0.4, kick: s.kick ?? 260, kickMin: s.kickMin ?? 110, id: s.id, tag: 'sling', part: s });
    }
    for (const t of c.targets ?? []) w.add({ kind: 'seg', a: t.a, b: t.b, r: 1.5, bounce: 0.45, id: t.id, tag: 'target', part: t, hitMin: 60 });
    for (const l of c.lanes ?? []) w.add({ kind: 'seg', a: l.a, b: l.b, r: 0, sensor: true, id: l.id, tag: 'lane', part: l });
    for (const g of c.gates ?? []) w.add({ kind: 'seg', a: g.a, b: g.b, r: 1, oneWay: g.oneWay, bounce: 0.2, tag: 'gate' });
    this.flippers = (c.flippers ?? []).map(f => w.addPart(new Flipper(f)));
    this.plunger = c.plunger ? w.addPart(new Plunger(c.plunger)) : null;
  }

  // ---------- game flow ----------
  get player() { return this.players[this.current]; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  start(players = 1) {
    this.players = Array.from({ length: players }, (_, i) => ({ n: i + 1, score: 0, ball: 1 }));
    this.current = 0;
    this.world.balls.length = 0;
    this.rules.start?.(this);
    this.emit('start', { players });
    this.serve();
  }

  serve() {
    const c = this.cfg;
    const [x, y] = c.ballStart ?? [(c.plunger.x0 + c.plunger.x1) / 2, c.plunger.y - (c.ballRadius ?? 5) - 1];
    this.world.addBall(new Ball(x, y, c.ballRadius ?? 5));
    this.state = 'ready';
    this.tilted = false; this.nudges = [];
    this.flippers.forEach(f => (f.enabled = true));
    this.timeLeftSave = 0; this.saveArmed = true;
    this.emit('serve', { player: this.player.n, ball: this.player.ball });
  }

  addScore(n) {
    if (!this.player || this.tilted || this.state === 'over') return;
    this.player.score += n;
  }

  // a ball sitting in the shooter lane, ready for the plunger
  ballInLane() {
    const l = this.cfg.lane;
    return this.world.balls.some(b => b.live && b.x > l.x0 && b.y > l.yTop);
  }

  // ---------- player input ----------
  flip(side, down) {
    for (const f of this.flippers) if (f.side === side) {
      const was = f.held; f.set(down && !this.tilted);
      if (f.held && !was) { this.emit('flip', { side }); this.rules.flip?.(side, this); }
    }
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
    for (const b of this.world.balls) if (b.live && b.layer === 0) { b.vx += dx * 110; b.vy += dy * 130; }
    this.emit('nudge', { dx, dy });
    const warn = this.cfg.tiltWarnings ?? 3;
    if (this.nudges.length > warn) {
      this.tilted = true;
      this.flippers.forEach(f => { f.enabled = false; f.set(false); });
      this.emit('tilt');
    } else if (this.nudges.length === warn) this.emit('danger');
  }

  // ---------- physics callbacks ----------
  hit(ball, s, impact, fired) {
    if (s.tag === 'bumper' || s.tag === 'sling') {
      this.flashes[s.id] = this.world.time;
      this.addScore(s.part.score ?? (s.tag === 'bumper' ? 100 : 10));
      this.emit(s.tag, { id: s.id });
    } else if (s.tag === 'target') {
      this.flashes[s.id] = this.world.time;
      this.addScore(s.part.score ?? 250);
      this.emit('target', { id: s.id });
    } else if (!s.id) {
      this.emit('knock', { impact });
    }
    if (s.id) this.rules.hit?.(s.id, this);
  }
  sensor(ball, s) {
    if (s.tag === 'lane') {
      this.addScore(s.part.score ?? 50);
      this.emit('lane', { id: s.id });
      this.rules.sensor?.(s.id, this);
    }
  }

  // ---------- time ----------
  update(dt) {
    this.acc += Math.min(dt, 0.1);   // after a long pause, don't try to catch up
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(); }
  }

  tick() {
    this.world.step();
    if (this.state === 'attract' || this.state === 'over') return;
    const c = this.cfg, l = c.lane;
    // launched: the ball has left the shooter lane
    if (this.state === 'ready' && !this.ballInLane() && this.world.balls.some(b => b.live && b.y < l.yTop)) {
      this.state = 'play';
      if (this.saveArmed) { this.timeLeftSave = c.ballSave ?? 6; this.saveArmed = false; this.emit('saveOn'); }
    }
    // a weak launch that fell back: the ball is back on the plunger and can be launched again
    if (this.state === 'play' && this.world.balls.length && this.world.balls.every(b => !b.live || (b.x > l.x0 && b.y > l.yTop + 40))) this.state = 'ready';
    if (this.timeLeftSave > 0) { this.timeLeftSave -= STEP; if (this.timeLeftSave <= 0) this.emit('saveOff'); }
    // drained balls
    const drainY = c.drainY ?? c.size[1] + 10;
    for (const b of this.world.balls) if (b.live && (b.y > drainY || b.x < -20 || b.x > c.size[0] + 20 || b.y < -40)) {
      b.live = false;
      if (b.y < drainY) this.emit('lost'); // escaped the table: a physics bug, reported so tests catch it
    }
    if (this.world.balls.some(b => !b.live)) {
      this.world.balls = this.world.balls.filter(b => b.live);
      if (this.world.balls.length === 0) this.drained();
    }
  }

  drained() {
    if (this.timeLeftSave > 0 && !this.tilted) {
      this.emit('saved');
      const c = this.cfg;
      const [x, y] = c.ballStart ?? [(c.plunger.x0 + c.plunger.x1) / 2, c.plunger.y - (c.ballRadius ?? 5) - 1];
      this.world.addBall(new Ball(x, y, c.ballRadius ?? 5));
      this.state = 'ready'; this.timeLeftSave = 0; this.saveArmed = true;
      return;
    }
    this.emit('drain', { tilted: this.tilted });
    this.rules.drain?.(this);
    const p = this.player;
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
