// Grand Slam: a baseball table, with a tall dot matrix and baseball bats for flippers. Play a nine-inning game
// against the Visitors. Every big shot is a hit: the orbit is a single, the Strike Zone targets a double, the
// Bullpen a triple and the Upper Deck ramp a home run. Runners go round the bases on the diamond above the
// flippers and score runs. Outs come from the outfielder catching the ball, pop-ups (a ramp shot that falls
// short) and strikes (three slingshot hits before the batter gets a hit). Three outs and the Visitors bat; after
// nine innings, win the game for World Series multiball. Two games are played on the dot matrix with the flipper
// buttons: the Home Run Derby and the Diving Catch. Same frame as the other tables (playfield 8..294 wide,
// shooter lane 294..312).
//   Top right:  H-I-T rollover lanes (skill shot), three baseball pop bumpers below them
//   Top left:   the Bullpen (a scoop with a subway), the outfielder patrolling in front of it
//   Centre:     the Upper Deck: a ramp straight up the middle that curves over the bumpers and down the right
//   Right:      the Strike Zone drop targets; the right orbit
//   Left:       the left orbit with the Foul Pole spinner; the Dugout scoop at its foot (the dot-matrix games)
//   Bottom:     the diamond (runners on base), slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawDerby, drawCatch } from './scenes.js';
import music from './music.js';

const LANES = ['laneH', 'laneI', 'laneT'];
const SKILL = ['skH', 'skI', 'skT'];
export const INNINGS = 9;
const HITS = { 1: 'SINGLE', 2: 'DOUBLE', 3: 'TRIPLE', 4: 'HOME RUN' };
const HIT_SCORE = { 1: 2000, 2: 4000, 3: 7500, 4: 15000 };
export const RUN_SCORE = 10000;
// where the runners stand, in table pixels: home plate, first, second, third
export const BASES = [[151, 500], [206, 445], [151, 401], [96, 445]];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const zone = t => [+(198 + 42 * t).toFixed(1), +(216 + 16 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));

// ---------- the ball game ----------
// g.player.counts: inning (1-9, then extra innings), outs, strikes, runs (ours), them (the Visitors'), wins
// g.player.bases: [first, second, third], true where a runner stands
// g.player.runners: runners being drawn on the diamond: { from, to, at } (base numbers 0-4: 4 is home again)
// g.player.cycle: the kinds of hit made this game (1-4), for hitting for the cycle
const pl = g => {
  const p = g.player;
  p.bases ??= [false, false, false]; p.runners ??= []; p.cycle ??= [];
  return p;
};
export const showGame = g => {
  const p = pl(g), c = p.counts;
  ['on1', 'on2', 'on3'].forEach((id, i) => (g.lamps[id] = p.bases[i] ? 1 : 0));
  ['out1', 'out2'].forEach((id, i) => (g.lamps[id] = (c.outs ?? 0) > i ? 1 : 0));
  ['cyc1', 'cyc2', 'cyc3', 'cyc4'].forEach((id, i) => (g.lamps[id] = p.cycle.includes(i + 1) ? 1 : 0));
  for (let i = 1; i <= INNINGS; i++) g.lamps[`inn${i}`] = (c.inning ?? 1) > i ? 1 : (c.inning ?? 1) === i ? 2 : 0;
};
const newGame = g => {
  const p = pl(g), c = p.counts;
  c.inning = 1; c.outs = 0; c.strikes = 0; c.runs = 0; c.them = 0;
  p.bases = [false, false, false]; p.runners = []; p.cycle = [];
  showGame(g);
};

