// Angry Andy: a team in-joke table, with a tall dot matrix. Andy is the Head of IT: sixty, bald, and with a
// short fuse. The aim of the game is to wind him up. Raise tickets at the Help Desk to start IT missions (jam the
// printer, forget your password, reply all...), ping him, break into his Server Room, and fill his anger meter
// for Meltdown multiball. Desk Pranks is a reaction game played on the dot matrix with the flipper buttons.
// Same frame as the other tables (playfield 8..294 wide, shooter lane 294..312).
//   Top centre: the Server Room (a scoop with a subway), Andy pacing about in front of it (a moving target)
//   Top right:  C-A-D (ctrl-alt-del) rollover lanes (skill shot); the Email Chain wire ramp comes over them
//   Top left:   three blue-screen monitors (pop bumpers), the PAPER drop targets (the printer) below them
//   Left:       the Password Reset orbit with a spinner; the Help Desk scoop at its foot (tickets, Desk Pranks)
//   Right:      the Email Chain: a wire ramp up the right that drops to the right inlane
//   Bottom:     slingshots, a kickback (the Backup) in the left outlane, ball save

import { arcPts, joinPath } from '../../engine/geom.js';
import scenes, { drawPranks } from './scenes.js';
import music from './music.js';

const LANES = ['laneC', 'laneA', 'laneD'];
const SKILL = ['skC', 'skA', 'skD'];
// IT missions: raise a ticket at the Help Desk, then make the shots before the ticket times out
export const MISSIONS = [
  { id: 'printer', text: 'PRINTER JAMMED', how: 'KNOCK DOWN THE PAPER', on: 'drop', need: 3 },
  { id: 'password', text: 'FORGOT MY PASSWORD', how: 'SPIN THE PASSWORD RESET', on: 'spin:reset', need: 15 },
  { id: 'replyall', text: 'REPLY ALL', how: 'SHOOT THE EMAIL CHAIN TWICE', on: 'ramp:email', need: 2 },
  { id: 'bluescreen', text: 'BLUE SCREEN', how: 'HIT THE MONITORS', on: 'bumper', need: 12 },
  { id: 'unplug', text: 'UNPLUGGED THE SERVER', how: 'SHOOT THE SERVER ROOM', on: 'saucer:servers', need: 1 },
  { id: 'quicklook', text: 'CAN YOU JUST HAVE A QUICK LOOK', how: 'HIT ANDY 4 TIMES', on: 'hit:andy', need: 4 },
];
export const MISSION_SECS = 30;
const leftSling = [[54, 448], [54, 494], [88, 520]];
const mirror = pts => pts.map(([x, y]) => [302 - x, y]);
const tray = t => [+(64 + 48 * t).toFixed(1), +(236 - 18 * t).toFixed(1)];
const fmt = n => n.toLocaleString('en-GB');
const multi = g => g.liveBalls() > 1 || g.launchQueue > 0;

const showBonusX = g => ['x2', 'x3', 'x4', 'x5'].forEach((id, i) => (g.lamps[id] = g.player.bonusX >= i + 2 ? 1 : 0));
const pickSkill = g => SKILL.forEach((id, i) => (g.lamps[id] = i === (g.player.ball + g.player.n) % 3 ? 2 : 0));
const showMissions = g => MISSIONS.forEach(m => (g.lamps[`m_${m.id}`] = g.player.counts[`done_${m.id}`] ? 1 : g.mission?.def.id === m.id ? 2 : 0));
const showAnger = g => [1, 2, 3, 4, 5].forEach(i => (g.lamps[`anger${i}`] = (g.player.counts.anger ?? 0) >= i * 20 ? 1 : (g.player.counts.anger ?? 0) > (i - 1) * 20 ? 2 : 0));

// ---------- Andy's anger ----------
export const anger = g => g.player?.counts.anger ?? 0;
const annoy = (g, n) => {
  if (multi(g)) return;
  const c = g.player.counts;
  c.anger = Math.min(100, (c.anger ?? 0) + n);
  showAnger(g);
  if (c.anger >= 100) meltdown(g);
};
const meltdown = g => {
  const c = g.player.counts;
  c.anger = 0; c.meltdowns = (c.meltdowns ?? 0) + 1;
  g.lamps[`fire${Math.min(3, c.meltdowns)}`] = 1;
  if (g.mission) endMission(g, true);
  showAnger(g);
  g.rules.act([['multiball', 3], ['message', 'MELTDOWN', 'HIT ANDY FOR JACKPOTS', 'meltdown']]);
};

