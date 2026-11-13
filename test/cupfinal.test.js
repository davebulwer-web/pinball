// The Cup Final table: the goalkeeper, goals, matches through the cup, the two dot-matrix games played with
// the flipper buttons (penalties and keepy-uppy), and Cup Final multiball.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import cupfinal, { matchStatus, bounce, MATCH_SECS } from '../tables/cupfinal/config.js';

const newGame = (over = {}) => { const g = new Game({ ...cupfinal, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const sink = (g, id) => { const b = ball(g); g.sensor(b, g.world.shapes.find(s => s.id === id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 0.02); g.flip(side, false); };
// keep the ball still on the plunger (so a long match isn't cut short by a drain)
const park = g => { g.saucerBalls.clear(); const b = ball(g); Object.assign(b, { held: false, hidden: false, x: 303, y: 592, vx: 0, vy: 0 }); };
const goal = g => { park(g); sink(g, 'goal'); run(g, 0.05); };

test('the keeper moves across to block a ball coming at the goal', () => {
  const g = newGame();
  run(g, 1);
  const b = ball(g); Object.assign(b, { x: 140, y: 320, vx: 0, vy: -100 }); g.world.gravity = 0;
  run(g, 1.5);
  const [a, c] = g.targetAt('keeper');
  assert.ok(Math.abs((a[0] + c[0]) / 2 - 140) < 4, `keeper at ${(a[0] + c[0]) / 2}`);
});

test('a fast shot past the keeper goes in: the ball comes back out of the subway above the flippers', () => {
  const g = newGame();
  run(g, 1);
  g.moving[0].disabled = true;   // (the keeper out of the way)
  const b = ball(g);
  Object.assign(b, { x: 180, y: 330, vx: 0, vy: -800 });
  let scored = false; run(g, 1, () => { scored ||= g.events.some(e => e.type === 'saucer' && e.id === 'goal'); });
  assert.ok(scored);
  run(g, 2);
  assert.ok(!b.held && b.y > 400, `ball at ${b.x},${b.y}`);
});

test('C-U-P lights a kick-off; a match is won by outscoring the rival before full time', () => {
  const g = newGame();
  for (const id of ['laneC', 'laneU', 'laneP']) g.trigger('lane', id, 50);
  assert.equal(g.lamps.kickoff, 2);
  sink(g, 'tunnel'); run(g, 0.1);
  assert.ok(g.match && g.modes.match);
  park(g);
  g.match.theirs = [5];                    // they will score once
  assert.match(matchStatus(g), /^HOME 0-0 ROVERS \d+'$/);
  goal(g); goal(g); park(g);
  run(g, 6);
  assert.equal(g.match.them, 1);
  assert.match(matchStatus(g), /HOME 2-1/);
  run(g, MATCH_SECS);
  assert.equal(g.match, null);
  assert.equal(g.player.counts.round, 1);
  assert.match(messages(g).join('|'), /ROUND ONE WON/);
});

test('a drawn match goes to penalties; three of five wins it', () => {
  const g = newGame();
  g.lamps.kickoff = 2; sink(g, 'tunnel'); run(g, 0.1);
  park(g);
  g.match.theirs = [];
  run(g, MATCH_SECS + 1);
  assert.equal(g.lamps.penalty, 2);
  run(g, 2);
  sink(g, 'tunnel'); run(g, 0.1);
  const pen = g.video.pen;
  assert.ok(pen.decider);
  for (let k = 0; k < 5; k++) {
    run(g, 1.6);
    pen.dive = null; press(g, 'left');
    run(g, 0.2);
    pen.dive = 'right';                     // (the keeper guesses wrong every time)
    run(g, 2);
  }
  run(g, 4);
  assert.equal(pen.goals, 5);
  assert.equal(g.player.counts.round, 1);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held, 'the Tunnel lets the ball go');
});

test('penalties: left aims left, right aims right, both together aim down the middle', () => {
  const g = newGame();
  g.lamps.penalty = 2; sink(g, 'tunnel'); run(g, 1.6);
  const pen = g.video.pen;
  press(g, 'right'); run(g, 0.2);
  assert.equal(pen.aim, 'right');
  run(g, 2);
  g.flip('left', true); run(g, 0.05); g.flip('right', true); run(g, 0.2); g.flip('left', false); g.flip('right', false);
  assert.equal(pen.aim, 'centre');
});

test('keepy-uppy counts taps made as the ball lands, and ends on a mistimed one', () => {
  const g = newGame();
  g.lamps.keepy = 2; sink(g, 'tunnel'); run(g, 0.1);
  const k = g.video.kick;
  for (let i = 0; i < 4; i++) {
    while (bounce(k, g.world.time) < 0.9) run(g, 1 / 120);
    press(g, 'left');
  }
  assert.equal(k.n, 4);
  run(g, 0.05); press(g, 'right');          // just after a touch: far too early
  assert.ok(k.over);
  assert.match(messages(g).join('|'), /4 KEEPY UPPIES 10,000/);
  run(g, 3);
  assert.equal(g.video, null);
});

test('twenty spins light keepy-uppy; the Wall lights penalties', () => {
  const g = newGame();
  for (let i = 0; i < 20; i++) g.trigger('spin', 'spinner', 100);
  assert.equal(g.lamps.keepy, 2);
  for (let i = 0; i < 3; i++) g.hit(ball(g), g.world.shapes.find(s => s.id === `wall:${i}`), 300);
  assert.equal(g.lamps.penalty, 2);
});

test('winning the final starts Cup Final multiball, where goals are jackpots', () => {
  const g = newGame();
  g.player.counts.round = 3;
  g.lamps.kickoff = 2; sink(g, 'tunnel'); run(g, 0.1);
  park(g);
  g.match.theirs = [];
  goal(g); park(g);
  run(g, MATCH_SECS + 1);
  assert.match(messages(g).join('|'), /CUP WINNERS/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  const before = g.player.score;
  goal(g);
  assert.ok(g.player.score - before >= 50000);
});

test('a header (the Cross, then a goal) scores double', () => {
  const g = newGame();
  g.trigger('ramp', 'cross', 0);
  const before = g.player.score;
  goal(g);
  assert.equal(g.player.score - before, 20000 + 1000);
  assert.match(messages(g).join('|'), /HEADER/);
});

test('ten minutes of bot play on Cup Final: no ball escapes or gets stuck', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...cupfinal, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
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
    for (const e of g.events) if (e.type === 'lost') lost++;
    g.events.length = 0;
  }
  assert.equal(lost, 0);
  assert.deepEqual(stuck, []);
});

test('the theme tune is sixteen bars of 4/4 in every part', async () => {
  const { default: music } = await import('../tables/cupfinal/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and both games draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawPenalties, drawKeepy } = await import('../tables/cupfinal/scenes.js');
  for (const sc of Object.values(cupfinal.scenes)) {
    const d = createDmd(cupfinal.dmd); d.show(['GOAL', 'HOME 1 - 0 CITY'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(cupfinal.dmd);
  const pen = { kick: 2, goals: 1, results: [true, false], phase: 'shot', aim: 'left', dive: 'right', at: 0 };
  for (let t = 0; t < 2; t += 0.05) d.frame(t, () => ({ video: api => drawPenalties(api, pen, t) }));
  const k = { n: 3, from: 0, period: 1, over: false };
  for (let t = 0; t < 2; t += 0.05) d.frame(t, () => ({ video: api => drawKeepy(api, k, t) }));
  // the status line under the score
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: "HOME 1-0 CITY 45'" }));
});
