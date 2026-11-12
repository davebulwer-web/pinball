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
  size: [320, 640],
  gravity: 900,
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
    { path: [[8, 160], [8, 350], [20, 390], [20, 650]] },             // left side, kinked in above the outlane
    { path: [[312, 160], [312, 650]] },                               // right side (outside of the shooter lane)
    { path: [[294, 205], [294, 650]] },                               // shooter lane inner wall
    { path: [[294, 350], [282, 390], [282, 650]] },                   // right side kink, matching the left
    // orbit lanes down each side
    { path: [[38, 190], [38, 330]], r: 2 },
    { path: [[264, 190], [264, 330]], r: 2 },
    // inlane guides (the outlane is between these and the side walls)
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

  // Small rules so the score strip has something to say. Milestone 2 replaces this with the rules system.
  rules(game) {
    const lit = () => LANES.filter(id => game.lamps[id]);
    const targets = ['tgt1', 'tgt2', 'tgt3'];
    return {
      start() { [...LANES, ...targets].forEach(id => (game.lamps[id] = 0)); },
      sensor(id) {
        if (!LANES.includes(id) || game.lamps[id]) return;
        game.lamps[id] = 1;
        if (lit().length === 3) {
          game.addScore(5000);
          game.emit('message', { text: 'F-U-N COMPLETE', sub: '5,000' });
          setTimeoutTicks(game, 0.6, () => LANES.forEach(l => (game.lamps[l] = 0)));
        }
      },
      // a flipper press moves the lit lanes along one (lane change)
      flip(side) {
        const v = LANES.map(id => game.lamps[id]);
        if (v.every(x => x === v[0])) return;
        const r = side === 'left' ? [...v.slice(1), v[0]] : [v[2], ...v.slice(0, 2)];
        LANES.forEach((id, i) => (game.lamps[id] = r[i]));
      },
      hit(id) {
        if (!targets.includes(id)) return;
        game.lamps[id] = 1;
        if (targets.every(t => game.lamps[t])) {
          game.addScore(10000);
          game.emit('message', { text: 'TARGETS DONE', sub: '10,000' });
          targets.forEach(t => (game.lamps[t] = 0));
        }
      },
    };
  },
};

// run fn after `secs` of game time (game time stops when paused)
function setTimeoutTicks(game, secs, fn) {
  const at = game.world.time + secs;
  const prev = game.world.parts.find(p => p.timers);
  const host = prev ?? game.world.addPart({ timers: [], update() {
    for (const t of [...this.timers]) if (game.world.time >= t.at) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); }
  } });
  host.timers.push({ at, fn });
}
