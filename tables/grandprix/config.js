// Grand Prix: a motor racing table, with a tall dot matrix. Race a season of six Grands Prix at made-up circuits
// for a made-up team. Every race is five laps: each ramp or orbit is a lap, and the two ramps (the Flyover and the
// Banking, which cross over each other at the top of the table) overtake a car. Start sixth on the grid,
// work your way up to the front, and the finishing place scores championship points. Tyres wear out: after four
// laps the team calls you in, and a lap on worn tyres loses a place, so make a pit stop at the Pit Lane scoop.
// Two games are played on the dot matrix with the flipper buttons: the Pit Stop and the Start Lights. Win a race
// for Victory Lap multiball. Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top right:  R-P-M rollover lanes (skill shot)
//   Top:        the Flyover (from the left of centre, over the top and down the right) and the Banking
//               (from the right of centre, over the top and down the left) cross at the top of the table
//   Centre:     three tyre-stack pop bumpers between the two ramps (the Chicane)
//   Right:      the D-R-S drop targets; the right orbit
//   Left:       the left orbit with a spinner; the Pit Lane scoop at its foot (the dot-matrix games)
//   Bottom:     slingshots, a kickback in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawPitStop, drawLights } from './scenes.js';
import music from './music.js';

const LANES = ['laneR', 'laneP', 'laneM'];
const SKILL = ['skR', 'skP', 'skM'];
export const CIRCUITS = ['PORTO AZUL', 'HIGHGATE PARK', 'SAKURA BAY', 'DUNE VALLEY', 'ALPINE PASS', 'CITY LIGHTS'];
export const LAPS = 5, CARS = 8, WEAR = 4, GRID = 6;   // GRID: where each race starts
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const drs = t => [+(198 + 42 * t).toFixed(1), +(216 + 16 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;
const place = n => `P${n}`;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));

// ---------- the race ----------
// g.player.counts: race (0-5, the Grand Prix being raced), lap (laps done), pos (1-8), wear (laps on these tyres),
// pts (championship points this season), wins
const racing = g => g.player.counts.lap !== undefined && !multi(g);
export const showRace = g => {
  const c = g.player.counts;
  for (let i = 1; i <= CARS; i++) g.lamps[`pos${i}`] = c.pos === i ? 2 : 0;
  for (let i = 1; i <= LAPS; i++) g.lamps[`lap${i}`] = (c.lap ?? 0) >= i ? 1 : 0;
  for (let i = 1; i <= CIRCUITS.length; i++) g.lamps[`gp${i}`] = (c.race ?? 0) >= i ? 1 : (c.race ?? 0) === i - 1 && c.lap !== undefined ? 2 : 0;
  g.lamps.box = c.wear >= WEAR ? 2 : 0;
};
const startRace = (g, quiet = false) => {
  const c = g.player.counts;
  c.race ??= 0; c.lap = 0; c.pos = GRID; c.wear = 0;
  showRace(g);
  if (!quiet) g.emit('message', { text: `${CIRCUITS[c.race]} GRAND PRIX`, sub: `ROUND ${c.race + 1}  START ${place(c.pos)}`, scene: 'lightsout' });
};
// gain (or lose, n < 0) places
export const move = (g, n, why) => {
  const c = g.player.counts, was = c.pos;
  c.pos = Math.max(1, Math.min(CARS, c.pos - n));
  const gained = was - c.pos;
  if (gained > 0) { g.addScore(5000 * gained); g.emit('message', { text: gained > 1 ? `UP ${gained} PLACES` : 'OVERTAKE', sub: `${why ? why + '  ' : ''}${place(c.pos)}`, scene: 'overtake' }); }
  else if (gained < 0) g.emit('message', { text: `DOWN TO ${place(c.pos)}`, sub: why ?? '', sound: 'drain' });
  showRace(g);
};
// a lap: worn tyres lose a place; the last lap finishes the race
export const lap = (g, overtake = 0) => {
  if (!racing(g)) return;
  const c = g.player.counts;
  c.lap++; c.wear++;
  g.addScore(2500);
  if (overtake) move(g, overtake, g.lamps.drs && overtake > 1 ? 'DRS' : '');
  if (c.wear > WEAR) move(g, -1, 'TYRES GONE');
  else if (c.wear === WEAR) g.emit('message', { text: 'BOX BOX', sub: 'PIT STOP AT THE PIT LANE' });
  if (c.lap >= LAPS) return finish(g);
  if (!overtake && c.wear <= WEAR) g.emit('message', { text: `LAP ${c.lap + 1} OF ${LAPS}`, sub: place(c.pos), scene: 'lap' });
  showRace(g);
};
const finish = g => {
  const c = g.player.counts, pos = c.pos, pts = POINTS[pos - 1];
  c.pts = (c.pts ?? 0) + pts;
  const v = pts * 2000;
  g.addScore(v);
  const won = pos === 1;
  g.emit('message', { text: won ? 'CHEQUERED FLAG  YOU WIN' : `CHEQUERED FLAG  ${place(pos)}`, sub: `${pts} POINTS  ${fmt(v)}`, scene: won ? 'podium' : 'flag', sound: won ? 'jackpot' : 'award' });
  c.race++;
  c.lap = undefined;
  if (won) {
    c.wins = (c.wins ?? 0) + 1;
    if (c.wins % 2 === 0) { g.lamps.xball = 2; g.emit('message', { text: 'TWO WINS', sub: 'EXTRA BALL AT THE PIT LANE' }); }
  }
  if (c.race >= CIRCUITS.length) endSeason(g);
  showRace(g);
  if (won) { g.emit('message', { text: 'VICTORY LAP', sub: 'MULTIBALL' }); g.rules.act([['multiball', 3]]); }
  else startRace(g);
};
const endSeason = g => {
  const c = g.player.counts, champ = c.pts >= 100;
  const v = champ ? 250000 : c.pts * 1000;
  g.addScore(v);
  g.emit('message', { text: champ ? 'WORLD CHAMPION' : 'SEASON OVER', sub: `${c.pts} POINTS  ${fmt(v)}`, scene: champ ? 'champion' : 'flag', sound: champ ? 'jackpot' : 'modeEnd' });
  if (champ) { c.titles = (c.titles ?? 0) + 1; g.lamps.xball = 2; }
  c.race = 0; c.pts = 0;
};
// the next race starts once the Victory Lap is over
const afterMultiball = g => { g.lamps.superJp = 0; if (g.player.counts.lap === undefined) startRace(g); };

