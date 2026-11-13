// The Star Siege table: the mothership and its shields, the tractor beam and black hole, Hangar locks and
// Fleet Launch multiball, hyperspace jumps, and the Dogfight played on the dot matrix with the flipper buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import starsiege, { DOGFIGHT_SECS, MOTHER_HITS, shipLane, status } from '../tables/starsiege/config.js';
import { LANE_Y, SHIP_X } from '../tables/starsiege/scenes.js';

const newGame = (over = {}) => { const g = new Game({ ...starsiege, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const sink = (g, id) => { const b = ball(g); g.sensor(b, shape(g, id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 0.02); g.flip(side, false); };
const hitMother = g => g.hit(ball(g), g.moving.find(s => s.id === 'mother'), 300);

test('the mothership patrols across the top', () => {
  const g = newGame();
  const xs = [];
  run(g, 7, g => { const [a, b] = g.targetAt('mother'); xs.push((a[0] + b[0]) / 2); });
  assert.ok(Math.max(...xs) - Math.min(...xs) > 50, `moved ${Math.min(...xs)}..${Math.max(...xs)}`);
});

test('the shields protect the mothership; with them down, five hits destroy it and light the Dogfight', () => {
  const g = newGame();
  hitMother(g);
  assert.match(messages(g).join('|'), /SHIELDS HOLDING/);
  for (let i = 0; i < 3; i++) g.hit(ball(g), shape(g, `shields:${i}`), 300);
  assert.equal(g.lamps.shieldsDown, 2);
  assert.match(status(g), /MOTHERSHIP 0\/5/);
  for (let i = 0; i < MOTHER_HITS; i++) hitMother(g);
  assert.match(messages(g).join('|'), /MOTHERSHIP DESTROYED/);
  assert.equal(g.lamps.dogfight, 2);
  assert.equal(g.lamps.shieldsDown, 0);
  run(g, 0.1);
  assert.ok(!shape(g, 'shields:0').disabled, 'the shields come back up');
});

test('the tractor beam catches the ball and throws it at the mothership', () => {
  const g = newGame();
  g.rules.act([['magnet', 'beam', 30], ['dropBank', 'shields']]);
  Object.assign(ball(g), { x: 150, y: 190, vx: 60, vy: 100, live: true });
  const seen = [];
  run(g, 9, g => { for (const e of g.events) if (e.type === 'magnet' || (e.type === 'hit' && e.id === 'mother')) seen.push(e.type); g.events.length = 0; });
  assert.deepEqual(seen, ['magnet', 'hit']);
});

test('the black hole swirls a ball round; ten trips start Event Horizon', () => {
  const g = newGame();
  const b = ball(g); Object.assign(b, { x: 86, y: 196, vx: 0, vy: 150, live: true }); g.world.gravity = 0;
  run(g, 0.2);
  assert.ok(Math.abs(b.vx) > 20, `bent sideways: vx ${b.vx}`);
  for (let i = 0; i < 9; i++) g.trigger('field', 'hole', 500);
  assert.ok(g.modes.horizon);
  const before = g.player.score;
  g.trigger('field', 'hole', 500);
  assert.equal(g.player.score - before, 10000);
});

test('A-C-E lights a lock; two fighters docked light Fleet Launch, a 3-ball multiball', () => {
  const g = newGame();
  for (let n = 0; n < 2; n++) {
    for (const id of ['laneA', 'laneC', 'laneE']) g.trigger('lane', id, 50);
    assert.equal(g.lamps.lock, 2);
    sink(g, 'hangar'); run(g, 2);
  }
  assert.equal(g.lamps.launch, 2);
  sink(g, 'hangar'); run(g, 0.1);
  assert.match(messages(g).join('|'), /FLEET LAUNCH/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  const before = g.player.score;
  g.trigger('ramp', 'hyper', 0);
  assert.ok(g.player.score - before >= 50000);
});

test('hyperspace jumps visit four places; every third turns the tractor beam on, the fourth lights an extra ball', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) g.trigger('ramp', 'hyper', 0);
  assert.ok(g.fieldOn.beam > g.world.time);
  g.trigger('ramp', 'hyper', 0);
  assert.match(messages(g).join('|'), /GALAXY TOUR/);
  assert.equal(g.lamps.xball, 2);
});

test('the Dogfight: the buttons fly the ship between lanes, its guns shoot aliens, asteroids hurt', () => {
  const g = newGame();
  g.lamps.dogfight = 2; sink(g, 'hangar'); run(g, 0.1);
  const df = g.video.df;
  assert.ok(df && ball(g).held);
  df.nextFoe = Infinity;                    // (no aliens but the ones placed here)
  run(g, 1.5);
  press(g, 'left'); run(g, 0.3);
  assert.equal(shipLane(df), 0);
  press(g, 'right'); press(g, 'right'); run(g, 0.4);
  assert.equal(shipLane(df), 2);
  // an alien in our lane gets shot down
  df.foes.push({ x: 60, lane: 2, kind: 'alien', speed: 0 });
  run(g, 0.8);
  assert.equal(df.kills, 1);
  // an asteroid soaks up the shots and hits the ship
  df.foes.push({ x: SHIP_X + 30, lane: 2, kind: 'rock', speed: 60 });
  run(g, 0.8);
  assert.equal(df.shields, 2);
  assert.ok(LANE_Y.length === 3);
});

test('the Dogfight ends after its time, gives the ball back, and pays for a clean run', () => {
  const g = newGame();
  g.lamps.dogfight = 2; sink(g, 'hangar'); run(g, 0.1);
  const df = g.video.df;
  const step = () => { df.foes.length = 0; };   // (an empty sky: nothing can hit the ship)
  run(g, DOGFIGHT_SECS + 2, step);
  assert.ok(df.over);
  assert.match(messages(g).join('|'), /NO DAMAGE 50,000/);
  run(g, 2);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held, 'the Hangar lets the ball go');
});

test('losing all three shields ends the Dogfight early', () => {
  const g = newGame();
  g.lamps.dogfight = 2; sink(g, 'hangar'); run(g, 1.6);
  const df = g.video.df;
  for (let i = 0; i < 3; i++) { df.foes.push({ x: SHIP_X + 8, lane: shipLane(df), kind: 'rock', speed: 0 }); run(g, 0.1); }
  assert.ok(df.over);
  assert.match(messages(g).join('|'), /SHIELDS GONE/);
});

test('twenty-five spins on the Warp orbit give the kickback and a ball save', () => {
  const g = newGame();
  g.lamps.kbL = 0;
  for (let i = 0; i < 25; i++) g.trigger('spin', 'warp', 100);
  assert.equal(g.lamps.kbL, 1);
  assert.ok(g.timeLeftSave > 10);
});

test('ten minutes of bot play on Star Siege, with the tractor beam on now and then: no ball escapes or gets stuck', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...starsiege, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    if (i % 1800 === 0) g.rules.act([['magnet', 'beam', 10]]);
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
  const { default: music } = await import('../tables/starsiege/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and the Dogfight draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawDogfight } = await import('../tables/starsiege/scenes.js');
  for (const sc of Object.values(starsiege.scenes)) {
    const d = createDmd(starsiege.dmd); d.show(['MOTHERSHIP DESTROYED', '100,000'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(starsiege.dmd);
  const df = { lane: 1, ship: 16, shots: [{ x: 40, lane: 1 }], foes: [{ x: 100, lane: 0, kind: 'alien' }, { x: 120, lane: 2, kind: 'rock' }],
    booms: [{ x: 50, y: 10, at: 0 }], kills: 3, shields: 2, start: 0.5, secs: 25, hitAt: 0.2, over: false };
  for (let t = 0; t < 2; t += 0.05) d.frame(t, () => ({ video: api => drawDogfight(api, df, t) }));
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: 'MOTHERSHIP 2/5' }));
});
