// Race Day: a day at the races. The second real table, laid out differently from Fun Fair and using the
// parts Fun Fair doesn't: an upper flipper, a scoop with a subway, a diverter and an up-post that rise and
// fall, a race toy on the playfield, a hurry-up, a mystery award, picking with the flippers, add-a-ball and
// a super jackpot. Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top right:  B-E-T rollover lanes, fed by a soft plunge (the skill shot)
//   Top left:   the Paddock, three hay bale pop bumpers, fed by a hard plunge or the diverter
//   Left:       the Starting Gate orbit with a spinner; it comes round the top and down the right orbit
//               onto the upper flipper. The Paddock diverter at its top turns balls into the bumpers.
//               The Stables scoop sits in an alcove beside it: a subway takes the ball to a kickout
//               above the flippers.
//   Centre:     the Home Straight ramp climbs the left, crosses the top and drops onto the upper flipper.
//               W-I-N standups below it.
//   Right:      the Fences, a bank of three drop targets on the wall, and the upper flipper above them
//   Bottom:     the race track (four horses that move as the race is run), slingshots, two outlanes, and
//               the Lucky Horseshoe up-post between the flippers

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes from './scenes.js';
import music from './music.js';

const LANES = ['laneB', 'laneE', 'laneT'];
const SKILL = ['skB', 'skE', 'skT'];
const WIN = ['tgtW', 'tgtI', 'tgtN'];
const HORSES = ['horse0', 'horse1', 'horse2', 'horse3'];
const ODDS = [2, 4, 8, 16];                       // the odds on each horse, which set the prize
const SHOTS = [4, 6, 8, 10];                      // and how many shots your horse needs to finish
const RIVAL_SECS = 40;                            // about how long the other horses take to finish
const TRACK = { x0: 104, x1: 206, y: 458, gap: 9 };
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const fmt = n => n.toLocaleString('en-GB');

// ---- rule helpers ----
const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));

// ---- the race ----
// g.race: { pick, pos: [0..1 x 4], running, picking } on the game, for the toy and the rules
const newRace = () => ({ pick: 0, pos: [0, 0, 0, 0], running: false, picking: false });
const pickedHorse = g => Math.max(0, HORSES.findIndex(id => g.lamps[id]));

// at the Stables: hold the ball while the flippers pick a horse, then the race starts
const pickHorse = g => {
  g.race = newRace(); g.race.picking = true;
  HORSES.forEach((id, i) => (g.lamps[id] = i === 0 ? 2 : 0));
  g.lamps.race = 0;
  g.holdSaucer('stables', 4.5);
  g.emit('message', { text: 'PICK YOUR HORSE', sub: 'FLIPPERS CHOOSE', scene: 'gate' });
  g.after(4.2, () => startRace(g));
};
// while picking, each flipper press shows the horse now chosen and its odds
const showPick = g => {
  if (!g.race?.picking) return;
  const i = pickedHorse(g);
  g.emit('message', { text: `${['RED', 'BLUE', 'YELLOW', 'WHITE'][i]} ${ODDS[i]} TO 1`, sub: `WIN ${fmt(10000 * ODDS[i])}`, sound: 'lane', now: true });
};
const startRace = g => {
  const r = g.race; if (!r?.picking) return;
  r.picking = false; r.running = true; r.pick = pickedHorse(g);
  HORSES.forEach(id => (g.lamps[id] = 0));      // (so the flippers stop moving the pick)
  g.emit('message', { text: `${ODDS[r.pick]} TO 1`, sub: "THEY'RE OFF", scene: 'gallop', sound: 'modeStart' });
  g.rules.startMode('race');
  // the other horses run on their own, each at its own pace with a little luck
  const pace = [0.95, 1.05, 1.0, 1.1].map(k => k / RIVAL_SECS);
  const step = () => {
    if (g.race !== r || !r.running) return;
    r.pos.forEach((p, i) => { if (i !== r.pick) r.pos[i] = Math.min(1, p + pace[i] * 0.25 * (0.6 + Math.random() * 0.8)); });
    if (r.pos.some((p, i) => i !== r.pick && p >= 1)) return finishRace(g, false);
    g.after(0.25, step);
  };
  g.after(0.6, step);
};
// a big shot moves your horse on
const gallop = g => {
  const r = g.race; if (!r?.running) return;
  r.pos[r.pick] = Math.min(1, r.pos[r.pick] + 1 / SHOTS[r.pick]);
  if (r.pos[r.pick] >= 1) finishRace(g, true);
  else g.emit('sound', { name: 'lane' });
};
const finishRace = (g, won) => {
  const r = g.race; r.running = false;
  g.rules.endMode('race', true);
  HORSES.forEach(id => (g.lamps[id] = 0));
  if (won) {
    const prize = 10000 * ODDS[r.pick];
    g.addScore(prize);
    g.player.counts.wins = (g.player.counts.wins ?? 0) + 1;
    g.lamps[`trophy${Math.min(3, g.player.counts.wins)}`] = 1;
    g.emit('message', { text: 'WINNER', sub: fmt(prize), scene: 'photo', sound: 'jackpot' });
    if (g.player.counts.wins % 2 === 0) { g.lamps.gn = 2; g.emit('message', { text: 'GRAND NATIONAL', sub: 'IS LIT' }); }
  } else {
    const place = 1 + r.pos.filter((p, i) => i !== r.pick && p > r.pos[r.pick]).length;
    const prize = place === 2 ? 10000 : place === 3 ? 5000 : 0;
    g.addScore(prize);
    g.emit('message', { text: place === 4 ? 'ALSO RAN' : `PLACED ${['', '1ST', '2ND', '3RD'][place]}`, sub: prize ? fmt(prize) : 'BETTER LUCK NEXT TIME', sound: 'modeEnd' });
  }
  g.after(3, () => { if (g.race === r) g.race = newRace(); });
};

