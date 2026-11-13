// The Race Day table: its shots, its new parts (upper flipper, subway scoop, diverter, up-post, race toy)
// and its rules (pick a horse, the race, the hurry-up, mystery, multiball with add-a-ball and super jackpot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import raceday from '../tables/raceday/config.js';

const newGame = (over = {}) => { const g = new Game({ ...raceday, ...over }); g.start(1); g.state = 'play'; return g; };
const run = (g, secs, each) => { for (let i = 0; i < secs * 60; i++) { g.update(1 / 60); each?.(g); } };
const messages = g => g.events.filter(e => e.type === 'message').map(e => e.text + (e.sub ? ' ' + e.sub : ''));
const shoot = (g, x, y, vx, vy) => { const b = g.world.balls[0]; Object.assign(b, { x, y, vx, vy }); return b; };
const stables = g => g.world.shapes.find(s => s.id === 'stables');
const sinkStables = g => { const b = g.world.balls[0]; g.sensor(b, stables(g)); return b; };
const flipShot = (g, id, ms) => {
  const f = g.flippers.find(x => x.id === id), b = g.world.balls[0];
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
    let hit = false; run(g, 3, () => { hit ||= g.events.some(want); });
    if (hit) n++;
  }
  return n;
};

test('the right flipper makes the Home Straight, and it drops onto the upper flipper', () => {
  assert.ok(sweep('flipR', e => e.type === 'ramp' && e.id === 'home') >= 25);
  const g = newGame(); const r = g.cfg.ramps[0], [a, c] = r.path;
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const b = shoot(g, a[0] - (c[0] - a[0]) / l * 20, a[1] - (c[1] - a[1]) / l * 20, (c[0] - a[0]) / l * 600, (c[1] - a[1]) / l * 600);
  let landed = null;
  run(g, 3, () => { if (!landed && g.events.some(e => e.type === 'ramp')) landed = [b.x, b.y]; });
  assert.ok(landed && landed[0] > 225 && landed[1] > 270 && landed[1] < 320, `landed at ${landed}`);
});

test('the left flipper reaches the Stables and the Fences; the right one the Starting Gate', () => {
  assert.ok(sweep('flipL', e => e.type === 'saucer' && e.id === 'stables') >= 10);
  assert.ok(sweep('flipL', e => e.type === 'drop') >= 10);
  assert.ok(sweep('flipR', e => e.type === 'spin') >= 15);
});

test('a soft plunge finds the B-E-T lanes, bounced back off the top gate', () => {
  const lanes = new Set();
  for (let p = 0.6; p <= 1.0001; p += 0.02) {
    const g = newGame(); g.state = 'ready'; g.pull(p); run(g, 20 / 60); g.launch(); g.events.length = 0;
    run(g, 4, () => { for (const e of g.events) if (e.type === 'lane' && e.id !== 'orbit') lanes.add(e.id); });
  }
  assert.ok(lanes.size >= 2, [...lanes].join());
});

test('a ball coming down the right orbit rolls onto the upper flipper, which can shoot it back up', () => {
  const g = newGame(); const b = shoot(g, 283, 220, 0, 250);
  let onBat = false;
  run(g, 0.6, () => { onBat ||= b.x < 268 && b.x > 235 && b.y > 295 && b.y < 335; });
  assert.ok(onBat);
  const g2 = newGame(); const b2 = shoot(g2, 283, 220, 0, 250);
  run(g2, 0.34); g2.flip('right', true); run(g2, 0.3);
  assert.ok(b2.vy < 0 || b2.y < 290, `ball at ${b2.x.toFixed(0)},${b2.y.toFixed(0)} going ${b2.vy.toFixed(0)}`);
});

test('the Stables subway takes the ball away and kicks it out above the flippers', () => {
  const g = newGame(); const b = sinkStables(g);
  assert.ok(b.hidden && b.held);
  for (let i = 0; i < 90 && b.held; i++) g.update(1 / 60);
  assert.ok(!b.hidden && !b.held);
  assert.ok(Math.abs(b.x - 151) < 30 && b.y > 430 && b.y < 470, `out at ${b.x},${b.y}`);
});

test('the diverter turns a Starting Gate shot into the Paddock, and only when it is up', () => {
  const up = s => { const g = newGame(); if (s) g.setPost('diverter', true); const b = shoot(g, 22, 330, 0, -900); let bale = false, round = false;
    run(g, 2, () => { for (const e of g.events) { if (e.type === 'bumper') bale = true; } round ||= b.x > 200 && b.y < 80; g.events.length = 0; }); return { bale, round }; };
  assert.deepEqual(up(false), { bale: false, round: true });
  assert.equal(up(true).bale, true);
});

test('the up-post waits for a ball to move off it before it rises', () => {
  const g = newGame(); const p = g.posts.horseshoe;
  shoot(g, 151, 600, 0, 0); g.world.balls[0].held = true;
  g.setPost('horseshoe', true);
  assert.equal(p.up, false);
  g.world.balls[0].held = false; g.world.balls[0].x = 60;
  run(g, 0.3);
  assert.equal(p.up, true);
});

test('B-E-T lights the race; at the Stables the flippers pick a horse and shots win the race', () => {
  const g = newGame();
  for (const id of ['laneB', 'laneE', 'laneT']) g.trigger('lane', id, 0);
  assert.equal(g.lamps.race, 2);
  sinkStables(g);
  assert.ok(g.race.picking);
  g.flip('right', true); g.flip('right', false); g.flip('right', true); g.flip('right', false);   // two to the right
  run(g, 4.5);
  assert.ok(g.race.running);
  assert.equal(g.race.pick, 2);        // 8 to 1: eight shots to win
  g.events.length = 0;
  for (let i = 0; i < 8; i++) g.trigger('ramp', 'home', 0);
  assert.ok(messages(g).includes('WINNER 80,000'), messages(g).join());
  assert.equal(g.player.counts.wins, 1);
});