// a hit of n bases: every runner moves up n, the batter takes base n, and runners who reach home score
export const hit = (g, n) => {
  if (multi(g) || g.player.counts.inning === undefined) return;
  const p = pl(g), c = p.counts, t = g.world.time;
  const loaded = p.bases.every(Boolean);
  let runs = 0;
  const bases = [false, false, false];
  p.runners = p.runners.filter(r => t - r.at < 1.2 && r.to < 4);
  const move = (from, to) => { p.runners = p.runners.filter(r => r.to !== from); p.runners.push({ from, to: Math.min(4, to), at: t }); };
  for (let b = 3; b >= 1; b--) if (p.bases[b - 1]) {
    move(b, b + n);
    if (b + n >= 4) runs++; else bases[b + n - 1] = true;
  }
  move(0, n);
  if (n >= 4) runs++; else bases[n - 1] = true;
  p.bases = bases;
  c.strikes = 0;
  c.runs = (c.runs ?? 0) + runs;
  const fresh = !p.cycle.includes(n);
  if (fresh) p.cycle.push(n);
  g.addScore(HIT_SCORE[n] + runs * RUN_SCORE);
  if (n === 4 && loaded) {
    g.addScore(100000);
    g.lamps.kbL = 1;
    g.emit('message', { text: 'GRAND SLAM', sub: `4 RUNS  ${fmt(100000 + HIT_SCORE[4] + 4 * RUN_SCORE)}`, scene: 'grandslam', sound: 'jackpot' });
  } else if (n === 4) g.emit('message', { text: 'HOME RUN', sub: runs > 1 ? `${runs} RUNS SCORE` : 'OVER THE WALL', scene: 'homerun', sound: 'jackpot' });
  else g.emit('message', { text: HITS[n], sub: runs ? `${runs} RUN${runs > 1 ? 'S' : ''} SCORE${runs > 1 ? '' : 'S'}` : `${fmt(HIT_SCORE[n])}`, scene: runs ? 'run' : 'hit', sound: runs ? 'award' : undefined });
  if (fresh && p.cycle.length === 4) {
    g.lamps.xball = 2;
    g.emit('message', { text: 'HIT FOR THE CYCLE', sub: 'EXTRA BALL AT THE DUGOUT', scene: 'cycle', sound: 'jackpot' });
  }
  showGame(g);
};

// an out: three ends the half inning
export const out = (g, how) => {
  if (multi(g) || g.player.counts.inning === undefined || g.video) return;
  const c = g.player.counts;
  c.outs = (c.outs ?? 0) + 1; c.strikes = 0;
  if (c.outs >= 3) return sideRetired(g, how);
  g.emit('message', { text: how, sub: `${c.outs} OUT`, scene: how === 'STRUCK OUT' ? 'strikeout' : 'out' });
  showGame(g);
};
// a strike: three is an out (a hit starts a new batter, with no strikes). A ball rattling between the
// slingshots is one strike, not several: a strike needs STRIKE_GAP seconds since the last one.
export const STRIKE_GAP = 3;
export const strike = g => {
  if (multi(g) || g.player.counts.inning === undefined || g.video) return;
  const c = g.player.counts, p = g.player;
  if (g.world.time - (p.lastStrike ?? -99) < STRIKE_GAP) return;
  p.lastStrike = g.world.time;
  c.strikes = (c.strikes ?? 0) + 1;
  if (c.strikes >= 3) out(g, 'STRUCK OUT');
};

