// Hole in One dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the two games played on it:
// the Putting Green and the Long Drive (drawPutting, drawDrive; their rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);
const dot = (api, x, y, v = 2) => { x = Math.round(x); y = Math.round(y); api.set(x, y, v); api.set(x + 1, y, v); api.set(x, y + 1, v); api.set(x + 1, y + 1, v); };

// a golfer at address and at the top of the swing (12 x 20)
const GOLFER = [pic([
  '    ###     ', '   #####    ', '    ###     ', '     #      ', '   #####    ', '  # ### #   ', '  # ### #   ', '   #####    ',
  '    ###  +  ', '    ###  +  ', '   ## ## +  ', '   #   # +  ', '  ##   ##+  ', '  #     #+  ', ' ##     ##++',
]), pic([
  '+++         ', '   +###     ', '   +#####   ', '    +###    ', '     +      ', '   #####    ', '  # ### #   ', ' #  ###  #  ',
  '    ###     ', '    ###     ', '   ## ##    ', '   #   #    ', '  ##   ##   ', '  #     #   ', ' ##     ##  ',
])];
const FLAG = pic(['#####  ', '###### ', '#######', '###### ', '#####  ', '#      ', '#      ', '#      ', '#      ', '#      ', '#      ', '#      ', '#      ', '#      ']);
// a bird flapping (9 x 5), two frames
const BIRD = [pic(['#       #', ' #     # ', '  # # #  ', '   ###   ', '    #    ']), pic(['         ', '         ', ' ### ### ', '#  ###  #', '    #    '])];
const CUP = pic([
  ' ################ ', '##++++++++++++++##', '# #+++++++++++# #', '#  #+++++++++#  # ', ' #  #+++++++#  #  ', '  ## #+++++# ##   ', '     #+++#        ',
  '      #+#         ', '      #+#         ', '     #####        ', '    #######       ', '   #########      ',
]);
const grass = api => { for (let x = 0; x < 160; x += 2) api.set(x, 31, 1); };

// Tee off: the golfer swings and the ball flies off
export const teeoff = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    grass(api);
    const k = p / 0.55;
    draw(api, GOLFER[k > 0.3 && k < 0.5 ? 1 : 0], 20, 16);
    if (k < 0.5) dot(api, 31, 29);
    else { const f = (k - 0.5) * 2; dot(api, 31 + f * 120, 29 - Math.sin(f * Math.PI) * 26); }
  },
};
// A big drive: the ball sails away over the fairway, a tracer behind it
export const drive = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    grass(api);
    const k = p / 0.5;
    for (let i = 0; i <= 40; i++) { const f = (i / 40) * k; api.set(Math.round(4 + f * 150), Math.round(29 - Math.sin(f * Math.PI) * 26), i === 40 ? 2 : 1); }
  },
};
// Holed: the ball rolls up to the flag and drops in
export const holeout = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    for (let x = 20; x < 140; x += 2) api.set(x, 28, 1);
    for (let x = 103; x < 110; x++) api.set(x, 28, 0);
    draw(api, FLAG, 105, 14);
    const k = Math.min(1, p / 0.35);
    if (k < 1) dot(api, 20 + k * 84, 26);
    else dot(api, 104, 28 + Math.min(3, (p - 0.35) * 30), 2);
  },
};
// Birdie: a bird flies across
export const birdie = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const f = Math.floor(t * 8) % 2;
    draw(api, BIRD[f], -10 + (p / 0.5) * 170, 12 + Math.sin(t * 6) * 4);
  },
};
// Eagle: three birds in a V
export const eagle = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const f = Math.floor(t * 8) % 2, x = -30 + (p / 0.5) * 190;
    draw(api, BIRD[f], x + 16, 13); draw(api, BIRD[1 - f], x, 5); draw(api, BIRD[1 - f], x, 21);
  },
};
// Hole in one: the ball flies straight into the cup, then fireworks
export const ace = {
  secs: 3.2,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: Math.floor(t * 8) % 2 ? 2 : 1 }); return; }
    grass(api);
    draw(api, FLAG, 130, 17);
    const k = Math.min(1, p / 0.3);
    if (k < 1) dot(api, 10 + k * 119, 29 - Math.sin(k * Math.PI) * 24);
    else for (let i = 0; i < 3; i++) { const r = ((p - 0.3) * 60 + i * 6) % 18; for (let a = 0; a < 6.28; a += 0.4) api.set(Math.round(50 + i * 25 + Math.cos(a) * r * 1.5), Math.round(12 + Math.sin(a) * r * 0.6), 1); }
  },
};
// The round is over: the trophy rises
export const trophy = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    draw(api, CUP, 71, 32 - Math.min(1, p / 0.3) * 26);
  },
};