// the Stables scoop: the first thing lit wins
const stables = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 200000], ['message', 'SUPER JACKPOT', '200,000', 'photo']]); return; }
  if (g.lamps.gn && g.liveBalls() <= 1) { g.lamps.gn = 0; g.rules.act([['multiball', 3], ['message', 'GRAND NATIONAL', 'MULTIBALL', 'gallop']]); return; }
  if (g.lamps.race && !g.race?.running && !g.race?.picking && g.liveBalls() <= 1) return pickHorse(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  if (g.lamps.tip) { g.lamps.tip = 0; g.rules.act([['mystery', MYSTERY]]); return; }
  g.addScore(2500);
};

const horseshoe = g => { g.setPost('horseshoe', true); g.lamps.shoe = 2; g.after(20, () => { g.setPost('horseshoe', false); g.lamps.shoe = 0; }); };
const MYSTERY = [
  { text: "BOOKIE'S TIP", sub: '25,000', do: [['score', 25000]], weight: 3 },
  { text: 'LUCKY HORSESHOE', sub: 'CENTRE POST UP', do: [horseshoe], weight: 2 },
  { text: 'BALL SAVE', sub: '15 SECONDS', do: [['ballSave', 15]], weight: 2 },
  { text: 'BONUS X', sub: 'ADVANCED', do: [['bonusX', 1], showBonusX], weight: 2 },
  { text: 'PADDOCK', sub: 'IS OPEN', do: [['post', 'diverter', 1], ['lamp', 'paddock', 2]], weight: 1, if: { notMode: 'paddock' } },
  { text: 'GALLOP', sub: 'HORSE MOVES ON', do: [gallop], weight: 2, if: { mode: 'race' } },
  { text: 'EXTRA BALL', sub: 'IS LIT', do: [['lamp', 'xball', 2]], weight: 0.5, if: { unlit: 'xball' } },
];

// the Fences: each clear round starts the Jump Off hurry-up at the Home Straight; the third lights an extra ball
const clearRound = g => {
  const n = g.player.counts.fences;
  g.rules.startMode('jumpOff');
  g.emit('message', { text: 'CLEAR ROUND', sub: 'JUMP OFF: SHOOT THE RAMP', scene: 'fences' });
  if (n === 3) { g.lamps.xball = 2; g.emit('message', { text: 'EXTRA BALL', sub: 'IS LIT AT THE STABLES' }); }
};

// Grand National jackpots: the Home Straight scores them, the Starting Gate relights; three light the super
const jackpot = g => {
  g.lamps.jackpot = 0;
  g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', '50,000', 'photo']]);
  g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
  if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'SUPER JACKPOT', sub: 'IS LIT AT THE STABLES' }); }
};

