// The Fun Fair table: its shots and rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import funfair from '../tables/funfair/config.js';

const newGame = (over = {}) => { const g = new Game({ ...funfair, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); each?.(g); } };
const seen = g => { const e = g.events.map(x => x.type + (x.id ? ':' + x.id : '')); g.events.length = 0; return e; };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const shoot = (g, x, y, vx, vy) => { const b = g.world.balls[0]; Object.assign(b, { x, y, vx, vy }); return b; };
const shootRamp = (g, id, speed) => {
  const r = g.cfg.ramps.find(x => x.id === id), [a, c] = r.path;
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]), d = [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
  return shoot(g, a[0] - d[0] * 20, a[1] - d[1] * 20, d[0] * speed, d[1] * speed);
};
const saucer = g => g.world.shapes.find(s => s.id === 'bigTop');
const dropDucks = g => { const b = g.world.balls[0]; for (const s of g.banks.ducks.shapes) g.hit(b, s, 200); };
// a ball resting in the cradle of a flipper, then flipped after `ms`
const flipShot = (g, side, ms) => {
  const f = g.flippers.find(x => x.side === side), b = g.world.balls[0];
  g.flip(side, true); run(g, 10 / 60);
  const [tx, ty] = f.tip(); Object.assign(b, { x: f.px + (tx - f.px) * 0.55, y: f.py + (ty - f.py) * 0.55 - 12, vx: 0, vy: 0 });
  run(g, 1.5);
  g.flip(side, false); for (let i = 0; i < ms; i++) g.update(1 / 1000);
  g.flip(side, true); g.events.length = 0;
  return b;
};

test('the Big Wheel drops to the left flipper and the Rollercoaster to the right', () => {
  for (const [id, side] of [['bigWheel', 'left'], ['coaster', 'right']]) {
    const g = newGame(); const b = shootRamp(g, id, 600);
    let landed = null;
    run(g, 3, () => { if (!landed && g.events.some(e => e.type === 'ramp' && e.id === id)) landed = [b.x, b.y]; });
    assert.ok(landed, `${id} completed`);
    assert.ok(side === 'left' ? landed[0] < 60 : landed[0] > 242, `${id} dropped at ${landed}`);
    assert.equal(b.layer, 0);
  }
});

test('each ramp is made from a good range of flipper timings', () => {
  // cradle-and-flip sweep, 4 ms steps: the cross shot to each ramp works over a real window, not one lucky timing
  for (const [side, id] of [['right', 'bigWheel'], ['left', 'coaster']]) {
    let made = 0;
    for (let ms = 100; ms <= 560; ms += 4) {
      const g = newGame(); flipShot(g, side, ms);
      let hit = false; run(g, 3, () => { hit ||= g.events.some(e => e.type === 'ramp' && e.id === id); });
      if (hit) made++;
    }
    assert.ok(made >= 15, `${side} flipper made the ${id} ${made} times out of 116`);
  }
});

test('the plunger can reach the top lanes, and the lit one is a skill shot', () => {
  const lanesHit = new Set();
  for (let p = 0.5; p <= 1.0001; p += 0.02) {
    const g = newGame(); g.state = 'ready'; g.pull(p); run(g, 20 / 60); g.launch(); g.events.length = 0;
    run(g, 4, () => { for (const e of g.events) if (e.type === 'lane' && e.id.startsWith('lane')) lanesHit.add(e.id); });
  }
  assert.ok(lanesHit.size >= 2, [...lanesHit].join());
  const g = newGame(); g.events.length = 0;
  g.rules.flip('left'); // the flippers move the lit skill lane
  const lit = ['skF', 'skU', 'skN'].findIndex(id => g.lamps[id]);
  const before = g.player.score;
  g.trigger('lane', ['laneF', 'laneU', 'laneN'][lit], 50);
  assert.ok(messages(g).includes('SKILL SHOT 10,000'));
  assert.ok(g.player.score - before >= 10000);
  assert.ok(['skF', 'skU', 'skN'].every(id => !g.lamps[id]), 'skill shot goes out');
});

test('a bumper before the lanes ends the skill shot', () => {
  const g = newGame();
  g.trigger('bumper', 'dodgem1', 100);
  assert.ok(['skF', 'skU', 'skN'].every(id => !g.lamps[id]));
});

test('five ride tickets open the Big Top; two locks start a three-ball multiball', () => {
  const g = newGame();
  for (let i = 0; i < 4; i++) g.rules.fire('ramp', 'bigWheel');
  assert.ok(!g.lamps.lock);
  g.rules.fire('bankDown', 'ducks');
  assert.equal(g.lamps.lock, 2, 'Big Top open');
  assert.ok(['ride1', 'ride2', 'ride3', 'ride4', 'ride5'].every(id => g.lamps[id]));
  g.events.length = 0;
  g.sensor(g.world.balls[0], saucer(g)); run(g, 2);
  assert.equal(g.player.locks, 1);
  assert.ok(messages(g).some(m => m.startsWith('BALL LOCKED')));
  g.sensor(g.world.balls[0], saucer(g)); run(g, 4);
  assert.ok(seen(g).includes('multiball'));
  assert.equal(g.lamps.lock, 0);
  assert.ok(g.banks.ducks.shapes.every(s => s.disabled), 'ducks drop so the Big Top is open for jackpots');
  // in multiball a ramp lights the jackpot and the Big Top collects it
  g.rules.fire('ramp', 'coaster');
  assert.equal(g.lamps.jackpot, 2);
  const before = g.player.score;
  g.sensor(g.world.balls[0], saucer(g));
  assert.ok(g.player.score - before >= 50000);
  assert.equal(g.lamps.jackpot, 0);
});

