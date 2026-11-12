// Engine parts and rules, played on the parts test table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import parts from '../tables/parts/config.js';

const newGame = (over = {}) => { const g = new Game({ ...parts, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); each?.(g); } };
const seen = g => { const e = g.events.map(x => x.type + (x.id ? ':' + x.id : '')); g.events.length = 0; return e; };
const shoot = (g, x, y, vx, vy) => { const b = g.world.balls[0]; Object.assign(b, { x, y, vx, vy }); return b; };

test('a slow ball is turned back at the ramp mouth, a fast one rides the ramp to the left inlane', () => {
  let g = newGame(); shoot(g, 80, 375, 0, -350); run(g, 1);
  assert.ok(!seen(g).includes('rampEnter:bigWheel'), 'slow ball should not get on the ramp');
  g = newGame(); const b = shoot(g, 80, 375, 0, -900);
  let landed = null;
  run(g, 3, () => { if (!landed && g.events.some(e => e.type === 'ramp' && e.id === 'bigWheel')) landed = [b.x, b.y]; });
  assert.ok(landed, 'ball completed the ramp');
  assert.ok(landed[0] > 34 && landed[0] < 54 && landed[1] < 440, `dropped at ${landed}, not over the left inlane`);
  assert.equal(b.layer, 0);
});

test('a ball that runs out of speed on a ramp rolls back off it onto the playfield', () => {
  const g = newGame(); const b = shoot(g, 80, 375, 0, -520);
  run(g, 2);
  const ev = seen(g);
  assert.ok(ev.includes('rampEnter:bigWheel') && ev.includes('rampFail:bigWheel'), ev.join());
  assert.equal(b.layer, 0);
});

test('the wire rail drops the ball into the saucer, which kicks it out again', () => {
  const g = newGame(); shoot(g, 232, 375, 0, -1000);
  let held = false;
  run(g, 4, () => { held ||= g.world.balls[0]?.held; });
  const ev = seen(g);
  assert.ok(ev.includes('ramp:coaster'), 'wire completed');
  assert.ok(held && ev.includes('saucer:hole') && ev.includes('eject:hole'), ev.join());
});

test('dropping the whole bank lights the lock, and the bank comes back up', () => {
  const g = newGame();
  const b = g.world.balls[0];
  for (const s of g.banks.ducks.shapes) g.hit(b, s, 200);
  assert.ok(seen(g).includes('bankDown:ducks'));
  assert.equal(g.lamps.lock, 2);
  assert.ok(g.banks.ducks.shapes.every(s => s.disabled));
  b.held = true; run(g, 3);                      // keep the ball still while the bank resets
  assert.ok(g.banks.ducks.shapes.every(s => !s.disabled), 'bank reset');
});

test('two locks start a three-ball multiball; the jackpot is lit until it ends', () => {
  const g = newGame();
  const hole = g.world.shapes.find(s => s.id === 'hole');
  for (let n = 0; n < 2; n++) {
    g.lamps.lock = 2;
    g.sensor(g.world.balls[0], hole);
    run(g, 2);
  }
  assert.equal(g.player.locks, 0, 'locks used up');
  run(g, 4);
  const ev = seen(g);
  assert.ok(ev.includes('multiball'), ev.join());
  assert.equal(g.lamps.jackpot, 2);
  // drain all but one (ball save off)
  g.timeLeftSave = 0; g.launchQueue = 0;
  g.world.balls.slice(1).forEach(b => (b.y = 700));
  run(g, 0.1);
  assert.ok(seen(g).includes('multiballEnd'));
  assert.equal(g.lamps.jackpot, 0);
  assert.equal(g.liveBalls(), 1);
});

test('the kickback fires a ball back up when lit, and lets it drain when not', () => {
  let g = newGame(); assert.equal(g.lamps.kbL, 1);
  let b = shoot(g, 27, 470, 0, 300); run(g, 0.6);
  assert.ok(seen(g).includes('kickback:kbL'));
  assert.ok(b.vy < 0 || b.y < 470, 'ball went back up');
  assert.equal(g.lamps.kbL, 0);
  b = shoot(g, 27, 470, 0, 300); run(g, 1.5);
  assert.ok(seen(g).includes('drain'), 'unlit kickback lets the ball drain');
});

test('the spinner scores per turn, five times as much in Spin Frenzy', () => {
  const spinScore = frenzy => {
    const g = newGame();
    if (frenzy) g.rules.startMode('frenzy');
    const before = g.player.score;
    const b = shoot(g, 279, 300, 0, -800); b.held = false;
    run(g, 0.25); b.held = true; run(g, 3);
    return g.player.score - before;
  };
  const plain = spinScore(false), frenzy = spinScore(true);
  assert.ok(plain >= 500, `plain spinner scored ${plain}`);
  assert.ok(Math.abs(frenzy - plain * 5) <= 500, `frenzy ${frenzy} vs plain ${plain}`);
});

test('Spin Frenzy starts after four ramps and ends after 20 seconds', () => {
  const g = newGame();
  for (let i = 0; i < 4; i++) g.rules.fire('ramp', 'bigWheel');
  assert.ok(g.modes.frenzy, 'mode running');
  g.world.balls[0].held = true;
  run(g, 21);
  assert.ok(!g.modes.frenzy, 'mode over');
  assert.ok(seen(g).includes('modeEnd:frenzy'));
});

test('combo: wire then ramp within five seconds scores the combo', () => {
  const g = newGame();
  g.rules.fire('ramp', 'coaster');
  const before = g.player.score;
  g.rules.fire('ramp', 'bigWheel');
  assert.ok(g.player.score - before >= 10000);
});

test('drain pays bonus times the multiplier; an extra ball shoots again on the same ball', () => {
  const g = newGame();
  g.player.bonus = 3000; g.player.bonusX = 3; g.player.extra = 1;
  g.timeLeftSave = 0;
  const before = g.player.score;
  g.world.balls[0].y = 700; run(g, 0.1);
  const ev = g.events.slice();
  assert.ok(ev.some(e => e.type === 'bonus' && e.total === 9000));
  assert.equal(g.player.score - before, 9000);
  assert.ok(ev.some(e => e.type === 'shootAgain'));
  assert.equal(g.player.ball, 1);
});

test('ten minutes of bot play on the parts table: no ball escapes or gets stuck', () => {
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...parts, balls: 100000 }); g.start(1);
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
