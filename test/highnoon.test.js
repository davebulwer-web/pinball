// The High Noon table: its new parts (pistol flippers that fire in the Quick Draw, a moving target, a captive
// ball, the tall dot matrix) and its rules (Jailbreak, the Bank, the Stagecoach).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import highnoon, { spotAt } from '../tables/highnoon/config.js';

const newGame = (over = {}) => { const g = new Game({ ...highnoon, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls.find(b => !b.captive);
const captive = g => g.world.balls.find(b => b.captive);
const sink = (g, id) => { const b = ball(g); g.sensor(b, g.world.shapes.find(s => s.id === id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 0.05); g.flip(side, false); run(g, 0.05); };

test('the captive ball stays in the Bank and is not a ball in play', () => {
  const g = newGame();
  assert.equal(g.world.balls.length, 2);
  assert.equal(g.liveBalls(), 1);
  run(g, 3);
  const c = captive(g);
  assert.ok(Math.abs(c.x - 160) < 2 && c.y > 240 && c.y < 252, `captive at ${c.x},${c.y}`);
  // a new game puts it back
  g.start(1); assert.equal(g.world.balls.filter(b => b.captive).length, 1);
});

test('a ball shot up the middle knocks the captive ball into the vault', () => {
  const g = newGame();
  g.moving[0].disabled = true;   // (the Stagecoach out of the way)
  run(g, 1);
  const b = ball(g); Object.assign(b, { x: 160, y: 330, vx: 0, vy: -650 });
  let vault = false; run(g, 1.5, () => { vault ||= g.events.some(e => e.type === 'hit' && e.id === 'vault'); });
  assert.ok(vault);
  assert.ok(b.y > 252, 'the ball in play stays out of the channel');
  run(g, 2);
  assert.ok(captive(g).y > 240, 'the captive ball drops back');
});

test('the Stagecoach rolls to and fro, and a ball bounces off it', () => {
  const g = newGame();
  const xs = []; run(g, 6, () => xs.push(g.targetAt('coach')[0][0]));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 70);
  const [a, c] = g.targetAt('coach');
  const b = ball(g); Object.assign(b, { x: (a[0] + c[0]) / 2, y: 340, vx: 0, vy: -500 });
  let hit = false; run(g, 0.3, () => { hit ||= g.events.some(e => e.type === 'hit' && e.id === 'coach'); });
  assert.ok(hit && b.vy > 0);
});

test('three hold-ups light the kickback and then the Jail', () => {
  const g = newGame();
  for (let i = 0; i < 2; i++) g.trigger('hit', 'coach', 500);
  assert.equal(g.lamps.kbL, 1);
  g.trigger('hit', 'coach', 500);
  assert.ok(g.lamps.lock);
});

test('the WANTED posters light the Quick Draw: the pistols shoot the outlaws, then the ball is let go', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) g.hit(ball(g), g.world.shapes.find(s => s.id === `wanted:${i}`), 300);
  assert.equal(g.lamps.duel, 2);
  const b = sink(g, 'saloon');
  assert.ok(g.duel && g.lookAt > 500 && b.held);
  // put an outlaw on each line, and a townsperson behind the left one
  const t = g.world.time;
  g.duel.figs.push({ side: 'left', k: 0, kind: 'outlaw', up: t, down: t + 9 }, { side: 'right', k: 1, kind: 'outlaw', up: t, down: t + 9 }, { side: 'left', k: 2, kind: 'folk', up: t, down: t + 9 });
  run(g, 0.3);
  const before = g.player.score;
  press(g, 'left'); press(g, 'right');
  assert.equal(g.duel.outlaws, 2);
  assert.equal(g.player.score - before, 15000 + 20000);
  assert.ok(g.duel.figs.find(f => f.kind === 'folk').hit === undefined, 'the first figure on a line takes the bullet');
  press(g, 'left');    // now the townsperson is first on the left line
  assert.equal(g.duel.misses, 1);
  assert.match(messages(g).join('|'), /DON'T SHOOT/);
  for (let i = 0; i < 3; i++) press(g, 'right');
  assert.equal(g.duel.bullets, 0);
  run(g, 3);
  assert.equal(g.duel, null); assert.equal(g.lookAt, null);
  assert.ok(!b.held, 'the Saloon lets the ball go');
  assert.equal(g.lamps.duel, 0);
});

test('the figures stand on the lines of fire, inside the table', () => {
  const g = newGame();
  for (const side of ['left', 'right']) for (let k = 0; k < 3; k++) {
    const [x, y] = spotAt(g, side, k);
    assert.ok(x > 20 && x < 290 && y > 440 && y < 560, `${side} ${k} at ${x},${y}`);
  }
});

test('two outlaws locked in the Jail, and the third shot there starts Jailbreak; jackpots on the Railroad', () => {
  const g = newGame();
  g.lamps.lock = 1;
  sink(g, 'jail'); run(g, 2);
  assert.equal(g.player.locks, 1);
  g.lamps.lock = 1; sink(g, 'jail'); run(g, 2);
  assert.equal(g.player.locks, 2); assert.equal(g.lamps.lock, 2);
  sink(g, 'jail'); run(g, 0.1);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  assert.match(messages(g).join('|'), /JAILBREAK/);
  assert.equal(g.lamps.jackpot, 2);
  g.trigger('bumper', 'barrel1', 100); g.trigger('bumper', 'barrel1', 100);
  const before = g.player.score;
  g.trigger('ramp', 'railroad', 0);
  assert.ok(g.player.score - before >= 60000);
  assert.equal(g.lamps.jackpot, 0);
  g.trigger('hit', 'vault', 0);
  assert.equal(g.lamps.jackpot, 2, 'the Bank relights it');
});

test('three knocks on the vault crack the safe: Gold Rush and an extra ball', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) g.trigger('hit', 'vault', 1000);
  assert.ok(g.modes.goldRush);
  assert.equal(g.lamps.xball, 2);
  assert.equal(g.rules.multiplier('spin', 'spinner'), 10);
});