export const status = g => {
  const c = g.player?.counts;
  if (!c || c.lap === undefined || multi(g)) return null;
  return `LAP ${Math.min(LAPS, c.lap + 1)}/${LAPS}  ${place(c.pos)}  ${c.pts ?? 0} PTS${c.wear >= WEAR ? '  BOX' : ''}`;
};

// ---------- the dot-matrix games, played with the flipper buttons while the Pit Lane holds the ball ----------
const startVideo = (g, v, secs) => { g.holdSaucer('pit', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('pit'); });

// The Pit Stop: four wheels to change. Each one lights on the left or the right of the car: press that flipper
// button. The wrong button fumbles the wheel nut (half a second lost). The time for all four sets the places
// gained or lost. ps: { wheel (0-3), sides, start, times, phase: 'ready' | 'go' | 'done', time, fumble }
export const pitResult = secs => (secs < 2.4 ? 2 : secs < 3.2 ? 1 : secs < 4.5 ? 0 : -1);
export const pitStop = g => {
  const sides = Array.from({ length: 4 }, () => (Math.random() < 0.5 ? 'left' : 'right'));
  const ps = { wheel: 0, sides, start: g.world.time + 1.5, times: [], phase: 'ready', time: 0, fumble: null };
  startVideo(g, { kind: 'pit', ps, draw: (api, t) => drawPitStop(api, ps, t), flip: side => wheelGun(g, ps, side) }, 15);
  g.emit('message', { text: 'PIT STOP', sub: 'PRESS THE SIDE THAT LIGHTS', sound: 'modeStart' });
};
const wheelGun = (g, ps, side) => {
  const t = g.world.time;
  if (ps.phase === 'done' || t < ps.start) return;
  ps.phase = 'go';
  if (side !== ps.sides[ps.wheel]) { ps.start -= 0.5; ps.fumble = t; g.emit('sound', { name: 'drain' }); return; }
  ps.times.push(t); ps.wheel++;
  g.emit('sound', { name: 'target' });
  if (ps.wheel >= 4) finishPit(g, ps);
};
const pitTick = g => {
  const ps = g.video?.kind === 'pit' && g.video.ps;
  if (ps && ps.phase !== 'done' && g.world.time > ps.start + 8) finishPit(g, ps);   // stuck in the pits
};
const finishPit = (g, ps) => {
  ps.phase = 'done';
  ps.time = ps.wheel >= 4 ? +(ps.times[3] - ps.start).toFixed(1) : 9.9;
  const c = g.player.counts, n = pitResult(ps.time);
  c.wear = 0; g.lamps.box = 0;
  g.addScore(Math.max(0, Math.round((5 - ps.time) * 10000)));
  g.emit('message', { text: `PIT STOP ${ps.time.toFixed(1)}S`, sub: n > 0 ? 'NEW TYRES  OVERCUT' : n < 0 ? 'SLOW STOP' : 'NEW TYRES', now: true, sound: n > 0 ? 'award' : 'modeEnd' });
  endVideo(g, 2);
  g.after(2.2, () => { if (racing(g) && n) move(g, n, n > 0 ? 'FAST STOP' : 'SLOW STOP'); });
};

