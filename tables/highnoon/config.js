// High Noon: a Wild West town. The third table, and the first with a tall (160 x 32) dot matrix. Its flippers
// are six-shooters, and in the Quick Draw they really fire: outlaws pop up across the bottom of the table and
// each flipper button shoots along its barrel. New parts: a moving target (the Stagecoach) and a captive ball
// (the Bank). Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top right:  G-U-N rollover lanes (skill shot), the Saloon's three barrel pop bumpers below them
//   Left:       the Gold Mine orbit with a spinner, round the top and down the right orbit to the right inlane.
//               The Jail scoop at its foot (locks for Jailbreak multiball).
//   Centre:     the Bank: a captive ball in a short channel with the vault target at its top. The Stagecoach
//               rolls to and fro across the front of it.
//               The Railroad ramp climbs the left of centre, crosses the top and drops into the right orbit.
//   Right:      the Saloon scoop (Quick Draw, extra ball), and the WANTED drop targets on the right wall
//   Bottom:     slingshots, a kickback in the left outlane (the Sheriff's Badge), and the pistols

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes from './scenes.js';
import music from './music.js';

const LANES = ['laneG', 'laneU', 'laneN'];
const SKILL = ['skG', 'skU', 'skN'];
const COACH = ['coach1', 'coach2', 'coach3'];
const CRACK = ['crack1', 'crack2', 'crack3'];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const fmt = n => n.toLocaleString('en-GB');

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));

// ---- the Quick Draw ----
// The ball waits in the Saloon while outlaws (and the odd townsperson) pop up along the two lines of fire across
// the bottom of the table. Each flipper button fires that pistol: the first figure on its line is hit.
// Six bullets, fifteen seconds. g.duel: { bullets, until, figs: [{ side, k, kind, up, down, hit }], shots, n, score }
export const DUEL = { bullets: 6, secs: 15, spots: [55, 95, 135] };   // spots: distances along the line from the muzzle
// a pistol's muzzle and line of fire with the flipper up
export const lineOfFire = (g, side) => {
  const f = g.flippers.find(x => x.side === side);
  const c = Math.cos(f.upA), s = Math.sin(f.upA);
  return { x: f.px + c * (f.len + 3), y: f.py + s * (f.len + 3), c, s };
};
export const spotAt = (g, side, k) => { const l = lineOfFire(g, side); return [l.x + l.c * DUEL.spots[k], l.y + l.s * DUEL.spots[k]]; };

