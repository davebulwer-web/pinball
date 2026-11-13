// Hole in One: a golf table, with a tall dot matrix. Play a round of nine holes: every hole has a length in
// yards and a par, and every shot on the table is a stroke that carries the ball down the fairway, so big shots
// (the ramp, the orbit) take fewer strokes. Once you're on the green the flag lights: sink the ball in the Cup at
// the top of the table to hole out; from close enough, the Cup chips straight in. Bunkers slow the ball and cost
// a stroke, the wind blows it about, and two games are played on the dot matrix with the flipper buttons: the
// Putting Green and the Long Drive. Finish the round for 19th Hole multiball. Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top centre: the Cup (a scoop with a subway) on the green, a bunker in front of it
//   Top right:  P-A-R rollover lanes (skill shot); the Buggy Path wire ramp comes down over them
//   Top left:   three trees (pop bumpers: the rough), the TEE drop targets below them, a fairway bunker
//   Left:       the Fairway orbit with a spinner; the Clubhouse scoop at its foot (the dot-matrix games)
//   Right:      the Buggy Path: a wire ramp up the right that drops to the right inlane (a big drive)
//   Bottom:     slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawPutting, drawDrive } from './scenes.js';
import music from './music.js';

const LANES = ['laneP', 'laneA', 'laneR'];
const SKILL = ['skP', 'skA', 'skR'];
// the course: par and length of each hole
export const COURSE = [[4, 380], [3, 150], [5, 520], [4, 400], [4, 360], [3, 140], [5, 540], [4, 410], [4, 420]];
// how far each shot carries the ball (yards). Each is a stroke, except the spinner (the ball rolls on)
const CARRY = { 'ramp:buggy': 200, 'lane:orbit': 150, 'saucer:cup': 150, 'saucer:clubhouse': 80, lane: 60, drop: 40, spin: 4 };
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const tee = t => [+(64 + 48 * t).toFixed(1), +(236 - 18 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));
const showCard = g => [...COURSE.keys()].forEach(i => (g.lamps[`hole${i + 1}`] = i < (g.player.counts.hole ?? 0) ? 1 : i === (g.player.counts.hole ?? 0) ? 2 : 0));