// The Start Lights: five red lights come on one by one, then go out after a random wait. Press a flipper button as
// soon as they go out: a quick start gains places, pressing before they go out is a jump start.
// sl: { on (the time the first light comes on), out (the time they go out), press, phase: 'lights' | 'done', result }
export const startResult = r => (r < 0 ? -1 : r < 0.25 ? 3 : r < 0.4 ? 2 : r < 0.6 ? 1 : 0);
export const startLights = g => {
  g.lamps.lights = 0;
  const on = g.world.time + 1.2;
  const sl = { on, out: on + 5 * 0.7 + 0.4 + Math.random() * 1.6, press: null, phase: 'lights', result: null };
  startVideo(g, { kind: 'lights', sl, draw: (api, t) => drawLights(api, sl, t), flip: () => launchStart(g, sl) }, 12);
  g.emit('message', { text: 'START LIGHTS', sub: 'GO WHEN THEY GO OUT', sound: 'modeStart' });
};
const launchStart = (g, sl) => {
  const t = g.world.time;
  if (sl.phase !== 'lights' || t < sl.on) return;
  sl.press = t; sl.phase = 'done';
  const r = t - sl.out, n = startResult(r);
  sl.result = r;
  g.addScore(n > 0 ? n * 15000 : 0);
  g.emit('message', { text: r < 0 ? 'JUMP START' : `REACTION ${r.toFixed(2)}S`, sub: n < 0 ? 'DRIVE THROUGH PENALTY' : n ? `UP ${n} PLACE${n > 1 ? 'S' : ''}` : 'SLOW AWAY', now: true, sound: n > 0 ? 'award' : 'drain' });
  endVideo(g, 2);
  g.after(2.2, () => { if (racing(g) && n) move(g, n, n > 0 ? 'GREAT START' : 'PENALTY'); });
};
const lightsTick = g => {
  const sl = g.video?.kind === 'lights' && g.video.sl;
  if (sl?.phase === 'lights' && g.world.time > sl.out + 2) launchStart(g, sl);   // asleep on the grid
};

// ---------- the Pit Lane scoop: the first thing lit wins ----------
const pitLane = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'podium']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.box && racing(g)) return pitStop(g);
  if (g.lamps.lights) return startLights(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500]]);
};
// Victory Lap jackpots at the ramps; three light the super jackpot at the Pit Lane
const jackpot = (g, where) => {
  g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', where, 'overtake']]);
  const c = g.player.counts; c.jps = (c.jps ?? 0) + 1;
  if (c.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'CHAMPAGNE', sub: 'SUPER JACKPOT AT THE PIT LANE' }); }
};
// a ramp: a lap and an overtake (two with DRS); both ramps one after the other is the fastest lap
const ramp = (g, where) => {
  if (multi(g)) return jackpot(g, where);
  const d = g.lamps.drs ? 2 : 1;
  g.lamps.drs = 0;
  lap(g, d);
};