// how many runs the Visitors score in their half inning
const VISITORS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3];
const sideRetired = (g, how) => {
  const p = pl(g), c = p.counts;
  const left = p.bases.filter(Boolean).length;
  const r = VISITORS[Math.floor(Math.random() * VISITORS.length)];
  c.them = (c.them ?? 0) + r;
  c.outs = 0; c.strikes = 0;
  p.bases = [false, false, false]; p.runners = [];
  g.addScore(5000 * (c.inning ?? 1));
  const done = c.inning >= INNINGS && c.runs !== c.them;
  g.emit('message', { text: `${how}  SIDE RETIRED`, sub: `${left ? `${left} LEFT ON BASE  ` : ''}VISITORS SCORE ${r}`, scene: 'inning' });
  if (done) return finalScore(g);
  c.inning++;
  if (c.inning > INNINGS) g.emit('message', { text: 'EXTRA INNINGS', sub: `TIED ${c.runs}-${c.them}`, scene: 'inning' });
  else g.emit('message', { text: `INNING ${c.inning}`, sub: `YOU ${c.runs}  VISITORS ${c.them}` });
  if (c.inning === 7) g.rules.act([['mode', 'stretch'], ['message', 'SEVENTH INNING STRETCH', 'DOUBLE SCORES', 'stretch']]);
  showGame(g);
};
// the end of the game: win it for World Series multiball
const finalScore = g => {
  const c = g.player.counts, won = c.runs > c.them;
  if (won) {
    const v = 50000 + 10000 * (c.runs - c.them);
    g.addScore(v);
    c.wins = (c.wins ?? 0) + 1;
    g.lamps[`pen${Math.min(3, c.wins)}`] = 1;
    g.emit('message', { text: `YOU WIN ${c.runs}-${c.them}`, sub: `${fmt(v)}  WORLD SERIES MULTIBALL`, scene: 'win', sound: 'jackpot' });
    c.inning = undefined;
    showGame(g);
    g.rules.act([['multiball', 3]]);
  } else {
    g.addScore(25000);
    g.emit('message', { text: `VISITORS WIN ${c.them}-${c.runs}`, sub: 'NEW GAME  INNING 1', scene: 'inning', sound: 'modeEnd' });
    newGame(g);
  }
};
// the next game starts once World Series multiball is over
const afterMultiball = g => { g.lamps.superJp = 0; if (g.player.counts.inning === undefined) { newGame(g); g.emit('message', { text: 'PLAY BALL', sub: 'INNING 1', scene: 'hit' }); } };

export const status = g => {
  const c = g.player?.counts;
  if (!c || c.inning === undefined || multi(g)) return null;
  return `INN ${c.inning} OUT ${c.outs ?? 0} STR ${c.strikes ?? 0}  ${c.runs ?? 0}-${c.them ?? 0}`;
};

// ---------- the dot-matrix games, played with the flipper buttons while the Dugout holds the ball ----------
const startVideo = (g, v, secs) => { g.holdSaucer('dugout', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('dugout'); });

// The Home Run Derby: five pitches. Each comes in from the pitcher at its own speed; press a flipper button to
// swing as it reaches the plate. Spot on is a home run, near enough a hit, a bit out a foul, else a strike.
// hd: { pitch, homers, results, phase: 'wait' | 'pitch' | 'result', at (the pitch is thrown), secs (to the plate), swing, result }
export const PITCHES = 5;
export const swingResult = d => (Math.abs(d) < 0.06 ? 'HOME RUN' : Math.abs(d) < 0.12 ? 'HIT' : Math.abs(d) < 0.2 ? 'FOUL' : 'STRIKE');
export const homeRunDerby = g => {
  g.lamps.derby = 0;
  const hd = { pitch: 0, homers: 0, results: [], phase: 'wait', at: g.world.time + 1.5, secs: 1 };
  nextPitch(g, hd, 1.5);
  startVideo(g, { kind: 'derby', hd, draw: (api, t) => drawDerby(api, hd, t), flip: () => swing(g, hd) }, 30);
  g.emit('message', { text: 'HOME RUN DERBY', sub: 'PRESS TO SWING', sound: 'modeStart' });
};
const nextPitch = (g, hd, wait) => {
  hd.phase = 'pitch'; hd.at = g.world.time + wait; hd.secs = 0.7 + Math.random() * 0.6; hd.swing = null; hd.result = null;
};
const swing = (g, hd) => {
  const t = g.world.time;
  if (hd.phase !== 'pitch' || t < hd.at) return;
  hd.swing = t;
  call(g, hd, swingResult(t - (hd.at + hd.secs)));
};
const call = (g, hd, result) => {
  hd.phase = 'result'; hd.result = result; hd.resultAt = g.world.time;
  hd.results.push(result); hd.pitch++;
  if (result === 'HOME RUN') { hd.homers++; g.addScore(25000); g.emit('sound', { name: 'jackpot' }); }
  else if (result === 'HIT') { g.addScore(5000); g.emit('sound', { name: 'target' }); }
  else g.emit('sound', { name: result === 'FOUL' ? 'drop' : 'drain' });
  g.after(1.6, () => {
    if (hd.pitch >= PITCHES) return finishDerby(g, hd);
    nextPitch(g, hd, 0.8);
  });
};
const derbyTick = g => {
  const hd = g.video?.kind === 'derby' && g.video.hd;
  if (hd?.phase === 'pitch' && g.world.time > hd.at + hd.secs + 0.25) call(g, hd, 'STRIKE');   // it went by
};
const finishDerby = (g, hd) => {
  hd.phase = 'done';
  if (hd.homers === PITCHES) { g.addScore(100000); g.emit('message', { text: 'FIVE FOR FIVE', sub: '100,000', scene: 'homerun', now: true }); }
  else g.emit('message', { text: `${hd.homers} HOME RUN${hd.homers === 1 ? '' : 'S'}`, sub: fmt(hd.homers * 25000), now: true, sound: 'modeEnd' });
  endVideo(g, 2);
};

