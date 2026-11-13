// Cup Final: a football table, with a tall dot matrix. Score goals past a goalkeeper who moves across to block
// the ball, play timed matches against a rival team through four rounds of the cup, and play two games on the
// dot matrix with the flipper buttons: a penalty shootout and keepy-uppy. Winning the final starts Cup Final
// multiball. Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top centre: the goal (a scoop with a subway), the goalkeeper in front of it
//   Top right:  C-U-P rollover lanes (skill shot); the Cross wire ramp comes down over them
//   Top left:   three football pop bumpers (the Crowd), the Wall drop targets below them
//   Left:       the Wing orbit with a spinner; the Tunnel scoop at its foot (kick-offs and the dot-matrix games)
//   Right:      the Cross: a wire ramp up the right that drops to the right inlane, for a header at the goal
//   Bottom:     slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawPenalties, drawKeepy } from './scenes.js';
import music from './music.js';

const LANES = ['laneC', 'laneU', 'laneP'];
const SKILL = ['skC', 'skU', 'skP'];
const ROUNDS = ['ROUND ONE', 'QUARTER FINAL', 'SEMI FINAL', 'THE FINAL'];
const RIVALS = ['ROVERS', 'CITY', 'ATHLETIC', 'WANDERERS'];
const RIVAL_GOALS = [[1, 1, 2], [1, 2, 2], [1, 2, 3], [2, 2, 3]];   // how many the rival may score, by round
export const MATCH_SECS = 60;
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const wall = t => [+(64 + 48 * t).toFixed(1), +(236 - 18 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));
const showRounds = g => ['round1', 'round2', 'round3', 'round4'].forEach((id, i) => (g.lamps[id] = i < (g.player.counts.round ?? 0) ? 1 : i === (g.player.counts.round ?? 0) ? 2 : 0));

// ---------- the match ----------
// g.match: { round, us, them, start, theirs: [times they score], over }
const minute = g => Math.min(90, Math.floor(((g.world.time - g.match.start) / MATCH_SECS) * 90));
const kickOff = g => {
  const round = Math.min(3, g.player.counts.round ?? 0);
  const n = RIVAL_GOALS[round][Math.floor(Math.random() * 3)];
  const theirs = Array.from({ length: n }, () => 6 + Math.random() * (MATCH_SECS - 10)).sort((a, b) => a - b);
  g.match = { round, us: 0, them: 0, start: g.world.time, theirs, over: false };
  g.lamps.kickoff = 0;
  g.rules.startMode('match');
  g.emit('message', { text: ROUNDS[round], sub: `KICK OFF V ${RIVALS[round]}`, scene: 'kickoff', sound: 'modeStart' });
};
const matchTick = g => {
  const m = g.match; if (!m || m.over) return;
  const t = g.world.time - m.start;
  while (m.theirs.length && t >= m.theirs[0]) {
    m.theirs.shift(); m.them++;
    g.emit('message', { text: `${RIVALS[m.round]} SCORE`, sub: `${m.us} - ${m.them}`, sound: 'drain' });
  }
  if (t >= MATCH_SECS) fullTime(g);
};
const fullTime = (g, quiet = false) => {
  const m = g.match; if (!m || m.over) return;
  m.over = true;
  g.rules.endMode('match', true);
  if (quiet) { g.match = null; return; }
  if (m.us > m.them) return winMatch(g);
  if (m.us === m.them) {
    g.emit('message', { text: `FULL TIME ${m.us} - ${m.them}`, sub: 'PENALTIES AT THE TUNNEL', scene: 'whistle' });
    g.lamps.penalty = 2; m.decider = true;
    return;
  }
  g.emit('message', { text: `FULL TIME ${m.us} - ${m.them}`, sub: 'KNOCKED OUT. TRY AGAIN', scene: 'whistle', sound: 'modeEnd' });
  g.match = null;
};
const winMatch = g => {
  const m = g.match, round = m.round;
  const prize = 25000 * (round + 1) + 10000 * m.us;
  g.addScore(prize);
  g.player.counts.round = Math.min(4, round + 1);
  showRounds(g);
  g.match = null;
  if (round === 3) {
    g.emit('message', { text: 'CUP WINNERS', sub: 'CUP FINAL MULTIBALL', scene: 'trophy', sound: 'jackpot' });
    g.player.counts.round = 0; showRounds(g);
    g.player.counts.cups = (g.player.counts.cups ?? 0) + 1;
    g.lamps[`cup${Math.min(3, g.player.counts.cups)}`] = 1;
    g.rules.act([['multiball', 3]]);
    return;
  }
  g.emit('message', { text: `${ROUNDS[round]} WON`, sub: fmt(prize), scene: 'whistle', sound: 'jackpot' });
};
export const matchStatus = g => {
  const m = g.match; if (!m || m.over) return null;
  return `HOME ${m.us}-${m.them} ${RIVALS[m.round]} ${minute(g)}'`;
};