export const status = g => {
  if (multi(g)) return null;
  const m = g.mission;
  if (m) return `${m.def.id === 'quicklook' ? 'QUICK LOOK' : m.def.text} ${m.got}/${m.def.need} ${Math.max(0, Math.ceil(m.until - g.world.time))}S`;
  return `ANDY'S ANGER ${anger(g)}%`;
};

// ---------- IT missions ----------
// g.mission: { def, got, until }
const raiseTicket = g => {
  g.lamps.ticket = 0;
  const c = g.player.counts;
  const left = MISSIONS.filter(m => !c[`done_${m.id}`]);
  const pool = left.length ? left : MISSIONS;
  const def = pool[(c.tickets ?? 0) % pool.length];
  c.tickets = (c.tickets ?? 0) + 1;
  g.mission = { def, got: 0, until: g.world.time + MISSION_SECS };
  showMissions(g);
  g.emit('message', { text: `TICKET ${String(1000 + c.tickets * 37).padStart(5, '0')}: ${def.text}`, sub: def.how, scene: 'ticket', sound: 'modeStart' });
};
const missionStep = (g, key) => {
  const m = g.mission; if (!m || m.def.on !== key) return;
  m.got++;
  if (m.got < m.def.need) return;
  const c = g.player.counts;
  const first = !c[`done_${m.def.id}`];
  c[`done_${m.def.id}`] = 1;
  const v = 25000 * (c.solved = (c.solved ?? 0) + 1);
  g.addScore(v);
  g.mission = null; showMissions(g);
  g.emit('message', { text: m.def.text, sub: `ANDY IS NOT IMPRESSED  ${fmt(v)}`, scene: m.def.id === 'bluescreen' ? 'bluescreen' : m.def.id === 'replyall' ? 'email' : 'reboot', sound: 'jackpot' });
  if (first && MISSIONS.every(x => c[`done_${x.id}`])) {
    g.addScore(250000); g.lamps.xball = 2;
    g.emit('message', { text: 'WORST USER OF THE YEAR', sub: '250,000  EXTRA BALL AT THE HELP DESK', scene: 'meltdown' });
  }
  annoy(g, 20);
};
const endMission = (g, quiet = false) => {
  if (!g.mission) return;
  g.mission = null; showMissions(g);
  if (!quiet) g.emit('message', { text: 'TICKET CLOSED', sub: 'NO FAULT FOUND', sound: 'modeEnd' });
};
const missionTick = g => { if (g.mission && g.world.time > g.mission.until) endMission(g); };

// ---------- Andy and his Server Room ----------
const hitAndy = g => {
  if (multi(g)) { g.rules.act([['jackpot', 25000], ['message', 'JACKPOT', 'ANDY IS FUMING', 'meltdown']]); return; }
  g.addScore(1000 * (1 + Math.floor(anger(g) / 20)));
  const lines = ['HAVE YOU TRIED TURNING IT OFF AND ON', 'IS THE WIFI DOWN?', 'MY MOUSE IS BROKEN', 'WHERE DO I SAVE THINGS?', 'CAN I HAVE ADMIN RIGHTS?'];
  g.emit('message', { text: 'PING', sub: lines[Math.floor(Math.random() * lines.length)] });
  annoy(g, 3);
};
const serverRoom = g => {
  if (multi(g)) {
    g.rules.act([['jackpot', 50000], ['message', 'JACKPOT', 'SERVER ROOM 50,000', 'meltdown']]);
    g.player.counts.jps = (g.player.counts.jps ?? 0) + 1;
    if (g.player.counts.jps % 3 === 0) { g.lamps.superJp = 2; g.emit('message', { text: 'ANDY HAS GONE HOME', sub: 'SUPER JACKPOT AT THE HELP DESK' }); }
    return;
  }
  g.addScore(5000);
  if (g.mission?.def.on !== 'saucer:servers') g.emit('message', { text: 'UNAUTHORISED ACCESS', sub: 'SERVER ROOM 5,000' });
  annoy(g, 5);
};