// The Diving Catch: fly balls drop into five spots across the outfield. Press left or right to run the fielder
// along (one spot a press) and get under each one. Eight fly balls.
// dc: { spot (0-4, the fielder), ball: { spot, at, secs }, n, caught, results, phase }
export const FLY_BALLS = 8, SPOTS = 5;
export const divingCatch = g => {
  g.lamps.catch = 0;
  const dc = { spot: 2, n: 0, caught: 0, results: [], phase: 'play', ball: null };
  startVideo(g, { kind: 'catch', dc, draw: (api, t) => drawCatch(api, dc, t), flip: side => run(dc, side) }, 30);
  g.emit('message', { text: 'DIVING CATCH', sub: 'LEFT AND RIGHT TO RUN', sound: 'modeStart' });
  dc.ball = flyBall(g, dc, 1.5);
};
const flyBall = (g, dc, wait) => {
  let spot; do spot = Math.floor(Math.random() * SPOTS); while (spot === dc.spot && Math.random() < 0.7);
  return { spot, at: g.world.time + wait, secs: Math.max(1.1, 1.9 - dc.n * 0.1) };
};
const run = (dc, side) => { if (dc.phase === 'play') dc.spot = Math.max(0, Math.min(SPOTS - 1, dc.spot + (side === 'left' ? -1 : 1))); };
const catchTick = g => {
  const dc = g.video?.kind === 'catch' && g.video.dc; if (!dc || dc.phase !== 'play' || !dc.ball) return;
  const b = dc.ball;
  if (g.world.time < b.at + b.secs) return;
  const ok = dc.spot === b.spot;
  dc.results.push(ok); dc.n++;
  if (ok) { dc.caught++; g.addScore(10000); g.emit('sound', { name: 'target' }); } else g.emit('sound', { name: 'drain' });
  dc.last = { ok, at: g.world.time, spot: b.spot };
  if (dc.n >= FLY_BALLS) {
    dc.phase = 'done'; dc.ball = null;
    if (dc.caught === FLY_BALLS) { g.addScore(50000); g.emit('message', { text: 'GOLD GLOVE', sub: 'EIGHT CATCHES  50,000', scene: 'out', now: true }); }
    else g.emit('message', { text: `${dc.caught} CATCHES`, sub: fmt(dc.caught * 10000), now: true, sound: 'modeEnd' });
    g.lamps.kbL = 1;
    endVideo(g, 2);
    return;
  }
  dc.ball = flyBall(g, dc, 0.6);
};

// ---------- the Dugout scoop: the first thing lit wins ----------
const dugout = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'win']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.derby) return homeRunDerby(g);
  if (g.lamps.catch) return divingCatch(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500]]);
};
// World Series jackpots at the ramp and the Bullpen; three light the super jackpot at the Dugout
const jackpot = (g, where) => {
  g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', where, 'homerun']]);
  const c = g.player.counts; c.jps = (c.jps ?? 0) + 1;
  if (c.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'MVP', sub: 'SUPER JACKPOT AT THE DUGOUT' }); }
};