// ---------- a goal ----------
const goal = g => {
  const last = g.lastTrigger['ramp:cross'], header = last !== undefined && g.world.time - last < 4;
  const n = (g.player.counts.goals = (g.player.counts.goals ?? 0) + 1);
  if (multi(g)) {
    const v = 50000 * (header ? 2 : 1);
    g.rules.act([['jackpot', v], ['message', header ? 'HEADER JACKPOT' : 'JACKPOT', fmt(v), 'goal']]);
    g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
    if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'LIFT THE CUP', sub: 'SUPER JACKPOT AT THE TUNNEL' }); }
  } else {
    const v = 10000 * (header ? 2 : 1);
    g.addScore(v);
    if (g.match && !g.match.over) {
      g.match.us++;
      g.emit('message', { text: header ? 'HEADER' : 'GOAL', sub: `HOME ${g.match.us} - ${g.match.them} ${RIVALS[g.match.round]}`, scene: 'goal', sound: 'jackpot' });
    } else g.emit('message', { text: header ? 'HEADER' : 'GOAL', sub: fmt(v), scene: 'goal', sound: 'jackpot' });
  }
  if (n % 5 === 0) { g.lamps.xball = 2; g.emit('message', { text: 'GOLDEN BOOT', sub: 'EXTRA BALL AT THE TUNNEL' }); }
  if (n % 2 === 0) g.lamps.kbL = 1;
};

// ---------- the dot-matrix games, played with the flipper buttons while the Tunnel holds the ball ----------
const startVideo = (g, v, secs) => {
  g.holdSaucer('tunnel', secs + 5);
  g.video = v;
};
const endVideo = (g, after = 1.2) => {
  g.after(after, () => { g.video = null; g.releaseSaucer('tunnel'); });
};

// Penalty shootout: five kicks. Left button shoots left, right button right, both together down the middle.
// The keeper guesses. g.video.pen: { kick, goals, results, phase: 'aim' | 'shot', aim, dive, at, press }
export const penalties = g => {
  g.lamps.penalty = 0;
  const pen = { kick: 0, goals: 0, results: [], phase: 'aim', at: g.world.time + 1.5, aim: null, dive: null, decider: !!g.match?.decider };
  const v = { kind: 'penalties', pen, draw: (api, t) => drawPenalties(api, pen, t), flip: side => aim(g, pen, side) };
  startVideo(g, v, 40);
  g.emit('message', { text: 'PENALTY SHOOTOUT', sub: 'FLIPPERS AIM', sound: 'modeStart' });
};
const aim = (g, pen, side) => {
  if (pen.phase !== 'aim' || g.world.time < pen.at - 1.2) return;
  const t = g.world.time;
  if (pen.press && pen.press.side !== side && t - pen.press.t < 0.15) { pen.press = null; return shootPen(g, pen, 'centre'); }
  pen.press = { side, t };
  g.after(0.15, () => { if (pen.press && pen.press.t === t) { pen.press = null; shootPen(g, pen, side); } });
};
const shootPen = (g, pen, where) => {
  if (pen.phase !== 'aim') return;
  pen.phase = 'shot'; pen.aim = where; pen.at = g.world.time;
  pen.dive = ['left', 'centre', 'right'][Math.floor(Math.random() * 3)];
  const lucky = Math.random() < 0.3;   // a kick down the middle can still beat a keeper who stays put
  g.emit('sound', { name: 'drop' });
  g.after(0.7, () => {
    const scored = pen.dive !== where || (where === 'centre' && lucky);
    pen.results.push(scored); pen.kick++;
    if (scored) { pen.goals++; g.addScore(15000); g.emit('sound', { name: 'jackpot' }); } else g.emit('sound', { name: 'drain' });
    g.after(1.0, () => {
      if (pen.kick >= 5) return finishPens(g, pen);
      pen.phase = 'aim'; pen.aim = null; pen.dive = null; pen.at = g.world.time + 1.5;
    });
  });
};
// no press in time: the kick goes down the middle
const penTick = g => {
  const pen = g.video?.pen; if (!pen || pen.phase !== 'aim') return;
  if (g.world.time > pen.at + 2.5) shootPen(g, pen, 'centre');
};
const finishPens = (g, pen) => {
  pen.phase = 'done';
  if (pen.goals === 5) { g.addScore(75000); g.emit('message', { text: 'PERFECT PENALTIES', sub: '75,000', scene: 'goal', now: true }); }
  else g.emit('message', { text: `${pen.goals} OUT OF 5`, sub: fmt(pen.goals * 15000), now: true, sound: 'modeEnd' });
  g.lamps.kbL = 1;
  if (pen.decider && g.match) {
    if (pen.goals >= 3) { g.match.us++; winMatch(g); } else { g.emit('message', { text: 'LOST ON PENALTIES', sub: 'TRY AGAIN' }); g.match = null; }
  }
  endVideo(g, 2);
};

