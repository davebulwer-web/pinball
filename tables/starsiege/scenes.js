// Star Siege dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the Dogfight: a little
// side-scrolling space shooter played with the flipper buttons (drawDogfight; its rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);
// a fixed starfield (so the stars don't jump about from frame to frame)
const STARS = Array.from({ length: 40 }, (_, i) => [(i * 73 + 11) % 160, (i * 37 + 5) % 32, 1 + (i % 3)]);
const stars = (api, t, speed = 20) => STARS.forEach(([x, y, z]) => api.set(Math.round((x - t * speed * z) % 160 + 160) % 160, y, 1));

// our fighter, pointing right (13 x 7)
export const SHIP = pic([
  '  ##         ', '+ ####       ', '++######+    ', ' ###########', '++######+    ', '+ ####       ', '  ##         ',
]);
// an alien fighter, pointing left (9 x 7)
export const ALIEN = pic([' +##  +# ', '##+####  ', ' #######+', '#+## ##+#', ' #######+', '##+####  ', ' +##  +# ']);
// an asteroid (7 x 7)
export const ROCK = pic(['  +++  ', ' +#+++ ', '+++++#+', '++#++++', '+++++#+', ' ++#++ ', '  +++  ']);
// the mothership (36 x 12)
const MOTHER = pic([
  '              ########              ', '            ##+#++#+##            ', '         ####++++++++####         ',
  '   ##############################   ', ' ##+##+##+##+##+##+##+##+##+##+##+# ', '####################################',
  ' ################################## ', '   ##++##++##++##++##++##++##++##   ', '      ######################      ',
  '         ################         ', '            ##########            ', '               ####               ',
]);
const BOOM = [pic(['  +  ', ' +#+ ', '+###+', ' +#+ ', '  +  ']), pic(['+ # +', ' ### ', '#####', ' ### ', '+ # +']), pic(['# + #', '+   +', '  +  ', '+   +', '# + #'])];

// a ring of sparks that grows (an explosion) round x, y
const burst = (api, x, y, r, n = 16) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; api.set(Math.round(x + Math.cos(a) * r * 1.6), Math.round(y + Math.sin(a) * r), i % 2 ? 2 : 1); } };

// Mothership destroyed: it blows apart in a string of explosions
export const explode = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.62) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    stars(api, t, 4);
    const k = p / 0.62;
    if (k < 0.35) draw(api, MOTHER, 62 + Math.sin(t * 60) * (k * 4), 10);
    for (let i = 0; i < 6; i++) { const s = (k - i * 0.08) * 3; if (s > 0 && s < 1) burst(api, 66 + ((i * 37) % 30), 12 + ((i * 11) % 9), 2 + s * 10); }
    if (k > 0.3) burst(api, 80, 16, (k - 0.3) * 40, 28);
  },
};

// Hyperspace: the stars stretch into streaks rushing past
export const hyperspace = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    const len = Math.min(30, p * 90);
    STARS.forEach(([x, y, z], i) => {
      const a = (i / STARS.length) * 6.283, r = ((x + t * 120 * z) % 90);
      for (let s = 0; s < len * (r / 90); s += 1) api.set(Math.round(80 + Math.cos(a) * (r - s) * 1.8), Math.round(16 + Math.sin(a) * (r - s) * 0.4), s < 2 ? 2 : 1);
    });
  },
};

// Launch: fighters leave the hangar one after another
export const launch = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    stars(api, t, 10);
    for (let i = 0; i < 3; i++) { const k = Math.max(0, p * 2.4 - i * 0.3); draw(api, SHIP, -14 + k * k * 120, 3 + i * 10); }
  },
};

// Tractor beam: the mothership's beam reaches down, then pulls the ball up into it
export const beam = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    draw(api, MOTHER, 62, 0);
    const k = Math.min(1, p / 0.3);
    for (let y = 12; y < 12 + k * 20; y++) { const w = (y - 12) * 0.9; for (let x = -w; x <= w; x += 2) if ((y + Math.floor(t * 12)) % 3) api.set(Math.round(80 + x), y, 1); }
    if (k >= 1) { const by = 28 - ((p - 0.3) / 0.3) * 14; api.set(79, Math.round(by), 2); api.set(80, Math.round(by), 2); api.set(79, Math.round(by) + 1, 2); api.set(80, Math.round(by) + 1, 2); }
  },
};

// Event horizon: everything spirals into the black hole
export const horizon = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    for (let arm = 0; arm < 4; arm++) for (let k = 0; k < 40; k++) {
      const r = 40 - k, a = t * 4 + k * 0.18 + arm * 1.571;
      api.set(Math.round(80 + Math.cos(a) * r * 1.8), Math.round(16 + Math.sin(a) * r * 0.45), k > 30 ? 2 : 1);
    }
    for (let x = -3; x <= 3; x++) for (let y = -1; y <= 1; y++) api.set(80 + x, 16 + y, 0);
  },
};

// Shields down: the mothership's shield flickers and fails
export const shields = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    draw(api, MOTHER, 62, 10);
    if (Math.floor(t * (6 + p * 30)) % 2 && p < 0.4) for (let a = 0; a < 6.283; a += 0.12) api.set(Math.round(80 + Math.cos(a) * 30), Math.round(16 + Math.sin(a) * 15), 1);
  },
};

// ---------- the Dogfight ----------
// df: { lane, ship, shots: [{ x, lane }], foes: [{ x, lane, kind }], booms: [{ x, y, at }], kills, shields, start, secs,
//       hitAt, over }. The ship flies in one of three lanes on the left; shots go right; foes come in from the right.
export const LANE_Y = [3, 13, 23];
export const SHIP_X = 4;
export function drawDogfight(api, df, t) {
  stars(api, t, 12);
  // our ship, sliding between lanes; it flickers just after a hit
  const flick = t - df.hitAt < 0.8 && Math.floor(t * 16) % 2;
  if (!df.over && !flick) draw(api, SHIP, SHIP_X, df.ship - 3);
  for (const s of df.shots) { api.set(Math.round(s.x), LANE_Y[s.lane] + 3, 2); api.set(Math.round(s.x) + 1, LANE_Y[s.lane] + 3, 2); api.set(Math.round(s.x) + 2, LANE_Y[s.lane] + 3, 1); }
  for (const f of df.foes) draw(api, f.kind === 'rock' ? ROCK : ALIEN, f.x, LANE_Y[f.lane]);
  for (const b of df.booms) { const k = Math.floor((t - b.at) / 0.1); if (k < 3) draw(api, BOOM[k], b.x, b.y); }
  // the kill count and shields along the bottom right
  api.text(String(df.kills), 159, 1, { align: 'right' });
  for (let i = 0; i < 3; i++) if (i < df.shields) for (let d = 0; d < 4; d++) { api.set(150 + i * 4 + (d % 2), 27 + (d >> 1), 2); } else api.set(150 + i * 4, 28, 1);
  // time left, a bar across the top
  const left = Math.max(0, 1 - (t - df.start) / df.secs);
  for (let x = 0; x < 100 * left; x += 2) api.set(30 + x, 0, 1);
  if (t < df.start) api.text('READY', 80, 12, { align: 'center', v: Math.floor(t * 4) % 2 ? 2 : 1 });
}

export default { explode, hyperspace, launch, beam, horizon, shields };