const startDuel = g => {
  g.lamps.duel = 0;
  g.duel = { bullets: DUEL.bullets, until: g.world.time + DUEL.secs, figs: [], shots: [], n: 0, score: 0, outlaws: 0, misses: 0 };
  g.holdSaucer('saloon', DUEL.secs + 6);
  g.lookAt = 560;   // show the bottom of the table while the ball waits in the Saloon
  g.emit('message', { text: 'QUICK DRAW', sub: 'SHOOT THE OUTLAWS', scene: 'duel', now: true });
  g.after(2.2, () => popUp(g));
};
const popUp = g => {
  const d = g.duel; if (!d || d.over) return;
  const t = g.world.time;
  if (t > d.until - 1.5) return;
  const free = [];
  for (const side of ['left', 'right']) for (let k = 0; k < 3; k++) if (!d.figs.some(f => f.side === side && f.k === k && t < f.down)) free.push([side, k]);
  if (free.length) {
    const [side, k] = free[Math.floor(Math.random() * free.length)];
    const kind = Math.random() < 0.72 || d.n < 2 ? 'outlaw' : 'folk';
    const stay = Math.max(1.0, 1.8 - d.n * 0.06);
    d.figs.push({ side, k, kind, look: Math.floor(Math.random() * 2), up: t, down: t + stay, hit: false });
    d.n++;
  }
  g.after(0.7 + Math.random() * 0.7, () => popUp(g));
};
const shoot = (g, side) => {
  const d = g.duel; if (!d || d.over || d.bullets <= 0) return;
  const t = g.world.time;
  d.bullets--;
  const l = lineOfFire(g, side);
  const target = d.figs.filter(f => f.side === side && !f.hit && t >= f.up + 0.12 && t < f.down).sort((a, b) => a.k - b.k)[0];
  const reach = target ? DUEL.spots[target.k] : 220;
  d.shots.push({ side, t, to: [l.x + l.c * reach, l.y + l.s * reach] });
  g.emit('sound', { name: 'gunshot' });
  if (target) {
    target.hit = true; target.down = Math.min(target.down, t + 0.5);
    if (target.kind === 'outlaw') {
      d.outlaws++;
      const v = 10000 + 5000 * d.outlaws;
      d.score += v; g.addScore(v);
      g.emit('message', { text: d.outlaws === 1 ? 'GOT ONE' : `${d.outlaws} OUTLAWS`, sub: fmt(v), now: true });
    } else {
      d.misses++;
      g.emit('message', { text: "DON'T SHOOT", sub: 'THE TOWNSFOLK', now: true, sound: 'drain' });
    }
  } else { d.misses++; g.emit('sound', { name: 'ricochet' }); }
  if (d.bullets === 0) g.after(0.6, () => endDuel(g));
};
const endDuel = g => {
  const d = g.duel; if (!d || d.over) return;
  d.over = true;
  if (d.outlaws >= 5 && d.misses === 0) { g.addScore(100000); g.emit('message', { text: 'DEAD EYE', sub: '100,000', scene: 'duel', now: true, sound: 'jackpot' }); }
  else g.emit('message', { text: `${d.outlaws} OUTLAWS`, sub: `TOTAL ${fmt(d.score)}`, now: true, sound: 'modeEnd' });
  g.player.counts.duels = (g.player.counts.duels ?? 0) + 1;
  g.after(1.6, () => { g.lookAt = null; g.releaseSaucer('saloon'); g.duel = null; });
};
// the duel's clock: called every tick by the script
const duelTick = g => { const d = g.duel; if (d && !d.over && g.world.time > d.until) endDuel(g); };

// ---- the Saloon scoop: the first thing lit wins ----
const saloon = g => {
  if (g.lamps.duel && g.liveBalls() <= 1) return startDuel(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 5000], ['bonus', 1000], ['message', 'WHISKEY', '5,000', 'saloon']]);
};

// ---- the Jail: lock two outlaws, the third shot breaks them out ----
const jail = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'jail']]); return; }
  if (!g.lamps.lock || g.liveBalls() > 1) { g.addScore(2500); return; }
  if (g.player.locks >= 2) {
    g.lamps.lock = 0;
    g.rules.act([['multiball', 3], ['message', 'JAILBREAK', 'MULTIBALL', 'jail']]);
    return;
  }
  g.rules.act([['lock'], ['message', `OUTLAW ${g.player.locks + 1} LOCKED`, g.player.locks === 1 ? 'JAILBREAK IS LIT' : 'LOCK ONE MORE', 'jail']]);
  g.lamps.lock = g.player.locks >= 2 ? 2 : 0;
};

// ---- the Bank: knock the captive ball into the vault ----
const crack = g => {
  const n = (g.player.counts.cracks = (g.player.counts.cracks ?? 0) + 1);
  CRACK.forEach((id, i) => (g.lamps[id] = i < ((n - 1) % 3) + 1 ? 1 : 0));
  if (g.liveBalls() > 1) { if (!g.lamps.jackpot) { g.lamps.jackpot = 2; g.emit('message', { text: 'JACKPOT', sub: 'RELIT', sound: 'award' }); } return; }
  if (n % 3 === 0) {
    g.rules.act([['score', 30000], ['message', 'SAFE CRACKED', 'GOLD RUSH', 'safe'], ['mode', 'goldRush']]);
    if (n === 3) { g.lamps.xball = 2; g.emit('message', { text: 'EXTRA BALL', sub: 'IS LIT AT THE SALOON' }); }
    g.after(1.5, () => CRACK.forEach(id => (g.lamps[id] = 0)));
  } else g.rules.act([['score', 5000 * (n % 3)], ['message', 'THE BANK', `${3 - (n % 3)} MORE TO CRACK IT`]]);
};

