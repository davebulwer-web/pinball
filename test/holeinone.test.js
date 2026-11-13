// The Hole in One table: holes with par and yardage, strokes counted at the flippers, holing out at the Cup,
// bunkers and wind, the two dot-matrix games (the Putting Green and the Long Drive) and 19th Hole multiball.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import holeinone, { COURSE, status, meter, PUTTS, DRIVE_SECS } from '../tables/holeinone/config.js';

const newGame = (over = {}) => { const g = new Game({ ...holeinone, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const sink = (g, id) => { const b = ball(g); g.sensor(b, shape(g, id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 0.02); g.flip(side, false); };
const park = g => { g.saucerBalls.clear(); Object.assign(ball(g), { held: false, hidden: false, x: 303, y: 592, vx: 0, vy: 0 }); };

test('the first hole is on the tee from the start: its par and yards are under the score', () => {
  const g = newGame();
  assert.equal(g.player.counts.yards, COURSE[0][1]);
  assert.match(status(g), /^HOLE 1 PAR 4 380Y S0$/);
});

test('shots carry the ball down the fairway; on the green the flag lights', () => {
  const g = newGame();
  g.trigger('ramp', 'buggy', 0);
  assert.equal(g.player.counts.yards, 180);
  g.trigger('lane', 'orbit', 0);
  assert.equal(g.player.counts.yards, 30);
  assert.equal(g.lamps.flag, 0);
  g.trigger('drop', 'tee:0', 0);
  assert.equal(g.lamps.flag, 2);
  assert.match(messages(g).join('|'), /ON THE GREEN/);
});

test('every shot is a stroke, except spins; a bunker costs a stroke too', () => {
  const g = newGame();
  g.trigger('ramp', 'buggy', 0); g.trigger('lane', 'laneP', 0);
  assert.equal(g.player.counts.strokes, 2);
  for (let i = 0; i < 5; i++) g.trigger('spin', 'fairway', 100);
  assert.equal(g.player.counts.strokes, 2);
  assert.equal(g.player.counts.yards, 380 - 200 - 60 - 20);
  g.trigger('field', 'bunker', 100);
  assert.equal(g.player.counts.strokes, 3);
});

test('holing out scores by strokes against par, and the next hole tees off', () => {
  const g = newGame();
  g.lamps.flag = 2; g.player.counts.strokes = 2;
  park(g);
  const before = g.player.score;
  sink(g, 'cup'); run(g, 0.05);
  assert.match(messages(g).join('|'), /BIRDIE 3 STROKES\s+40,000/);
  assert.ok(g.player.score - before >= 40000);
  assert.equal(g.player.counts.hole, 1);
  assert.equal(g.player.counts.yards, COURSE[1][1]);
  assert.equal(g.player.counts.toPar, -1);
});

test('the Cup before reaching the green is an approach shot, not a hole out', () => {
  const g = newGame();
  park(g); sink(g, 'cup'); run(g, 0.05);
  assert.equal(g.player.counts.hole ?? 0, 0);
  assert.equal(g.player.counts.yards, 230);
  assert.equal(g.player.counts.strokes, 1);
  assert.match(messages(g).join('|'), /APPROACH SHOT/);
});

test('within 150 yards the Cup chips straight in: from the tee of a par 3, that is a hole in one', () => {
  const g = newGame();
  g.player.counts.hole = 1; g.player.counts.yards = 150; g.player.counts.strokes = 0;
  park(g); sink(g, 'cup'); run(g, 0.05);
  assert.match(messages(g).join('|'), /CHIPPED IN/);
  assert.match(messages(g).join('|'), /HOLE IN ONE/);
  assert.equal(g.lamps.xball, 2);
});

test('the ninth hole finishes the round: 19th Hole multiball, where the Cup is a jackpot', () => {
  const g = newGame();
  g.player.counts.hole = 8; g.lamps.flag = 2; g.player.counts.strokes = 3;
  park(g); sink(g, 'cup'); run(g, 0.1);
  assert.match(messages(g).join('|'), /19TH HOLE MULTIBALL/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  assert.equal(g.player.counts.hole, 0);
  park(g);
  const before = g.player.score;
  sink(g, 'cup'); run(g, 0.05);
  assert.ok(g.player.score - before >= 50000);
});

test('a bunker slows the ball down', () => {
  const g = newGame();
  g.world.gravity = 0;
  const b = ball(g); Object.assign(b, { x: 162, y: 190, vx: 0, vy: -300, live: true });
  run(g, 0.15);
  assert.ok(b.vy > -250, `still going ${b.vy}`);
});

test('the wind blows the ball across the top of the table', () => {
  const g = newGame();
  g.world.gravity = 0; g.lamps.windL = 1; g.lamps.windR = 0;
  const b = ball(g); Object.assign(b, { x: 120, y: 220, vx: 0, vy: 0, live: true });
  run(g, 0.3);
  assert.ok(b.vx > 30, `vx ${b.vx}`);
});

test('the Putting Green: a putt struck at the right power drops in', () => {
  const g = newGame();
  g.lamps.putting = 2; sink(g, 'clubhouse'); run(g, 0.1);
  const pg = g.video.pg;
  for (let k = 0; k < PUTTS; k++) {
    while (g.world.time < pg.at || Math.abs(meter(pg, g.world.time) - pg.target) > 0.02) run(g, 1 / 120);
    press(g, 'left');
    run(g, 2.8);
  }
  assert.equal(pg.holed, PUTTS);
  assert.match(messages(g).join('|'), /THREE FROM THREE/);
  run(g, 3);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held, 'the Clubhouse lets the ball go');
});

test('the Long Drive: alternate taps wind up the swing; the same button twice counts once', () => {
  const g = newGame();
  g.lamps.drive = 2; sink(g, 'clubhouse'); run(g, 1.6);
  const ld = g.video.ld;
  press(g, 'left'); press(g, 'left');
  assert.equal(ld.taps, 1);
  for (let i = 0; i < 29; i++) press(g, i % 2 ? 'left' : 'right');
  assert.equal(ld.taps, 30);
  run(g, DRIVE_SECS + 3);
  assert.equal(ld.yards, 120 + 30 * 9);
  assert.match(messages(g).join('|'), /390 YARDS LONGEST DRIVE/);
  assert.equal(g.player.counts.longest, 390);
});

test('TEE lights the Long Drive; twenty spins light the Putting Green', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) g.hit(ball(g), shape(g, `tee:${i}`), 300);
  assert.equal(g.lamps.drive, 2);
  for (let i = 0; i < 20; i++) g.trigger('spin', 'fairway', 100);
  assert.equal(g.lamps.putting, 2);
});

test('ten minutes of bot play on Hole in One, with the wind blowing: no ball escapes or gets stuck', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...holeinone, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    if (i % 3600 === 0) { g.lamps.windL = i % 7200 ? 1 : 0; g.lamps.windR = i % 7200 ? 0 : 1; }
    for (const b of g.world.balls) if (b.layer === 0 && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.5 + rnd() * 0.5); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
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

test('the theme tune is sixteen bars of 4/4 in every part', async () => {
  const { default: music } = await import('../tables/holeinone/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and both games draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawPutting, drawDrive } = await import('../tables/holeinone/scenes.js');
  for (const sc of Object.values(holeinone.scenes)) {
    const d = createDmd(holeinone.dmd); d.show(['BIRDIE', '3 STROKES 40,000'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(holeinone.dmd);
  for (const phase of ['aim', 'roll']) {
    const pg = { putt: 1, holed: 1, results: [true], phase, target: 0.6, power: 0.55, at: 0.2, rollAt: 0.3 };
    for (let t = 0; t < 2; t += 0.05) d.frame(t, () => ({ video: api => drawPutting(api, pg, t) }));
  }
  for (const phase of ['swing', 'fly']) {
    const ld = { taps: 12, start: 0.5, secs: 4, yards: 300, phase, flyAt: 0.2 };
    for (let t = 0; t < 3; t += 0.05) d.frame(t, () => ({ video: api => drawDrive(api, ld, t) }));
  }
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: 'HOLE 3 PAR 5 520Y S2' }));
});