// ---------- the round ----------
// g.player.counts: hole (0-8, the hole being played), yards (left to the green), strokes (on this hole),
// toPar (the round so far), birdies
export const hole = g => COURSE[(g.player.counts.hole ?? 0) % 9];
const teeOff = (g, quiet = false) => {
  const c = g.player.counts, [par, yards] = hole(g);
  c.yards = yards; c.strokes = 0;
  g.lamps.flag = 0;
  // a breeze on some holes, from one side or the other
  const w = Math.random();
  g.lamps.windL = w < 0.25 ? 1 : 0; g.lamps.windR = w > 0.75 ? 1 : 0;
  showCard(g);
  if (!quiet) g.emit('message', { text: `HOLE ${(c.hole ?? 0) + 1}  PAR ${par}`, sub: `${yards} YARDS${g.lamps.windL ? '  WIND FROM THE LEFT' : g.lamps.windR ? '  WIND FROM THE RIGHT' : ''}`, scene: 'teeoff' });
};
// a shot carries the ball down the fairway; on the green, the flag lights
const carry = (g, key) => {
  const c = g.player.counts;
  if (multi(g) || g.lamps.flag || c.yards === undefined) return;
  const y = CARRY[key] ?? CARRY[key.split(':')[0]];
  if (!y) return;
  if (key !== 'spin') c.strokes = (c.strokes ?? 0) + 1;
  c.yards = Math.max(0, c.yards - y);
  if (c.yards === 0) { g.lamps.flag = 2; g.emit('message', { text: 'ON THE GREEN', sub: 'SINK IT IN THE CUP', sound: 'award' }); }
};
const NAMES = { '-3': 'ALBATROSS', '-2': 'EAGLE', '-1': 'BIRDIE', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY' };
const SCENE = { '-3': 'eagle', '-2': 'eagle', '-1': 'birdie' };
// holing out is one more stroke (the putt, or a chip in)
export const holeOut = g => {
  const c = g.player.counts, [par] = hole(g), n = (c.strokes ?? 0) + 1, diff = n - par;
  const ace = n === 1;
  const v = ace ? 100000 : Math.max(5000, 10000 * (3 - diff));
  g.addScore(v);
  c.toPar = (c.toPar ?? 0) + diff;
  const name = ace ? 'HOLE IN ONE' : NAMES[Math.max(-3, diff)] ?? `${diff} OVER PAR`;
  g.emit('message', { text: name, sub: `${n} STROKE${n > 1 ? 'S' : ''}  ${fmt(v)}`, scene: ace ? 'ace' : SCENE[Math.max(-3, diff)] ?? 'holeout', sound: diff < 0 ? 'jackpot' : 'award' });
  if (diff < 0 || ace) {
    c.birdies = (c.birdies ?? 0) + 1;
    if (ace || c.birdies % 3 === 0) { g.lamps.xball = 2; g.emit('message', { text: ace ? 'ACE' : 'THREE BIRDIES', sub: 'EXTRA BALL AT THE CLUBHOUSE' }); }
  }
  c.hole = (c.hole ?? 0) + 1;
  if (c.hole >= 9) return finishRound(g);
  teeOff(g);
};
const finishRound = g => {
  const c = g.player.counts, toPar = c.toPar ?? 0;
  const v = Math.max(25000, 100000 - 10000 * toPar);
  g.addScore(v);
  g.lamps[`cup${Math.min(3, (c.rounds = (c.rounds ?? 0) + 1))}`] = 1;
  g.emit('message', { text: `ROUND ${toPar === 0 ? 'LEVEL PAR' : toPar < 0 ? `${-toPar} UNDER` : `${toPar} OVER`}`, sub: `${fmt(v)}  19TH HOLE MULTIBALL`, scene: 'trophy', sound: 'jackpot' });
  c.hole = 0; c.toPar = 0; c.yards = undefined;
  g.lamps.flag = 0; g.lamps.windL = g.lamps.windR = 0;
  showCard(g);
  g.rules.act([['multiball', 3]]);
};
// the next hole starts once the 19th Hole multiball is over
const afterMultiball = g => { g.lamps.superJp = 0; if (g.player.counts.yards === undefined) teeOff(g); };

export const status = g => {
  const c = g.player.counts;
  if (c.yards === undefined || multi(g)) return null;
  const [par] = hole(g);
  return `HOLE ${(c.hole ?? 0) + 1} PAR ${par} ${c.yards ? `${c.yards}Y` : 'GREEN'} S${c.strokes ?? 0}`;
};

// ---------- the Cup: hole out once on the green; a good approach shot before then ----------
const cup = g => {
  if (multi(g)) {
    g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', '50,000', 'holeout']]);
    g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
    if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'CLUB CHAMPION', sub: 'SUPER JACKPOT AT THE CLUBHOUSE' }); }
    return;
  }
  const c = g.player.counts;
  if (g.lamps.flag) return holeOut(g);
  if (c.yards === undefined) return;
  // close enough, it goes straight in
  if (c.yards <= CARRY['saucer:cup']) { g.emit('message', { text: 'CHIPPED IN', sound: 'award' }); return holeOut(g); }
  g.emit('message', { text: 'APPROACH SHOT', sub: `${c.yards - CARRY['saucer:cup']} YARDS TO GO` });
};

// ---------- the dot-matrix games, played with the flipper buttons while the Clubhouse holds the ball ----------
const startVideo = (g, v, secs) => { g.holdSaucer('clubhouse', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('clubhouse'); });

