// The Grand Slam table: its shots, hits moving runners round the bases, outs and innings against the Visitors,
// the World Series multiball, the two dot-matrix games (the Home Run Derby and the Diving Catch) and long bot games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import grandslam, { status, hit, out, strike, INNINGS, STRIKE_GAP, PITCHES, FLY_BALLS, RUN_SCORE, runnerAt, BASES } from '../tables/grandslam/config.js';

const newGame = (over = {}) => { const g = new Game({ ...grandslam, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); each?.(g); } };
const up = g => { Object.assign(ball(g), { x: 280, y: 240, vx: 0, vy: -500 }); };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const sink = (g, id) => { const b = ball(g); g.sensor(b, shape(g, id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 1 / 60); g.flip(side, false); };
const park = g => { g.saucerBalls.clear(); Object.assign(ball(g), { held: false, hidden: false, x: 303, y: 592, vx: 0, vy: 0 }); };
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

test('the game starts in the first inning, with nobody on and no outs', () => {
  const g = newGame();
  assert.equal(status(g), 'INN 1 OUT 0 STR 0  0-0');
  assert.deepEqual(g.player.bases, [false, false, false]);
  assert.equal(g.lamps.inn1, 2);
});

test('both flippers make the Upper Deck ramp; the right one finds the Bullpen; the left one the right orbit', () => {
  const ramp = e => e.type === 'ramp' && e.id === 'deck';
  assert.ok(sweep('flipL', ramp) >= 15);
  assert.ok(sweep('flipR', ramp) >= 10);
  assert.ok(sweep('flipR', e => e.type === 'saucer' && e.id === 'bullpen') >= 4);
  assert.ok(sweep('flipL', e => e.type === 'lane' && e.id === 'orbit') >= 15);
  assert.ok(sweep('flipR', e => e.type === 'spin') >= 15);
});

test('a soft plunge finds the H-I-T lanes, bounced back off the top gate', () => {
  const lanes = new Set();
  let plunges = 0, hits = 0;
  for (let p = 0.6; p <= 1.0001; p += 0.02) {
    const g = newGame(); g.state = 'ready'; g.pull(p); run(g, 20 / 60); g.launch(); g.events.length = 0;
    let found = false;
    run(g, 4, () => { for (const e of g.events) if (e.type === 'lane' && e.id !== 'orbit') { lanes.add(e.id); found = true; } g.events.length = 0; });
    plunges++; if (found) hits++;
    if (!found) assert.equal(g.player.counts.runs + g.player.bases.filter(Boolean).length, 0, 'a plunge back down the orbit is no hit');
  }
  assert.ok(lanes.size >= 2 && hits >= plunges / 2, `${hits} of ${plunges}: ${[...lanes].join()}`);
});

test('hits move the runners: a single, a double and a triple score the runners ahead', () => {
  const g = newGame();
  hit(g, 1);
  assert.deepEqual(g.player.bases, [true, false, false]);
  hit(g, 2);
  assert.deepEqual(g.player.bases, [false, true, true]);
  assert.equal(g.player.counts.runs, 0);
  const before = g.player.score;
  hit(g, 3);
  assert.deepEqual(g.player.bases, [false, false, true]);
  assert.equal(g.player.counts.runs, 2);
  assert.ok(g.player.score - before >= 2 * RUN_SCORE);
  assert.match(messages(g).join('|'), /TRIPLE 2 RUNS SCORE/);
});

test('the shots are the hits: orbit single, Strike Zone double, Bullpen triple, ramp home run', () => {
  const g = newGame();
  g.trigger('lane', 'orbit', 0);
  assert.deepEqual(g.player.bases, [false, false, false], 'a ball coming down the orbit is no hit');
  up(g); g.trigger('lane', 'orbit', 0);
  assert.deepEqual(g.player.bases, [true, false, false]);
  for (let i = 0; i < 3; i++) g.hit(ball(g), shape(g, `zone:${i}`), 300);
  assert.deepEqual(g.player.bases, [false, true, true]);
  assert.equal(g.lamps.derby, 2);
  park(g); sink(g, 'bullpen'); run(g, 0.05);
  assert.deepEqual(g.player.bases, [false, false, true]);
  g.trigger('ramp', 'deck', 0);
  assert.deepEqual(g.player.bases, [false, false, false]);
  assert.equal(g.player.counts.runs, 4);
  assert.match(messages(g).join('|'), /HIT FOR THE CYCLE/);
  assert.equal(g.lamps.xball, 2);
});

test('a home run with the bases loaded is a grand slam', () => {
  const g = newGame();
  hit(g, 1); hit(g, 1); hit(g, 1);
  assert.deepEqual(g.player.bases, [true, true, true]);
  const before = g.player.score;
  hit(g, 4);
  assert.equal(g.player.counts.runs, 4);
  assert.match(messages(g).join('|'), /GRAND SLAM/);
  assert.ok(g.player.score - before >= 100000);
});

test('outs: the outfielder, a pop-up, and three strikes from the slingshots (a rattle between them is one); a hit starts a new batter', () => {
  const g = newGame();
  g.trigger('hit', 'fielder', 0);
  assert.equal(g.player.counts.outs, 1);
  g.trigger('rampFail', 'deck', 0);
  assert.equal(g.player.counts.outs, 2);
  assert.equal(g.lamps.out2, 1);
  g.trigger('sling', 'slingL', 0); g.trigger('sling', 'slingR', 0);
  assert.equal(g.player.counts.strikes, 1, 'a ball rattling between the slings is one strike');
  g.world.time += STRIKE_GAP; g.trigger('sling', 'slingR', 0);
  assert.equal(g.player.counts.strikes, 2);
  hit(g, 1);
  assert.equal(g.player.counts.strikes, 0);
  for (let i = 0; i < 3; i++) { g.world.time += STRIKE_GAP; g.trigger('sling', 'slingL', 0); }
  assert.equal(g.player.counts.outs, 0);
  assert.equal(g.player.counts.inning, 2);
  assert.deepEqual(g.player.bases, [false, false, false]);
  assert.match(messages(g).join('|'), /STRUCK OUT\s+SIDE RETIRED 1 LEFT ON BASE/);
});

test('win after nine innings for World Series multiball, where the ramp is a jackpot', () => {
  const g = newGame();
  Object.assign(g.player.counts, { inning: INNINGS, runs: 50, them: 0 });
  park(g);
  for (let i = 0; i < 3; i++) out(g, 'CAUGHT');
  run(g, 0.1);
  assert.match(messages(g).join('|'), /YOU WIN \d+-\d+.*WORLD SERIES MULTIBALL/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  assert.equal(g.lamps.pen1, 1);
  const before = g.player.score;
  g.trigger('ramp', 'deck', 0);
  assert.ok(g.player.score - before >= 50000);
  assert.equal(status(g), null);
});

test('losing after nine innings starts a new game; a tie goes to extra innings', () => {
  const g = newGame();
  Object.assign(g.player.counts, { inning: INNINGS, runs: 0, them: 50 });
  for (let i = 0; i < 3; i++) out(g, 'CAUGHT');
  assert.match(messages(g).join('|'), /VISITORS WIN/);
  assert.equal(g.player.counts.inning, 1);
  const g2 = newGame();
  Object.assign(g2.player.counts, { inning: INNINGS, runs: 3, them: 3 });
  const rnd = Math.random; Math.random = () => 0;   // the Visitors score nothing
  for (let i = 0; i < 3; i++) out(g2, 'CAUGHT');
  Math.random = rnd;
  assert.equal(g2.player.counts.inning, INNINGS + 1);
  assert.match(messages(g2).join('|'), /EXTRA INNINGS/);
});

test('the seventh inning stretch doubles the big shots', () => {
  const g = newGame();
  g.player.counts.inning = 6;
  for (let i = 0; i < 3; i++) out(g, 'CAUGHT');
  assert.ok(g.modes.stretch);
  assert.ok(g.lamps.stretch);
});

test('the Home Run Derby: a swing as the pitch reaches the plate is a home run', () => {
  const g = newGame();
  g.lamps.derby = 2; sink(g, 'dugout'); run(g, 0.1);
  const hd = g.video.hd;
  for (let k = 0; k < PITCHES; k++) {
    while (hd.phase !== 'pitch' || g.world.time < hd.at + hd.secs - 1 / 120) run(g, 1 / 60);
    press(g, 'left');
    assert.equal(hd.results[k], 'HOME RUN');
  }
  run(g, 2);
  assert.match(messages(g).join('|'), /FIVE FOR FIVE/);
  run(g, 3);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held, 'the Dugout lets the ball go');
});

test('the Home Run Derby: no swing is a strike', () => {
  const g = newGame();
  g.lamps.derby = 2; sink(g, 'dugout'); run(g, 0.1);
  run(g, 4);
  assert.equal(g.video.hd.results[0], 'STRIKE');
});

test('the Diving Catch: run under every fly ball for a Gold Glove', () => {
  const g = newGame();
  g.lamps.catch = 2; sink(g, 'dugout'); run(g, 0.1);
  const dc = g.video.dc;
  for (let k = 0; k < FLY_BALLS; k++) {
    while (dc.ball && dc.spot !== dc.ball.spot) press(g, dc.spot < dc.ball.spot ? 'right' : 'left');
    while (dc.n === k) run(g, 1 / 60);
  }
  assert.equal(dc.caught, FLY_BALLS);
  assert.match(messages(g).join('|'), /GOLD GLOVE/);
  run(g, 4);
  assert.equal(g.video, null);
});

test('twenty spins light the Diving Catch; H-I-T lights the kickback', () => {
  const g = newGame();
  for (let i = 0; i < 20; i++) g.trigger('spin', 'foulPole', 100);
  assert.equal(g.lamps.catch, 2);
  g.lamps.kbL = 0;
  for (const id of ['laneH', 'laneI', 'laneT']) g.trigger('lane', id, 0);
  assert.equal(g.lamps.kbL, 1);
});

test('runners run base to base along the diamond', () => {
  const r = { from: 0, to: 2, at: 0 };
  assert.deepEqual(runnerAt(r, 0).slice(0, 2), BASES[0]);
  assert.deepEqual(runnerAt(r, 10).slice(0, 2), BASES[2]);
  const [x, y] = runnerAt(r, 0.175);
  assert.ok(Math.abs(x - (BASES[0][0] + BASES[1][0]) / 2) < 1 && Math.abs(y - (BASES[0][1] + BASES[1][1]) / 2) < 1);
});

test('ten minutes of bot play on Grand Slam: no ball escapes or gets stuck, and the innings go by', () => {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...grandslam, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0, outs = 0; const still = new Map(), stuck = [];
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
    for (const e of g.events) { if (e.type === 'lost') lost++; if (e.type === 'message' && / OUT$|SIDE RETIRED/.test(e.text + ' ' + (e.sub ?? ''))) outs++; }
    g.events.length = 0;
  }
  assert.equal(lost, 0);
  assert.deepEqual(stuck, []);
  assert.ok(outs >= 20, `only ${outs} outs in ten minutes`);
});

