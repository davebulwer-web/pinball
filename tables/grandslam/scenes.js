// Grand Slam dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the two games played on it:
// the Home Run Derby and the Diving Catch (drawDerby, drawCatch; their rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);
const dot = (api, x, y, v = 2) => { x = Math.round(x); y = Math.round(y); api.set(x, y, v); api.set(x + 1, y, v); api.set(x, y + 1, v); api.set(x + 1, y + 1, v); };
const ground = (api, y = 31) => { for (let x = 0; x < 160; x += 2) api.set(x, y, 1); };

// a batter waiting and swinging (14 x 18), facing right
const BATTER = [pic([
  '     ###      ', '    #####     ', '     ###  +   ', '      #  +    ', '    #####+    ', '   # ###      ', '   # ###      ', '    #####     ',
  '     ###      ', '     ###      ', '    ## ##     ', '    #   #     ', '   ##   ##    ', '   #     #    ', '  ##     ##   ',
]), pic([
  '     ###      ', '    #####     ', '     ###      ', '      #       ', '    ########++', '   # ###      ', '   # ###      ', '    #####     ',
  '     ###      ', '     ###      ', '    ## ##     ', '    #   #     ', '   ##   ##    ', '   #     #    ', '  ##     ##   ',
])];
// a pitcher winding up and throwing (12 x 15), facing left
const PITCHER = [pic([
  '    ###     ', '   #####    ', '    ###  #  ', '     # ##   ', '   #####    ', '   ###      ', '   ###      ', '   #####    ',
  '    ###     ', '    ###     ', '   ## ##    ', '   #   #    ', '  ##   ##   ', '  #     #   ', ' ##     ##  ',
]), pic([
  '    ###     ', '   #####    ', '    ###     ', '     #      ', '######      ', '   ###      ', '   ###      ', '   #####    ',
  '    ###     ', '    ###     ', '   ## ##    ', '   #   #    ', '  ##    ##  ', '  #      #  ', ' ##       ##',
])].map(flipX);
// a runner (10 x 12), two frames
const RUNNER = [pic([
  '   ###    ', '  #####   ', '   ###   ', '    #     ', '  ####### ', ' # ###    ', '   ###    ', '   ####   ', '  ##  ##  ', ' ##    ## ', '##      # ', '        # ',
]), pic([
  '   ###    ', '  #####   ', '   ###   ', '    #     ', '   #####  ', '  ####    ', '   ###    ', '   ###    ', '   ###    ', '   ##     ', '  # #     ', '  #  #    ',
])];
// a fielder with his glove up (11 x 15)
const FIELDER = pic([
  '        ###', '   ###  ###', '  ##### ## ', '   ###  #  ', '    #  #   ', '  ######   ', ' # ###     ', ' # ###     ',
  '   ###     ', '   ###     ', '  ## ##    ', '  #   #    ', ' ##   ##   ', ' #     #   ', '##     ##  ',
]);
const PENNANT = pic([
  '#################', '#+++++++++++++#  ', '#++++++++++++#   ', '#+++++++++++#    ', '#++++++++++#     ', '#+++++++++#      ', '#++++++++#       ',
  '#+++++++#        ', '#++++++#         ', '#+++++#          ', '#++++#           ', '#+++#            ', '#++#             ', '##               ',
  '#                ', '#                ', '#                ', '#                ', '#                ', '#                ',
]);
const HOTDOG = pic([' ################ ', '#++++++++++++++++#', '##################', '#++++++++++++++++#', ' ################ ']);
// the outfield wall and fans: a row of heads bobbing
const crowd = (api, t, y = 4) => { for (let x = 2; x < 160; x += 6) { const b = Math.floor(t * 8 + x) % 3 === 0 ? 1 : 0; api.set(x, y - b, 1); api.set(x + 1, y - b, 1); } };

