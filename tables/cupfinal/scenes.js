// Cup Final dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the two games played on it:
// the penalty shootout and keepy-uppy (drawPenalties, drawKeepy; their rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);

const BALL = pic([' ### ', '#+#+#', '##+##', '#+#+#', ' ### ']);
const BIGBALL = pic(['  ####  ', ' #+##+# ', '##++++##', '#+####+#', '#+####+#', '##++++##', ' #+##+# ', '  ####  ']);
// a footballer running right (12 x 20), two frames
const RUN = [pic([
  '    ###     ', '    ###     ', '     #      ', '   #####    ', '  # ### #   ', ' #  ###  #  ', '    ###     ', '    +++     ',
  '   ## ##    ', '  ##   ##   ', ' ##     ##  ', '##       #  ',
]), pic([
  '    ###     ', '    ###     ', '     #      ', '   #####    ', '   #####    ', '   #####    ', '    ###     ', '    +++     ',
  '    ##      ', '    ###     ', '    # ##    ', '   ##  #    ',
])];
// the goalkeeper, arms up (16 x 14), and diving (22 x 10)
const KEEPER = pic([
  '#      ###     #', '##     ###    ##', ' ##     #    ## ', '  ############  ', '     ######     ', '     ######     ', '      ####      ',
  '      ++++      ', '     ##  ##     ', '     ##  ##     ', '     ##  ##     ', '    ###  ###    ',
]);
const DIVE = pic([
  '##                  ###', ' ##   ++   ######   ###', '  ######++##########  #', '  ######++##########   ', ' ##   ++   ######      ', '##                     ',
]);
const CUP = pic([
  ' ################ ', '##++++++++++++++##', '# #+++++++++++# #', '#  #+++++++++#  # ', ' #  #+++++++#  #  ', '  ## #+++++# ##   ', '     #+++#        ',
  '      #+#         ', '      #+#         ', '     #####        ', '    #######       ', '   #########      ',
]);
const WHISTLE = pic(['   ######   ', '  ########++', ' ##########+', '###########', ' #######    ', '  #####     ']);

// the goal frame: posts at x0 and x1, the crossbar at y0, a net of dim dots
const goalFrame = (api, x0, x1, y0, y1, bulge = 0) => {
  for (let x = x0; x <= x1; x++) { api.set(x, y0, 2); api.set(x, y0 + 1, 2); }
  for (let y = y0; y <= y1; y++) { api.set(x0, y, 2); api.set(x0 + 1, y, 2); api.set(x1, y, 2); api.set(x1 - 1, y, 2); }
  for (let y = y0 + 3; y < y1; y += 3) for (let x = x0 + 3; x < x1 - 1; x += 3) api.set(x, y - (bulge && Math.abs(x - (x0 + x1) / 2) < 12 ? bulge : 0), 1);
};

// GOAL: a shot flies into the net, the net bulges, GOAL flashes
export const goal = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.62) { words(api, lines, { v: Math.floor(t * 6) % 2 ? 2 : 1 }); return; }
    const k = Math.min(1, p / 0.25);
    goalFrame(api, 40, 120, 2, 31, k >= 1 && p < 0.4 ? 2 : 0);
    if (k < 1) draw(api, BIGBALL, 20 + k * 56, 26 - k * 18);
    else {
      draw(api, BIGBALL, 76, 6);
      if (Math.floor(t * 8) % 2) api.text('GOAL', 80, 12, { sc: 3, align: 'center' });
    }
  },
};

// Kick-off: a whistle, then two players run at the ball
export const kickoff = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    for (let x = 0; x < 160; x += 2) api.set(x, 31, 1);
    for (let y = 0; y < 32; y += 2) api.set(80, y, 1);
    for (let a = 0; a < 6.3; a += 0.15) api.set(Math.round(80 + Math.cos(a) * 14), Math.round(18 + Math.sin(a) * 10), 1);
    const f = Math.floor(t * 8) % 2;
    draw(api, RUN[f], 20 + p * 70, 19);
    draw(api, flipX(RUN[1 - f]), 128 - p * 70, 19);
    draw(api, BALL, 78, 26);
    if (p < 0.25) draw(api, WHISTLE, 74, 2);
  },
};

// Full time: the whistle blows
export const whistle = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.45) { words(api, lines); return; }
    draw(api, WHISTLE, 74, 12);
    for (let i = 0; i < 3; i++) { const r = ((t * 30 + i * 8) % 24); for (let a = -0.6; a < 0.6; a += 0.1) api.set(Math.round(86 + Math.cos(a) * r), Math.round(14 + Math.sin(a) * r), 1); }
  },
};

