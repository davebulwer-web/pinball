// Star Siege: a space battle table, with a tall dot matrix. An alien mothership patrols the top of the table
// behind three shield generators: knock the shields down, then hit the mothership five times to destroy it.
// That lights the Dogfight at the Hangar, a little space shooter played on the dot matrix with the flipper
// buttons. Dock fighters in the Hangar for Fleet Launch multiball, jump through hyperspace on the ramp, and
// mind the black hole. Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top centre: the mothership (a moving target), its three shield drop targets in front of it
//   Top right:  A-C-E rollover lanes (skill shot); the Hyperspace wire ramp comes down over them
//   Top left:   three asteroid pop bumpers; the black hole (a vortex) below them
//   Middle:     the tractor beam (a magnet) that catches the ball and throws it up at the mothership
//   Left:       the Warp orbit with a spinner; the Hangar scoop at its foot (locks and the Dogfight)
//   Right:      Hyperspace: a wire ramp up the right that drops to the right inlane
//   Bottom:     slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawDogfight, LANE_Y, SHIP_X } from './scenes.js';
import music from './music.js';

const LANES = ['laneA', 'laneC', 'laneE'];
const SKILL = ['skA', 'skC', 'skE'];
const PLANETS = ['THE MOON', 'SATURN', 'A NOVA', 'EARTH'];
const JUMPS = ['jump1', 'jump2', 'jump3', 'jump4'];
export const DOGFIGHT_SECS = 25;
export const MOTHER_HITS = 5;
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const shield = t => [+(128 + 64 * t).toFixed(1), +(156 - 8 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));
const showJumps = g => JUMPS.forEach((id, i) => (g.lamps[id] = i < (g.player.counts.jumps ?? 0) % 4 ? 1 : i === (g.player.counts.jumps ?? 0) % 4 ? 2 : 0));
const showDocks = g => ['dock1', 'dock2'].forEach((id, i) => (g.lamps[id] = i < (g.player.counts.docked ?? 0) ? 1 : 0));

// ---------- the mothership ----------
const shieldsDown = g => {
  g.lamps.shieldsDown = 2; g.player.counts.mhits = 0;
  g.emit('message', { text: 'SHIELDS DOWN', sub: `HIT THE MOTHERSHIP ${MOTHER_HITS} TIMES`, scene: 'shields', sound: 'modeStart' });
};
const hitMother = g => {
  if (!g.lamps.shieldsDown) { g.emit('message', { text: 'SHIELDS HOLDING', sub: 'KNOCK THEM DOWN' }); return; }
  const n = (g.player.counts.mhits = (g.player.counts.mhits ?? 0) + 1);
  if (n < MOTHER_HITS) { g.addScore(5000 * n); g.emit('message', { text: `DIRECT HIT ${n}`, sub: `${MOTHER_HITS - n} MORE`, sound: 'jackpot' }); return; }
  const k = (g.player.counts.motherships = (g.player.counts.motherships ?? 0) + 1);
  const v = 50000 * k;
  g.addScore(v);
  g.lamps.shieldsDown = 0; g.player.counts.mhits = 0;
  g.rules.act([['resetBank', 'shields'], ['lamp', 'dogfight', 2]]);
  g.lamps[`kill${Math.min(3, k)}`] = 1;
  g.emit('message', { text: 'MOTHERSHIP DESTROYED', sub: `${fmt(v)}  DOGFIGHT AT THE HANGAR`, scene: 'explode', sound: 'boom' });
};

// ---------- hyperspace ----------
const hyperspace = g => {
  if (multi(g)) {
    g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', '50,000', 'hyperspace']]);
    g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
    if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'MOTHERSHIP IN RANGE', sub: 'SUPER JACKPOT AT THE HANGAR' }); }
    return;
  }
  const n = (g.player.counts.jumps = (g.player.counts.jumps ?? 0) + 1);
  const i = (n - 1) % 4, v = 5000 * (i + 1);
  g.addScore(v);
  showJumps(g);
  if (i === 3) {
    g.addScore(50000); g.lamps.xball = 2;
    g.emit('message', { text: 'GALAXY TOUR', sub: '50,000  EXTRA BALL AT THE HANGAR', scene: 'hyperspace', sound: 'jackpot' });
  } else g.emit('message', { text: 'HYPERSPACE', sub: `TO ${PLANETS[i]}  ${fmt(v)}`, scene: 'hyperspace' });
  if (n % 3 === 0) { g.rules.act([['magnet', 'beam', 15]]); g.emit('message', { text: 'TRACTOR BEAM', sub: 'IS ON' }); }
};