// ---------- Desk Pranks: a reaction game on the dot matrix, while the Help Desk holds the ball ----------
// Andy pops up over the left or the right desk: press that flipper button to ping him with a rubber band before
// he ducks down. Don't ping the boss: three strikes and it's over.
// dp: { pops: [{ side, who: 'andy' | 'boss', at, until, res }], start, secs, hits, strikes, over, next }
export const PRANK_SECS = 20;
const startVideo = (g, v, secs) => { g.holdSaucer('helpdesk', secs + 5); g.video = v; };
const endVideo = (g, after = 1.2) => g.after(after, () => { g.video = null; g.releaseSaucer('helpdesk'); });
export const deskPranks = g => {
  g.lamps.pranks = 0;
  const t = g.world.time;
  const dp = { pops: [], start: t + 1.5, secs: PRANK_SECS, hits: 0, strikes: 0, over: false, next: t + 1.8 };
  startVideo(g, { kind: 'pranks', dp, draw: (api, now) => drawPranks(api, dp, now), flip: side => ping(g, dp, side) }, PRANK_SECS + 2);
  g.emit('message', { text: 'DESK PRANKS', sub: 'PING ANDY, NOT THE BOSS', sound: 'modeStart' });
};
const ping = (g, dp, side) => {
  if (dp.over) return;
  const t = g.world.time;
  const p = dp.pops.find(x => !x.res && x.side === side && t >= x.at && t < x.until);
  if (!p) return;
  if (p.who === 'andy') { p.res = 'hit'; p.resAt = t; dp.hits++; g.addScore(3000 * dp.hits); g.emit('sound', { name: 'target' }); annoy(g, 1); }
  else { p.res = 'strike'; p.resAt = t; dp.strikes++; g.emit('sound', { name: 'drain' }); if (dp.strikes >= 3) pranksOver(g, dp); }
};
const pranksTick = g => {
  const dp = g.video?.dp; if (!dp || dp.over) return;
  const t = g.world.time;
  if (t < dp.start) return;
  if (t >= dp.next) {
    const into = (t - dp.start) / dp.secs, side = Math.random() < 0.5 ? 'left' : 'right';
    if (!dp.pops.some(x => !x.res && x.side === side && t < x.until)) dp.pops.push({ side, who: Math.random() < 0.22 ? 'boss' : 'andy', at: t, until: t + Math.max(0.5, 1.0 - 0.5 * into) });
    dp.next = t + Math.max(0.45, 1.1 - 0.6 * into);
  }
  for (const p of dp.pops) if (!p.res && t >= p.until) p.res = 'gone';
  dp.pops = dp.pops.filter(p => !(p.res && t - (p.resAt ?? p.until) > 0.6));
  if (t >= dp.start + dp.secs) pranksOver(g, dp);
};
const pranksOver = (g, dp) => {
  dp.over = true;
  const clean = dp.strikes === 0 && dp.hits >= 10;
  if (clean) g.addScore(50000);
  g.emit('message', { text: `PINGED ${dp.hits} TIMES`, sub: dp.strikes >= 3 ? 'CAUGHT BY THE BOSS' : clean ? 'NEVER CAUGHT 50,000' : 'BACK TO WORK', now: true, sound: dp.strikes >= 3 ? 'modeEnd' : 'jackpot' });
  g.lamps.kbL = 1;
  endVideo(g, 2);
};

// ---------- the Help Desk scoop: the first thing lit wins ----------
const helpDesk = g => {
  if (g.lamps.superJp) { g.lamps.superJp = 0; g.rules.act([['jackpot', 250000], ['message', 'SUPER JACKPOT', '250,000', 'meltdown']]); return; }
  if (multi(g)) { g.addScore(5000); return; }
  if (g.lamps.pranks) return deskPranks(g);
  if (g.lamps.ticket && !g.mission) return raiseTicket(g);
  if (g.lamps.xball) { g.lamps.xball = 0; g.rules.act([['extraBall'], ['message', 'EXTRA BALL']]); return; }
  g.rules.act([['score', 2500], ['bonus', 500], ['message', 'HELP DESK', 'PLEASE HOLD']]);
};