// Lift the cup: the trophy rises, sparkles round it
export const trophy = {
  secs: 3.2,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    const y = 32 - Math.min(1, p / 0.3) * 26;
    draw(api, CUP, 71, y);
    for (let i = 0; i < 10; i++) { const a = i * 0.63 + t * 2, r = 22 + Math.sin(t * 6 + i) * 3; if ((i + Math.floor(t * 8)) % 3) api.set(Math.round(80 + Math.cos(a) * r * 1.6), Math.round(14 + Math.sin(a) * r * 0.55), 2); }
  },
};

// Free kick: a wall of defenders, then the ball curls over them
export const wall = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    for (let i = 0; i < 4; i++) draw(api, RUN[1], 56 + i * 12, 19);
    const k = Math.min(1, p / 0.5);
    draw(api, BALL, 10 + k * 140, 26 - Math.sin(k * Math.PI) * 26);
  },
};

// ---------- the penalty shootout ----------
// pen: { kick, goals, results, phase, aim, dive, at }. The goal is in the middle; the five kicks' results are
// shown as balls (scored) and crosses (saved) down the left; the controls down the right.
const AIMX = { left: 52, centre: 78, right: 104 };
export function drawPenalties(api, pen, t) {
  goalFrame(api, 40, 120, 2, 28);
  // the keeper: standing, swaying while you aim; diving once the shot is taken
  const since = t - pen.at;
  if (pen.phase === 'shot' || (pen.phase === 'aim' && pen.dive)) {
    const k = Math.min(1, since / 0.35);
    if (pen.dive === 'centre') draw(api, KEEPER, 72, 14 - Math.round(k * 4));
    else { const p = pen.dive === 'left' ? flipX(DIVE) : DIVE; draw(api, p, 69 + (pen.dive === 'left' ? -1 : 1) * Math.round(k * 22), 14); }
    // the ball, flying to where it was aimed
    const kb = Math.min(1, since / 0.5);
    const tx = AIMX[pen.aim] ?? 78, ty = 9;
    draw(api, BALL, 78 + (tx - 78) * kb, 27 - (27 - ty) * kb);
  } else {
    draw(api, KEEPER, 72 + Math.round(Math.sin(t * 5) * 3), 15);
    if (pen.phase === 'aim') draw(api, BALL, 78, 27);
  }
  // results so far
  pen.results.forEach((ok, i) => {
    const y = 2 + i * 6;
    if (ok) draw(api, BALL, 2, y);
    else for (let d = 0; d < 5; d++) { api.set(2 + d, y + d, 2); api.set(6 - d, y + d, 2); }
  });
  for (let i = pen.results.length; i < 5; i++) api.set(4, 4 + i * 6, 1);
  if (pen.phase === 'aim') {
    api.text(`KICK ${pen.kick + 1}`, 159, 2, { align: 'right' });
    if (Math.floor(t * 3) % 2) { api.text('<  >', 159, 13, { align: 'right' }); api.text('AIM', 159, 23, { align: 'right', v: 1 }); }
  } else if (pen.phase === 'shot' && since > 0.6) {
    const scored = pen.results[pen.results.length - 1];
    if (scored !== undefined) api.text(scored ? 'GOAL' : 'SAVED', 159, 12, { align: 'right' });
  }
}

// ---------- keepy-uppy ----------
// kick: { n, from, period, over }. The ball rises from the boot and falls back; the count is on the right.
const BOOT = pic(['   ####   ', '   ####   ', '   #####  ', '  ########', ' #########', '##########', '+ + + + + ']);
export function drawKeepy(api, kick, t) {
  const p = (t - kick.from) / kick.period;
  draw(api, BOOT, 60, 25);
  for (let x = 30; x < 110; x += 2) api.set(x, 31, 1);
  if (!kick.over) {
    const h = p < 0 ? 0 : 4 * Math.min(1.15, p) * (1 - Math.min(1.15, p));   // a parabola: 0 at the boot, 1 at the top
    draw(api, BALL, 66, 20 - Math.max(-2, h) * 18);
    if (p > 0.78 && p < 1.12) api.text('TAP', 120, 12, { v: 2 });
  } else {
    const k = Math.min(1, (t - (kick.missAt ?? t)) / 0.5);
    draw(api, BALL, 66 + k * 40, 20 + k * 6);
  }
  api.text(String(kick.n), 159, 2, { sc: 3, align: 'right' });
  if (p < 0 && !kick.over) api.text('READY', 2, 2, { v: Math.floor(t * 4) % 2 ? 2 : 1 });
}

export default { goal, kickoff, whistle, trophy, wall };