// Keepy-uppy: tap a flipper button just as the ball drops onto the boot. Every touch counts; miss and it's over.
// g.video.kick: { n, from, period, over, missAt }
export const keepyUppy = g => {
  g.lamps.keepy = 0;
  const k = { n: 0, from: g.world.time + 1.2, period: 1.0, over: false, lastTap: -9 };
  const v = { kind: 'keepy', kick: k, draw: (api, t) => drawKeepy(api, k, t), flip: () => tap(g, k) };
  startVideo(g, v, 30);
  g.emit('message', { text: 'KEEPY UPPY', sub: 'TAP AS IT LANDS', sound: 'modeStart' });
};
// how far through its bounce the ball is (0 leaving the boot, 1 landing on it)
export const bounce = (k, t) => (t - k.from) / k.period;
const tap = (g, k) => {
  if (k.over) return;
  const t = g.world.time, p = bounce(k, t);
  if (p < 0) return;
  k.lastTap = t;
  if (p > 0.78 && p < 1.12) {
    k.n++; k.from = t; k.period = Math.max(0.55, k.period * 0.96);
    const v = 1000 * k.n; g.addScore(v);
    g.emit('sound', { name: 'target' });
  } else keepyOver(g, k);
};
const keepyTick = g => {
  const k = g.video?.kick; if (!k || k.over) return;
  if (bounce(k, g.world.time) > 1.12) keepyOver(g, k);
};
const keepyOver = (g, k) => {
  k.over = true; k.missAt = g.world.time;
  const total = (k.n * (k.n + 1) / 2) * 1000;
  g.emit('sound', { name: 'drain' });
  if (k.n >= 10) g.emit('sound', { name: 'jackpot' });
  g.emit('message', { text: `${k.n} KEEPY UPPIES`, sub: fmt(total), now: true });
  endVideo(g, 1.5);
};

// ---------- the Tunnel scoop: the first thing lit wins ----------
const tunnel = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'trophy']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.penalty) return penalties(g);
  if (g.lamps.keepy) return keepyUppy(g);
  if (g.lamps.kickoff && !g.match) return kickOff(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500]]);
};

