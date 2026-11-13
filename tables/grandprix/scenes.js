// Grand Prix dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the two games played on it:
// the Pit Stop and the Start Lights (drawPitStop, drawLights; their rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);
const blink = (t, n = 6) => (Math.floor(t * n) % 2 ? 2 : 1);

// an open-wheel racing car from the side, facing right (28 x 9)
const CAR = pic([
  '##                          ',
  '###                         ',
  '####          ##            ',
  ' ++######### ####           ',
  '  ++++++++++#######++++++## ',
  ' ###   +++++++++++   ###  ##',
  '#####  ++++++++++   #####   ',
  '#####               #####   ',
  ' ###                 ###    ',
]);
// the car from above, nose up (11 x 18), for the pit stop
const TOP = pic([
  '    ###    ', '   #####   ', '    ###    ', '    ###    ', '##  ###  ##', '##+#####+##', '##  ###  ##', '    ###    ', '    #+#    ',
  '    #+#    ', '   #####   ', '   #####   ', '##+#####+##', '##+#####+##', '##+#####+##', '##  ###  ##', '  #######  ', '  #######  ',
]);
const TROPHY = pic([
  ' ############### ', '##+++++++++++++##', '# #+++++++++++# #', '#  #+++++++++#  #', ' #  #+++++++#  # ', '  ## #+++++# ##  ', '     #+++#       ',
  '      #+#        ', '      #+#        ', '     #####       ', '    #######      ', '   #########     ',
]);
const road = api => { for (let x = 0; x < 160; x += 2) api.set(x, 31, 1); for (let x = 0; x < 160; x += 12) { api.set(x, 26, 1); api.set(x + 1, 26, 1); api.set(x + 2, 26, 1); } };
const speedLines = (api, t) => { for (let i = 0; i < 6; i++) { const y = 3 + i * 4, x = 160 - ((t * 300 + i * 53) % 200); for (let k = 0; k < 12; k++) api.set(Math.round(x + k), y, 1); } };
const chequer = (api, x0, y0, w, h, s, t) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((Math.floor((x + Math.floor(t * 8)) / s) + Math.floor(y / s)) % 2) api.set(x0 + x, y0 + y, 2); };
const lightsRow = (api, n, cx, y, on) => { for (let i = 0; i < 5; i++) { const x = cx - 44 + i * 20; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10) api.set(x + a, y + b, i < n && on ? 2 : 1); } };

// Lights out: five red lights, then away
export const lightsout = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    const k = p / 0.55;
    if (k < 0.7) lightsRow(api, Math.ceil(k / 0.14), 80, 8, true);
    else { road(api); draw(api, CAR, -30 + (k - 0.7) / 0.3 * 200, 17); speedLines(api, t); }
  },
};
// An overtake: two cars, ours goes by
export const overtake = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const k = p / 0.5;
    road(api);
    draw(api, CAR, 60, 4, 1);
    draw(api, CAR, -30 + k * 170, 17);
    speedLines(api, t);
  },
};
// A lap: the car flashes across the line
export const lap = {
  secs: 2,
  draw(api, p, lines, t) {
    if (p > 0.45) { words(api, lines); return; }
    const k = p / 0.45;
    road(api);
    for (let y = 0; y < 31; y += 2) { api.set(80, y, 2); api.set(81, y + 1, 2); }
    draw(api, CAR, -30 + k * 200, 17);
  },
};
// The chequered flag waves
export const flag = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const wave = x => Math.round(Math.sin(t * 8 + x / 8) * 2);
    for (let x = 0; x < 64; x++) for (let y = 0; y < 22; y++) if ((Math.floor(x / 6) + Math.floor(y / 6)) % 2) api.set(48 + x, 4 + y + wave(x), 2);
    for (let y = 2; y < 32; y++) api.set(47, y, 2);
  },
};
// A win: the trophy rises, then champagne spray
export const podium = {
  secs: 3.2,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: blink(t) }); return; }
    const k = Math.min(1, p / 0.3);
    draw(api, TROPHY, 71, 32 - k * 26);
    if (p > 0.3) for (let i = 0; i < 30; i++) { const a = i * 0.21, r = ((p - 0.3) * 120 + i * 3) % 40; api.set(Math.round(20 + Math.cos(a) * r), Math.round(30 - Math.sin(a) * r * 0.7), 1); api.set(Math.round(140 - Math.cos(a) * r), Math.round(30 - Math.sin(a) * r * 0.7), 1); }
  },
};
// The world championship: chequered flags either side of the trophy
export const champion = {
  secs: 3.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: blink(t, 8) }); return; }
    chequer(api, 0, 0, 40, 32, 4, t);
    chequer(api, 120, 0, 40, 32, 4, t);
    draw(api, TROPHY, 71, 32 - Math.min(1, p / 0.3) * 26);
  },
};

