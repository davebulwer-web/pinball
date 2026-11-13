// The parts test table: a grey table that uses every engine part, so each can be played and tuned.
// Same frame as the feel test (playfield 8..294 wide, shooter lane 294..312), plus:
//   a plastic ramp (Big Wheel) that climbs the left side, turns and drops into the left inlane
//   a wire rail (Coaster) that climbs the right of centre, loops over the bumpers and drops into the saucer
//   a slanted bank of three drop targets in front of the saucer (Hole), which locks balls for multiball
//   a spinner in the right orbit, a kickback in the left outlane, bonus multiplier lamps
// The rules at the bottom exercise lamp groups, locks, multiball, jackpots, combos, an extra ball and a mode.

import { arcPts, joinPath } from '../../engine/geom.js';

const LANES = ['laneF', 'laneU', 'laneN'];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
// a point a fraction t along the drop bank line
const bank = t => [+(124 + 54 * t).toFixed(1), +(302 - 18 * t).toFixed(1)];

// keep the bonus multiplier lamps in step with the player's multiplier
const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));

export default {
  id: 'parts',
  name: 'Parts Test',
  tagline: 'Every engine part on one grey table.',
  workshop: true,
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 6,
  multiballSave: 10,
  nameY: 610,
  drainY: 650,
  colours: { field: '#1b2433', wall: '#9aa3b8', wallDark: '#4a5266', rubber: '#e8e8e8', bumper: '#c84a4a', lamp: '#ffcc33', ramp: '#5a7fb8', rampDark: '#2a3f66', wire: '#d8dce6' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left side: kinks in above the outlane so a ball dropping down the side usually reaches the inlane
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    // right side: orbit lane with a spinner, sloping in to the right inlane (no right outlane)
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane is between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // top lane posts
    { path: [[105, 62], [105, 92]], r: 2 },
    { path: [[136, 62], [136, 92]], r: 2 },
    { path: [[167, 62], [167, 92]], r: 2 },
    { path: [[198, 62], [198, 92]], r: 2 },
  ],
  gates: [{ a: [294, 200], b: [312, 188], oneWay: [0, -1] }],
  posts: [{ c: [151, 420], R: 3 }],

  // both mouths lean toward the opposite flipper, so the cross shots (right flipper to the ramp, left
  // flipper to the wire) go straight in; funnels catch near misses
  ramps: [
    { id: 'bigWheel', style: 'ramp', width: 20, mouth: 32, minSpeed: 300, assist: 700, score: 2000, funnel: [18, 10],
      path: joinPath([[104, 352], [86, 306], [80, 270], [80, 150]], arcPts([62, 150], 18, 0, -180, 15), [[44, 150], [44, 414]]) },
    { id: 'coaster', style: 'wire', width: 16, mouth: 30, minSpeed: 300, assist: 700, score: 1500, funnel: [18, 10],
      path: joinPath([[200, 352], [218, 306], [232, 270], [232, 150]], arcPts([191.5, 150], 40.5, 0, -180, 10), [[151, 150], [151, 222]]) },
  ],
  bumpers: [
    { id: 'bump1', c: [180, 190], R: 13, score: 100 },
    { id: 'bump2', c: [212, 218], R: 13, score: 100 },
    { id: 'bump3', c: [182, 244], R: 13, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  dropBanks: [
    { id: 'ducks', score: 500, resetDelay: 2.5, targets: [[bank(0), bank(0.3)], [bank(0.35), bank(0.65)], [bank(0.7), bank(1)]] },
  ],
  saucers: [{ id: 'hole', c: [151, 256], hold: 1.2, score: 1000, eject: { dir: [-0.55, 1], speed: 330 } }],
  spinners: [{ id: 'spinR', a: [266, 262], b: [292, 262], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneF', a: [107, 80], b: [134, 80], label: 'F' },
    { id: 'laneU', a: [138, 80], b: [165, 80], label: 'U' },
    { id: 'laneN', a: [169, 80], b: [196, 80], label: 'N' },
  ],
  inserts: [
    { id: 'kbL', c: [27, 505], r: 4, label: 'K' },
    { id: 'lock', c: [151, 322], r: 5, label: 'L' },
    { id: 'jackpot', c: [112, 390], r: 5, label: 'J', colour: '#ff5a5a' },
    { id: 'combo', c: [190, 390], r: 5, label: 'C', colour: '#5ad0ff' },
    { id: 'xball', c: [151, 396], r: 5, label: 'X', colour: '#ff9a3a' },
    { id: 'frenzy', c: [279, 296], r: 5, label: 'S', colour: '#c07aff' },
    { id: 'x2', c: [118, 466], r: 4, label: '2' },
    { id: 'x3', c: [138, 472], r: 4, label: '3' },
    { id: 'x4', c: [164, 472], r: 4, label: '4' },
    { id: 'x5', c: [184, 466], r: 4, label: '5' },
  ],

  startLamps: { kbL: 1 },
  lampGroups: { fun: { lamps: LANES, rotate: true, reset: true } },
  modes: { frenzy: { name: 'SPIN FRENZY', secs: 20, scoreX: { spin: 5 }, lamps: ['frenzy'] } },
  rules: [
    // F-U-N lanes: light all three to raise the bonus multiplier and relight the kickback
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:fun', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['lamp', 'kbL', 1], ['message', 'F-U-N', 'BONUS X UP']] },
    { on: 'serve', do: [showBonusX] },
    { on: 'kickback', do: [['message', 'KICKBACK']] },
    // drop targets light the lock; two locks start multiball
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:ducks', if: { multiball: false }, do: [['score', 2500], ['lamp', 'lock', 2], ['message', 'LOCK IS LIT']] },
    { on: 'saucer:hole', if: { lit: 'lock', multiball: false }, do: [['lamp', 'lock', 0], ['lock'], ['event', 'lockCheck']] },
    { on: 'lockCheck', if: { locks: ['>=', 2] }, do: [['multiball', 3], ['message', 'MULTIBALL']], else: [['message', 'BALL LOCKED']] },
    { on: 'multiballStart', do: [['lamp', 'jackpot', 2]] },
    { on: 'multiballEnd', do: [['lamp', 'jackpot', 0]] },
    { on: 'ramp:bigWheel', if: { lit: 'jackpot' }, do: [['jackpot', 25000], ['message', 'JACKPOT', '25,000']] },
    // ramps: bonus, combos between the two, a mode after four ramps, an extra ball after three wires
    { on: 'ramp', do: [['bonus', 500], ['lamp', 'combo', 2]] },
    { on: 'ramp:bigWheel', if: { after: ['ramp:coaster', 5] }, do: [['score', 10000], ['message', 'COMBO', '10,000']] },
    { on: 'ramp:coaster', if: { after: ['ramp:bigWheel', 5] }, do: [['score', 10000], ['message', 'COMBO', '10,000']] },
    { on: 'ramp:bigWheel', do: [['count', 'ramps', 1]] },
    { on: 'ramp:bigWheel', if: { count: ['ramps', '>=', 4], notMode: 'frenzy' }, do: [['setCount', 'ramps', 0], ['mode', 'frenzy']] },
    { on: 'ramp:coaster', do: [['count', 'wires', 1]] },
    { on: 'ramp:coaster', if: { count: ['wires', '==', 3] }, do: [['lamp', 'xball', 1], ['message', 'EXTRA BALL', 'IS LIT']] },
    { on: 'saucer:hole', if: { lit: 'xball' }, do: [['lamp', 'xball', 0], ['extraBall'], ['message', 'EXTRA BALL']] },
    { on: 'drain', do: [['lamp', 'combo', 0]] },
  ],
};