export default {
  id: 'cupfinal',
  name: 'Cup Final',
  tagline: 'Beat the keeper, win four matches and lift the cup. Penalties and keepy-uppy on the dot matrix.',
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
  status: matchStatus,
  colours: { field: '#1a4a22', wall: '#e8ecf2', wallDark: '#3a4250', wallHi: '#ffffff', rubber: '#f2f2ee', bumper: '#e8e8e8', lamp: '#ffd040',
    ramp: '#2a5ab0', rampDark: '#14306a', wire: '#f0f4ff', sling: '#d83a3a', slingDark: '#5a1010', slingHi: '#ff9a9a', name: 'rgba(255,255,255,0.45)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Wing orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Tunnel scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the goal: open at the bottom, its back slanted (so nothing rests on its roof); its right side is also the
    // first C-U-P lane post
    { path: [[116, 124], [116, 100], [208, 82]], r: 2 },
    { path: [[208, 64], [208, 124]], r: 2 },
    // right: the shooter lane, then the right orbit sloping in to the right inlane
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // C-U-P lane posts
    { path: [[228, 64], [228, 92]], r: 2 },
    { path: [[248, 64], [248, 92]], r: 2 },
    { path: [[268, 64], [268, 92]], r: 2 },
  ],
  posts: [{ c: [116, 126], R: 3 }, { c: [208, 126], R: 3 }],   // the goalposts
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the C-U-P lanes; a ball from the Wing passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Cross: up the right, over the C-U-P lanes and down to the right inlane, for a header
    { id: 'cross', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  bumpers: [
    { id: 'crowd1', art: 'ball', c: [52, 112], R: 12, score: 100 },
    { id: 'crowd2', art: 'ball', c: [86, 94], R: 12, score: 100 },
    { id: 'crowd3', art: 'ball', c: [72, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // the Wall: three defenders, slanted so nothing rests on them
  dropBanks: [
    { id: 'wall', art: 'defender', score: 750, targets: [[wall(0), wall(0.3)], [wall(0.35), wall(0.65)], [wall(0.7), wall(1)]] },
  ],
  saucers: [
    // the goal: the ball goes down a subway and the keeper rolls it out above the flippers
    { id: 'goal', c: [162, 106], R: 22, hold: 1.4, score: 1000, exit: [110, 418], eject: { dir: [0.35, 1], speed: 200 } },
    { id: 'tunnel', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  // the goalkeeper: moves across to block a ball coming at the goal
  targets: [{ id: 'keeper', a: [155, 130], b: [169, 130], move: { follow: true, reach: 30, speed: 30, sight: 200, secs: 2.6 }, score: 250 }],
  spinners: [{ id: 'spinner', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneC', a: [210, 82], b: [226, 82], label: 'C', marquee: true },
    { id: 'laneU', a: [230, 82], b: [246, 82], label: 'U', marquee: true },
    { id: 'laneP', a: [250, 82], b: [266, 82], label: 'P', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [218 + i * 20, 52], art: 'lamp-boot', colour: '#ffffff' })),
    // the cup run: three medals and the cup
    { id: 'round1', c: [130, 300], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'round2', c: [146, 306], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'round3', c: [162, 306], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'round4', c: [178, 300], art: 'lamp-cup', colour: '#ffffff' },
    { id: 'kickoff', c: [58, 352], art: 'lamp-whistle', colour: '#ffffff' },
    { id: 'penalty', c: [44, 370], art: 'lamp-net', colour: '#ffffff' },
    { id: 'keepy', c: [72, 370], art: 'lamp-ball', colour: '#ffffff' },
    { id: 'superJp', c: [58, 388], art: 'lamp-cup', colour: '#ffd040' },
    { id: 'xball', c: [154, 340], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'match', c: [154, 160], art: 'lamp-scarf', colour: '#ff5a5a' },
    { id: 'wallLit', c: [92, 252], art: 'lamp-yellow', colour: '#ffd040', lit: g => (g.lamps.penalty ? 2 : 0) },
    { id: 'cross', c: [206, 378], art: 'lamp-flag', colour: '#ffd040', lit: g => (g.world.time - (g.lastTrigger['ramp:cross'] ?? -9) < 4 ? 2 : 0) },
    { id: 'cup1', c: [130, 400], art: 'lamp-star', colour: '#ffd040' },
    { id: 'cup2', c: [151, 404], art: 'lamp-star', colour: '#ffd040' },
    { id: 'cup3', c: [172, 400], art: 'lamp-star', colour: '#ffd040' },
    { id: 'kbL', c: [27, 505], art: 'lamp-glove', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-shirt', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'THE CUP', items: [
      { marquee: 'C', text: 'LIGHT C-U-P IN THE TOP LANES TO LIGHT A KICK-OFF AT THE TUNNEL (THE SCOOP ON THE LEFT). THEY ALSO RAISE THE BONUS MULTIPLIER.' },
      { art: 'lamp-whistle', text: 'A MATCH LASTS 60 SECONDS. SCORE GOALS PAST THE KEEPER BEFORE THE OTHER TEAM DOES. THE SCORE IS ON THE DOT MATRIX.' },
      { art: 'lamp-medal', text: 'WIN FOUR ROUNDS TO REACH AND WIN THE FINAL. A DRAW GOES TO PENALTIES.' },
      { art: 'lamp-cup', text: 'WIN THE FINAL FOR CUP FINAL MULTIBALL: EVERY GOAL IS A 50,000 JACKPOT. THREE LIGHT THE 250,000 SUPER JACKPOT AT THE TUNNEL.' },
    ] },
    { title: 'GOALS', items: [
      { art: 'keeper', text: 'THE KEEPER MOVES ACROSS TO BLOCK YOUR SHOT. ANGLED AND FAST SHOTS BEAT HIM.' },
      { art: 'lamp-flag', text: 'SHOOT THE CROSS RAMP, THEN SCORE WITHIN 4 SECONDS FOR A HEADER: DOUBLE.' },
      { art: 'lamp-boot', text: 'EVERY FIFTH GOAL IS A GOLDEN BOOT: AN EXTRA BALL AT THE TUNNEL. EVERY SECOND GOAL LIGHTS THE KICKBACK.' },
    ] },
    { title: 'DOT-MATRIX GAMES', items: [
      { art: 'lamp-net', text: 'KNOCK DOWN THE WALL TO LIGHT PENALTIES. FIVE KICKS: LEFT BUTTON SHOOTS LEFT, RIGHT BUTTON RIGHT, BOTH AT ONCE DOWN THE MIDDLE.' },
      { art: 'lamp-ball', text: 'TWENTY SPINS ON THE WING LIGHT KEEPY-UPPY: TAP A FLIPPER BUTTON JUST AS THE BALL LANDS ON THE BOOT.' },
      { art: 'lamp-shirt', text: 'BALL SAVE: WHILE THE SHIRT FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  toys: [
    // the goalkeeper, standing on his target
    { art: 'keeper', at: g => { const [a, b] = g.targetAt('keeper'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 2]; } },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    cup: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },
  modes: {
    match: { name: 'MATCH', secs: MATCH_SECS + 5, lamps: ['match'] },
  },

  script: g => ({
    start: () => { g.match = null; g.video = null; },
    tick: () => { matchTick(g); penTick(g); keepyTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, showRounds, g => { g.video = null; }] },
    { on: 'drain', do: [g => { if (g.match && !g.match.over) { fullTime(g, true); g.emit('message', { text: 'MATCH ABANDONED' }); } }] },

    // skill shot
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', '15,000', 'goal']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // C-U-P: bonus multiplier and a kick-off
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:cup', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, g => { if (!g.match) { g.lamps.kickoff = 2; g.emit('message', { text: 'C-U-P', sub: 'KICK OFF AT THE TUNNEL' }); } }] },

    { on: 'saucer:goal', do: [goal] },
    { on: 'saucer:tunnel', do: [tunnel] },
    { on: 'hit:keeper', do: [['sound', 'target'], ['bonus', 100]] },

    // the dot-matrix games read the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    // the Wall lights penalties; the Wing lights keepy-uppy
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:wall', do: [['score', 5000], ['lamp', 'penalty', 2], ['message', 'FREE KICK', 'PENALTIES AT THE TUNNEL', 'wall']] },
    { on: 'spin:spinner', if: { unlit: 'keepy' }, do: [['count', 'spins', 1]] },
    { on: 'spin:spinner', if: { count: ['spins', '>=', 20], unlit: 'keepy' }, do: [['setCount', 'spins', 0], ['lamp', 'keepy', 2], ['message', 'KEEPY UPPY', 'AT THE TUNNEL']] },

    { on: 'ramp:cross', do: [['bonus', 500]] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    { on: 'multiballEnd', do: [['lamp', 'superJp', 0]] },
  ],
};
