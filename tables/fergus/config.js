// Fergus - the Platonic Muppet: a team in-joke table, with a tall dot matrix. Fergus (long hair, glasses, a
// beard, a heart of gold) has a great many lady friends, and every one of them is just a friend. Light A-S-K to
// ask one out at the Cafe; however it goes, she ends up in the Friend Zone. Five friends make him everyone's plus
// one: Plus One multiball. The Dance Floor is a rhythm game played on the dot matrix with the flipper buttons.
// Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top centre: the Friend Zone (a scoop with a subway), Fergus pacing about in front of it
//   Top right:  A-S-K rollover lanes (skill shot); the Wingman wire ramp comes down over them
//   Top left:   three pint pop bumpers (the Bar), the GLASSES drop targets below them
//   Left:       the Hair Flick orbit with a spinner; the Cafe scoop at its foot (asking out, the Dance Floor)
//   Right:      the Wingman: a wire ramp up the right that drops to the right inlane
//   Bottom:     slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawDance } from './scenes.js';
import music from './music.js';

const LANES = ['laneA', 'laneS', 'laneK'];
const SKILL = ['skA', 'skS', 'skK'];
export const REPLIES = [
  "YOU'RE LIKE A BROTHER TO ME", "LET'S JUST BE FRIENDS", "YOU'RE SO EASY TO TALK TO", "I'D HATE TO RUIN OUR FRIENDSHIP",
  'CAN YOU HELP ME MOVE HOUSE?', 'YOU GIVE THE BEST ADVICE', "YOU'D BE A GREAT CATCH FOR SOMEONE", 'AWW, YOU MUPPET',
];
export const PLUS_ONE = 5;   // friends for Plus One multiball
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const lens = t => [+(64 + 48 * t).toFixed(1), +(236 - 18 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));
const showFriends = g => [...Array(PLUS_ONE).keys()].forEach(i => (g.lamps[`friend${i + 1}`] = i < (g.player.counts.friends ?? 0) % PLUS_ONE ? 1 : 0));

export const status = g => (multi(g) ? null : `FRIENDS ${g.player.counts.totalFriends ?? 0}  DATES 0`);

// ---------- asking her out (it never goes the way he hopes) ----------
const askOut = g => {
  g.lamps.ask = 0;
  const n = (g.player.counts.asks = (g.player.counts.asks ?? 0) + 1);
  const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
  g.addScore(10000 * n);
  g.lamps.zone = 2;
  g.emit('message', { text: 'FERGUS ASKS HER OUT', sub: fmt(10000 * n), scene: 'askout', sound: 'modeStart' });
  g.emit('message', { text: reply, sub: 'SHOOT THE FRIEND ZONE', scene: 'friendzone', sound: 'drain' });
};

// ---------- the Friend Zone ----------
const friendZone = g => {
  const c = g.player.counts;
  const last = g.lastTrigger['ramp:wingman'], assist = last !== undefined && g.world.time - last < 4;
  if (multi(g)) {
    const v = 50000 * (assist ? 2 : 1);
    g.rules.act([['jackpot', v], ['message', assist ? 'WINGMAN JACKPOT' : 'JACKPOT', fmt(v), 'hug']]);
    c.jps = (c.jps ?? 0) + 1;
    if (c.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'BEST MAN', sub: 'SUPER JACKPOT AT THE CAFE' }); }
    return;
  }
  if (!g.lamps.zone) { g.addScore(5000); g.emit('message', { text: 'STILL JUST FRIENDS', sub: '5,000' }); return; }
  g.lamps.zone = 0;
  c.friends = (c.friends ?? 0) + 1; c.totalFriends = (c.totalFriends ?? 0) + 1;
  const v = 50000 * (assist ? 2 : 1);
  g.addScore(v);
  showFriends(g);
  g.emit('message', { text: assist ? 'WINGMAN FRIEND ZONE' : 'FRIEND ZONED', sub: `FRIEND NUMBER ${c.totalFriends}  ${fmt(v)}`, scene: 'friendzone', sound: 'jackpot' });
  if (c.totalFriends % 3 === 0) { g.lamps.xball = 2; g.emit('message', { text: 'SHOULDER TO CRY ON', sub: 'EXTRA BALL AT THE CAFE' }); }
  if (c.friends >= PLUS_ONE) {
    c.friends = 0;
    g.lamps[`ring${Math.min(3, (c.weddings = (c.weddings ?? 0) + 1))}`] = 1;
    g.rules.act([['multiball', 3], ['message', 'EVERYONE\'S PLUS ONE', 'PLUS ONE MULTIBALL', 'plusone']]);
    showFriends(g);
  }
};