test('the theme tune is sixteen bars of 4/4 in every part', async () => {
  const { default: music } = await import('../tables/grandslam/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and both games draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawDerby, drawCatch } = await import('../tables/grandslam/scenes.js');
  for (const sc of Object.values(grandslam.scenes)) {
    const d = createDmd(grandslam.dmd); d.show(['HOME RUN', '2 RUNS SCORE'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(grandslam.dmd);
  for (const [phase, result] of [['pitch', null], ['result', 'HOME RUN'], ['result', 'HIT'], ['result', 'FOUL'], ['result', 'STRIKE']]) {
    const hd = { pitch: 1, homers: 1, results: ['HOME RUN', 'FOUL'], phase, at: 0.5, secs: 1, swing: 1.4, result, resultAt: 0.2 };
    for (let t = 0; t < 2.5; t += 0.05) d.frame(t, () => ({ video: api => drawDerby(api, hd, t) }));
  }
  const dc = { spot: 1, n: 2, caught: 1, results: [true, false], phase: 'play', ball: { spot: 3, at: 0.3, secs: 1.5 }, last: { ok: true, at: 0 } };
  for (let t = 0; t < 2.5; t += 0.05) d.frame(t, () => ({ video: api => drawCatch(api, dc, t) }));
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: 'INN 3 OUT 1 STR 2  4-2' }));
});
