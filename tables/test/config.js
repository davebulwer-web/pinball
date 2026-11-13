// The feel test table: a plain grey table for tuning the ball, flippers, plunger and camera before any
// art. Playfield is 8..294 wide (centre x 151), the shooter lane is 294..312 on the right.

const mirror = ([x, y]) => [302 - x, y];        // reflect a point across the playfield centre line
const mirrorAll = pts => pts.map(mirror);

const leftGuide = [[34, 432], [34, 500], [101, 556]];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const LANES = ['laneF', 'laneU', 'laneN'];

export default {
  id: 'test',
  name: 'Feel Test',
  tagline: 'Ball, flippers and plunger, for tuning the feel.',
  workshop: true,
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 6,
  drainY: 650,
  colours: { field: '#1d2438', wall: '#9aa3b8', wallDark: '#4a5266', rubber: '#e8e8e8', bumper: '#c84a4a', lamp: '#ffcc33' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },

  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },          // the top of the cabinet
    // sides: below the orbits they slope in to the inlane guides, so a ball from an orbit feeds an inlane
    // (no outlanes on this table)
    { path: [[8, 160], [8, 650]] },
    { path: [[8, 350], [34, 432]] },
    { path: [[312, 160], [312, 650]] },                               // right side (outside of the shooter lane)
    { path: [[294, 205], [294, 650]] },                               // shooter lane inner wall
    { path: [[294, 350], [268, 432]] },
    // orbit lanes down each side
    { path: [[38, 190], [38, 330]], r: 2 },
    { path: [[264, 190], [264, 330]], r: 2 },
    // inlane guides
    { path: leftGuide },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // peaked back of the target bank
    { path: [[119, 345], [151, 330], [183, 345]] },
    // top lane posts
    { path: [[105, 62], [105, 92]], r: 2 },
    { path: [[136, 62], [136, 92]], r: 2 },
    { path: [[167, 62], [167, 92]], r: 2 },
    { path: [[198, 62], [198, 92]], r: 2 },
  ],
  // stop a ball dropping back into the shooter lane from the playfield
  gates: [{ a: [294, 200], b: [312, 188], oneWay: [0, -1] }],
  posts: [{ c: [151, 420], R: 3 }],
  bumpers: [
    { id: 'bump1', c: [115, 215], R: 13, score: 100 },
    { id: 'bump2', c: [187, 215], R: 13, score: 100 },
    { id: 'bump3', c: [151, 265], R: 13, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirrorAll(leftSling) },
  ],
  // three standups facing the flippers, with a peaked back so a ball from above rolls off
  targets: [
    { id: 'tgt1', a: [121, 346], b: [139, 346], score: 250 },
    { id: 'tgt2', a: [142, 346], b: [160, 346], score: 250 },
    { id: 'tgt3', a: [163, 346], b: [181, 346], score: 250 },
  ],
  lanes: [
    { id: 'laneF', a: [107, 80], b: [134, 80], label: 'F' },
    { id: 'laneU', a: [138, 80], b: [165, 80], label: 'U' },
    { id: 'laneN', a: [169, 80], b: [196, 80], label: 'N' },
  ],

  // Small rules so the score strip has something to say.
  lampGroups: {
    fun: { lamps: LANES, rotate: true, reset: true },
    targets: { lamps: ['tgt1', 'tgt2', 'tgt3'], reset: true },
  },
  rules: [
    { on: 'lane:laneF', do: [['lamp', 'laneF', 1]] },
    { on: 'lane:laneU', do: [['lamp', 'laneU', 1]] },
    { on: 'lane:laneN', do: [['lamp', 'laneN', 1]] },
    { on: 'complete:fun', do: [['score', 5000], ['message', 'F-U-N COMPLETE', '5,000']] },
    { on: 'hit:tgt1', do: [['lamp', 'tgt1', 1]] },
    { on: 'hit:tgt2', do: [['lamp', 'tgt2', 1]] },
    { on: 'hit:tgt3', do: [['lamp', 'tgt3', 1]] },
    { on: 'complete:targets', do: [['score', 10000], ['message', 'TARGETS DONE', '10,000']] },
  ],
};