// ---------- the Dance Floor: a rhythm game on the dot matrix, while the Cafe holds the ball ----------
// Arrows come along the dot matrix; press the matching flipper button as each reaches the line.
// dd: { notes: [{ t, side, res: 'hit' | 'miss' | undefined }], start, hits, streak, best, over }
export const WINDOW = 0.15;
export const NOTES = 16;
const startVideo = (g, v, secs) => { g.holdSaucer('cafe', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('cafe'); });
export const danceFloor = g => {
  g.lamps.dance = 0;
  const start = g.world.time + 2;
  let t = start;
  const notes = [];
  for (let i = 0; i < NOTES; i++) { notes.push({ t, side: Math.random() < 0.5 ? 'left' : 'right' }); t += Math.max(0.42, 0.85 - i * 0.03); }
  const dd = { notes, start, hits: 0, streak: 0, best: 0, over: false };
  startVideo(g, { kind: 'dance', dd, draw: (api, now) => drawDance(api, dd, now), flip: side => step(g, dd, side) }, t - g.world.time + 3);
  g.emit('message', { text: 'DANCE FLOOR', sub: 'PRESS WITH THE ARROWS', sound: 'modeStart' });
};
const step = (g, dd, side) => {
  if (dd.over) return;
  const now = g.world.time;
  const n = dd.notes.find(x => !x.res && Math.abs(x.t - now) < WINDOW);
  if (!n) return;
  if (n.side === side) { n.res = 'hit'; dd.hits++; dd.streak++; dd.best = Math.max(dd.best, dd.streak); g.addScore(2000 * dd.streak); g.emit('sound', { name: 'target' }); }
  else { n.res = 'miss'; dd.streak = 0; g.emit('sound', { name: 'drop' }); }
};
const danceTick = g => {
  const dd = g.video?.dd; if (!dd || dd.over) return;
  const now = g.world.time;
  for (const n of dd.notes) if (!n.res && now > n.t + WINDOW) { n.res = 'miss'; dd.streak = 0; }
  if (dd.notes.every(n => n.res)) {
    dd.over = true; dd.overAt = now;
    const perfect = dd.hits === NOTES;
    if (perfect) g.addScore(50000);
    g.emit('message', { text: perfect ? 'DANCE FLOOR LEGEND' : `${dd.hits} OF ${NOTES} STEPS`, sub: perfect ? '50,000  BEST DANCE PARTNER (AS A FRIEND)' : 'BEST DANCE PARTNER (AS A FRIEND)', now: true, sound: dd.hits >= 12 ? 'jackpot' : 'modeEnd' });
    g.lamps.kbL = 1;
    endVideo(g, 2);
  }
};

// ---------- the Cafe scoop: the first thing lit wins ----------
const cafe = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', 'BEST MAN SPEECH 250,000', 'plusone']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.dance) return danceFloor(g);
  if (g.lamps.ask) return askOut(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500], ['message', 'FLAT WHITE', '2,500']]);
};