test('a flipper shot through the dropped ducks goes into the Big Top', () => {
  let caught = 0;
  for (const side of ['left', 'right']) for (let ms = 100; ms <= 560; ms += 4) {
    const g = newGame(); g.dropBank('ducks'); flipShot(g, side, ms);
    run(g, 3, () => { if (g.events.some(e => e.type === 'saucer')) caught++; g.events.length = 0; });
  }
  assert.ok(caught >= 3, `Big Top caught ${caught} shots`);
});

test('the ducks stay down until the Big Top is hit, then come back up once the ball is out', () => {
  const g = newGame();
  dropDucks(g);
  run(g, 5, () => (g.world.balls[0].held = true));
  assert.ok(g.banks.ducks.shapes.every(s => s.disabled), 'still down');
  g.world.balls[0].held = false;
  g.sensor(g.world.balls[0], saucer(g));
  run(g, 3);
  assert.ok(g.banks.ducks.shapes.every(s => !s.disabled), 'back up');
});

test('Hook a Duck lights the extra ball, then pays a growing award', () => {
  const g = newGame();
  dropDucks(g);
  assert.equal(g.lamps.xball, 2);
  g.sensor(g.world.balls[0], saucer(g));
  assert.equal(g.player.extra, 1);
  g.resetBank('ducks');
  const a = g.player.score; dropDucks(g); const first = g.player.score - a;
  g.resetBank('ducks');
  const b = g.player.score; dropDucks(g); const second = g.player.score - b;
  assert.ok(second > first, `${second} > ${first}`);
});

test('the coaster combo doubles with each repeat', () => {
  const g = newGame();
  const awards = [];
  for (let i = 0; i < 3; i++) {
    g.rules.fire('ramp', 'bigWheel');
    assert.equal(g.lamps.combo, 2);
    const s = g.player.score; g.rules.fire('ramp', 'coaster'); awards.push(g.player.score - s);
  }
  assert.ok(awards[1] - awards[0] >= 10000 && awards[2] - awards[1] >= 20000, awards.join());
  // too slow: no combo
  g.rules.fire('ramp', 'bigWheel'); g.world.balls[0].held = true; run(g, 6);
  assert.equal(g.lamps.combo, 0);
  const s = g.player.score; g.rules.fire('ramp', 'coaster');
  assert.ok(g.player.score - s < 10000);
});

test('three Coconut Shy hits relight the kickback', () => {
  const g = newGame();
  g.lamps.kbL = 0;
  const coco = g.world.shapes.find(s => s.id === 'coconut'), b = g.world.balls[0];
  for (let i = 0; i < 3; i++) g.hit(b, coco, 200);
  assert.equal(g.lamps.kbL, 1);
  assert.ok(messages(g).includes('COCONUT SHY KICKBACK LIT'));
});

test('a shot up the spinner lane spins it; 20 spins light the Ghost Train, which makes spins worth 5 times as much', () => {
  const g = newGame(); shoot(g, 23, 330, 0, -1000);
  let spins = 0; run(g, 1, () => { spins += g.events.filter(e => e.type === 'spin').length; g.events.length = 0; });
  assert.ok(spins >= 3, `${spins} spins`);
  for (let i = 0; i < 20; i++) g.rules.fire('spin', 'spinner');
  assert.equal(g.lamps.ghost, 2);
  g.sensor(g.world.balls[0], saucer(g));
  assert.ok(g.modes.ghost, 'Ghost Train running');
  assert.equal(g.rules.multiplier('spin', 'spinner'), 5);
  g.world.balls[0].held = true; run(g, 31);
  assert.ok(!g.modes.ghost);
});

test('a shot round the right orbit comes back over the top into the lanes', () => {
  const g = newGame(); shoot(g, 279, 330, 0, -1000);
  const ev = []; run(g, 3, () => { ev.push(...seen(g)); });
  assert.ok(ev.includes('lane:orbit'), ev.join());
  assert.ok(ev.some(e => /^lane:lane[FUN]$/.test(e)) || ev.some(e => e.startsWith('bumper')), ev.join());
});

test('ten minutes of bot play on Fun Fair: no ball escapes or gets stuck', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...funfair, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    for (const b of g.world.balls) if (b.layer === 0 && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.6 + rnd() * 0.4); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
    g.update(1 / 60);
    for (const b of g.world.balls) {
      if (b.held || (b.x > 294 && b.y > 400)) { still.delete(b); continue; }
      if (Math.hypot(b.vx, b.vy) < 15) { const n = (still.get(b) ?? 0) + 1; still.set(b, n); if (n === 180) { stuck.push(`${b.x.toFixed(0)},${b.y.toFixed(0)} layer ${b.layer}`); b.vy = -300; } }
      else still.delete(b);
    }
    for (const e of g.events) if (e.type === 'lost') lost++;
    g.events.length = 0;
  }
  assert.equal(lost, 0);
  assert.deepEqual(stuck, []);
});

test('the theme tune is sixteen bars of waltz time in every part', async () => {
  const { default: music } = await import('../tables/funfair/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.ok(beats === 48 || beats === 24, `a track is ${beats} beats`);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  for (const [name, sc] of Object.entries(funfair.scenes)) {
    const d = createDmd(); d.show(['HOOK A DUCK', '5,000'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
});