// ---------- the Pit Stop ----------
// ps: { wheel, sides, start, times, phase, time, fumble }. The car from above in the middle; the wheel to change
// next flashes, with an arrow on its side.
export function drawPitStop(api, ps, t) {
  draw(api, TOP, 74, 7);
  for (let y = 4; y < 29; y += 2) { api.set(60, y, 1); api.set(99, y, 1); }    // the pit box
  // a dot by each wheel changed so far (the first two at the front, the last two at the back)
  const at = i => [ps.sides[i] === 'left' ? 74 : 83, i < 2 ? 11 : 19];
  for (let i = 0; i < Math.min(ps.wheel, 4); i++) { const [x, y] = at(i); api.set(x - 3 + (ps.sides[i] === 'left' ? 0 : 6), y, 2); }
  if (ps.phase !== 'done' && t >= ps.start && ps.wheel < 4) {
    const side = ps.sides[ps.wheel], y = ps.wheel < 2 ? 12 : 20, v = blink(t, 8);
    if (side === 'left') for (let i = 0; i < 6; i++) { api.set(52 - i, y - i, v); api.set(52 - i, y + i, v); api.set(52 - i, y, v); }
    else for (let i = 0; i < 6; i++) { api.set(107 + i, y - i, v); api.set(107 + i, y + i, v); api.set(107 + i, y, v); }
    api.text(side === 'left' ? 'LEFT' : 'RIGHT', side === 'left' ? 2 : 158, 2, { align: side === 'left' ? 'left' : 'right', v: 1 });
  }
  if (t < ps.start) api.text('READY', 80, 2, { align: 'center', v: blink(t, 4) });
  const secs = ps.phase === 'done' ? ps.time : Math.max(0, t - ps.start);
  api.text(`${secs.toFixed(1)}S`, 159, 24, { align: 'right' });
  api.text(`${Math.min(ps.wheel, 4)}/4`, 2, 24, { v: 1 });
  if (ps.fumble && t - ps.fumble < 0.6) api.text('FUMBLE', 80, 26, { align: 'center' });
}

// ---------- the Start Lights ----------
// sl: { on, out, press, phase, result }. Five lights come on one a second-ish, then all go out together.
export function drawLights(api, sl, t) {
  const n = t < sl.on ? 0 : Math.min(5, 1 + Math.floor((t - sl.on) / 0.7));
  const out = t >= sl.out;
  for (let i = 0; i < 5; i++) {
    const x = 36 + i * 22;
    for (let y = 2; y < 18; y++) { api.set(x - 6, y, 1); api.set(x + 6, y, 1); }
    for (const yy of [8, 14]) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10) api.set(x + a, yy + b, i < n && !out ? 2 : 0);
  }
  road(api);
  if (sl.phase === 'done' && sl.result !== null) {
    draw(api, CAR, sl.result < 0 ? 4 : 4 + Math.min(1, (t - sl.press) / 1) * 130, 21);
    api.text(sl.result < 0 ? 'JUMP' : `${sl.result.toFixed(2)}`, 159, 2, { align: 'right' });
  } else draw(api, CAR, 4, 21);
  if (t < sl.on) api.text('WAIT FOR IT', 80, 22, { align: 'center', small: true, v: 1 });
}

export default { lightsout, overtake, lap, flag, podium, champion };
