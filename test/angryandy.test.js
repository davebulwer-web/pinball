// The Angry Andy table: Andy pacing about (and getting angrier), IT missions from the Help Desk, the Server Room,
// Meltdown multiball, and the Desk Pranks reaction game played on the dot matrix with the flipper buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import andy, { MISSIONS, MISSION_SECS, PRANK_SECS, anger, status } from '../tables/angryandy/config.js';

const newGame = (over = {}) => { const g = new Game({ ...andy, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const ball = g => g.world.balls[0];
const shape = (g, id) => g.world.shapes.find(s => s.id === id);
const park = g => { g.saucerBalls.clear(); Object.assign(ball(g), { held: false, hidden: false, x: 303, y: 592, vx: 0, vy: 0 }); };
const sink = (g, id) => { park(g); const b = ball(g); g.sensor(b, shape(g, id)); run(g, 0.05); return b; };
const hitAndy = g => g.hit(ball(g), g.moving.find(s => s.id === 'andy'), 300);
// Desk Pranks picks sides and faces at random: seed it so the tests always see the same game
const seeded = (fn, seed = 3) => { const r = Math.random; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); try { fn(); } finally { Math.random = r; } };
const ticket = g => { g.lamps.ticket = 2; sink(g, 'helpdesk'); return g.mission; };

test('Andy paces about in front of his Server Room', () => {
  const g = newGame();
  const xs = [];
  run(g, 6, g => { const [a, b] = g.targetAt('andy'); xs.push((a[0] + b[0]) / 2); });
  assert.ok(Math.max(...xs) - Math.min(...xs) > 20);
});

test('pinging Andy and breaking into the Server Room wind him up', () => {
  const g = newGame();
  hitAndy(g);
  assert.equal(anger(g), 3);
  assert.ok(messages(g).some(m => m.startsWith('PING')));
  sink(g, 'servers');
  assert.equal(anger(g), 8);
  assert.match(messages(g).join('|'), /UNAUTHORISED ACCESS/);
  assert.match(status(g), /ANDY'S ANGER 8%/);
});

test('C-A-D lights a ticket; the Help Desk raises it as a mission, and finishing it makes Andy angrier', () => {
  const g = newGame();
  for (const id of ['laneC', 'laneA', 'laneD']) g.trigger('lane', id, 50);
  assert.equal(g.lamps.ticket, 2);
  sink(g, 'helpdesk');
  const m = g.mission;
  assert.equal(m.def.id, MISSIONS[0].id);
  assert.match(status(g), /PRINTER JAMMED 0\/3/);
  for (let i = 0; i < 3; i++) g.trigger('drop', `paper:${i}`, 100);
  assert.equal(g.mission, null);
  assert.equal(g.player.counts.done_printer, 1);
  assert.equal(anger(g), 20);
  assert.match(messages(g).join('|'), /ANDY IS NOT IMPRESSED/);
});

test('every mission can be done, and all six make you Worst User of the Year', () => {
  const g = newGame();
  const doIt = {
    printer: g => g.trigger('drop', 'paper:0', 100),
    password: g => g.trigger('spin', 'reset', 100),
    replyall: g => g.trigger('ramp', 'email', 0),
    bluescreen: g => g.trigger('bumper', 'mon1', 100),
    unplug: g => { g.saucerBalls.clear(); sink(g, 'servers'); },
    quicklook: g => hitAndy(g),
  };
  for (let n = 0; n < MISSIONS.length; n++) {
    g.player.counts.anger = 0;
    const m = ticket(g);
    assert.ok(m, `ticket ${n}`);
    for (let i = 0; i < m.def.need && g.mission; i++) doIt[m.def.id](g);
    assert.equal(g.mission, null, m.def.id);
  }
  assert.match(messages(g).join('|'), /WORST USER OF THE YEAR/);
  assert.equal(g.lamps.xball, 2);
});

test('a ticket left too long is closed with no fault found', () => {
  const g = newGame();
  ticket(g);
  park(g);
  run(g, MISSION_SECS + 1, park);
  assert.equal(g.mission, null);
  assert.match(messages(g).join('|'), /TICKET CLOSED/);
});

test('at 100% Andy has a meltdown: three balls, and Andy and the Server Room are jackpots', () => {
  const g = newGame();
  g.player.counts.anger = 97;
  hitAndy(g);
  assert.match(messages(g).join('|'), /MELTDOWN/);
  assert.equal(g.liveBalls() + g.launchQueue, 3);
  assert.equal(anger(g), 0);
  assert.equal(status(g), null);
  let before = g.player.score;
  hitAndy(g);
  assert.ok(g.player.score - before >= 25000);
  for (let i = 0; i < 3; i++) { before = g.player.score; sink(g, 'servers'); assert.ok(g.player.score - before >= 50000); }
  assert.equal(g.lamps.superJp, 2);
  before = g.player.score;
  sink(g, 'helpdesk');
  assert.ok(g.player.score - before >= 250000);
});

test('Desk Pranks: ping Andy, not the boss; three strikes and you are caught', () => seeded(() => {
  const g = newGame();
  g.trigger('bankDown', 'paper', 0);
  assert.equal(g.lamps.pranks, 2);
  sink(g, 'helpdesk');
  const dp = g.video.dp;
  let tried = new Set();
  run(g, PRANK_SECS + 2, g => {
    for (const p of dp.pops) if (!p.res && !tried.has(p) && g.world.time >= p.at + 0.05) { tried.add(p); g.flip(p.side, true); g.flip(p.side, false); }
  });
  assert.ok(dp.over);
  assert.ok(dp.hits > 5, `hits ${dp.hits}`);
  assert.equal(dp.strikes >= 3, /CAUGHT BY THE BOSS/.test(messages(g).join('|')));
  run(g, 4);
  assert.equal(g.video, null);
  assert.ok(!ball(g).held);
}));

test('Desk Pranks pays 50,000 for ten pings with no strikes', () => seeded(() => {
  const g = newGame();
  g.lamps.pranks = 2; sink(g, 'helpdesk');
  const dp = g.video.dp;
  run(g, PRANK_SECS + 2, g => {
    for (const p of dp.pops) if (!p.res && p.who === 'andy' && g.world.time >= p.at + 0.05) { g.flip(p.side, true); g.flip(p.side, false); }
  });
  assert.equal(dp.strikes, 0);
  assert.ok(dp.hits >= 10, `hits ${dp.hits}`);
  assert.match(messages(g).join('|'), /NEVER CAUGHT/);
}));

test('twenty-five password resets restore the backup: kickback and ball save', () => {
  const g = newGame();
  g.lamps.kbL = 0;
  for (let i = 0; i < 25; i++) g.trigger('spin', 'reset', 100);
  assert.equal(g.lamps.kbL, 1);
  assert.ok(g.timeLeftSave > 10);
});

test('ten minutes of bot play on Angry Andy: no ball escapes or gets stuck', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...andy, balls: 100000 }); g.start(1);
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
  const { default: music } = await import('../tables/angryandy/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 64);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes and Desk Pranks draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  const { drawPranks } = await import('../tables/angryandy/scenes.js');
  for (const sc of Object.values(andy.scenes)) {
    const d = createDmd(andy.dmd); d.show(['CAN YOU JUST HAVE A QUICK LOOK', 'HIT ANDY 4 TIMES'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
  const d = createDmd(andy.dmd);
  const dp = { pops: [{ side: 'left', who: 'andy', at: 1, until: 2, res: 'hit', resAt: 1.5 }, { side: 'right', who: 'boss', at: 1.2, until: 2.2 }], start: 0.8, secs: 20, hits: 1, strikes: 1, over: false };
  for (let t = 0; t < 3; t += 0.05) d.frame(t, () => ({ video: api => drawPranks(api, dp, t) }));
  d.frame(0, () => ({ player: 1, ball: 1, score: 12345, status: "ANDY'S ANGER 40%" }));
});