// ---- the Stagecoach: each hold-up lights something ----
const holdUp = g => {
  const n = (g.player.counts.coach = (g.player.counts.coach ?? 0) + 1) % 3 || 3;
  COACH.forEach((id, i) => (g.lamps[id] = i < n ? 1 : 0));
  if (n === 1) g.emit('message', { text: 'HOLD UP', sub: '5,000', scene: 'coach' });
  if (n === 2) { g.lamps.kbL = 1; g.emit('message', { text: 'HOLD UP', sub: "SHERIFF'S BADGE LIT", scene: 'coach' }); }
  if (n === 3) {
    g.lamps.lock = g.player.locks >= 2 ? 2 : 1;
    g.emit('message', { text: 'HOLD UP', sub: g.liveBalls() > 1 ? '25,000' : 'JAIL IS OPEN', scene: 'coach' });
    g.after(1.5, () => COACH.forEach(id => (g.lamps[id] = 0)));
  }
  g.addScore(n === 3 ? 25000 : 5000);
};

// ---- Jailbreak jackpots: the Railroad scores them, worth more for every Saloon bumper hit ----
const jackpot = g => {
  g.lamps.jackpot = 0;
  const v = 50000 + 5000 * (g.player.counts.jpBumps ?? 0);
  g.rules.act([['jackpot', v], ['message', 'JACKPOT', fmt(v), 'train']]);
  g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
  if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'SUPER JACKPOT', sub: 'IS LIT AT THE JAIL' }); }
};