// runners on the diamond, drawn over the playfield: each runs from base to base along the base paths
const RUN_SECS = 0.35;   // a second base to base, near enough
export const runnerAt = (r, t) => {
  const k = Math.max(0, Math.min(1, (t - r.at) / (RUN_SECS * (r.to - r.from)))), pos = r.from + (r.to - r.from) * k;
  const i = Math.min(3, Math.floor(pos)), f = pos - i, [a, b] = [BASES[i % 4], BASES[(i + 1) % 4]];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, k >= 1];
};
const drawRunners = (ctx, g, t, art) => {
  const p = g.player; if (!p || g.state === 'attract') return;
  const im = art.runner, gt = g.world.time;
  const shown = new Set();
  for (const r of p.runners ?? []) {
    const [x, y, done] = runnerAt(r, gt);
    if (done && r.to >= 4) continue;
    if (done) shown.add(r.to);
    put(ctx, im, x, y, (r.to - r.from) > 0 && !done ? Math.floor(t * 10) % 2 : 0);
  }
  (p.bases ?? []).forEach((on, i) => { if (on && !shown.has(i + 1) && !(p.runners ?? []).some(r => r.to === i + 1)) put(ctx, im, ...BASES[i + 1], 0); });
};
const put = (ctx, im, x, y, bob) => {
  if (im) ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height + 3 - bob));
  else { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 6 - bob, 4, 7); }
};