export default {
  id: 'angryandy',
  name: 'Angry Andy',
  tagline: 'Wind up the Head of IT: raise tickets, reply all, unplug the server. Desk Pranks on the dot matrix.',
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
  colours: { field: '#1a2a3a', wall: '#e0e8f0', wallDark: '#2a3a4a', wallHi: '#ffffff', rubber: '#f0f4f8', bumper: '#3a6ad8', lamp: '#ff6a3a',
    ramp: '#3a8ad8', rampDark: '#14305a', wire: '#e8f4ff', sling: '#d83a3a', slingDark: '#5a1010', slingHi: '#ff9a9a', name: 'rgba(220,235,255,0.5)' },

  lane: { x0: 294, x1: 312, yTop: 182 },
  plunger: { x0: 294, x1: 312, y: 604, maxPull: 22, minSpeed: 250, maxSpeed: 1350 },
  flippers: [
    { id: 'flipL', side: 'left', pivot: [102, 566], length: 46 },
    { id: 'flipR', side: 'right', pivot: [200, 566], length: 46 },
  ],

  walls: [
    { arc: { c: [160, 160], R: 152, from: 180, to: 360 } },
    // left: the Password Reset orbit runs up between the wall and a guide
    { path: [[8, 160], [8, 340], [20, 380], [20, 650]] },
    { path: [[38, 206], [38, 296]], r: 2 },
    // the Help Desk scoop at its foot, with a backstop round its far side
    { path: arcPts([58, 326], 20, 190, 350, 16), r: 2 },
    // the Server Room: open at the bottom, its back slanted (so nothing rests on top); its right side is also the
    // first C-A-D lane post
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
    // C-A-D lane posts
    { path: [[228, 64], [228, 92]], r: 2 },
    { path: [[248, 64], [248, 92]], r: 2 },
    { path: [[268, 64], [268, 92]], r: 2 },
  ],
  posts: [{ c: [116, 126], R: 3 }, { c: [208, 126], R: 3 }],
  gates: [
    { a: [294, 200], b: [312, 188], oneWay: [0, -1] },
    { a: [9, 176], b: [37, 200], oneWay: [0, -1] },
    // on the top arc: a plunge bounces back into the C-A-D lanes; a ball from the Password Reset passes
    { a: [160, 9], b: [162, 34], oneWay: [1, 0] },
  ],

  ramps: [
    // the Email Chain: up the right, over the C-A-D lanes and down to the right inlane
    { id: 'email', style: 'wire', width: 16, mouth: 28, minSpeed: 300, assist: 700, score: 1500, funnel: [16, 8],
      path: joinPath([[198, 352], [216, 306], [222, 270], [222, 124]], arcPts([240, 124], 18, 180, 360, 15), [[258, 124], [258, 414]]) },
  ],
  bumpers: [
    { id: 'mon1', art: 'monitor', c: [52, 112], R: 12, score: 100 },
    { id: 'mon2', art: 'monitor', c: [86, 94], R: 12, score: 100 },
    { id: 'mon3', art: 'monitor', c: [72, 148], R: 12, score: 100 },
  ],
  slings: [
    { id: 'slingL', points: leftSling },
    { id: 'slingR', points: mirror(leftSling) },
  ],
  // PAPER: the printer's paper tray, three targets slanted so nothing rests on them
  dropBanks: [
    { id: 'paper', score: 750, targets: [[tray(0), tray(0.3)], [tray(0.35), tray(0.65)], [tray(0.7), tray(1)]] },
  ],
  saucers: [
    // the Server Room: the ball goes down a subway and comes back out above the flippers
    { id: 'servers', c: [162, 106], R: 22, hold: 1.4, score: 1000, exit: [110, 418], eject: { dir: [0.35, 1], speed: 200 } },
    { id: 'helpdesk', c: [58, 326], R: 14, hold: 1.2, score: 1000, eject: { dir: [0.35, 1], speed: 220 } },
  ],
  // Andy, pacing about in front of his Server Room (drawn by the toy below, redder as he gets angrier)
  targets: [{ id: 'andy', a: [150, 134], b: [174, 134], move: { by: [30, 0], secs: 6 }, score: 250, bar: false }],
  toys: [
    { art: g => (anger(g) >= 60 || multi(g) ? 'andy-red' : 'andy'), at: g => { const [a, b] = g.targetAt('andy'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 7]; } },
  ],
  spinners: [{ id: 'reset', a: [10, 260], b: [36, 260], score: 100 }],
  kickbacks: [{ id: 'kbL', a: [21, 540], b: [33, 540], dir: [0, -1], speed: 950 }],
  lanes: [
    { id: 'laneC', a: [210, 82], b: [226, 82], label: 'C', marquee: true },
    { id: 'laneA', a: [230, 82], b: [246, 82], label: 'A', marquee: true },
    { id: 'laneD', a: [250, 82], b: [266, 82], label: 'D', marquee: true },
    { id: 'orbit', a: [266, 240], b: [292, 240], score: 1000 },
  ],
  inserts: [
    ...SKILL.map((id, i) => ({ id, c: [218 + i * 20, 52], art: 'lamp-plug', colour: '#ffffff' })),
    // the anger meter in front of Andy
    ...[1, 2, 3, 4, 5].map(i => ({ id: `anger${i}`, c: [126 + i * 12, 176 - (i === 3 ? 4 : i === 2 || i === 4 ? 2 : 0)], art: 'lamp-angry', colour: '#ff3a3a' })),
    // the six missions
    { id: 'm_printer', c: [118, 300], art: 'lamp-printer', colour: '#ffffff' },
    { id: 'm_password', c: [138, 306], art: 'lamp-key', colour: '#ffd040' },
    { id: 'm_replyall', c: [158, 308], art: 'lamp-email', colour: '#ffffff' },
    { id: 'm_bluescreen', c: [178, 306], art: 'monitor', colour: '#5a9aff' },
    { id: 'm_unplug', c: [198, 300], art: 'lamp-plug', colour: '#ffffff' },
    { id: 'm_quicklook', c: [158, 326], art: 'lamp-phone', colour: '#ffffff' },
    { id: 'ticket', c: [44, 360], art: 'lamp-ticket', colour: '#ffd040' },
    { id: 'pranks', c: [72, 360], art: 'lamp-band', colour: '#ff5a5a' },
    { id: 'superJp', c: [58, 380], art: 'lamp-coffee', colour: '#ffd040' },
    { id: 'xball', c: [154, 350], art: 'lamp-xball', colour: '#ff9a3a' },
    { id: 'paperLit', c: [92, 252], art: 'lamp-printer', colour: '#ffd040', lit: g => (g.lamps.pranks ? 2 : g.mission?.def.id === 'printer' ? 2 : 0) },
    { id: 'emailLit', c: [206, 378], art: 'lamp-email', colour: '#5ae8ff', lit: g => (g.mission?.def.id === 'replyall' ? 2 : 0) },
    { id: 'fire1', c: [130, 400], art: 'lamp-fire', colour: '#ff9a3a' },
    { id: 'fire2', c: [151, 404], art: 'lamp-fire', colour: '#ff9a3a' },
    { id: 'fire3', c: [172, 400], art: 'lamp-fire', colour: '#ff9a3a' },
    { id: 'kbL', c: [27, 505], art: 'lamp-floppy', colour: '#5aff8a' },
    { id: 'x2', c: [112, 540], marquee: true, label: '2' },
    { id: 'x3', c: [128, 546], marquee: true, label: '3' },
    { id: 'x4', c: [174, 546], marquee: true, label: '4' },
    { id: 'x5', c: [190, 540], marquee: true, label: '5' },
    { id: 'save', c: [151, 550], art: 'lamp-star', colour: '#5aff8a', lit: g => (g.timeLeftSave > 0 ? 2 : 0) },
  ],
  instructions: [
    { title: 'ANDY', items: [
      { art: 'andy', text: 'ANDY IS THE HEAD OF IT. YOUR JOB IS TO WIND HIM UP. HIS ANGER METER IS UNDER THE SCORE.' },
      { art: 'lamp-angry', text: 'PING ANDY AS HE PACES ABOUT, BREAK INTO HIS SERVER ROOM, AND FINISH IT MISSIONS TO MAKE HIM ANGRIER.' },
      { art: 'lamp-fire', text: 'AT 100% HE HAS A MELTDOWN: MELTDOWN MULTIBALL. HITTING ANDY IS A 25,000 JACKPOT, THE SERVER ROOM 50,000. THREE LIGHT THE SUPER JACKPOT AT THE HELP DESK.' },
    ] },
    { title: 'IT MISSIONS', items: [
      { marquee: 'C', text: 'LIGHT C-A-D (CTRL ALT DEL) IN THE TOP LANES TO RAISE A TICKET AT THE HELP DESK (THE SCOOP ON THE LEFT).' },
      { art: 'lamp-ticket', text: 'EACH TICKET IS A MISSION, WITH 30 SECONDS TO DO IT: PRINTER JAMMED, FORGOT MY PASSWORD, REPLY ALL, BLUE SCREEN, UNPLUGGED THE SERVER, AND CAN YOU JUST HAVE A QUICK LOOK.' },
      { art: 'lamp-star', text: 'DO ALL SIX TO BE WORST USER OF THE YEAR: 250,000 AND AN EXTRA BALL.' },
    ] },
    { title: 'DESK PRANKS', items: [
      { art: 'lamp-band', text: 'KNOCK DOWN THE PAPER TRAY TO LIGHT DESK PRANKS: ANDY POPS UP OVER THE LEFT OR RIGHT DESK. PRESS THAT FLIPPER BUTTON TO PING HIM WITH A RUBBER BAND.' },
      { art: 'lamp-coffee', text: 'DON\'T PING THE BOSS: THREE STRIKES AND YOU\'RE CAUGHT.' },
      { art: 'lamp-floppy', text: 'THE KICKBACK IS THE BACKUP. BALL SAVE: WHILE THE STAR FLASHES, A LOST BALL IS SERVED AGAIN.' },
    ] },
  ],

  startLamps: { kbL: 1 },
  lampGroups: {
    cad: { lamps: LANES, rotate: true, reset: true },
    skill: { lamps: SKILL, rotate: true },
  },

  script: g => ({
    start: () => { g.video = null; g.mission = null; },
    tick: () => { missionTick(g); pranksTick(g); },
  }),

  rules: [
    { on: 'serve', do: [showBonusX, pickSkill, showMissions, showAnger, g => { g.video = null; }] },
    { on: 'drain', do: [g => endMission(g, true)] },

    // skill shot
    ...LANES.map((id, i) => ({ on: `lane:${id}`, if: { lit: SKILL[i] }, do: [['score', 15000], ['message', 'SKILL SHOT', 'TURNED IT OFF AND ON AGAIN', 'reboot']] })),
    { on: ['lane', 'bumper', 'sling', 'hit', 'drop', 'spin', 'ramp', 'saucer'], do: [['lamp', SKILL, 0]] },

    // C-A-D: bonus multiplier, and a ticket
    ...LANES.map(id => ({ on: `lane:${id}`, do: [['lamp', id, 1]] })),
    { on: 'complete:cad', do: [['score', 5000], ['bonus', 1000], ['bonusX', 1], showBonusX,
      g => { if (!multi(g) && !g.mission) { g.lamps.ticket = 2; g.emit('message', { text: 'CTRL ALT DEL', sub: 'RAISE A TICKET AT THE HELP DESK' }); } }] },

    // mission progress
    ...[...new Set(MISSIONS.map(m => m.on))].map(key => ({ on: key, do: [g => missionStep(g, key)] })),

    { on: 'saucer:servers', do: [serverRoom] },
    { on: 'saucer:helpdesk', do: [helpDesk] },
    { on: 'hit:andy', do: [['sound', 'target'], hitAndy] },
    { on: 'ramp:email', do: [['bonus', 500]] },

    // Desk Pranks reads the flipper buttons
    { on: 'flip:left', do: [g => g.video?.flip('left')] },
    { on: 'flip:right', do: [g => g.video?.flip('right')] },

    { on: 'drop', do: [['bonus', 100]] },
    { on: 'bankDown:paper', do: [['score', 5000], ['lamp', 'pranks', 2], ['message', 'OUT OF PAPER', 'DESK PRANKS AT THE HELP DESK', 'ticket']] },
    { on: 'spin:reset', do: [['count', 'resets', 1]] },
    { on: 'spin:reset', if: { count: ['resets', '>=', 25] }, do: [['setCount', 'resets', 0], ['lamp', 'kbL', 1], ['ballSave', 12], ['message', 'BACKUP RESTORED', 'KICKBACK AND BALL SAVE', 'reboot']] },
    { on: 'lane:orbit', do: [['bonus', 250]] },

    { on: 'multiballEnd', do: [['lamp', 'superJp', 0]] },
  ],
};