export default {
  id: 'raceday',
  name: 'Race Day',
  tagline: 'Pick a horse at the Stables and ride the Home Straight to win the Grand National.',
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 8,
  multiballSave: 12,
  nameY: 612,
  drainY: 650,
  scenes,   // dot-matrix animations (scenes.js)
  music,    // chiptune theme (music.js)
  colours: { field: '#16301c', wall: '#d8dce4', wallDark: '#3a4250', wallHi: '#ffffff', rubber: '#f2ead6', bumper: '#d8a040', lamp: '#ffd040',
    ramp: '#2f7a3a', rampDark: '#173f1e', wire: '#f0e8d0', sling: '#e8e2d0', slingDark: '#4a2a12', slingHi: '#ffffff', name: 'rgba(255,220,120,0.5)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
    // the upper flipper, at the foot of the right orbit, aims across at the Stables
    { id: 'flipU', side: 'right', pivot: [268, 318], length: 34, rest: 34, up: -18 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Starting Gate orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 300]], r: 2 },
    // the Stables: a scoop up the right of centre, with a backstop round its far side
    { path: arcPts([184, 262], 19, 190, 350, 16), r: 2 },
    // right: the shooter lane, then the right orbit coming down onto the upper flipper
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[272, 200], [272, 276]], r: 2 },
    // the orbit floor slopes onto the upper flipper; under it the right side slopes in to the inlane and outlane
    { path: [[294, 288], [272, 306], [277, 326], [290, 338], [282, 394], [282, 650]] },
    // inlane guides: outlanes between x 20..34 and 268..282
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // B-E-T lane posts
    { path: [[172, 64], [172, 92]], r: 2 },
    { path: [[198, 64], [198, 92]], r: 2 },
    { path: [[224, 64], [224, 92]], r: 2 },
    { path: [[250, 64], [250, 92]], r: 2 },
    // the Fences sit against this wall
    { path: [[262, 340], [252, 420]], r: 2 },
    // the Paddock diverter at the top of the Starting Gate: when up, it turns balls into the bumpers
    // (solid only from below, so a ball dropping onto it from above falls through)
    { id: 'diverter', path: [[9, 152], [36, 128]], r: 2, down: true, oneWay: [0.66, 0.75] },
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    // top of the Starting Gate: up but not back down, slanted so nothing rests on it
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge coming round from the right bounces back into the B-E-T lanes; a ball
    // going round from the Starting Gate passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],
  // the Lucky Horseshoe up-post between the flippers (raised by a mystery award)
  posts: [{ id: 'horseshoe', c: [151, 600], R: 4, down: true }],

  ramps: [
    // the Home Straight: climbs the left of centre, over the top, and drops onto the upper flipper
    { id: 'home', style: 'ramp', width: 20, mouth: 30, minSpeed: 300, assist: 700, score: 2000, funnel: [16, 8],
      path: joinPath([[124, 356], [112, 306], [108, 240], [108, 172]], arcPts([160, 172], 52, 180, 360, 12), [[212, 172], [222, 230], [246, 286]]) },
  ],
  bumpers: [
    { id: 'bale1', art: 'bale', c: [52, 112], R: 12, score: 100 },
    { id: 'bale2', art: 'bale', c: [84, 92], R: 12, score: 100 },
    { id: 'bale3', art: 'bale', c: [70, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  dropBanks: [
    { id: 'fences', score: 750, targets: [[[260, 346], [258, 364]], [[257, 370], [255, 388]], [[254, 394], [252, 412]]] },
  ],
  saucers: [{ id: 'stables', c: [184, 262], R: 11, hold: 1.0, score: 1000, exit: [151, 436], eject: { dir: [0.3, 1], speed: 200 } }],
  // W-I-N: three standups under the Paddock, facing the upper flipper
  targets: WIN.map((id, i) => ({ id, a: [54 + i * 15, 214 - i * 4], b: [66 + i * 15, 211 - i * 4], score: 500 })),
  spinners: [{ id: 'spinner', a: [10, 260], b: [36, 260], score: 100 }],
  lanes: [
    { id: 'laneB', a: [174, 82], b: [196, 82], label: 'B', marquee: true },
    { id: 'laneE', a: [200, 82], b: [222, 82], label: 'E', marquee: true },
    { id: 'laneT', a: [226, 82], b: [248, 82], label: 'T', marquee: true },
    { id: 'orbit', a: [274, 250], b: [292, 250], score: 1000 },
  ],
  inserts: [
    // lamps are Pixellab pictures (lit, or darkened when off); W-I-N and the multipliers are bulb letters
    ...SKILL.map((id, i) => ({ id, c: [185 + i * 26, 116], art: 'lamp-flag', colour: '#ffffff' })),
    { id: 'race', c: [184, 293], art: 'lamp-horse', colour: '#ffd040' },
    { id: 'tip', c: [165, 302], art: 'lamp-tip', colour: '#5ad0ff' },
    { id: 'gn', c: [203, 302], art: 'lamp-rosette', colour: '#ff5a5a' },
    { id: 'superJp', c: [184, 312], art: 'lamp-coins', colour: '#ffffff' },
    { id: 'xball', c: [151, 416], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'jackpot', c: [126, 374], art: 'lamp-coins', colour: '#ffcc33' },
    { id: 'jumpOff', c: [144, 384], art: 'lamp-hurdle', colour: '#5aff8a' },
    { id: 'paddock', c: [26, 112], art: 'lamp-hay', colour: '#c07aff' },
    ...WIN.map((id, i) => ({ id, c: [60 + i * 15, 227 - i * 4], marquee: true, label: 'WIN'[i] })),
    { id: 'trophy1', c: [133, 526], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'trophy2', c: [151, 530], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'trophy3', c: [169, 526], art: 'lamp-trophy', colour: '#ffd040' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-cap', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
    { id: 'shoe', c: [151, 584], art: 'lamp-shoe', colour: '#ffd040' },
  ],
  // the instructions screen (after the controls page): the goals, with the lamp that shows each one
  instructions: [
    { title: 'RACE DAY', items: [
      { marquee: 'B', text: 'LIGHT B-E-T IN THE TOP LANES TO LIGHT A RACE AT THE STABLES (THE SCOOP UP THE RIGHT). THEY ALSO RAISE THE BONUS MULTIPLIER.' },
      { art: 'lamp-horse', text: 'AT THE STABLES, PICK YOUR HORSE WITH THE FLIPPERS. LONGER ODDS PAY MORE BUT NEED MORE SHOTS.' },
      { art: 'horse2', text: 'IN THE RACE, THE HOME STRAIGHT RAMP AND THE ORBITS MOVE YOUR HORSE ON. BEAT THE OTHERS TO THE POST TO WIN 10,000 TIMES THE ODDS.' },
      { art: 'lamp-trophy', text: 'EVERY TWO WINS LIGHT THE GRAND NATIONAL.' },
    ] },
    { title: 'GRAND NATIONAL', items: [
      { art: 'lamp-rosette', text: 'SHOOT THE STABLES TO START 3-BALL MULTIBALL.' },
      { art: 'lamp-coins', text: 'THE HOME STRAIGHT SCORES A 50,000 JACKPOT. THE STARTING GATE SPINNER RELIGHTS IT. THREE JACKPOTS LIGHT THE 200,000 SUPER JACKPOT AT THE STABLES.' },
      { marquee: 'W', text: 'COMPLETE W-I-N DURING MULTIBALL TO ADD ANOTHER BALL.' },
    ] },
    { title: 'AROUND THE COURSE', items: [
      { art: 'lamp-hurdle', text: 'CLEAR ROUND: KNOCK DOWN THE THREE FENCES, THEN SHOOT THE HOME STRAIGHT FOR THE JUMP OFF, 40,000 FALLING TO 10,000.' },
      { art: 'lamp-tip', text: "W-I-N LIGHTS THE BOOKIE'S TIP AT THE STABLES: A MYSTERY AWARD." },
      { art: 'lamp-hay', text: 'FIFTEEN SPINS RAISE THE PADDOCK GATE. THE NEXT ORBIT GOES INTO THE BUMPERS FOR 20 SECONDS OF BUMPERS X10.' },
      { art: 'lamp-shoe', text: 'AFTER THE PADDOCK, THE LUCKY HORSESHOE POST RISES BETWEEN THE FLIPPERS FOR 20 SECONDS.' },
      { art: 'lamp-cap', text: 'BALL SAVE: WHILE THE CAP FLASHES, A LOST BALL IS SERVED AGAIN. THIRD CLEAR ROUND LIGHTS AN EXTRA BALL.' },
    ] },
  ],

  // the race: four horses on the track above the flippers
  toys: HORSES.map((id, i) => ({
    art: `horse${i}`, colour: ['#ff5a5a', '#5ad0ff', '#ffd040', '#ffffff'][i],
    at: (g, t) => {
      const r = g.race, p = r?.pos[i] ?? 0;
      const bob = r?.running ? Math.round(Math.sin(t * 14 + i * 2) * 0.8) : 0;
      if (r?.picking && g.lamps[id] && Math.floor(t * 6) % 2) return null;   // the one being picked flashes
      return [TRACK.x0 + (TRACK.x1 - TRACK.x0) * p, TRACK.y + i * TRACK.gap + bob];
    },
  })),

  startLamps: {},
  lampGroups: {
    bet: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
    horses: { lamps: HORSES, rotate: true },
    win: { lamps: WIN, reset: true },
  },
  modes: {
    race: { name: 'RACE', secs: 90 },
    jumpOff: { name: 'JUMP OFF', secs: 20, hurry: [40000, 10000], lamps: ['jumpOff'] },
    paddock: { name: 'PADDOCK', secs: 20, scoreX: { bumper: 10 }, lamps: ['paddock'] },
  },

  script: g => ({ start: () => { g.race = newRace(); } }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, g => { if (g.race?.running) finishRace(g, false); g.race = newRace(); HORSES.forEach(id => (g.lamps[id] = 0)); }] },
    { on: 'drain', do: [g => { if (g.race?.running) { g.race.running = false; g.emit('message', { text: 'RACE VOID' }); } }] },

    // skill shot: the lit lane straight off the plunger
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', '15,000'], ['lamp', 'race', 2]] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // B-E-T lanes raise the bonus multiplier and light the race
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:bet', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['message', 'BETS ARE ON', 'RACE IS LIT'], g => { if (!g.race?.running) g.lamps.race = 2; }] },

    // the Stables scoop; while a horse is being picked, the flippers move the pick
    { on: 'saucer:stables', do: [stables] },
    { on: 'flip', do: [showPick] },

    // big shots move your horse on in a race
    { on: ['ramp:home', 'lane:orbit'], do: [gallop] },
    { on: 'ramp', do: [['bonus', 500]] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    // the Fences
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:fences', do: [['count', 'fences', 1], clearRound] },
    { on: 'ramp:home', if: { mode: 'jumpOff' }, do: [['collect', 'jumpOff', 'JUMP OFF']] },

    // W-I-N lights the Bookie's Tip at the Stables; in the Grand National it adds a ball (once)
    ...WIN.map(id => ({ on: `hit:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:win', if: { multiball: false }, do: [['lamp', 'tip', 2], ['message', "BOOKIE'S TIP", 'AT THE STABLES']] },
    { on: 'complete:win', if: { multiball: true, count: ['addBall', '<', 1] }, do: [['count', 'addBall', 1], ['addBall', 1]] },

    // the Paddock: 15 spins at the Starting Gate raise the diverter; a ball turned into the bumpers starts
    // Paddock, bumpers x10 for 20 seconds
    { on: 'spin:spinner', if: { notMode: 'paddock', unlit: 'paddock' }, do: [['count', 'spins', 1]] },
    { on: 'spin:spinner', if: { count: ['spins', '>=', 15], unlit: 'paddock' }, do: [['setCount', 'spins', 0], ['post', 'diverter', 1], ['lamp', 'paddock', 2], ['message', 'PADDOCK', 'IS OPEN']] },
    { on: 'bumper', if: { lit: 'paddock', notMode: 'paddock' }, do: [['post', 'diverter', 0], ['mode', 'paddock']] },
    { on: 'modeEnd:paddock', do: [horseshoe, ['message', 'LUCKY HORSESHOE', 'CENTRE POST UP']] },

    // the Grand National: 3-ball multiball; the Home Straight scores jackpots, the Starting Gate relights them
    { on: 'multiballStart', do: [['lamp', 'jackpot', 2], ['setCount', 'addBall', 0]] },
    { on: 'ramp:home', if: { lit: 'jackpot', multiball: true }, do: [jackpot] },
    { on: 'spin:spinner', if: { multiball: true, unlit: 'jackpot' }, do: [['lamp', 'jackpot', 2]] },
    { on: 'multiballEnd', do: [['lamp', ['jackpot', 'superJp'], 0]] },
  ],
};