export default {
  id: 'grandslam',
  name: 'Grand Slam',
  tagline: 'Nine innings against the Visitors: hit, run the bases and win the World Series. Home Run Derby on the dot matrix.',
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 8,
  multiballSave: 12,
  nameY: 612,
  drainY: 650,
  dmd: { rows: 32 },
  scenes,
  music,
  status,
  colours: { field: '#2a6a2a', wall: '#f4f0e0', wallDark: '#3a3020', wallHi: '#ffffff', rubber: '#f2f2ee', bumper: '#c83030', lamp: '#ffe060',
    ramp: '#2a5ab0', rampDark: '#122a5a', wire: '#f8f4e8', sling: '#e8e8e0', slingDark: '#5a5a50', slingHi: '#ffffff', name: 'rgba(255,255,255,0.45)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46, style: 'bat' },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46, style: 'bat' },
  ],
  flipSound: 'bat',

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the left orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Dugout scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the Bullpen: a backstop round the top, open at the bottom
    { path: arcPts([96, 116], 25, 160, 380, 20), r: 2 },
    // right: the shooter lane, then the right orbit sloping in to the right inlane
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // H-I-T lane posts
    { path: [[172, 64], [172, 92]], r: 2 },
    { path: [[198, 64], [198, 92]], r: 2 },
    { path: [[224, 64], [224, 92]], r: 2 },
    { path: [[250, 64], [250, 92]], r: 2 },
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the H-I-T lanes; a ball from the left orbit passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Upper Deck: straight up the middle, over the bumpers and down the right to the right inlane
    { id: 'deck', style: 'ramp', width: 16, mouth: 30, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[168, 358], [176, 310], [178, 260], [178, 150]], arcPts([218, 150], 40, 180, 360, 12), [[258, 150], [258, 414]]) },
  ],
  bumpers: [
    { id: 'ball1', art: 'baseball', c: [206, 128], R: 11, score: 100 },
    { id: 'ball2', art: 'baseball', c: [238, 140], R: 11, score: 100 },
    { id: 'ball3', art: 'baseball', c: [214, 168], R: 11, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // the Strike Zone: three targets, slanted so nothing rests on them
  dropBanks: [
    { id: 'zone', score: 750, targets: [[zone(0), zone(0.3)], [zone(0.35), zone(0.65)], [zone(0.7), zone(1)]] },
  ],
  // the outfielder: he patrols the left field in front of the Bullpen. Hit him and he catches it: an out
  targets: [{ id: 'fielder', a: [89, 190], b: [103, 190], move: { by: [34, 0], secs: 6 }, score: 250, art: 'fielder', artOffset: [0, 2], bar: false }],
  saucers: [
    // the Bullpen: the ball goes down a subway and comes back out above the flippers
    { id: 'bullpen', c: [96, 116], R: 19, hold: 1.4, score: 1000, exit: [124, 452], eject: { dir: [0.35, 1], speed: 200 } },
    { id: 'dugout', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  spinners: [{ id: 'foulPole', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneH', a: [174, 82], b: [196, 82], label: 'H', marquee: true },
    { id: 'laneI', a: [200, 82], b: [222, 82], label: 'I', marquee: true },
    { id: 'laneT', a: [226, 82], b: [248, 82], label: 'T', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  toys: [{ draw: drawRunners }],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [185 + i * 26, 50], art: 'lamp-ball', colour: '#ffffff' })),
    // runners on base, at the bases of the diamond
    { id: 'on1', c: BASES[1], art: 'lamp-base', colour: '#ffffff' },
    { id: 'on2', c: BASES[2], art: 'lamp-base', colour: '#ffffff' },
    { id: 'on3', c: BASES[3], art: 'lamp-base', colour: '#ffffff' },
    // outs, beside home plate
    { id: 'out1', c: [124, 508], art: 'lamp-ump', colour: '#ff5a5a' },
    { id: 'out2', c: [178, 508], art: 'lamp-ump', colour: '#ff5a5a' },
    // the scoreboard: nine innings, in left field
    ...Array.from({ length: INNINGS }, (_, i) => ({ id: `inn${i + 1}`, c: [56 + (i % 5) * 17 + (i >= 5 ? 8 : 0), 236 + (i >= 5 ? 16 : 0)], marquee: true, label: String(i + 1) })),
    // hitting for the cycle: single, double, triple, home run
    ...['1', '2', '3', '4'].map((label, i) => ({ id: `cyc${i + 1}`, c: [196 + i * 16, 300], marquee: true, label })),
    { id: 'deckLit', c: [150, 376], art: 'lamp-pennant', colour: '#ffd040', lit: g => (multi(g) ? 2 : g.player?.counts.inning !== undefined && pl(g).bases.every(Boolean) ? 2 : 1) },
    { id: 'derby', c: [44, 360], art: 'lamp-bat', colour: '#ffffff' },
    { id: 'catch', c: [72, 360], art: 'lamp-glove', colour: '#ffffff' },
    { id: 'superJp', c: [58, 380], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'xball', c: [151, 443], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'zoneLit', c: [214, 256], art: 'lamp-bat', colour: '#ffd040', lit: g => (g.lamps.derby ? 2 : 0) },
    { id: 'stretch', c: [84, 200], art: 'lamp-hotdog', colour: '#ffd040' },
    { id: 'pen1', c: [200, 340], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'pen2', c: [218, 344], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'pen3', c: [236, 340], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'kbL', c: [27, 505], art: 'lamp-foam', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-star', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'THE BALL GAME', items: [
      { art: 'lamp-base', text: 'PLAY NINE INNINGS AGAINST THE VISITORS. THE INNING, OUTS, STRIKES AND SCORE ARE UNDER THE POINTS.' },
      { art: 'lamp-bat', text: 'BIG SHOTS ARE HITS: THE RIGHT ORBIT A SINGLE, THE STRIKE ZONE TARGETS A DOUBLE, THE BULLPEN A TRIPLE, THE UPPER DECK RAMP A HOME RUN.' },
      { art: 'runner', text: 'RUNNERS GO ROUND THE DIAMOND ABOVE THE FLIPPERS. EVERY RUN HOME SCORES 10,000. A HOME RUN WITH THE BASES LOADED IS A GRAND SLAM.' },
      { art: 'lamp-ump', text: 'OUTS: THE OUTFIELDER CATCHES IT, A RAMP SHOT FALLS SHORT, OR THREE STRIKES (SLINGSHOT HITS) BEFORE A HIT. THREE OUTS AND THE VISITORS BAT.' },
      { art: 'lamp-trophy', text: 'WIN AFTER NINE INNINGS FOR WORLD SERIES MULTIBALL: THE RAMP AND THE BULLPEN ARE 50,000 JACKPOTS.' },
    ] },
    { title: 'THE BALLPARK', items: [
      { art: 'lamp-xball', text: 'HIT FOR THE CYCLE (A SINGLE, DOUBLE, TRIPLE AND HOME RUN IN ONE GAME) FOR AN EXTRA BALL AT THE DUGOUT.' },
      { art: 'lamp-hotdog', text: 'THE SEVENTH INNING STRETCH DOUBLES THE BIG SHOTS FOR 30 SECONDS.' },
      { marquee: 'H', text: 'LIGHT H-I-T IN THE TOP LANES TO RAISE THE BONUS MULTIPLIER AND LIGHT THE KICKBACK.' },
      { art: 'lamp-foam', text: 'KICKBACK: WHILE THE FOAM FINGER IS LIT, THE LEFT OUTLANE FIRES THE BALL BACK.' },
    ] },
    { title: 'DOT-MATRIX GAMES', items: [
      { art: 'lamp-bat', text: 'KNOCK DOWN THE STRIKE ZONE TO LIGHT THE HOME RUN DERBY AT THE DUGOUT: PRESS A FLIPPER BUTTON TO SWING AS THE PITCH REACHES THE PLATE.' },
      { art: 'lamp-glove', text: 'TWENTY SPINS ON THE FOUL POLE LIGHT THE DIVING CATCH: PRESS LEFT AND RIGHT TO RUN UNDER THE FLY BALLS.' },
      { art: 'lamp-star', text: 'BALL SAVE: WHILE THE STAR FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    hit: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },
  modes: {
    stretch: { name: 'SEVENTH INNING STRETCH', secs: 30, scoreX: { ramp: 2, saucer: 2, lane: 2, drop: 2, bumper: 2 }, lamps: ['stretch'] },
  },

  script: g => ({
    start: () => { g.video = null; },
    tick: () => { derbyTick(g); catchTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, g => { g.video = null; const p = pl(g); p.runners = []; if (p.counts.inning === undefined && !multi(g)) newGame(g); showGame(g); }] },

    // skill shot: a hit off the first pitch
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', 'FIRST PITCH', 'hit'], g => hit(g, 1)] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // H-I-T: bonus multiplier, and the kickback
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:hit', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['lamp', 'kbL', 1], ['message', 'H-I-T', 'BONUS MULTIPLIER']] },

    // the hits
    // (only a shot up the orbit: a plunge falling back down it is no hit)
    { on: 'lane:orbit', do: [['bonus', 250], g => { if (g.world.balls.some(b => g.inPlay(b) && b.x > 262 && b.x < 296 && Math.abs(b.y - 240) < 20 && b.vy < 0)) hit(g, 1); }] },
    { on: 'bankDown:zone', do: [['score', 5000], ['lamp', 'derby', 2], g => hit(g, 2), ['message', 'STRIKE ZONE', 'HOME RUN DERBY AT THE DUGOUT']] },
    { on: 'saucer:bullpen', do: [g => (multi(g) ? jackpot(g, 'THE BULLPEN') : hit(g, 3))] },
    { on: 'ramp:deck', do: [['bonus', 500], g => (multi(g) ? jackpot(g, 'THE UPPER DECK') : hit(g, 4))] },
    { on: 'saucer:dugout', do: [dugout] },

    // the outs
    { on: 'hit:fielder', do: [g => out(g, 'CAUGHT')] },
    { on: 'rampFail:deck', do: [g => out(g, 'POP UP')] },
    { on: 'sling', do: [strike] },

    // the dot-matrix games read the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    { on: 'drop', do: [['bonus', 100]] },
    { on: 'spin:foulPole', if: { unlit: 'catch' }, do: [['count', 'spins', 1]] },
    { on: 'spin:foulPole', if: { count: ['spins', '>=', 20], unlit: 'catch' }, do: [['setCount', 'spins', 0], ['lamp', 'catch', 2], ['message', 'DIVING CATCH', 'AT THE DUGOUT']] },

    { on: 'multiballEnd', do: [afterMultiball] },
  ],
};