test('ten minutes of bot play on High Noon: no ball escapes or gets stuck', () => {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...highnoon, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    for (const b of g.world.balls) if (!b.captive && b.layer === 0 && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
    if (i - hold > 12) { g.flip('left', false); g.flip('right', false); }
    if (g.state === 'ready' && g.ballInLane()) { g.pull(0.5 + rnd() * 0.5); for (let k = 0; k < 20; k++) g.update(1 / 60); g.launch(); }
    g.update(1 / 60);
    for (const b of g.world.balls) {
      if (b.held || b.captive || (b.x > 294 && b.y > 400)) { still.delete(b); continue; }
      if (Math.hypot(b.vx, b.vy) < 15) { const n = (still.get(b) ?? 0) + 1; still.set(b, n); if (n === 180) { stuck.push(`${b.x.toFixed(0)},${b.y.toFixed(0)} layer ${b.layer}`); b.vy = -300; } }
      else still.delete(b);
    }
    for (const e of g.events) if (e.type === 'lost') lost++;
    g.events.length = 0;
  }
  assert.equal(lost, 0);
  assert.deepEqual(stuck, []);
  const c = captive(g); assert.ok(c.x > 153 && c.x < 167 && c.y > 200 && c.y < 254, 'the captive ball never leaves the Bank');
});

test('the theme tune is sixteen bars of 4/4 in every part', async () => {
  const { default: music } = await import('../tables/highnoon/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the tall dot matrix: 32 rows, big letters, and every scene draws without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const d = createDmd(highnoon.dmd);
  assert.equal(d.H, 32); assert.equal(d.rows, 64);
  for (const sc of Object.values(highnoon.scenes)) {
    const m = createDmd(highnoon.dmd); m.show(['JAILBREAK', 'MULTIBALL'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) m.frame(t, () => ({}));
  }
  // a short table keeps the 16-row display
  assert.equal(createDmd().H, 16);
});