// A hit: crack of the bat, the ball flies off
export const hit = {
  secs: 2,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    ground(api);
    const k = p / 0.5;
    draw(api, BATTER[k > 0.2 ? 1 : 0], 14, 16);
    if (k < 0.2) dot(api, 140 - k * 5 * 110, 22);
    else { const f = (k - 0.2) / 0.8; dot(api, 28 + f * 130, 22 - Math.sin(f * Math.PI * 0.8) * 16); }
  },
};
// Runs score: a runner slides into home
export const run = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    ground(api);
    const k = p / 0.5;
    for (let x = 118; x < 130; x++) api.set(x, 30, 2);   // home plate
    if (k < 0.75) draw(api, RUNNER[Math.floor(t * 10) % 2], -10 + k / 0.75 * 112, 19);
    else { for (let x = 0; x < 16; x++) api.set(104 + x, 29, 2); for (let x = 0; x < 8; x++) api.set(110 + x, 27, 2); api.text('SAFE', 124, 8, { align: 'center' }); }
  },
};
// A home run: the ball sails over the wall into the crowd
export const homerun = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    const k = p / 0.55;
    crowd(api, t);
    for (let x = 110; x < 160; x++) api.set(x, 12, 2);                 // the outfield wall
    for (let y = 12; y < 32; y += 3) api.set(110, y, 1);
    ground(api);
    draw(api, BATTER[1], 4, 16);
    const f = k; dot(api, 18 + f * 140, 22 - Math.sin(f * Math.PI * 0.7) * 22);
    for (let i = 1; i < 6; i++) { const g = Math.max(0, f - i * 0.04); api.set(Math.round(18 + g * 140), Math.round(22 - Math.sin(g * Math.PI * 0.7) * 22), 1); }
  },
};
// A grand slam: four runners and fireworks
export const grandslam = {
  secs: 3.4,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: Math.floor(t * 8) % 2 ? 2 : 1 }); return; }
    ground(api);
    const k = p / 0.6;
    for (let i = 0; i < 4; i++) draw(api, RUNNER[Math.floor(t * 10 + i) % 2], -40 + k * 150 + i * 30, 19);
    for (let i = 0; i < 3; i++) { const r = ((p * 60) + i * 7) % 16; for (let a = 0; a < 6.28; a += 0.45) api.set(Math.round(30 + i * 50 + Math.cos(a) * r * 1.4), Math.round(9 + Math.sin(a) * r * 0.5), 1); }
  },
};
// An out: the fielder makes the catch
export const out = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    ground(api);
    const k = p / 0.5;
    draw(api, FIELDER, 74, 16);
    if (k < 0.8) dot(api, 10 + k / 0.8 * 72, 2 + Math.pow(k / 0.8 - 0.6, 2) * 30);
    else api.text('OUT', 120, 10, { sc: 2, align: 'center' });
  },
};
// A strikeout: three strikes, one at a time
export const strikeout = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    const k = p / 0.55;
    ground(api);
    draw(api, BATTER[Math.floor(k * 6) % 2], 10, 16);
    for (let i = 0; i < 3; i++) if (k > i * 0.3) { const x = 70 + i * 26; for (let d = 0; d < 9; d++) { api.set(x + d, 8 + d, 2); api.set(x + 8 - d, 8 + d, 2); } }
  },
};
// The side is retired: a scoreboard flickers on
export const inning = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.45) { words(api, lines); return; }
    const k = p / 0.45;
    for (let x = 4; x < 156; x++) { api.set(x, 1, 1); api.set(x, 30, 1); }
    for (let y = 1; y < 31; y++) { api.set(4, y, 1); api.set(155, y, 1); }
    for (let i = 0; i < 9; i++) if (k > i / 12) { api.text(String(i + 1), 18 + i * 15, 6, { v: 1 }); api.text(String((i * 7) % 3 ? 0 : 1), 18 + i * 15, 18); }
  },
};
// The seventh inning stretch: the crowd stands up, a hot dog goes by
export const stretch = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const k = p / 0.5;
    for (let x = 4; x < 160; x += 8) { const up = Math.floor(t * 6 + x / 8) % 2; api.set(x, 22 - up * 4, 2); api.set(x + 1, 22 - up * 4, 2); for (let y = 24 - up * 4; y < 31; y++) api.set(x, y, 1); }
    draw(api, HOTDOG, -20 + k * 180, 4);
  },
};
// Hit for the cycle: four bases light one after another
export const cycle = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    const k = p / 0.55, pts = [[80, 28], [110, 16], [80, 4], [50, 16]];
    pts.forEach(([x, y], i) => { const lit = k > i * 0.22; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Math.abs(a) + Math.abs(b) <= 3) api.set(x + a, y + b, lit ? 2 : 1); });
    const j = Math.min(4, k / 0.22), i = Math.floor(j) % 4, f = j - Math.floor(j);
    const [a, b] = [pts[i], pts[(i + 1) % 4]];
    if (j < 4) draw(api, RUNNER[Math.floor(t * 10) % 2], a[0] + (b[0] - a[0]) * f - 5, a[1] + (b[1] - a[1]) * f - 10);
  },
};
// Winning the game: the pennant rises
export const win = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    crowd(api, t, 30);
    const k = Math.min(1, p / 0.3);
    draw(api, PENNANT, 72 + Math.sin(t * 6), 32 - k * 28);
  },
};

