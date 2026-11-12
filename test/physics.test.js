// Headless physics checks: run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, Ball, STEP } from '../engine/physics.js';
import { Game } from '../engine/table.js';
import testTable from '../tables/test/config.js';

const run = (world, secs) => { for (let t = 0; t < secs; t += STEP) world.step(); };

test('a very fast ball does not pass through a thin wall', () => {
  const w = new World({ gravity: 0 });
  w.add({ kind: 'seg', a: [0, 100], b: [200, 100], r: 0 });
  const b = w.addBall(new Ball(100, 20, 5));
  b.vy = 2500;
  run(w, 0.2);
  assert.ok(b.y < 100, `ball ended at y=${b.y.toFixed(1)}`);
  assert.ok(b.vy < 0, 'ball bounced back');
});

test('a ball dropped on a floor comes to rest on it', () => {
  const w = new World({ gravity: 900 });
  w.add({ kind: 'seg', a: [0, 100], b: [200, 100], r: 0 });
  const b = w.addBall(new Ball(100, 0, 5));
  run(w, 4);
  assert.ok(Math.abs(b.y - 95) < 0.5, `rests at y=${b.y.toFixed(2)}`);
  assert.ok(Math.abs(b.vy) < 5, `still moving at ${b.vy.toFixed(1)}`);
});

const newGame = () => { const g = new Game(testTable); g.start(1); return g; };
const ball = g => g.world.balls[0];

test('a full plunge sends the ball round the top and into the playfield', () => {
  const g = newGame();
  for (let i = 0; i < 18; i++) g.update(1 / 60);
  g.pull(1); for (let i = 0; i < 30; i++) g.update(1 / 60);
  g.launch();
  let topY = 999, leftX = 999, played = false;
  for (let i = 0; i < 60; i++) { g.update(1 / 60); const b = ball(g); if (!b) break; topY = Math.min(topY, b.y); leftX = Math.min(leftX, b.x); played ||= g.state === 'play'; }
  assert.ok(topY < 60, `ball only reached y=${topY.toFixed(0)}`);
  assert.ok(leftX < 250, `ball never left the lane side (min x ${leftX.toFixed(0)})`);
  assert.ok(played, 'game went into play');
});

test('a soft plunge falls back to the plunger', () => {
  const g = newGame();
  for (let i = 0; i < 18; i++) g.update(1 / 60);
  g.pull(0.15); for (let i = 0; i < 30; i++) g.update(1 / 60);
  g.launch();
  for (let i = 0; i < 240; i++) g.update(1 / 60);
  assert.equal(g.state, 'ready');
  assert.ok(g.ballInLane());
});

test('a ball cradled on a raised flipper is fired up the table', () => {
  const g = newGame();
  const b = ball(g);
  g.flip('left', true); for (let i = 0; i < 12; i++) g.update(1 / 60);
  // put the ball on the raised left flipper, near its tip
  const f = g.flippers[0];
  const [tx, ty] = f.tip();
  b.x = (f.px + tx) / 2 + 8; b.y = Math.min(f.py, ty) - 14; b.vx = 0; b.vy = 0;
  g.state = 'play';
  g.flip('left', false); for (let i = 0; i < 15; i++) g.update(1 / 60);           // flipper drops, ball rolls down onto it
  g.flip('left', true);
  let fastest = 0;
  for (let i = 0; i < 20; i++) { g.update(1 / 240); fastest = Math.max(fastest, -ball(g).vy); }
  assert.ok(fastest > 700, `ball only went up at ${fastest.toFixed(0)} px/s`);
});

test('a bumper kicks the ball away', () => {
  const g = newGame();
  const b = ball(g);
  g.state = 'play';
  b.x = 115; b.y = 190; b.vx = 0; b.vy = 50;  // dropping onto bump1 from above
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) { g.update(1 / 120); hit = g.events.some(e => e.type === 'bumper'); }
  assert.ok(hit, 'bumper fired');
  assert.ok(Math.hypot(b.vx, b.vy) > 300, 'ball kicked away');
});

test('flipping at random for 3 minutes never lets a ball escape the table', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...testTable, balls: 1000, ballSave: 0 });
  g.start(1);
  let lost = 0, launches = 0;
  for (let i = 0; i < 60 * 180; i++) {
    if (i % 7 === 0) { g.flip('left', rnd() < 0.5); g.flip('right', rnd() < 0.5); }
    if (g.state === 'ready' && g.ballInLane()) {
      g.pull(0.6 + rnd() * 0.4); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); launches++;
    }
    g.update(1 / 60);
    for (const e of g.events) if (e.type === 'lost') lost++;
    g.events.length = 0;
  }
  assert.equal(lost, 0, `${lost} balls escaped the table`);
  assert.ok(launches > 5, 'several balls were played');
});

test('a ball that falls back into the shooter lane can be launched again', () => {
  const g = newGame();
  for (let i = 0; i < 18; i++) g.update(1 / 60);
  g.pull(0.55); for (let i = 0; i < 30; i++) g.update(1 / 60);
  g.launch();
  for (let i = 0; i < 300; i++) g.update(1 / 60);
  assert.ok(g.ballInLane(), 'ball is back on the plunger');
  assert.equal(g.state, 'ready');
});

test('no ball comes to a stop on the playfield in 15 minutes of bot play', () => {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...testTable, balls: 100000, ballSave: 0 });
  g.start(1);
  let hold = 0, still = 0; const stuck = [];
  for (let i = 0; i < 60 * 900; i++) {
    const b = g.world.balls[0];
    if (b && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    else if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.5 + rnd() * 0.5); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
    g.update(1 / 60);
    // a ball still for 3 seconds outside the shooter lane is stuck (cradling isn't possible for this bot)
    if (b && g.state === 'play' && Math.hypot(b.vx, b.vy) < 15) { if (++still === 180) { stuck.push(`${b.x.toFixed(0)},${b.y.toFixed(0)}`); b.vy = -300; } } else still = 0;
    g.events.length = 0;
  }
  assert.deepEqual(stuck, []);
});

test('the slingshots cannot keep a ball bouncing between them', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...testTable, balls: 100000, ballSave: 0 });
  g.start(1);
  let hold = 0, run = 0, last = null, longest = 0;
  for (let i = 0; i < 60 * 600; i++) {
    const b = g.world.balls[0];
    if (b && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    else if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.6 + rnd() * 0.4); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
    g.update(1 / 60);
    for (const e of g.events) {
      if (e.type === 'sling') { run = last && last !== e.id ? run + 1 : 1; last = e.id; longest = Math.max(longest, run); }
      else if (e.type === 'bumper' || e.type === 'target' || e.type === 'flip') { run = 0; last = null; }
    }
    g.events.length = 0;
  }
  assert.ok(longest < 8, `ball went back and forth between the slings ${longest} times`);
});
