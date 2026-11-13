// The Fergus table: asking out at the Cafe, the Friend Zone, Plus One multiball, the Wingman assist, the Dance
// Floor rhythm game played on the dot matrix with the flipper buttons, and Fergus pacing about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import fergus, { PLUS_ONE, NOTES, REPLIES, status } from '../tables/fergus/config.js';

const newGame = (over = {}) => { const g = new Game({ ...fergus, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const sink = (g, id) => { const b = ball(g); g.sensor(b, shape(g, id)); return b; };
const press = (g, side) => { g.flip(side, true); run(g, 0.02); g.flip(side, false); };
const park = g => { g.saucerBalls.clear(); Object.assign(ball(g), { held: false, hidden: false, x: 303, y: 592, vx: 0, vy: 0 }); };
const zone = g => { park(g); sink(g, 'zone'); run(g, 0.05); };

test('Fergus paces about in front of the Friend Zone', () => {
  const g = newGame();
  const xs = [];
  run(g, 5, g => { const [a, b] = g.targetAt('fergus'); xs.push((a[0] + b[0]) / 2); });
  assert.ok(Math.max(...xs) - Math.min(...xs) > 40);
});

test('A-S-K lights asking out; she always says something friendly, and it lights the Friend Zone', () => {
  const g = newGame();
  for (const id of ['laneA', 'laneS', 'laneK']) g.trigger('lane', id, 50);
  assert.equal(g.lamps.ask, 2);
  park(g); sink(g, 'cafe'); run(g, 0.1);
  const said = messages(g);
  assert.ok(said.some(m => /FERGUS ASKS HER OUT/.test(m)));
  assert.ok(said.some(m => REPLIES.some(r => m.startsWith(r))));
  assert.equal(g.lamps.zone, 2);
  assert.match(status(g), /DATES 0$/);
});

test('the Friend Zone adds a friend when lit; five friends start Plus One multiball', () => {
  const g = newGame();
  for (let i = 0; i < PLUS_ONE; i++) { g.lamps.zone = 2; zone(g); }
  assert.equal(g.player.counts.totalFriends, PLUS_ONE);
  assert.match(messages(g).join('|'), /FRIEND ZONED/);
  assert.match(messages(g).join('|'), /PLUS ONE MULTIBALL/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  assert.match(status(g) ?? '', /^$/);
  const before = g.player.score;
  zone(g);
  assert.ok(g.player.score - before >= 50000);
});

test('unlit, the Friend Zone is still just friends', () => {
  const g = newGame();
  zone(g);
  assert.match(messages(g).join('|'), /STILL JUST FRIENDS/);
  assert.equal(g.player.counts.totalFriends ?? 0, 0);
});

test('the Wingman ramp, then the Friend Zone, scores double', () => {
  const g = newGame();
  g.lamps.zone = 2;
  g.trigger('ramp', 'wingman', 0);
  const before = g.player.score;
  zone(g);
  assert.equal(g.player.score - before, 100000 + 1000);
  assert.match(messages(g).join('|'), /WINGMAN FRIEND ZONE/);
});

test('the Dance Floor: matching presses score, wrong ones miss, and the Cafe lets the ball go after', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) g.hit(ball(g), shape(g, `glasses:${i}`), 300);
  assert.equal(g.lamps.dance, 2);
  sink(g, 'cafe'); run(g, 0.1);
  const dd = g.video.dd;
  dd.notes.forEach((n, i) => {
    while (g.world.time < n.t - 0.02) run(g, 1 / 120);
    press(g, i === 3 ? (n.side === 'left' ? 'right' : 'left') : n.side);   // (one wrong on purpose)
  });
  run(g, 0.5);
  assert.equal(dd.hits, NOTES - 1);
  assert.ok(dd.over);
  assert.match(messages(g).join('|'), new RegExp(`${NOTES - 1} OF ${NOTES} STEPS`));
  run(g, 3);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held);
});

test('a perfect dance pays 50,000', () => {
  const g = newGame();
  g.lamps.dance = 2; sink(g, 'cafe'); run(g, 0.1);
  const dd = g.video.dd;
  for (const n of dd.notes) { while (g.world.time < n.t - 0.02) run(g, 1 / 120); press(g, n.side); }
  run(g, 0.5);
  assert.match(messages(g).join('|'), /DANCE FLOOR LEGEND/);
});

test('twenty hair flicks light the kickback and a ball save', () => {
  const g = newGame();
  g.lamps.kbL = 0;
  for (let i = 0; i < 20; i++) g.trigger('spin', 'hair', 100);
  assert.equal(g.lamps.kbL, 1);
  assert.ok(g.timeLeftSave > 10);
});

test('ten minutes of bot play on Fergus: no ball escapes or gets stuck', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...fergus, balls: 100000 }); g.start(1);
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
  const { default: music } = await import('../tables/fergus/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and the Dance Floor draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawDance } = await import('../tables/fergus/scenes.js');
  for (const sc of Object.values(fergus.scenes)) {
    const d = createDmd(fergus.dmd); d.show(["LET'S JUST BE FRIENDS", 'SHOOT THE FRIEND ZONE'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(fergus.dmd);
  const dd = { notes: [{ t: 1, side: 'left', res: 'hit' }, { t: 1.5, side: 'right', res: 'miss' }, { t: 2, side: 'left' }], start: 0.8, hits: 1, streak: 2, best: 2, over: false };
  for (let t = 0; t < 3; t += 0.05) d.frame(t, () => ({ video: api => drawDance(api, dd, t) }));
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: 'FRIENDS 7  DATES 0' }));
});