// ---------- the dot-matrix Dogfight, played with the flipper buttons while the Hangar holds the ball ----------
const startVideo = (g, v, secs) => { g.holdSaucer('hangar', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('hangar'); });

// df: see drawDogfight in scenes.js. The left button flies up a lane, the right button down; the guns fire by
// themselves. Shoot the alien fighters (5,000 each), dodge the asteroids (shots don't break them).
export const dogfight = g => {
  g.lamps.dogfight = 0;
  const t = g.world.time;
  const df = { lane: 1, ship: LANE_Y[1] + 3, shots: [], foes: [], booms: [], kills: 0, shields: 3, start: t + 1.5, secs: DOGFIGHT_SECS,
    hitAt: -9, over: false, nextFire: t + 1.5, nextFoe: t + 2, last: t };
  startVideo(g, { kind: 'dogfight', df, draw: (api, now) => drawDogfight(api, df, now), flip: side => steer(df, side) }, DOGFIGHT_SECS + 2);
  g.emit('message', { text: 'DOGFIGHT', sub: 'FLIPPERS FLY UP AND DOWN', sound: 'modeStart' });
};
const steer = (df, side) => { if (!df.over) df.lane = Math.max(0, Math.min(2, df.lane + (side === 'left' ? -1 : 1))); };
// the lane the ship is in now (it slides between lanes)
export const shipLane = df => LANE_Y.reduce((best, y, i) => (Math.abs(y + 3 - df.ship) < Math.abs(LANE_Y[best] + 3 - df.ship) ? i : best), 0);
const dogfightTick = g => {
  const df = g.video?.df; if (!df || df.over) return;
  const t = g.world.time, dt = t - df.last; df.last = t;
  if (t < df.start) return;
  const into = (t - df.start) / df.secs;
  const to = LANE_Y[df.lane] + 3, d = to - df.ship;
  df.ship += Math.sign(d) * Math.min(Math.abs(d), 90 * dt);
  const lane = shipLane(df);
  if (t >= df.nextFire) { df.shots.push({ x: SHIP_X + 13, lane }); df.nextFire = t + 0.3; g.emit('sound', { name: 'laser' }); }
  if (t >= df.nextFoe) {
    df.foes.push({ x: 160, lane: Math.floor(Math.random() * 3), kind: Math.random() < 0.3 ? 'rock' : 'alien', speed: 30 + 30 * into });
    df.nextFoe = t + Math.max(0.45, 1.1 - 0.6 * into);
  }
  for (const s of df.shots) s.x += 150 * dt;
  for (const f of df.foes) f.x -= f.speed * dt;
  for (const s of df.shots) for (const f of df.foes) {
    if (s.dead || f.dead || s.lane !== f.lane || s.x + 2 < f.x || s.x > f.x + 8) continue;
    s.dead = true;
    if (f.kind === 'alien') { f.dead = true; df.kills++; g.addScore(5000); df.booms.push({ x: f.x + 2, y: LANE_Y[f.lane] + 1, at: t }); g.emit('sound', { name: 'target' }); }
  }
  for (const f of df.foes) {
    if (f.dead || f.lane !== lane || f.x > SHIP_X + 11 || f.x < SHIP_X - 6) continue;
    f.dead = true; df.shields--; df.hitAt = t;
    df.booms.push({ x: SHIP_X + 4, y: LANE_Y[lane] + 1, at: t }); g.emit('sound', { name: 'drain' });
  }
  df.shots = df.shots.filter(s => !s.dead && s.x < 160);
  df.foes = df.foes.filter(f => !f.dead && f.x > -10);
  df.booms = df.booms.filter(b => t - b.at < 0.3);
  if (df.shields <= 0 || t >= df.start + df.secs) dogfightOver(g, df);
};
const dogfightOver = (g, df) => {
  df.over = true;
  const perfect = df.shields === 3;
  if (perfect) g.addScore(50000);
  g.emit('message', { text: `${df.kills} ALIENS DOWN`, sub: perfect ? 'NO DAMAGE 50,000' : df.shields > 0 ? 'MISSION COMPLETE' : 'SHIELDS GONE', now: true, sound: df.shields > 0 ? 'jackpot' : 'modeEnd' });
  g.lamps.kbL = 1;
  endVideo(g, 2);
};

