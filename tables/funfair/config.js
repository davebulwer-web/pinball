// Fun Fair (grey box): the first real table. Layout and rules from the plan, with placeholder drawing.
// Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top:    F-U-N rollover lanes with a skill shot, three dodgem pop bumpers below them
//   Left:   the Big Wheel ramp (climbs the left, turns over the top and drops to the left inlane), and
//           the spinner lane, a left orbit that comes round the top and down the right orbit
//   Centre: Hook a Duck, a slanted bank of four drop targets, with the Big Top saucer behind it
//   Right:  the Rollercoaster wire rail (climbs the right, turns and drops to the right inlane), with the
//           Coconut Shy standup beside its entry
//   Bottom: slingshots, inlanes, a left outlane with a kickback, ball save and bonus multiplier lamps
// The two ramps feed each other: the Big Wheel drops the ball to the left flipper, which shoots the
// Rollercoaster; that drops it to the right flipper, which shoots the Big Wheel. That loop is the combo.

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes from './scenes.js';
import music from './music.js';

const LANES = ['laneF', 'laneU', 'laneN'];
const SKILL = ['skF', 'skU', 'skN'];
const RIDES = ['ride1', 'ride2', 'ride3', 'ride4', 'ride5'];
const COCO = ['coco1', 'coco2', 'coco3'];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
// a point a fraction t along the duck bank, which slants up to the right so a ball can't rest on top
const duck = t => [+(104 + 94 * t).toFixed(1), +(322 - 22 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');

// ---- rule helpers (functions, for the few things the rule actions don't cover) ----
const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));

// light the next ride ticket; the fifth opens the Big Top (lights the lock)
const rideTicket = g => {
  if (g.liveBalls() > 1 || g.lamps.lock) return;
  const i = RIDES.findIndex(id => !g.lamps[id]);
  if (i < 0) return;
  g.lamps[RIDES[i]] = 1;
  if (i === RIDES.length - 1) { g.lamps.lock = 2; g.emit('message', { text: 'BIG TOP', sub: 'IS OPEN', scene: 'curtain' }); }
  else g.emit('message', { text: 'RIDE TICKET', sub: `${i + 1} OF ${RIDES.length}` });
};

// Hook a Duck: the first bank lights the extra ball, later banks give a growing award
const hookADuck = g => {
  const n = g.player.counts.ducks;
  if (n === 1) { g.lamps.xball = 2; g.emit('message', { text: 'HOOK A DUCK', sub: 'EXTRA BALL LIT', scene: 'ducks' }); return; }
  const award = 5000 * (n - 1);
  g.addScore(award);
  g.emit('message', { text: 'HOOK A DUCK', sub: fmt(award), scene: 'ducks' });
};

// the combo window: the Big Wheel lights the Rollercoaster for 5 seconds
const COMBO_SECS = 5;
const openCombo = g => {
  const t = g.world.time; g.comboAt = t; g.lamps.combo = 2;
  g.after(COMBO_SECS, () => { if (g.comboAt === t) g.lamps.combo = 0; });
};
// Coaster combo: 10,000, doubling with each repeat on the same ball
const coasterCombo = g => {
  const n = g.player.counts.combo ?? 0, award = 10000 * 2 ** n;
  g.addScore(award);
  g.player.counts.combo = n + 1;
  g.emit('message', { text: n ? `COMBO X${n + 1}` : 'COASTER COMBO', sub: fmt(award), scene: 'coaster' });
};

// Coconut Shy: three hits relight the kickback (or score, if it is already lit)
const coconut = g => {
  const n = g.player.counts.coco ?? 0;
  COCO.forEach((id, i) => (g.lamps[id] = i < n ? 1 : 0));
  if (n < 3) return;
  g.player.counts.coco = 0;
  COCO.forEach(id => (g.lamps[id] = 2));
  g.after(0.8, () => COCO.forEach(id => (g.lamps[id] = 0)));
  if (g.lamps.kbL) { g.addScore(25000); g.emit('message', { text: 'COCONUT SHY', sub: '25,000' }); }
  else { g.lamps.kbL = 1; g.emit('message', { text: 'COCONUT SHY', sub: 'KICKBACK LIT' }); }
};