// The Putting Green: three putts. A power meter swings to and fro; press a flipper button to strike the putt.
// Hit it just right to drop it in the hole. pg: { putt, holed, results, target, phase: 'aim' | 'roll', power, at }
export const PUTTS = 3;
export const meter = (pg, t) => (1 - Math.cos(Math.max(0, t - pg.at) * 2.6)) / 2;   // 0..1, swinging
export const puttingGreen = g => {
  g.lamps.putting = 0;
  const pg = { putt: 0, holed: 0, results: [], phase: 'aim', target: 0.35 + Math.random() * 0.5, power: 0, at: g.world.time + 1.5 };
  startVideo(g, { kind: 'putting', pg, draw: (api, t) => drawPutting(api, pg, t), flip: () => putt(g, pg) }, 40);
  g.emit('message', { text: 'PUTTING GREEN', sub: 'PRESS TO PUTT', sound: 'modeStart' });
};
const putt = (g, pg) => {
  const t = g.world.time;
  if (pg.phase !== 'aim' || t < pg.at) return;
  pg.phase = 'roll'; pg.power = meter(pg, t); pg.rollAt = t;
  const holed = Math.abs(pg.power - pg.target) < 0.07;
  g.emit('sound', { name: 'target' });
  g.after(1.4, () => {
    pg.results.push(holed); pg.putt++;
    if (holed) { pg.holed++; g.addScore(20000); g.emit('sound', { name: 'jackpot' }); } else g.emit('sound', { name: 'drain' });
    g.after(1.2, () => {
      if (pg.putt >= PUTTS) return finishPutting(g, pg);
      pg.phase = 'aim'; pg.target = 0.35 + Math.random() * 0.5; pg.at = g.world.time + 1;
    });
  });
};
const puttingTick = g => {
  const pg = g.video?.pg;
  if (pg?.phase === 'aim' && g.world.time > pg.at + 8) putt(g, pg);   // no press: it's struck anyway
};
const finishPutting = (g, pg) => {
  pg.phase = 'done';
  if (pg.holed === PUTTS) { g.addScore(50000); g.emit('message', { text: 'THREE FROM THREE', sub: '50,000', scene: 'holeout', now: true }); }
  else g.emit('message', { text: `${pg.holed} PUTT${pg.holed === 1 ? '' : 'S'} HOLED`, sub: fmt(pg.holed * 20000), now: true, sound: 'modeEnd' });
  endVideo(g, 2);
};

// The Long Drive: press left, right, left, right as fast as you can to wind up the swing, then the ball flies.
// ld: { taps, last, start, secs, yards, phase: 'swing' | 'fly' }
export const DRIVE_SECS = 4;
export const longDrive = g => {
  g.lamps.drive = 0;
  const ld = { taps: 0, last: null, start: g.world.time + 1.5, secs: DRIVE_SECS, yards: 0, phase: 'swing' };
  startVideo(g, { kind: 'drive', ld, draw: (api, t) => drawDrive(api, ld, t), flip: side => wind(g, ld, side) }, 15);
  g.emit('message', { text: 'LONG DRIVE', sub: 'LEFT RIGHT LEFT RIGHT FAST', sound: 'modeStart' });
};
const wind = (g, ld, side) => {
  const t = g.world.time;
  if (ld.phase !== 'swing' || t < ld.start || side === ld.last) return;
  ld.last = side; ld.taps++;
};
const driveTick = g => {
  const ld = g.video?.ld; if (!ld || ld.phase !== 'swing') return;
  if (g.world.time < ld.start + ld.secs) return;
  ld.phase = 'fly'; ld.flyAt = g.world.time;
  ld.yards = Math.min(420, 120 + ld.taps * 9);
  g.emit('sound', { name: 'kickback' });
  g.after(2.2, () => {
    const c = g.player.counts, best = ld.yards > (c.longest ?? 0);
    if (best) c.longest = ld.yards;
    const v = ld.yards * 100;
    g.addScore(v);
    g.emit('message', { text: `${ld.yards} YARDS`, sub: best ? `LONGEST DRIVE ${fmt(v)}` : fmt(v), now: true, sound: ld.yards >= 300 ? 'jackpot' : 'award' });
    // a long drive also carries the ball down the fairway of the hole being played
    if (c.yards !== undefined && !g.lamps.flag) { c.yards = Math.max(0, c.yards - Math.round(ld.yards / 2)); if (!c.yards) g.lamps.flag = 2; }
    g.lamps.kbL = 1;
    endVideo(g, 1.5);
  });
};

// ---------- the Clubhouse scoop: the first thing lit wins ----------
const clubhouse = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'trophy']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.putting) return puttingGreen(g);
  if (g.lamps.drive) return longDrive(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500]]);
};