// ---------- the Hangar scoop: the first thing lit wins ----------
const hangar = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'explode']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.dogfight) return dogfight(g);
  if (g.lamps.launch) {
    g.lamps.launch = 0; g.player.counts.docked = 0; showDocks(g);
    g.rules.act([['multiball', 3], ['message', 'FLEET LAUNCH', 'JACKPOTS ON HYPERSPACE', 'launch']]);
    return;
  }
  if (g.lamps.lock) {
    g.lamps.lock = 0;
    const n = (g.player.counts.docked = (g.player.counts.docked ?? 0) + 1);
    showDocks(g); g.addScore(10000);
    if (n >= 2) { g.lamps.launch = 2; g.emit('message', { text: 'FIGHTER 2 DOCKED', sub: 'LAUNCH IS LIT', scene: 'launch' }); }
    else g.emit('message', { text: 'FIGHTER 1 DOCKED', sub: 'LIGHT A-C-E FOR ANOTHER' });
    return;
  }
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500]]);
};

// the tractor beam holds the ball at least a second, then lets it go as the mothership passes overhead
const beamTick = g => {
  if (!g.saucerHolding('beam')) return;
  const h = [...g.saucerBalls.values()].find(x => x.saucer.id === 'beam');
  const [a, b] = g.targetAt('mother');
  if (h.releaseAt - g.world.time < 7 && Math.abs((a[0] + b[0]) / 2 - 160) < 6) g.releaseSaucer('beam');
};

export const status = g => {
  if (g.modes?.horizon) return `EVENT HORIZON ${Math.ceil(g.modes.horizon.left)}`;
  if (g.lamps.shieldsDown) return `MOTHERSHIP ${g.player.counts.mhits ?? 0}/${MOTHER_HITS}`;
  return null;
};