export default {
  id: 'highnoon',
  name: 'High Noon',
  tagline: 'Six-shooters for flippers. Lock up the outlaws, rob the train and win the Quick Draw.',
  size: [320, 640],
  gravity: 780,
  ballRadius: 5,
  balls: 3,
  ballSave: 8,
  multiballSave: 12,
  nameY: 612,
  drainY: 650,
  dmd: { rows: 32 },   // the tall dot matrix, for the detailed scenes
  flipSound: 'cap',
  scenes,
  music,
  colours: { field: '#3a2412', wall: '#d8c8a8', wallDark: '#4a3420', wallHi: '#fff4dc', rubber: '#e8dcc0', bumper: '#b0642c', lamp: '#ffc040',
    ramp: '#6a4a2a', rampDark: '#2e1e10', wire: '#e8d8b0', sling: '#c87830', slingDark: '#4a2410', slingHi: '#ffd090', name: 'rgba(255,210,140,0.5)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46, style: 'pistol' },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46, style: 'pistol' },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Gold Mine orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Jail scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the Saloon scoop, right of centre
    { path: arcPts([226, 268], 20, 190, 350, 16), r: 2 },
    // the Bank: a channel for the captive ball, closed at the top by the vault target; a bar across the
    // bottom keeps the captive ball in but lets a ball in play through to hit it
    { path: [[153.5, 212], [153.5, 252]] },
    { path: [[166.5, 212], [166.5, 252]] },
    { path: [[153, 254], [167, 254]], captiveOnly: true },
    // a funnel flaring out from the Bank's mouth guides near misses onto the captive ball
    { path: [[153.5, 252], [140, 266]], r: 1.5 },
    { path: [[166.5, 252], [180, 266]], r: 1.5 },
    // right: the shooter lane, then the right orbit down to the right inlane
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[266, 196], [266, 330], [257, 416]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // G-U-N lane posts
    { path: [[172, 64], [172, 92]], r: 2 },
    { path: [[198, 64], [198, 92]], r: 2 },
    { path: [[224, 64], [224, 92]], r: 2 },
    { path: [[250, 64], [250, 92]], r: 2 },
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the G-U-N lanes; a ball from the Gold Mine passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Railroad: up the left of centre, over the top and down into the right orbit
    { id: 'railroad', style: 'wire', width: 18, mouth: 30, minSpeed: 300, assist: 700, score: 2000, funnel: [16, 8],
      path: joinPath([[124, 356], [112, 306], [108, 240], [108, 172]], arcPts([160, 172], 52, 180, 360, 12), [[212, 172], [226, 214], [256, 246], [282, 262]]) },
  ],
  bumpers: [
    { id: 'barrel1', art: 'barrel', c: [234, 118], R: 12, score: 100 },
    { id: 'barrel2', art: 'barrel', c: [266, 138], R: 12, score: 100 },
    { id: 'barrel3', art: 'barrel', c: [244, 162], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  dropBanks: [
    { id: 'wanted', art: 'lamp-wanted', score: 750, targets: [[[260, 342], [258, 360]], [[257, 366], [255, 384]], [[254, 390], [252, 408]]] },
  ],
  saucers: [
    { id: 'jail', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
    { id: 'saloon', c: [226, 268], R: 14, hold: 1.0, score: 1000, eject: { dir: [-0.3, 1], speed: 220 } },
  ],
  targets: [
    // the vault, hit by the captive ball
    { id: 'vault', a: [154, 212], b: [166, 212], score: 1000 },
    // the Stagecoach: slanted a little so nothing rests on it, rolling across the front of the Bank
    { id: 'coach', a: [140, 294], b: [162, 290], move: { by: [40, 0], secs: 6 }, score: 500 },
  ],
  captives: [{ id: 'bank', c: [160, 246] }],
  spinners: [{ id: 'spinner', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneG', a: [174, 82], b: [196, 82], label: 'G', marquee: true },
    { id: 'laneU', a: [200, 82], b: [222, 82], label: 'U', marquee: true },
    { id: 'laneN', a: [226, 82], b: [248, 82], label: 'N', marquee: true },
    { id: 'orbit', a: [268, 226], b: [292, 226], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [185 + i * 26, 52], art: 'lamp-bullet', colour: '#ffffff' })),
    { id: 'lock', c: [62, 354], art: 'lamp-key', colour: '#ffd040' },
    { id: 'superJp', c: [62, 372], art: 'lamp-dynamite', colour: '#ff5a3a' },
    { id: 'goldRush', c: [23, 290], art: 'lamp-gold', colour: '#ffd040' },
    { id: 'duel', c: [226, 294], art: 'lamp-star', colour: '#ffd040' },
    { id: 'xball', c: [226, 312], art: 'lamp-xball', colour: '#ff9a3a' },
    ...CRACK.map((id, i) => ({ id, c: [180, 214 + i * 14], art: 'lamp-safe', colour: '#ffd040' })),
    { id: 'jackpot', c: [126, 374], art: 'lamp-bag', colour: '#ffcc33' },
    ...COACH.map((id, i) => ({ id, c: [136 + i * 15, 320 + (i === 1 ? 4 : 0)], art: 'lamp-coach', colour: '#ff6a4a' })),
    { id: 'kbL', c: [27, 505], art: 'lamp-star', colour: '#ffd040' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-hat', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'HIGH NOON', items: [
      { art: 'lamp-star', text: 'KNOCK DOWN THE THREE WANTED POSTERS TO LIGHT THE QUICK DRAW AT THE SALOON (THE SCOOP ON THE RIGHT).' },
      { art: 'outlaw', text: 'QUICK DRAW: OUTLAWS POP UP ACROSS THE BOTTOM OF THE TABLE. EACH FLIPPER BUTTON FIRES THAT PISTOL ALONG ITS BARREL. SIX BULLETS.' },
      { art: 'folk', text: "DON'T SHOOT THE TOWNSFOLK. HIT FIVE OUTLAWS WITHOUT A MISS FOR DEAD EYE, 100,000." },
    ] },
    { title: 'JAILBREAK', items: [
      { art: 'lamp-coach', text: 'HIT THE STAGECOACH AS IT ROLLS PAST THE BANK. THE SECOND HOLD-UP LIGHTS THE KICKBACK, THE THIRD OPENS THE JAIL.' },
      { marquee: 'G', text: 'G-U-N IN THE TOP LANES ALSO OPENS THE JAIL, AND RAISES THE BONUS MULTIPLIER.' },
      { art: 'lamp-key', text: 'LOCK TWO OUTLAWS IN THE JAIL (THE SCOOP ON THE LEFT). THE NEXT SHOT THERE STARTS JAILBREAK, 3-BALL MULTIBALL.' },
      { art: 'lamp-bag', text: 'IN JAILBREAK THE RAILROAD RAMP SCORES THE JACKPOT, 50,000 PLUS 5,000 FOR EVERY BARREL HIT. THE BANK RELIGHTS IT.' },
      { art: 'lamp-dynamite', text: 'THREE JACKPOTS LIGHT THE 250,000 SUPER JACKPOT AT THE JAIL.' },
    ] },
    { title: 'THE BANK', items: [
      { art: 'lamp-safe', text: 'HIT THE CAPTIVE BALL IN THE MIDDLE SO IT KNOCKS THE VAULT. THREE KNOCKS CRACK THE SAFE: 30,000 AND A GOLD RUSH.' },
      { art: 'lamp-gold', text: 'GOLD RUSH: 20 SECONDS OF THE GOLD MINE SPINNER SCORING TEN TIMES.' },
      { art: 'lamp-xball', text: 'THE FIRST SAFE CRACKED LIGHTS AN EXTRA BALL AT THE SALOON.' },
      { art: 'lamp-star', text: "THE SHERIFF'S BADGE: WHILE IT IS LIT, THE KICKBACK IN THE LEFT OUTLANE SAVES THE BALL." },
      { art: 'lamp-hat', text: 'BALL SAVE: WHILE THE HAT FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  toys: [
    // the Stagecoach rides along on top of its target
    { art: 'coach', at: g => { const [a, b] = g.targetAt('coach'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 9]; } },
    // the jail window over the Jail scoop: the outlaws locked in it
    { draw: (ctx, g, t, art) => drawJail(ctx, g, t, art) },
    // the Quick Draw: figures popping up, and the shots
    { draw: (ctx, g, t, art) => drawDuel(ctx, g, art) },
  ],

  startLamps: {},
  lampGroups: {
    gun: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },
  modes: {
    goldRush: { name: 'GOLD RUSH', secs: 20, scoreX: { spin: 10 }, lamps: ['goldRush'] },
  },

  script: g => ({ start: () => { g.duel = null; g.lookAt = null; }, tick: () => duelTick(g) }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, g => { g.duel = null; g.lookAt = null; }] },

    // skill shot: the lit lane straight off the plunger
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', '15,000', 'duel']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // G-U-N: bonus multiplier, and opens the Jail
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:gun', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['message', 'G-U-N', 'JAIL IS OPEN'], g => { if (!g.lamps.lock) g.lamps.lock = g.player.locks >= 2 ? 2 : 1; }] },

    // the scoops
    { on: 'saucer:saloon', do: [saloon] },
    { on: 'saucer:jail', do: [jail] },
    { on: 'flip:left', do: [g => shoot(g, 'left')] },
    { on: 'flip:right', do: [g => shoot(g, 'right')] },

    // WANTED: all three down light the Quick Draw
    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:wanted', do: [['lamp', 'duel', 2], ['message', 'WANTED', 'QUICK DRAW AT THE SALOON', 'wanted']] },

    // the Stagecoach and the Bank
    { on: 'hit:coach', do: [holdUp] },
    { on: 'hit:vault', do: [crack] },

    // the Railroad and the Gold Mine
    { on: 'ramp:railroad', do: [['bonus', 500], ['sound', 'whistle']] },
    { on: 'lane:orbit', do: [['bonus', 250]] },
    { on: 'lane:orbit', if: { after: ['ramp:railroad', 4] }, do: [['score', 25000], ['message', 'RIDE OUT', '25,000', 'train']] },

    // Jailbreak: the Railroad scores jackpots; every barrel hit adds to them; the Bank relights them
    { on: 'multiballStart', do: [['lamp', 'jackpot', 2], ['setCount', 'jpBumps', 0]] },
    { on: 'ramp:railroad', if: { lit: 'jackpot', multiball: true }, do: [jackpot] },
    { on: 'bumper', if: { multiball: true }, do: [['count', 'jpBumps', 1]] },
    { on: 'multiballEnd', do: [['lamp', ['jackpot', 'superJp'], 0]] },
  ],
};

// ---------- drawing for the toys ----------
// the jail window: bars over a dark cell, with an outlaw's face behind them for each locked ball
function drawJail(ctx, g, t, art) {
  const x0 = 46, y0 = 288, w = 32, h = 16;
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = '#0a0604'; ctx.fillRect(x0, y0, w, h);
  const locks = g.player?.locks ?? 0, im = art.outlaw;
  for (let i = 0; i < locks; i++) if (im) ctx.drawImage(im, 0, 0, im.width, Math.ceil(im.height * 0.55), x0 + 2 + i * 15, y0 + 2, 13, Math.round(13 * im.height * 0.55 / im.width));
  ctx.fillStyle = '#8a8f9a';
  for (let x = x0 + 3; x < x0 + w; x += 5) ctx.fillRect(x, y0, 1, h);
  ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0 + h - 1, w, 1);
  if (g.lamps.lock === 2 && Math.floor(t * 4) % 2) { ctx.fillStyle = 'rgba(255,200,60,0.35)'; ctx.fillRect(x0, y0, w, h); }
}

// the Quick Draw: figures rise from the ground at their spots; shots are a bright line for a moment
function drawDuel(ctx, g, art) {
  const d = g.duel; if (!d) return;
  const t = g.world.time;
  for (const f of d.figs) {
    if (t >= f.down + (f.hit ? 0.35 : 0)) continue;
    const im = art[f.kind === 'outlaw' ? (f.look ? 'outlaw2' : 'outlaw') : (f.look ? 'folk2' : 'folk')];
    const [x, y] = spotAt(g, f.side, f.k);
    const rise = Math.min(1, (t - f.up) / 0.15, Math.max(0, (f.down - t) / 0.15) + (f.hit ? 1 : 0));
    const w = im?.width ?? 16, h = im?.height ?? 24, show = Math.round(h * rise);
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - 7), Math.round(y + 1), 14, 3); ctx.globalAlpha = 1;
    if (im && show > 0) {
      if (f.hit) ctx.globalAlpha = Math.max(0, 1 - (t - (f.down - 0.5)) / 0.85);
      ctx.drawImage(im, 0, 0, im.width, Math.round(im.height * rise), Math.round(x - w / 2), Math.round(y + 2 - show), w, show);
      ctx.globalAlpha = 1;
    }
    if (f.hit && f.kind === 'outlaw') { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), Math.round(y - 12), 2, 2); }
  }
  for (const s of d.shots) if (t - s.t < 0.12) {
    const l = lineOfFire(g, s.side), n = Math.ceil(Math.hypot(s.to[0] - l.x, s.to[1] - l.y));
    ctx.fillStyle = '#fff6c0';
    for (let k = 0; k <= n; k += 1) ctx.fillRect(Math.round(l.x + (s.to[0] - l.x) * k / n), Math.round(l.y + (s.to[1] - l.y) * k / n), 1, 1);
  }
  // the bullets left, over the flippers
  for (let i = 0; i < d.bullets; i++) {
    const x = 151 - (d.bullets - 1) * 4 + i * 8;
    ctx.fillStyle = '#c89a30'; ctx.fillRect(x - 1, 596, 3, 6); ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 1, 594, 3, 2);
  }
}