export default {
  id: 'holeinone',
  name: 'Hole in One',
  tagline: 'Play nine holes in as few strokes as you can. Putting and the Long Drive on the dot matrix.',
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
  colours: { field: '#2a6a2a', wall: '#f4f0e0', wallDark: '#4a4030', wallHi: '#ffffff', rubber: '#f2f2ee', bumper: '#3a7a2a', lamp: '#ffe060',
    ramp: '#b08a50', rampDark: '#5a4020', wire: '#f8f4e8', sling: '#e8e8e0', slingDark: '#5a5a50', slingHi: '#ffffff', name: 'rgba(255,255,255,0.45)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Fairway orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Clubhouse scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the green: open at the bottom, its back slanted (so nothing rests on top); its right side is also the
    // first P-A-R lane post
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
    // P-A-R lane posts
    { path: [[228, 64], [228, 92]], r: 2 },
    { path: [[248, 64], [248, 92]], r: 2 },
    { path: [[268, 64], [268, 92]], r: 2 },
  ],
  posts: [{ c: [116, 126], R: 3 }, { c: [208, 126], R: 3 }],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the P-A-R lanes; a ball from the Fairway passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Buggy Path: up the right, over the P-A-R lanes and down to the right inlane
    { id: 'buggy', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  bumpers: [
    { id: 'tree1', art: 'tree', c: [52, 112], R: 12, score: 100 },
    { id: 'tree2', art: 'tree', c: [86, 94], R: 12, score: 100 },
    { id: 'tree3', art: 'tree', c: [72, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // TEE: three tee markers, slanted so nothing rests on them
  dropBanks: [
    { id: 'tee', score: 750, targets: [[tee(0), tee(0.3)], [tee(0.35), tee(0.65)], [tee(0.7), tee(1)]] },
  ],
  saucers: [
    // the Cup: the ball goes down a subway and comes back out above the flippers
    { id: 'cup', c: [162, 106], R: 22, hold: 1.4, score: 1000, exit: [110, 418], eject: { dir: [0.35, 1], speed: 200 } },
    { id: 'clubhouse', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  fields: [
    // the greenside bunker and a fairway bunker: they slow the ball down
    { id: 'bunker', kind: 'sand', c: [162, 160], R: 15, drag: 2.5, score: 100 },
    { id: 'trap', kind: 'sand', c: [176, 262], R: 13, drag: 2.5, score: 100 },
    // the wind, from the left or the right on some holes
    { id: 'gustL', kind: 'wind', c: [160, 170], R: 110, dir: [1, 0], strength: 160, lamp: 'windL' },
    { id: 'gustR', kind: 'wind', c: [160, 170], R: 110, dir: [-1, 0], strength: 160, lamp: 'windR' },
  ],
  decals: [{ art: 'flag', c: [176, 96] }],
  spinners: [{ id: 'fairway', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneP', a: [210, 82], b: [226, 82], label: 'P', marquee: true },
    { id: 'laneA', a: [230, 82], b: [246, 82], label: 'A', marquee: true },
    { id: 'laneR', a: [250, 82], b: [266, 82], label: 'R', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [218 + i * 20, 52], art: 'ball', colour: '#ffffff' })),
    { id: 'flag', c: [162, 140], art: 'lamp-flag', colour: '#ff5a5a' },
    // the scorecard: nine holes
    ...COURSE.map((_, i) => ({ id: `hole${i + 1}`, c: [110 + (i % 5) * 20 + (i >= 5 ? 10 : 0), 296 + (i >= 5 ? 16 : 0)], marquee: true, label: String(i + 1) })),
    { id: 'windL', c: [130, 196], art: 'lamp-wind', colour: '#ffffff' },
    { id: 'windR', c: [194, 196], art: 'lamp-wind', colour: '#ffffff' },
    { id: 'putting', c: [44, 360], art: 'lamp-club', colour: '#ffffff' },
    { id: 'drive', c: [72, 360], art: 'lamp-tee', colour: '#ffffff' },
    { id: 'superJp', c: [58, 380], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'xball', c: [154, 344], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'teeLit', c: [92, 252], art: 'lamp-flag', colour: '#ffd040', lit: g => (g.lamps.drive ? 2 : 0) },
    { id: 'buggyLit', c: [206, 378], art: 'lamp-card', colour: '#ffd040', lit: g => (g.player?.counts.yards && !g.lamps.flag ? 1 : 0) },
    { id: 'cup1', c: [130, 400], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'cup2', c: [151, 404], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'cup3', c: [172, 400], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'kbL', c: [27, 505], art: 'lamp-house', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-star', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'THE ROUND', items: [
      { art: 'lamp-card', text: 'PLAY NINE HOLES. EACH HAS A PAR AND A LENGTH IN YARDS, SHOWN UNDER THE SCORE.' },
      { art: 'buggy', text: 'EVERY SHOT IS A STROKE THAT CARRIES THE BALL DOWN THE FAIRWAY: THE BUGGY PATH RAMP 200 YARDS, THE ORBIT 150, THE CUP 150, THE CLUBHOUSE 80, LANES 60, TEE TARGETS 40. SPINS ROLL IT ON FOR FREE.' },
      { art: 'lamp-flag', text: 'ON THE GREEN THE FLAG LIGHTS: SHOOT THE CUP AT THE TOP TO HOLE OUT. WITHIN 150 YARDS THE CUP CHIPS STRAIGHT IN.' },
      { art: 'lamp-bird', text: 'BIG SHOTS SAVE STROKES. A BIRDIE PAYS MORE THAN A BOGEY; A HOLE IN ONE PAYS 100,000 AND AN EXTRA BALL.' },
      { art: 'lamp-trophy', text: 'FINISH THE ROUND FOR 19TH HOLE MULTIBALL: THE CUP IS A 50,000 JACKPOT.' },
    ] },
    { title: 'THE COURSE', items: [
      { art: 'lamp-sand', text: 'BUNKERS SLOW THE BALL DOWN AND COST A STROKE. THE TREES ARE THE ROUGH: THEY DON\'T GET YOU ANYWHERE.' },
      { art: 'lamp-wind', text: 'ON SOME HOLES THE WIND BLOWS THE BALL ACROSS THE TOP OF THE TABLE.' },
      { art: 'lamp-bird', text: 'THREE BIRDIES LIGHT AN EXTRA BALL AT THE CLUBHOUSE (THE SCOOP ON THE LEFT).' },
    ] },
    { title: 'DOT-MATRIX GAMES', items: [
      { art: 'lamp-club', text: 'TWENTY SPINS ON THE FAIRWAY LIGHT THE PUTTING GREEN: PRESS A FLIPPER BUTTON TO PUTT WHEN THE POWER IS RIGHT. THREE PUTTS.' },
      { art: 'lamp-tee', text: 'KNOCK DOWN THE TEE TARGETS TO LIGHT THE LONG DRIVE: PRESS LEFT, RIGHT, LEFT, RIGHT AS FAST AS YOU CAN.' },
      { art: 'lamp-star', text: 'BALL SAVE: WHILE THE STAR FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    par: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },

  script: g => ({
    start: () => { g.video = null; },
    tick: () => { puttingTick(g); driveTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, showCard, g => { g.video = null; if (g.player.counts.yards === undefined && !multi(g)) teeOff(g, true); }] },

    // skill shot: a tee shot down the middle
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', 'STRAIGHT DOWN THE MIDDLE', 'drive'], g => carry(g, 'ramp:buggy')] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // P-A-R: bonus multiplier
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:par', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['message', 'P-A-R', 'BONUS MULTIPLIER']] },

    // shots carry the ball down the fairway
    ...['ramp:buggy', 'lane:orbit', 'saucer:clubhouse', 'drop', 'spin'].map(key => ({ on: key, do: [g => carry(g, key)] })),
    ...LANES.map(id => ({ on: `lane:${id}`, do: [g => carry(g, 'lane')] })),
    { on: 'saucer:cup', do: [g => { const c = g.player.counts, hole = c.hole, chip = !g.lamps.flag && c.yards > CARRY['saucer:cup']; cup(g); if (chip && c.hole === hole) carry(g, 'saucer:cup'); }] },
    { on: 'saucer:clubhouse', do: [clubhouse] },
    { on: 'ramp:buggy', do: [['bonus', 500], g => { if (!multi(g) && !g.lamps.flag && g.player.counts.yards) g.emit('message', { text: 'BIG DRIVE', sub: `${g.player.counts.yards} YARDS TO GO`, scene: 'drive' }); }] },
    // a bunker costs a stroke
    ...['bunker', 'trap'].map(id => ({ on: `field:${id}`, if: { multiball: false }, do: [['sound', 'drop'], g => {
      const c = g.player.counts; if (c.yards === undefined || g.video) return;
      c.strokes = (c.strokes ?? 0) + 1; g.emit('message', { text: 'IN THE BUNKER', sub: 'ONE STROKE' });
    }] })),

    // the dot-matrix games read the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    // TEE lights the Long Drive; the Fairway lights the Putting Green
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:tee', do: [['score', 5000], ['lamp', 'drive', 2], ['message', 'ON THE TEE', 'LONG DRIVE AT THE CLUBHOUSE', 'drive']] },
    { on: 'spin:fairway', if: { unlit: 'putting' }, do: [['count', 'spins', 1]] },
    { on: 'spin:fairway', if: { count: ['spins', '>=', 20], unlit: 'putting' }, do: [['setCount', 'spins', 0], ['lamp', 'putting', 2], ['message', 'PUTTING GREEN', 'AT THE CLUBHOUSE']] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    { on: 'multiballEnd', do: [afterMultiball] },
  ],
};