export default {
  id: 'starsiege',
  name: 'Star Siege',
  tagline: 'Bring down the mothership\'s shields and blow it up. A space shooter dogfight on the dot matrix.',
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
  colours: { field: '#0a0a2a', wall: '#c8d4ff', wallDark: '#2a3460', wallHi: '#ffffff', rubber: '#e8f0ff', bumper: '#9aa0b0', lamp: '#5ae8ff',
    ramp: '#6a2ab0', rampDark: '#30104a', wire: '#d8f4ff', sling: '#2ab0e8', slingDark: '#0a3a5a', slingHi: '#9aeaff', name: 'rgba(200,220,255,0.45)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Warp orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Hangar scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // right: the shooter lane, then the right orbit sloping in to the right inlane
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // A-C-E lane posts
    { path: [[208, 64], [208, 92]], r: 2 },
    { path: [[228, 64], [228, 92]], r: 2 },
    { path: [[248, 64], [248, 92]], r: 2 },
    { path: [[268, 74], [268, 92]], r: 2 },   // (short, so a plunge can get over it)
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the A-C-E lanes; a ball from the Warp passes
    { a: [235, 29], b: [237, 54], oneWay: [1, 0] },
  ],

  ramps: [
    // Hyperspace: up the right, over the A-C-E lanes and down to the right inlane
    { id: 'hyper', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  bumpers: [
    { id: 'rock1', art: 'asteroid', c: [52, 112], R: 12, score: 100 },
    { id: 'rock2', art: 'asteroid', c: [86, 94], R: 12, score: 100 },
    { id: 'rock3', art: 'asteroid', c: [72, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // the mothership's shield generators, slanted so nothing rests on them; they stay down until it is destroyed
  dropBanks: [
    { id: 'shields', score: 750, resetDelay: null, targets: [[shield(0), shield(0.28)], [shield(0.36), shield(0.64)], [shield(0.72), shield(1)]] },
  ],
  saucers: [
    { id: 'hangar', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  // the mothership: patrols across the top
  targets: [{ id: 'mother', a: [142, 112], b: [178, 106], move: { by: [30, 0], secs: 7 }, score: 250, art: 'mothership', artOffset: [0, 9], bar: false }],
  fields: [
    // the black hole: swirls a ball round and flings it on
    { id: 'hole', kind: 'vortex', c: [86, 226], R: 26, strength: 1400, spin: 1, score: 500 },
    // the tractor beam: when on, catches the ball and throws it up at the mothership
    // (it holds the ball until the mothership passes overhead: see beamTick)
    { id: 'beam', kind: 'magnet', c: [160, 212], R: 30, strength: 2400, hold: 8, score: 25000, eject: { dir: [0, -1], speed: 720 } },
  ],
  spinners: [{ id: 'warp', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneA', a: [210, 82], b: [226, 82], label: 'A', marquee: true },
    { id: 'laneC', a: [230, 82], b: [246, 82], label: 'C', marquee: true },
    { id: 'laneE', a: [250, 82], b: [266, 82], label: 'E', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [218 + i * 20, 52], art: 'lamp-star', colour: '#ffffff' })),
    // the mothership: shields down, then five hits
    { id: 'shieldsDown', c: [160, 176], art: 'lamp-shield', colour: '#5ae8ff' },
    ...[0, 1, 2, 3, 4].map(i => ({ id: `mh${i}`, c: [136 + i * 12, 190], art: 'lamp-laser', colour: '#ff5a5a',
      lit: g => (g.lamps.shieldsDown ? ((g.player.counts.mhits ?? 0) > i ? 1 : 2) : 0) })),
    // hyperspace: four destinations
    { id: 'jump1', c: [206, 378], art: 'lamp-moon', colour: '#ffffff' },
    { id: 'jump2', c: [218, 396], art: 'lamp-planet', colour: '#ffd040' },
    { id: 'jump3', c: [230, 414], art: 'lamp-star', colour: '#ffffff' },
    { id: 'jump4', c: [242, 432], art: 'lamp-earth', colour: '#5aff8a' },
    { id: 'beamLit', c: [160, 244], art: 'lamp-beam', colour: '#fff36a', lit: g => (g.fieldOn?.beam > g.world.time ? 2 : 0) },
    { id: 'horizon', c: [86, 262], art: 'lamp-hole', colour: '#d08aff' },
    // the Hangar
    { id: 'dogfight', c: [58, 352], art: 'lamp-alien', colour: '#5aff8a' },
    { id: 'lock', c: [44, 370], art: 'lamp-rocket', colour: '#ff5a5a' },
    { id: 'launch', c: [72, 370], art: 'lamp-planet', colour: '#ffd040' },
    { id: 'superJp', c: [58, 388], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'dock1', c: [130, 300], art: 'fighter', colour: '#ffffff' },
    { id: 'dock2', c: [150, 306], art: 'fighter', colour: '#ffffff' },
    { id: 'xball', c: [154, 340], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'kill1', c: [130, 400], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'kill2', c: [151, 404], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'kill3', c: [172, 400], art: 'lamp-medal', colour: '#ffd040' },
    { id: 'kbL', c: [27, 505], art: 'lamp-fuel', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-shield', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'THE MOTHERSHIP', items: [
      { art: 'lamp-shield', text: 'KNOCK DOWN ALL THREE SHIELD GENERATORS IN FRONT OF THE MOTHERSHIP.' },
      { art: 'mothership', text: 'THEN HIT THE MOTHERSHIP FIVE TIMES AS IT PATROLS THE TOP TO DESTROY IT: 50,000, MORE EACH TIME.' },
      { art: 'lamp-alien', text: 'DESTROYING IT LIGHTS THE DOGFIGHT AT THE HANGAR (THE SCOOP ON THE LEFT).' },
    ] },
    { title: 'THE DOGFIGHT', items: [
      { art: 'fighter', text: 'A SPACE SHOOTER ON THE DOT MATRIX FOR 25 SECONDS. LEFT BUTTON FLIES UP, RIGHT BUTTON DOWN. YOUR GUNS FIRE BY THEMSELVES.' },
      { art: 'alien', text: 'SHOOT THE ALIEN FIGHTERS: 5,000 EACH. DODGE THE ASTEROIDS: SHOTS DON\'T BREAK THEM. THREE HITS AND YOUR SHIELDS ARE GONE.' },
      { art: 'lamp-medal', text: 'COME BACK WITHOUT A SCRATCH FOR 50,000.' },
    ] },
    { title: 'THE FLEET', items: [
      { marquee: 'A', text: 'LIGHT A-C-E IN THE TOP LANES TO LIGHT A LOCK AT THE HANGAR. TWO FIGHTERS DOCKED LIGHT FLEET LAUNCH: 3-BALL MULTIBALL.' },
      { art: 'lamp-medal', text: 'IN MULTIBALL, HYPERSPACE IS A 50,000 JACKPOT. THREE LIGHT THE 250,000 SUPER JACKPOT AT THE HANGAR.' },
      { art: 'lamp-planet', text: 'HYPERSPACE (THE RAMP) JUMPS TO THE MOON, SATURN, A NOVA AND HOME: AN EXTRA BALL. EVERY THIRD JUMP TURNS THE TRACTOR BEAM ON.' },
    ] },
    { title: 'HAZARDS', items: [
      { art: 'lamp-beam', text: 'THE TRACTOR BEAM CATCHES THE BALL FOR 25,000 AND THROWS IT AT THE MOTHERSHIP.' },
      { art: 'lamp-hole', text: 'THE BLACK HOLE SWIRLS THE BALL ROUND. TEN TRIPS THROUGH IT START EVENT HORIZON: 10,000 A TRIP FOR 20 SECONDS.' },
      { art: 'lamp-fuel', text: 'TWENTY-FIVE SPINS ON THE WARP ORBIT: WARP SPEED, THE KICKBACK AND BALL SAVE.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    ace: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },
  modes: {
    horizon: { name: 'EVENT HORIZON', secs: 20, scoreX: { field: 20 }, lamps: ['horizon'] },
  },

  script: g => ({
    start: () => { g.video = null; },
    tick: () => { dogfightTick(g); beamTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, showJumps, showDocks, g => { g.video = null; }] },

    // skill shot
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', '15,000', 'launch']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // A-C-E: bonus multiplier and a lock
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:ace', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX,
      g => { if (!g.lamps.launch && !multi(g)) { g.lamps.lock = 2; g.emit('message', { text: 'A-C-E', sub: 'LOCK IS LIT AT THE HANGAR' }); } }] },

    { on: 'saucer:hangar', do: [hangar] },
    { on: 'hit:mother', do: [hitMother] },
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:shields', do: [['score', 5000], shieldsDown] },
    { on: 'ramp:hyper', do: [hyperspace, ['bonus', 500]] },
    { on: 'magnet:beam', do: [['message', 'TRACTOR BEAM', '25,000', 'beam']] },

    // the Dogfight reads the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    // the black hole
    { on: 'field:hole', if: { notMode: 'horizon' }, do: [['count', 'holes', 1]] },
    { on: 'field:hole', if: { notMode: 'horizon', count: ['holes', '>=', 10] }, do: [['setCount', 'holes', 0], ['mode', 'horizon'], ['message', 'EVENT HORIZON', '10,000 A TRIP', 'horizon']] },
    { on: 'field:hole', if: { mode: 'horizon' }, do: [['sound', 'jackpot']] },

    // the Warp orbit
    { on: 'spin:warp', do: [['count', 'spins', 1]] },
    { on: 'spin:warp', if: { count: ['spins', '>=', 25] }, do: [['setCount', 'spins', 0], ['lamp', 'kbL', 1], ['ballSave', 15], ['message', 'WARP SPEED', 'KICKBACK AND BALL SAVE', 'hyperspace']] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    { on: 'multiballEnd', do: [['lamp', 'superJp', 0]] },
  ],
};