// skill shot: one lane is lit at each serve (the flippers move it); it goes out at the first other score
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));

export default {
  id: 'funfair',
  name: 'Fun Fair',
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 8,
  multiballSave: 12,
  nameY: 610,
  drainY: 650,
  // red and gold with chrome rails, over the night fairground backdrop (tables/funfair/art)
  colours: { field: '#141a33', wall: '#d4d8e2', wallDark: '#3a3f52', wallHi: '#ffffff', rubber: '#f0e6d0', bumper: '#d84040', lamp: '#ffcc33',
    ramp: '#c0392b', rampDark: '#6e1a14', wire: '#f2e2b0', sling: '#d83a2a', slingDark: '#6e1a14', slingHi: '#ffcf4a', name: 'rgba(255,204,51,0.55)' },
  decals: [{ art: 'ghost', c: [23, 236] }],
  // bulbs round the top arch and down the outer walls
  bulbs: { spacing: 9, paths: [joinPath([[14, 330], [14, 160]], arcPts([160, 160], 146, 180, 360, 4), [[306, 160], [306, 182]])] },
  scenes,   // dot-matrix animations (scenes.js)
  music,    // chiptune theme (music.js)

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left side: the spinner lane runs up between the wall and a guide; below it the wall kinks in so a
    // ball dropping down the side usually reaches the inlane
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 318]], r: 2 },
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    // right orbit: the spinner lane's return, sloping in to the right inlane (no right outlane)
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane is between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // top lane posts
    // the Big Top: an alcove behind the ducks that funnels a ball into the saucer at its back
    { path: joinPath([[105, 319], [135, 272]], arcPts([151, 266], 16, 160, 380, 20), [[167, 272], [197, 297]]) },
    { path: [[105, 62], [105, 92]], r: 2 },
    { path: [[136, 62], [136, 92]], r: 2 },
    { path: [[167, 62], [167, 92]], r: 2 },
    { path: [[198, 62], [198, 92]], r: 2 },
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    // top of the spinner lane: a ball can go up it but not come back down; slanted so nothing rests on it
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a ball going round to the right passes, one coming round from the plunger or the
    // right orbit bounces back into the top lanes
    { a: [100, 20], b: [106, 44], oneWay: [0.97, -0.24] },
  ],
  posts: [{ c: [151, 420], R: 3 }],

  // each mouth leans toward the opposite flipper, so the cross shots go straight in; funnels catch near misses
  ramps: [
    { id: 'bigWheel', style: 'ramp', width: 20, mouth: 30, minSpeed: 300, assist: 700, score: 2000, funnel: [16, 8],
      path: joinPath([[104, 352], [86, 306], [80, 270], [80, 150]], arcPts([62, 150], 18, 0, -180, 15), [[44, 150], [44, 414]]) },
    { id: 'coaster', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  // the dodgems
  bumpers: [
    { id: 'dodgem1', c: [124, 160], R: 13, score: 100, art: 'dodgem-red' },
    { id: 'dodgem2', c: [178, 160], R: 13, score: 100, art: 'dodgem-blue' },
    { id: 'dodgem3', c: [151, 198], R: 13, score: 100, art: 'dodgem-yellow' },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  dropBanks: [
    { id: 'ducks', art: 'duck', score: 500, resetDelay: null, targets: [[duck(0), duck(0.22)], [duck(0.26), duck(0.48)], [duck(0.52), duck(0.74)], [duck(0.78), duck(1)]] },
  ],
  saucers: [{ id: 'bigTop', c: [151, 268], R: 10, hold: 1.2, score: 1000, eject: { dir: [-0.3, 1], speed: 330 } }],
  targets: [{ id: 'coconut', art: 'coconut', a: [236, 356], b: [248, 342], score: 500 }],
  spinners: [{ id: 'spinner', a: [10, 270], b: [36, 270], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneF', a: [107, 80], b: [134, 80], label: 'F', marquee: true },
    { id: 'laneU', a: [138, 80], b: [165, 80], label: 'U', marquee: true },
    { id: 'laneN', a: [169, 80], b: [196, 80], label: 'N', marquee: true },
    // a rollover in the right orbit, so a shot round the top scores
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  // lamps are Pixellab pictures (lit, or darkened when off); the multiplier lamps are bulb numbers
  inserts: [
    { id: 'skF', c: [120, 117], art: 'lamp-star', colour: '#ffffff' },
    { id: 'skU', c: [151, 117], art: 'lamp-star', colour: '#ffffff' },
    { id: 'skN', c: [182, 117], art: 'lamp-star', colour: '#ffffff' },
    { id: 'ghostMode', c: [23, 300], art: 'lamp-ghost', colour: '#c07aff' },
    { id: 'kbL', c: [27, 505], art: 'lamp-arrow', colour: '#ff5a5a' },
    { id: 'lock', c: [140, 338], art: 'lamp-tent', colour: '#ff5a5a' },
    { id: 'jackpot', c: [162, 338], art: 'lamp-coins', colour: '#ffcc33' },
    { id: 'xball', c: [151, 357], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'ghost', c: [151, 376], art: 'lamp-ghost', colour: '#c07aff' },
    { id: 'combo', c: [208, 384], art: 'lamp-car', colour: '#5ad0ff' },
    { id: 'coco1', c: [238, 370], art: 'lamp-coco', colour: '#8ad05a' },
    { id: 'coco2', c: [248, 378], art: 'lamp-coco', colour: '#8ad05a' },
    { id: 'coco3', c: [258, 386], art: 'lamp-coco', colour: '#8ad05a' },
    ...RIDES.map((id, i) => ({ id, c: [115 + i * 18, 397 + Math.abs(i - 2) * -3 + 6], art: 'lamp-ticket', colour: '#ffcc33' })),
    { id: 'x2', c: [118, 466], marquee: true, label: '2' },
    { id: 'x3', c: [138, 472], marquee: true, label: '3' },
    { id: 'x4', c: [164, 472], marquee: true, label: '4' },
    { id: 'x5', c: [184, 466], marquee: true, label: '5' },
    { id: 'save', c: [151, 508], art: 'lamp-buoy', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],

  // the instructions screen (after the controls page): the goals, with the lamp that shows each one
  instructions: [
    { title: 'THE BIG TOP', items: [
      { art: 'lamp-ticket', text: 'EACH RAMP, RAIL OR DUCK BANK LIGHTS A RIDE TICKET. FIVE TICKETS OPEN THE BIG TOP.' },
      { art: 'lamp-tent', text: 'WHILE THE BIG TOP IS OPEN, SHOOT THROUGH THE DUCKS INTO IT TO LOCK A BALL. LOCK TWO TO START 3-BALL MULTIBALL.' },
      { art: 'lamp-coins', text: 'IN MULTIBALL EVERY RAMP LIGHTS THE JACKPOT. COLLECT IT IN THE BIG TOP FOR 50,000.' },
    ] },
    { title: 'FAIRGROUND GAMES', items: [
      { art: 'duck', text: "HOOK A DUCK: KNOCK DOWN ALL FOUR DUCKS. THEY STAY DOWN UNTIL A BALL GOES IN THE BIG TOP." },
      { art: 'lamp-xball', text: 'THE FIRST HOOK A DUCK LIGHTS AN EXTRA BALL: COLLECT IT IN THE BIG TOP. AFTER THAT IT PAYS 5,000, 10,000 AND UP.' },
      { art: 'lamp-car', text: 'COASTER COMBO: THE BIG WHEEL THEN THE ROLLERCOASTER WITHIN 5 SECONDS. 10,000, DOUBLING EACH TIME.' },
      { art: 'lamp-coco', text: 'COCONUT SHY: HIT IT THREE TIMES TO RELIGHT THE KICKBACK.' },
    ] },
    { title: 'LANES AND RIDES', items: [
      { art: 'lamp-star', text: 'SKILL SHOT: LAUNCH INTO THE LANE WITH THE LIT STAR FOR 10,000. THE FLIPPERS MOVE THE STAR.' },
      { marquee: 'F', text: 'LIGHT F-U-N IN THE TOP LANES TO RAISE THE BONUS MULTIPLIER, UP TO X5.' },
      { art: 'lamp-ghost', text: 'GHOST TRAIN: 20 SPINS IN THE LEFT LANE LIGHT IT. START IT IN THE BIG TOP FOR 30 SECONDS OF SPINNER X5.' },
      { art: 'lamp-arrow', text: 'WHILE THE ARROW IS LIT, THE KICKBACK FIRES A BALL BACK OUT OF THE LEFT OUTLANE.' },
      { art: 'lamp-buoy', text: 'BALL SAVE: WHILE THE LIFEBUOY FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    fun: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },
  modes: { ghost: { name: 'GHOST TRAIN', secs: 30, scoreX: { spin: 5 }, lamps: ['ghostMode'] } },

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, ['setCount', 'combo', 0]] },

    // skill shot: the lit lane straight off the plunger
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 10000], ['message', 'SKILL SHOT', '10,000']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer', 'kickback'], do: [['lamp', SKILL, 0]] },

    // F-U-N lanes raise the bonus multiplier
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:fun', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['message', 'F-U-N', 'BONUS X UP']] },

    // ride tickets: each ramp, rail or duck bank lights one; five open the Big Top
    { on: ['ramp', 'bankDown:ducks'], do: [rideTicket] },

    // Big Top multiball: lock two balls in the saucer while it is open
    { on: 'saucer:bigTop', if: { lit: 'lock', multiball: false }, do: [['lock'], ['event', 'lockCheck']] },
    { on: 'lockCheck', if: { locks: ['>=', 2] }, do: [['lamp', 'lock', 0], ['lamp', RIDES, 0], ['multiball', 3], ['message', 'BIG TOP', 'MULTIBALL', 'curtain']],
      else: [['message', 'BALL LOCKED', '1 MORE FOR MULTIBALL']] },
    // in multiball each ramp lights the jackpot, collected at the Big Top
    { on: 'multiballStart', do: [['lamp', 'jackpot', 0], ['dropBank', 'ducks']] },
    { on: 'ramp', if: { multiball: true, unlit: 'jackpot' }, do: [['lamp', 'jackpot', 2], ['message', 'JACKPOT', 'IS LIT']] },
    { on: 'saucer:bigTop', if: { lit: 'jackpot' }, do: [['lamp', 'jackpot', 0], ['jackpot', 50000], ['message', 'JACKPOT', '50,000']] },
    { on: 'multiballEnd', do: [['lamp', 'jackpot', 0], ['resetBank', 'ducks']] },

    // Hook a Duck
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:ducks', do: [['count', 'ducks', 1], hookADuck] },
    { on: 'saucer:bigTop', if: { lit: 'xball' }, do: [['lamp', 'xball', 0], ['extraBall'], ['message', 'EXTRA BALL']] },

    // Coaster combo
    { on: 'ramp', do: [['bonus', 500]] },
    { on: 'ramp:coaster', if: { after: ['ramp:bigWheel', COMBO_SECS] }, do: [coasterCombo] },
    { on: 'ramp:coaster', do: [['lamp', 'combo', 0]] },
    { on: 'ramp:bigWheel', do: [openCombo] },

    // Coconut Shy
    { on: 'hit:coconut', do: [['count', 'coco', 1], coconut] },
    { on: 'kickback', do: [['message', 'KICKBACK']] },

    // Ghost Train: 20 spins light it at the Big Top; it runs 30 seconds with the spinner scoring x5
    { on: 'spin:spinner', if: { unlit: 'ghost', notMode: 'ghost' }, do: [['count', 'spins', 1]] },
    { on: 'spin:spinner', if: { count: ['spins', '>=', 20] }, do: [['setCount', 'spins', 0], ['lamp', 'ghost', 2], ['message', 'GHOST TRAIN', 'IS LIT']] },
    { on: 'saucer:bigTop', if: { lit: 'ghost', notMode: 'ghost' }, do: [['lamp', 'ghost', 0], ['mode', 'ghost']] },

    // the ducks stay down (the Big Top open) until a ball goes in; they come back up once it has been
    // kicked out past them (in multiball they stay down for the jackpots)
    { on: 'saucer:bigTop', if: { multiball: false }, do: [g => g.after(1.6, () => { if (g.liveBalls() <= 1 && !g.launchQueue) g.resetBank('ducks'); })] },
  ],
};