export default {
  id: 'fergus',
  name: 'Fergus',
  tagline: 'Fergus - the Platonic Muppet. Ask them out, end up in the Friend Zone. Dance Floor on the dot matrix.',
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
  colours: { field: '#3a1a2a', wall: '#ffe8f0', wallDark: '#5a3040', wallHi: '#ffffff', rubber: '#fff0f4', bumper: '#d89a3a', lamp: '#ff7ab0',
    ramp: '#d84a8a', rampDark: '#6a1a40', wire: '#fff0f8', sling: '#ff5a9a', slingDark: '#6a1a3a', slingHi: '#ffb0d0', name: 'rgba(255,220,235,0.5)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Hair Flick orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Cafe scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the Friend Zone: open at the bottom, its back slanted (so nothing rests on top); its right side is also the
    // first A-S-K lane post
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
    // A-S-K lane posts
    { path: [[228, 64], [228, 92]], r: 2 },
    { path: [[248, 64], [248, 92]], r: 2 },
    { path: [[268, 64], [268, 92]], r: 2 },
  ],
  posts: [{ c: [116, 126], R: 3 }, { c: [208, 126], R: 3 }],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the A-S-K lanes; a ball from the Hair Flick passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Wingman: up the right, over the A-S-K lanes and down to the right inlane
    { id: 'wingman', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  bumpers: [
    { id: 'pint1', art: 'pint', c: [52, 112], R: 12, score: 100 },
    { id: 'pint2', art: 'pint', c: [86, 94], R: 12, score: 100 },
    { id: 'pint3', art: 'pint', c: [72, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // GLASSES: three targets, slanted so nothing rests on them
  dropBanks: [
    { id: 'glasses', score: 750, targets: [[lens(0), lens(0.3)], [lens(0.35), lens(0.65)], [lens(0.7), lens(1)]] },
  ],
  saucers: [
    // the Friend Zone: the ball goes down a subway and comes back out above the flippers
    { id: 'zone', c: [162, 106], R: 22, hold: 1.4, score: 1000, exit: [110, 418], eject: { dir: [0.35, 1], speed: 200 } },
    { id: 'cafe', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  // Fergus himself, pacing about in front of the Friend Zone
  targets: [{ id: 'fergus', a: [150, 134], b: [174, 134], move: { by: [28, 0], secs: 5 }, score: 250, art: 'fergus', artOffset: [0, 6], bar: false }],
  spinners: [{ id: 'hair', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneA', a: [210, 82], b: [226, 82], label: 'A', marquee: true },
    { id: 'laneS', a: [230, 82], b: [246, 82], label: 'S', marquee: true },
    { id: 'laneK', a: [250, 82], b: [266, 82], label: 'K', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  decals: [{ art: 'friend1', c: [134, 112] }, { art: 'friend2', c: [190, 100] }],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [218 + i * 20, 52], art: 'lamp-heart', colour: '#ffffff' })),
    { id: 'zone', c: [162, 160], art: 'lamp-broken', colour: '#ff5a8a' },
    // friends towards Plus One multiball
    ...[...Array(PLUS_ONE).keys()].map(i => ({ id: `friend${i + 1}`, c: [122 + i * 20, 300 + (i % 2) * 6], art: 'lamp-hug', colour: '#ff9ac0' })),
    { id: 'ask', c: [44, 360], art: 'lamp-rose', colour: '#ff5a5a' },
    { id: 'dance', c: [72, 360], art: 'lamp-disco', colour: '#ffffff' },
    { id: 'superJp', c: [58, 380], art: 'lamp-ring', colour: '#ffd040' },
    { id: 'xball', c: [154, 344], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'glassLit', c: [92, 252], art: 'lamp-glasses', colour: '#ffd040', lit: g => (g.lamps.dance ? 2 : 0) },
    { id: 'wingLit', c: [206, 378], art: 'lamp-phone', colour: '#5ae8ff', lit: g => (g.world.time - (g.lastTrigger['ramp:wingman'] ?? -9) < 4 ? 2 : 0) },
    { id: 'ring1', c: [130, 400], art: 'lamp-ring', colour: '#ffd040' },
    { id: 'ring2', c: [151, 404], art: 'lamp-ring', colour: '#ffd040' },
    { id: 'ring3', c: [172, 400], art: 'lamp-ring', colour: '#ffd040' },
    { id: 'kbL', c: [27, 505], art: 'lamp-coffee', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-star', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'FERGUS', items: [
      { art: 'fergus', text: 'FERGUS: LONG HAIR, GLASSES, A BEARD AND A HEART OF GOLD. EVERY LADY HE MEETS BECOMES A FRIEND. JUST A FRIEND.' },
      { marquee: 'A', text: 'LIGHT A-S-K IN THE TOP LANES TO ASK HER OUT AT THE CAFE (THE SCOOP ON THE LEFT). HOWEVER IT GOES, IT LIGHTS THE FRIEND ZONE.' },
      { art: 'lamp-broken', text: 'SHOOT THE FRIEND ZONE AT THE TOP TO ADD HER TO HIS FRIENDS: 50,000. FERGUS PACES ABOUT IN FRONT OF IT. THE DATE COUNT STAYS AT ZERO.' },
      { art: 'lamp-ring', text: 'FIVE FRIENDS MAKE HIM EVERYONE\'S PLUS ONE: PLUS ONE MULTIBALL. THE FRIEND ZONE IS A 50,000 JACKPOT; THREE LIGHT THE BEST MAN SUPER JACKPOT AT THE CAFE.' },
    ] },
    { title: 'MORE', items: [
      { art: 'lamp-phone', text: 'SHOOT THE WINGMAN RAMP, THEN THE FRIEND ZONE WITHIN 4 SECONDS: DOUBLE.' },
      { art: 'lamp-disco', text: 'KNOCK DOWN THE GLASSES TO LIGHT THE DANCE FLOOR: PRESS THE FLIPPER BUTTON THAT MATCHES EACH ARROW AS IT REACHES THE LINE.' },
      { art: 'lamp-comb', text: 'TWENTY HAIR FLICKS (SPINS ON THE LEFT ORBIT) LIGHT THE KICKBACK AND A BALL SAVE.' },
      { art: 'lamp-hug', text: 'EVERY THIRD FRIEND IS A SHOULDER TO CRY ON: AN EXTRA BALL AT THE CAFE.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    ask: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },

  script: g => ({
    start: () => { g.video = null; },
    tick: () => { danceTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, showFriends, g => { g.video = null; }] },

    // skill shot
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', 'SMOOTH', 'hairflick']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // A-S-K: bonus multiplier, and he plucks up the courage
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:ask', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX,
      g => { if (!multi(g)) { g.lamps.ask = 2; g.emit('message', { text: 'A-S-K', sub: 'ASK HER OUT AT THE CAFE' }); } }] },

    { on: 'saucer:zone', do: [friendZone] },
    { on: 'saucer:cafe', do: [cafe] },
    { on: 'hit:fergus', do: [['sound', 'target'], ['bonus', 100], ['message', 'AWKWARD HUG']] },
    { on: 'ramp:wingman', do: [['bonus', 500], ['message', 'WINGMAN', 'NOW THE FRIEND ZONE']] },

    // the Dance Floor reads the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:glasses', do: [['score', 5000], ['lamp', 'dance', 2], ['message', 'POLISHED HIS GLASSES', 'DANCE FLOOR AT THE CAFE', 'glasses']] },
    { on: 'spin:hair', do: [['count', 'flicks', 1]] },
    { on: 'spin:hair', if: { count: ['flicks', '>=', 20] }, do: [['setCount', 'flicks', 0], ['lamp', 'kbL', 1], ['ballSave', 12], ['message', 'HAIR FLICK', 'KICKBACK AND BALL SAVE', 'hairflick']] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    { on: 'multiballEnd', do: [['lamp', 'superJp', 0]] },
  ],
};