// ---------- the Home Run Derby ----------
// hd: { pitch, homers, results, phase: 'pitch' | 'result' | 'done', at, secs, swing, result, resultAt }.
// The pitcher on the right throws; the ball crosses the plate (by the batter on the left) at `at + secs`.
export const PLATE_X = 30, MOUND_X = 128;
export function drawDerby(api, hd, t) {
  ground(api);
  for (let x = PLATE_X - 3; x <= PLATE_X + 3; x++) api.set(x, 30, 2);
  const swung = hd.swing != null && t - hd.swing < 0.4;
  draw(api, BATTER[swung ? 1 : 0], PLATE_X - 18, 16);
  draw(api, PITCHER[hd.phase === 'pitch' && t > hd.at - 0.3 && t < hd.at + 0.15 ? 1 : 0], MOUND_X, 16);
  if (hd.phase === 'pitch') {
    if (t < hd.at) api.text('PITCH ' + (hd.pitch + 1), 80, 2, { align: 'center', v: 1 });
    else { const k = (t - hd.at) / hd.secs; dot(api, MOUND_X - 2 + (PLATE_X - MOUND_X + 2) * k, 21 + Math.sin(Math.min(1, k) * Math.PI) * -2); }
  } else if (hd.phase === 'result' || hd.phase === 'done') {
    const f = Math.min(1, (t - hd.resultAt) / 1.2);
    if (hd.result === 'HOME RUN') dot(api, PLATE_X + f * 130, 21 - Math.sin(f * Math.PI * 0.7) * 20);
    else if (hd.result === 'HIT') dot(api, PLATE_X + f * 90, 21 - Math.sin(f * Math.PI) * 10);
    else if (hd.result === 'FOUL') dot(api, PLATE_X + f * 30, 21 - f * 22);
    if (hd.result) api.text(hd.result, 80, 2, { align: 'center', v: Math.floor(t * 6) % 2 ? 2 : 1 });
  }
  // the pitches so far, down the right: a full dot for a home run
  hd.results.forEach((r, i) => { const x = 148, y = 4 + i * 5; if (r === 'HOME RUN') dot(api, x, y); else if (r === 'HIT') api.set(x, y, 2); else api.set(x, y, 1); });
}

// ---------- the Diving Catch ----------
// dc: { spot, ball: { spot, at, secs }, n, caught, results, last, phase }. Five spots across the outfield; the
// fly ball's shadow shows where it will come down.
export const spotX = i => 16 + i * 32;
export function drawCatch(api, dc, t) {
  ground(api);
  for (let i = 0; i < 5; i++) api.set(spotX(i), 30, 2);
  draw(api, FIELDER, spotX(dc.spot) - 6, 16);
  const b = dc.ball;
  if (b && t >= b.at) {
    const k = Math.min(1, (t - b.at) / b.secs);
    for (let x = -2; x <= 2; x++) if (Math.floor(t * 8) % 2) api.set(spotX(b.spot) + x, 31, 2);    // the shadow
    dot(api, spotX(b.spot) - 1, -2 + k * 18);
  } else if (b) api.text('FLY BALL ' + (dc.n + 1), 80, 4, { align: 'center', v: 1 });
  if (dc.last && t - dc.last.at < 0.8) api.text(dc.last.ok ? 'CAUGHT' : 'DROPPED', 80, 4, { align: 'center' });
  api.text(`${dc.caught}/${dc.n}`, 159, 2, { align: 'right', v: 1 });
}

export default { hit, run, homerun, grandslam, out, strikeout, inning, stretch, cycle, win };
