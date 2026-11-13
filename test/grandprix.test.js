// The Grand Prix table: the crossover ramps, laps and overtakes, tyre wear and the pit stop, the race finish and
// championship points, the Victory Lap multiball, the two dot-matrix games and long bot games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import grandprix, { status, move, LAPS, CARS, WEAR, GRID, POINTS, CIRCUITS, pitResult, startResult } from '../tables/grandprix/config.js';

const newGame = (over = {}) => { const g = new Game({ ...grandprix, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const sink = (g, id) => { const b = ball(g); g.sensor(b, shape(g, id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 1 / 60); g.flip(side, false); };
const flipShot = (g, id, ms) => {
  const f = g.flippers.find(x => x.id === id), b = ball(g);
  g.flip(f.side, true); run(g, 10 / 60);
  const [tx, ty] = f.tip(); Object.assign(b, { x: f.px + (tx - f.px) * 0.55, y: f.py + (ty - f.py) * 0.55 - 12, vx: 0, vy: 0 });
  run(g, 1.5);
  g.flip(f.side, false); for (let i = 0; i < ms; i++) g.update(1 / 1000);
  g.flip(f.side, true); g.events.length = 0;
  return b;
};
const sweep = (id, want) => {
  let n = 0;
  for (let ms = 100; ms <= 560; ms += 4) {
    const g = newGame(); flipShot(g, id, ms);
    let seen = false; run(g, 3, () => { seen ||= g.events.some(want); g.events.length = 0; });
    if (seen) n++;
  }
  return n;
};

test('the first race starts sixth on the grid', () => {
  const g = newGame();
  assert.equal(g.player.counts.pos, GRID);
  assert.equal(status(g), 'LAP 1/5  P6  0 PTS');
  assert.equal(g.lamps.pos6, 2);
});

test('each flipper makes the crossover ramp across from it: the left the Banking, the right the Flyover', () => {
  assert.ok(sweep('flipL', e => e.type === 'ramp' && e.id === 'banking') >= 15);
  assert.ok(sweep('flipR', e => e.type === 'ramp' && e.id === 'flyover') >= 15);
  assert.ok(sweep('flipL', e => e.type === 'lane' && e.id === 'orbit') >= 15);
  assert.ok(sweep('flipL', e => e.type === 'drop') >= 10);
  assert.ok(sweep('flipR', e => e.type === 'spin') >= 15);
});

test('a ball on the Banking lands in the left inlane, one on the Flyover in the right inlane', () => {
  for (const [id, side] of [['banking', 'left'], ['flyover', 'right']]) {
    const g = newGame(); const r = g.cfg.ramps.find(x => x.id === id), [a, c] = r.path;
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]), b = ball(g);
    Object.assign(b, { x: a[0] - (c[0] - a[0]) / l * 20, y: a[1] - (c[1] - a[1]) / l * 20, vx: (c[0] - a[0]) / l * 900, vy: (c[1] - a[1]) / l * 900 });
    let at = null; run(g, 4, () => { if (!at && g.events.some(e => e.type === 'ramp')) at = [b.x, b.y]; });
    assert.ok(at, `${id} not made`);
    assert.ok(side === 'left' ? at[0] < 60 : at[0] > 245, `${id} landed at ${at}`);
  }
});

test('a ramp is a lap and an overtake; DRS makes it two', () => {
  const g = newGame();
  g.trigger('ramp', 'flyover', 0);
  assert.equal(g.player.counts.lap, 1);
  assert.equal(g.player.counts.pos, GRID - 1);
  for (let i = 0; i < 3; i++) g.hit(ball(g), shape(g, `drs:${i}`), 300);
  assert.equal(g.lamps.drs, 2);
  g.trigger('ramp', 'banking', 0);
  assert.equal(g.player.counts.pos, GRID - 3);
  assert.equal(g.lamps.drs, 0);
  assert.match(messages(g).join('|'), /FASTEST LAP/);
});

test('an orbit up the right is a lap; a ball coming down it is not', () => {
  const g = newGame();
  g.trigger('lane', 'orbit', 0);
  assert.equal(g.player.counts.lap, 0);
  Object.assign(ball(g), { x: 280, y: 240, vx: 0, vy: -500 });
  g.trigger('lane', 'orbit', 0);
  assert.equal(g.player.counts.lap, 1);
  assert.equal(g.player.counts.pos, GRID);
});

test('worn tyres: box after four laps, then each lap loses a place; a pit stop fits new tyres', () => {
  const g = newGame();
  const up = () => { Object.assign(ball(g), { x: 280, y: 240, vx: 0, vy: -500 }); g.trigger('lane', 'orbit', 0); };
  g.player.counts.pos = 4;
  for (let i = 0; i < WEAR; i++) up();
  assert.equal(g.lamps.box, 2);
  assert.match(messages(g).join('|'), /BOX BOX/);
  g.player.counts.lap = 0;
  up();
  assert.equal(g.player.counts.pos, 5);
  sink(g, 'pit'); run(g, 0.1);
  const ps = g.video.ps;
  while (g.world.time < ps.start) run(g, 1 / 60);
  for (let i = 0; i < 4; i++) press(g, ps.sides[i]);
  assert.ok(ps.time < 2.4, `${ps.time}`);
  run(g, 3);
  assert.equal(g.player.counts.wear, 0);
  assert.equal(g.player.counts.pos, 3, 'a fast stop gains two places');
  assert.equal(g.video, null);
  assert.ok(!ball(g).held);
});

test('pit stop and start times turn into places', () => {
  assert.deepEqual([2, 3, 4, 6].map(pitResult), [2, 1, 0, -1]);
  assert.deepEqual([-0.1, 0.2, 0.3, 0.5, 0.8].map(startResult), [-1, 3, 2, 1, 0]);
});

test('the Start Lights: go as the lights go out to gain places; too soon is a jump start', () => {
  const g = newGame();
  for (let i = 0; i < 20; i++) g.trigger('spin', 'straight', 100);
  assert.equal(g.lamps.lights, 2);
  sink(g, 'pit'); run(g, 0.1);
  const sl = g.video.sl;
  while (g.world.time < sl.out) run(g, 1 / 60);
  press(g, 'left');
  run(g, 3);
  assert.equal(g.player.counts.pos, GRID - 3);
  const g2 = newGame(); g2.lamps.lights = 2; g2.player.counts.pos = 4;
  sink(g2, 'pit'); run(g2, 1.5); press(g2, 'right'); run(g2, 3);
  assert.match(messages(g2).join('|'), /JUMP START/);
  assert.equal(g2.player.counts.pos, 5);
});

test('the last lap finishes the race: points by place, and a win starts Victory Lap multiball', () => {
  const g = newGame();
  Object.assign(g.player.counts, { lap: LAPS - 1, pos: 3 });
  g.trigger('ramp', 'flyover', 0);
  assert.match(messages(g).join('|'), /CHEQUERED FLAG  P2 18 POINTS/);
  assert.equal(g.player.counts.pts, POINTS[1]);
  assert.equal(g.player.counts.race, 1);
  assert.equal(g.player.counts.pos, GRID, 'the next race starts from the grid again');
  Object.assign(g.player.counts, { lap: LAPS - 1, pos: 2 });
  g.trigger('ramp', 'banking', 0);
  run(g, 0.1);
  assert.match(messages(g).join('|'), /YOU WIN/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  const before = g.player.score;
  g.trigger('ramp', 'flyover', 0);
  assert.ok(g.player.score - before >= 50000);
  assert.equal(status(g), null);
});

test('a season of six races: 100 points makes you world champion', () => {
  const g = newGame();
  Object.assign(g.player.counts, { race: CIRCUITS.length - 1, pts: 90, lap: LAPS - 1, pos: 2 });
  g.trigger('ramp', 'flyover', 0);
  assert.match(messages(g).join('|'), /WORLD CHAMPION/);
  assert.equal(g.player.counts.race, 0);
  assert.equal(g.lamps.xball, 2);
});

test('places stay between first and last', () => {
  const g = newGame();
  move(g, 20); assert.equal(g.player.counts.pos, 1);
  move(g, -20); assert.equal(g.player.counts.pos, CARS);
});

test('ten minutes of bot play on Grand Prix: no ball escapes or gets stuck, and races are run', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...grandprix, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0, laps = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    for (const b of g.world.balls) if (b.layer === 0 && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.5 + rnd() * 0.5); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
    g.update(1 / 60);
    for (const b of g.world.balls) {
      if (b.held || (b.x > 294 && b.y > 400)) { still.delete(b); continue; }
      if (Math.hypot(b.vx, b.vy) < 15) { const n = (still.get(b) ?? 0) + 1; still.set(b, n); if (n === 180) { stuck.push(`${b.x.toFixed(0)},${b.y.toFixed(0)} layer ${b.layer}`); b.vy = -300; } }
      else still.delete(b);
    }
    for (const e of g.events) { if (e.type === 'lost') lost++; if (e.type === 'ramp') laps++; }
    g.events.length = 0;
  }
  assert.equal(lost, 0);
  assert.deepEqual(stuck, []);
  assert.ok(laps >= 10, `only ${laps} ramps in ten minutes`);
});

test('the theme tune is sixteen bars of 4/4 in every part', async () => {
  const { default: music } = await import('../tables/grandprix/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and both games draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawPitStop, drawLights } = await import('../tables/grandprix/scenes.js');
  for (const sc of Object.values(grandprix.scenes)) {
    const d = createDmd(grandprix.dmd); d.show(['OVERTAKE', 'P4'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(grandprix.dmd);
  for (const phase of ['ready', 'go', 'done']) {
    const ps = { wheel: phase === 'done' ? 4 : 1, sides: ['left', 'right', 'right', 'left'], start: 0.5, times: [], phase, time: 2.3, fumble: 0.8 };
    for (let t = 0; t < 2.5; t += 0.05) d.frame(t, () => ({ video: api => drawPitStop(api, ps, t) }));
  }
  for (const [phase, result] of [['lights', null], ['done', 0.31], ['done', -0.2]]) {
    const sl = { on: 0.3, out: 4, press: 1, phase, result };
    for (let t = 0; t < 5; t += 0.05) d.frame(t, () => ({ video: api => drawLights(api, sl, t) }));
  }
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: 'LAP 3/5  P4  43 PTS  BOX' }));
});