// ---------- the Putting Green ----------
// pg: { putt, holed, results, target, phase, power, at, rollAt }. The green runs left to right; the ball starts on
// the left, the hole is at `target` of the way along. The power meter swings along the bottom.
export const GREEN_X0 = 14, GREEN_X1 = 120;
export function drawPutting(api, pg, t) {
  const hx = GREEN_X0 + pg.target * (GREEN_X1 - GREEN_X0);
  // the green's edge, the hole and its flag
  for (let x = GREEN_X0 - 4; x <= GREEN_X1 + 4; x += 2) { api.set(x, 6, 1); api.set(x, 24, 1); }
  for (let x = hx - 2; x <= hx + 2; x++) api.set(Math.round(x), 16, 2);
  draw(api, FLAG.map(r => r.slice(0, 5)).slice(0, 10), Math.round(hx), 6, 1);
  // the ball, at rest or rolling to where the putt takes it
  let bx = GREEN_X0;
  if (pg.phase === 'roll' || pg.phase === 'done') {
    const k = Math.min(1, (t - pg.rollAt) / 1.2), ease = 1 - (1 - k) * (1 - k);
    bx = GREEN_X0 + pg.power * (GREEN_X1 - GREEN_X0) * ease;
  }
  const holed = pg.phase !== 'aim' && Math.abs(pg.power - pg.target) < 0.07 && t - pg.rollAt > 1.0;
  if (!holed) dot(api, bx, 15);
  // the power meter
  if (pg.phase === 'aim' && t >= pg.at) {
    const m = (1 - Math.cos((t - pg.at) * 2.6)) / 2;
    for (let x = 0; x < 100; x += 2) api.set(GREEN_X0 + x, 29, 1);
    for (let x = 0; x < m * 100; x++) { api.set(GREEN_X0 + x, 28, 2); api.set(GREEN_X0 + x, 30, 2); }
  } else if (pg.phase === 'aim') api.text('READY', 70, 26, { align: 'center', v: Math.floor(t * 4) % 2 ? 2 : 1 });
  // putts so far down the right
  api.text(`PUTT ${Math.min(3, pg.putt + 1)}`, 159, 2, { align: 'right' });
  pg.results.forEach((ok, i) => { const x = 136 + i * 8; if (ok) dot(api, x, 16); else { api.set(x, 15, 2); api.set(x + 1, 16, 2); api.set(x, 17, 2); api.set(x + 2, 15, 2); api.set(x + 2, 17, 2); } });
  for (let i = pg.results.length; i < 3; i++) api.set(137 + i * 8, 16, 1);
  if (pg.phase !== 'aim' && t - pg.rollAt > 1.2 && pg.results.length) {
    const last = pg.results[pg.results.length - 1];
    api.text(last ? 'IN' : 'MISS', 159, 22, { align: 'right' });
  }
}

// ---------- the Long Drive ----------
// ld: { taps, start, secs, yards, phase: 'swing' | 'fly', flyAt }. A swing meter fills with every tap; then the
// ball flies down a fairway marked in yards.
export function drawDrive(api, ld, t) {
  grass(api);
  if (ld.phase === 'swing') {
    draw(api, GOLFER[ld.taps % 2], 10, 16);
    dot(api, 21, 29);
    const m = Math.min(1, ld.taps / 33);
    for (let y = 0; y < 26; y += 2) api.set(150, 3 + y, 1);
    for (let y = 0; y < m * 26; y++) { api.set(152, 28 - y, 2); api.set(153, 28 - y, 2); }
    if (t < ld.start) api.text('READY', 80, 4, { align: 'center', v: Math.floor(t * 4) % 2 ? 2 : 1 });
    else {
      api.text(String(Math.ceil(ld.start + ld.secs - t)), 80, 4, { sc: 2, align: 'center' });
      if (Math.floor(t * 6) % 2) api.text('L R L R', 80, 20, { align: 'center', v: 1 });
    }
    return;
  }
  // the flight: the view follows the ball, yard markers slide by
  const k = Math.min(1, (t - ld.flyAt) / 1.8), dist = ld.yards * k;
  for (let y = 50; y <= 450; y += 50) { const x = 20 + (y - dist) * 1.2; if (x > 0 && x < 140) { api.set(Math.round(x), 30, 2); api.set(Math.round(x), 29, 2); if (y % 100 === 0) api.text(String(y), Math.round(x), 22, { align: 'center', v: 1 }); } }
  dot(api, 20, 26 - Math.sin(k * Math.PI) * 20);
  api.text(`${Math.round(dist)}Y`, 159, 2, { align: 'right' });
}

export default { teeoff, drive, holeout, birdie, eagle, ace, trophy };