test('the other horses win a race you leave alone', () => {
  const g = newGame(); g.lamps.race = 2; const b = sinkStables(g);
  run(g, 4.5); assert.ok(g.race.running);
  b.held = true; g.saucerBalls.clear();          // keep the ball out of play while the race runs
  run(g, 60);
  assert.ok(!g.race.running);
  assert.ok(g.events.some(e => e.type === 'message' && /PLACED|ALSO RAN/.test(e.text)));
});

test('a clear round starts the Jump Off, worth less the longer you wait', () => {
  const g = newGame(); const b = g.world.balls[0];
  for (const s of g.banks.fences.shapes) g.hit(b, s, 200);
  assert.ok(g.modes.jumpOff);
  const v0 = g.hurryValue('jumpOff'); run(g, 5); const v1 = g.hurryValue('jumpOff');
  assert.ok(v0 >= 39000 && v1 < v0 && v1 > 10000, `${v0} then ${v1}`);
  const before = g.player.score; g.trigger('ramp', 'home', 0);
  assert.equal(g.player.score - before, v1);
  assert.ok(!g.modes.jumpOff);
});

test("W-I-N lights the Bookie's Tip, a mystery award at the Stables", () => {
  const g = newGame();
  for (const id of ['tgtW', 'tgtI', 'tgtN']) g.trigger('hit', id, 0);
  assert.equal(g.lamps.tip, 2);
  g.events.length = 0; sinkStables(g);
  assert.equal(g.lamps.tip, 0);
  const names = ["BOOKIE'S TIP", 'LUCKY HORSESHOE', 'BALL SAVE', 'BONUS X', 'PADDOCK', 'EXTRA BALL'];
  assert.ok(messages(g).some(m => names.some(n => m.startsWith(n))), messages(g).join());
});

test('two race wins light the Grand National: multiball, jackpots, add-a-ball and a super jackpot', () => {
  const g = newGame({ balls: 9 });
  g.player.counts.wins = 1; g.race = { pick: 0, pos: [0.9, 0, 0, 0], running: true };
  g.rules.startMode('race'); g.trigger('ramp', 'home', 0);
  assert.equal(g.lamps.gn, 2);
  sinkStables(g); run(g, 4);
  assert.ok(g.liveBalls() + g.launchQueue >= 3);
  for (let k = 0; k < 3; k++) { g.lamps.jackpot = 2; g.events.length = 0; g.trigger('ramp', 'home', 0); assert.ok(g.events.some(e => e.type === 'jackpot')); }
  assert.equal(g.lamps.superJp, 2);
  const q = g.launchQueue;
  for (const id of ['tgtW', 'tgtI', 'tgtN']) g.trigger('hit', id, 0);
  assert.equal(g.launchQueue, q + 1);
  const before = g.player.score; sinkStables(g);
  assert.equal(g.player.score - before, 200000 + 1000);
});

test('15 spins open the Paddock; a bumper then starts Paddock (bumpers x10) and lowers the diverter', () => {
  const g = newGame();
  for (let i = 0; i < 15; i++) g.trigger('spin', 'spinner', 0);
  run(g, 0.2);
  assert.equal(g.posts.diverter.up, true);
  g.trigger('bumper', 'bale1', 100);
  assert.ok(g.modes.paddock);
  assert.equal(g.posts.diverter.up, false);
  const before = g.player.score; g.trigger('bumper', 'bale2', 100);
  assert.equal(g.player.score - before, 1000);
});

test('ten minutes of bot play on Race Day: no ball escapes or gets stuck', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ ...raceday, balls: 100000 }); g.start(1);
  let hold = 0, lost = 0; const still = new Map(), stuck = [];
  for (let i = 0; i < 60 * 600; i++) {
    for (const b of g.world.balls) {
      if (b.layer === 0 && b.y > 535 && b.y < 585 && b.vy > 40 && rnd() < 0.85) { g.flip(b.x < 151 ? 'left' : 'right', true); hold = i; }
      if (b.layer === 0 && b.x > 228 && b.x < 270 && b.y > 290 && b.y < 335 && Math.hypot(b.vx, b.vy) > 40 && rnd() < 0.3) { g.flip('right', true); hold = i; }
    }
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

test('the theme tune is sixteen bars of 2/4 in every part', async () => {
  const { default: music } = await import('../tables/raceday/music.js');
  for (const tr of music.tracks) {
    const beats = tr.notes.trim().split(/\s+/).reduce((n, tok) => n + +(tok.split(':')[1] ?? 1), 0);
    assert.equal(beats, 32);
    for (const tok of tr.notes.trim().split(/\s+/)) assert.match(tok.split(':')[0], /^(-|[A-G][#b]?\d)$/);
  }
});

test('the dot-matrix scenes draw every frame without errors', async () => {
  const { createDmd } = await import('../ui/dmd.js');
  for (const sc of Object.values(raceday.scenes)) {
    const d = createDmd(); d.show(['WINNER', '80,000'], { secs: sc.secs, scene: sc.draw });
    for (let t = 0; t <= sc.secs; t += 0.05) d.frame(t, () => ({}));
  }
});