export default {
  id: 'grandprix',
  name: 'Grand Prix',
  tagline: 'Six races, five laps each: overtake on the crossover ramps, pit for tyres and win the championship.',
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
  colours: { field: '#3a3a40', wall: '#f0f0f0', wallDark: '#303038', wallHi: '#ffffff', rubber: '#f2f2ee', bumper: '#202024', lamp: '#ffe060',
    ramp: '#d82a2a', rampDark: '#6a1010', wire: '#f8f4e8', sling: '#e8e8e0', slingDark: '#5a5a50', slingHi: '#ffffff', name: 'rgba(255,255,255,0.45)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the left orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Pit Lane scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // right: the shooter lane, then the right orbit sloping in to the right inlane
    { path: [[312, 160], [312, 650]] },
    { path: [[294, 205], [294, 650]] },
    { path: [[264, 190], [264, 330]], r: 2 },
    { path: [[294, 350], [268, 432]] },
    // inlane guides (left outlane between x 20 and 34)
    { path: [[34, 432], [34, 500], [101, 556]] },
    { path: [[268, 432], [268, 500], [201, 556]] },
    // a peaked roof between the two ramp mouths, so a ball can't come to rest in the pocket between them
    { path: [[146, 360], [151, 344], [156, 360]], r: 2 },
    // R-P-M lane posts
    { path: [[172, 64], [172, 92]], r: 2 },
    { path: [[198, 64], [198, 92]], r: 2 },
    { path: [[224, 64], [224, 92]], r: 2 },
    { path: [[250, 64], [250, 92]], r: 2 },
  ],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the R-P-M lanes; a ball from the left orbit passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Flyover: up from the left of centre, over the top and down the right to the right inlane
    { id: 'flyover', style: 'ramp', layer: 1, width: 16, mouth: 30, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[130, 358], [124, 310], [122, 260], [122, 150]], arcPts([190, 150], 68, 180, 360, 10), [[258, 150], [258, 414]]) },
    // the Banking: up from the right of centre, over the top (above the Flyover) and down the left to the left inlane
    { id: 'banking', style: 'ramp', layer: 2, width: 16, mouth: 30, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[172, 358], [178, 310], [180, 260], [180, 150]], arcPts([112, 150], 68, 360, 180, 10), [[44, 150], [44, 420]]) },
  ],
  bumpers: [
    { id: 'tyre1', art: 'tyres', c: [140, 196], R: 11, score: 100 },
    { id: 'tyre2', art: 'tyres', c: [164, 214], R: 11, score: 100 },
    { id: 'tyre3', art: 'tyres', c: [146, 240], R: 11, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // D-R-S: three targets, slanted so nothing rests on them
  dropBanks: [
    { id: 'drs', score: 750, targets: [[drs(0), drs(0.3)], [drs(0.35), drs(0.65)], [drs(0.7), drs(1)]] },
  ],
  saucers: [
    { id: 'pit', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  spinners: [{ id: 'straight', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneR', a: [174, 82], b: [196, 82], label: 'R', marquee: true },
    { id: 'laneP', a: [200, 82], b: [222, 82], label: 'P', marquee: true },
    { id: 'laneM', a: [226, 82], b: [248, 82], label: 'M', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [185 + i * 26, 50], art: 'lamp-helmet', colour: '#ffffff' })),
    // the timing tower: your place, 1 to 8, up the middle
    ...Array.from({ length: CARS }, (_, i) => ({ id: `pos${i + 1}`, c: [151, 290 + i * 16], marquee: true, label: String(i + 1) })),
    // laps, across the bottom of the tower
    ...Array.from({ length: LAPS }, (_, i) => ({ id: `lap${i + 1}`, c: [119 + i * 16, 428], art: 'lamp-flag', colour: '#ffffff' })),
    // the season: six races
    ...CIRCUITS.map((_, i) => ({ id: `gp${i + 1}`, c: [206 + (i % 3) * 18, 268 + Math.floor(i / 3) * 18], art: 'lamp-trophy', colour: '#ffd040' })),
    { id: 'box', c: [96, 352], art: 'lamp-tyre', colour: '#ffd040' },
    { id: 'lights', c: [82, 368], art: 'lamp-lights', colour: '#ff4040' },
    { id: 'superJp', c: [96, 384], art: 'lamp-bottle', colour: '#ffd040' },
    { id: 'xball', c: [151, 456], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'drs', c: [226, 250], art: 'lamp-wing', colour: '#5aff8a' },
    { id: 'fastest', c: [96, 300], art: 'lamp-watch', colour: '#c060ff' },
    { id: 'kbL', c: [27, 505], art: 'lamp-wrench', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-star', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'THE RACE', items: [
      { art: 'lamp-flag', text: 'SIX GRANDS PRIX OF FIVE LAPS EACH, STARTING SIXTH ON THE GRID. YOUR LAP AND PLACE ARE UNDER THE SCORE AND ON THE TIMING TOWER.' },
      { art: 'car', text: 'EVERY RAMP OR ORBIT IS A LAP. THE FLYOVER AND THE BANKING RAMPS ALSO OVERTAKE A CAR.' },
      { art: 'lamp-wing', text: 'KNOCK DOWN D-R-S AND THE NEXT RAMP OVERTAKES TWO CARS.' },
      { art: 'lamp-tyre', text: 'AFTER FOUR LAPS THE TYRES ARE WORN: BOX AT THE PIT LANE, OR LOSE A PLACE EVERY LAP.' },
      { art: 'lamp-trophy', text: 'THE FINISHING PLACE SCORES CHAMPIONSHIP POINTS. WIN A RACE FOR VICTORY LAP MULTIBALL: THE RAMPS ARE JACKPOTS.' },
    ] },
    { title: 'THE SEASON', items: [
      { art: 'lamp-watch', text: 'BOTH RAMPS ONE AFTER THE OTHER IS THE FASTEST LAP: 25,000.' },
      { art: 'lamp-xball', text: 'EVERY SECOND WIN LIGHTS AN EXTRA BALL AT THE PIT LANE. 100 POINTS IN A SEASON MAKES YOU WORLD CHAMPION.' },
      { marquee: 'R', text: 'LIGHT R-P-M IN THE TOP LANES TO RAISE THE BONUS MULTIPLIER AND LIGHT THE KICKBACK.' },
      { art: 'lamp-wrench', text: 'KICKBACK: WHILE THE WRENCH IS LIT, THE LEFT OUTLANE FIRES THE BALL BACK.' },
    ] },
    { title: 'DOT-MATRIX GAMES', items: [
      { art: 'lamp-tyre', text: 'THE PIT STOP: CHANGE FOUR WHEELS. PRESS THE FLIPPER BUTTON ON THE SIDE THAT LIGHTS. A FAST STOP GAINS PLACES.' },
      { art: 'lamp-lights', text: 'TWENTY SPINS ON THE LEFT ORBIT LIGHT THE START LIGHTS: PRESS AS SOON AS THE LIGHTS GO OUT, BUT NOT BEFORE.' },
      { art: 'lamp-star', text: 'BALL SAVE: WHILE THE STAR FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    rpm: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },

  script: g => ({
    start: () => { g.video = null; },
    tick: () => { pitTick(g); lightsTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, g => { g.video = null; if (g.player.counts.lap === undefined && !multi(g)) startRace(g, g.player.ball > 1); showRace(g); }] },

    // skill shot: a flying start
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', 'FLYING START', 'lightsout'], g => racing(g) && move(g, 2, 'FLYING START')] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // R-P-M: bonus multiplier, and the kickback
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:rpm', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX, ['lamp', 'kbL', 1], ['message', 'R-P-M', 'BONUS MULTIPLIER']] },

    // laps and overtakes; both ramps one after the other is the fastest lap
    { on: 'ramp:flyover', if: { after: ['ramp:banking', 4] }, do: [['score', 25000], ['lamp', 'fastest', 1], ['message', 'FASTEST LAP', '25,000', 'lap']] },
    { on: 'ramp:banking', if: { after: ['ramp:flyover', 4] }, do: [['score', 25000], ['lamp', 'fastest', 1], ['message', 'FASTEST LAP', '25,000', 'lap']] },
    { on: 'ramp:flyover', do: [['bonus', 500], g => ramp(g, 'THE FLYOVER')] },
    { on: 'ramp:banking', do: [['bonus', 500], g => ramp(g, 'THE BANKING')] },
    // (only a shot up the right orbit: a plunge falling back down it is no lap)
    { on: 'lane:orbit', do: [['bonus', 250], g => { if (g.world.balls.some(b => g.inPlay(b) && b.x > 262 && b.x < 296 && Math.abs(b.y - 240) < 20 && b.vy < 0)) lap(g); }] },
    { on: 'saucer:pit', do: [pitLane] },
    { on: 'bankDown:drs', do: [['score', 5000], ['lamp', 'drs', 2], ['message', 'DRS ENABLED', 'NEXT RAMP OVERTAKES TWO', 'overtake']] },

    // the dot-matrix games read the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    { on: 'drop', do: [['bonus', 100]] },
    { on: 'spin:straight', if: { unlit: 'lights' }, do: [['count', 'spins', 1]] },
    { on: 'spin:straight', if: { count: ['spins', '>=', 20], unlit: 'lights' }, do: [['setCount', 'spins', 0], ['lamp', 'lights', 2], ['message', 'START LIGHTS', 'AT THE PIT LANE']] },

    { on: 'multiballEnd', do: [afterMultiball] },
  ],
};
