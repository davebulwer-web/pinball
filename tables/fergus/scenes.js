// Fergus dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the Dance Floor rhythm game
// played on it (drawDance; its rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);

// Fergus: long hair to his shoulders, round glasses, a big beard (14 x 22)
export const FERGUS = pic([
  '   ++++++++   ', '  ++++++++++  ', ' +++######+++ ', ' ++#+##+#+#++ ', ' ++########++ ', ' +++#++++#+++ ', ' ++ ###### ++ ',
  ' ++ ###### ++ ', ' +   ####   + ', '     ####     ', '   ########   ', '  ##########  ', ' # ######## # ', ' # ######## # ',
  ' # ######## # ', '   ########   ', '   ###  ###   ', '   ###  ###   ', '   ##    ##   ', '   ##    ##   ', '  ###    ###  ',
]);
// a friend: a bob of hair and a dress (12 x 21)
export const FRIEND = pic([
  '   ######   ', '  ########  ', '  ##+##+##  ', '  ##++++##  ', '   #+##+#   ', '    ++++    ', '     ##     ', '   ######   ',
  '  # #### #  ', ' #  ####  # ', '   ######   ', '  ########  ', ' ########## ', '############', '    +  +    ', '    +  +    ',
  '    +  +    ', '   ##  ##   ',
]);
const HEART = pic([' ## ## ', '#######', '#######', ' ##### ', '  ###  ', '   #   ']);
const BIGHEART = pic(['  ###   ###  ', ' ##### ##### ', '#############', '#############', '#############', ' ########### ', '  #########  ', '   #######   ', '    #####    ', '     ###     ', '      #      ']);
const ROSE = pic([' ## ', '####', ' ## ', '  + ', ' ++ ', '  + ', '  + ']);
const ARROW_L = pic(['   #   ', '  ##   ', ' ######', '#######', ' ######', '  ##   ', '   #   ']);
const ARROW_R = flipX(ARROW_L);

// Asking her out: Fergus walks up with a rose, a heart rises between them
export const askout = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    const k = Math.min(1, p / 0.3);
    draw(api, FERGUS, 20 + k * 40, 8);
    draw(api, ROSE, 36 + k * 40, 18);
    draw(api, flipX(FRIEND), 110, 9);
    if (k >= 1) draw(api, HEART, 94, 6 - Math.sin(t * 4) * 2);
  },
};
// The Friend Zone: the big heart cracks down the middle and falls apart
export const friendzone = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines, { v: Math.floor(t * 4) % 2 ? 2 : 1 }); return; }
    const k = Math.max(0, (p - 0.2) / 0.35), gap = Math.round(k * 10), drop = k * k * 14;
    BIGHEART.forEach((row, j) => row.forEach((d, i) => {
      if (!d) return;
      const crack = Math.round(6 + Math.sin(j * 1.7) * 1.2);
      const left = i < crack;
      api.set(74 + i + (left ? -gap : gap), Math.round(10 + j + drop * (left ? 1 : 1.3)), d);
    }));
  },
};
// An awkward hug: two figures, a little heart over them
export const hug = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const k = Math.min(1, p / 0.25);
    draw(api, FERGUS, 50 + k * 14, 9); draw(api, flipX(FRIEND), 98 - k * 14, 10);
    if (k >= 1) draw(api, HEART, 77, 1);
  },
};
// Plus one: wedding bells ring, confetti falls
export const plusone = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    draw(api, FERGUS, 56, 9); draw(api, FRIEND, 90, 10);
    for (let i = 0; i < 30; i++) api.set((i * 53 + Math.floor(t * 20) * 7) % 160, (i * 17 + Math.floor(t * 30)) % 32, i % 3 ? 1 : 2);
  },
};
// Hair flick: his hair swishes across
export const hairflick = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    draw(api, FERGUS, 72, 8);
    const a = Math.sin(t * 10) * 1.2;
    for (let s = 0; s < 14; s++) for (const side of [-1, 1]) api.set(Math.round(79 + side * 6 + Math.cos(a + s * 0.12) * s * side), Math.round(9 + Math.sin(a) * s * 0.6 + s * 0.5), 1);
  },
};
// Glasses: a big pair of glasses with a glint
export const glasses = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    for (const cx of [62, 98]) for (let a = 0; a < 6.3; a += 0.12) api.set(Math.round(cx + Math.cos(a) * 14), Math.round(16 + Math.sin(a) * 10), 2);
    for (let x = 76; x <= 84; x++) api.set(x, 13, 2);
    const g = Math.floor((p / 0.5) * 30);
    for (let d = -3; d <= 3; d++) api.set(50 + g + d, 10 - Math.abs(d), 1);
  },
};

// ---------- the Dance Floor ----------
// dd: { notes: [{ t, side, res }], start, hits, streak, best, over }. Arrows travel left to the line at x 30.
export const LINE_X = 30, SPEED = 70;
export function drawDance(api, dd, t) {
  // the line, flashing on the beat, and Fergus dancing to the left of it
  for (let y = 2; y < 30; y += 2) api.set(LINE_X - 2, y, 1);
  const bob = Math.floor(t * 4) % 2;
  draw(api, bob ? flipX(FERGUS) : FERGUS, 4, 6 + bob);
  for (const n of dd.notes) {
    const x = LINE_X + (n.t - t) * SPEED;
    if (x > 160 || x < -8) continue;
    if (n.res === 'hit') { if (t - n.t < 0.3) for (let a = 0; a < 6.3; a += 0.5) api.set(Math.round(LINE_X + Math.cos(a) * 8), Math.round(16 + Math.sin(a) * 6), 2); continue; }
    draw(api, n.side === 'left' ? ARROW_L : ARROW_R, x, n.side === 'left' ? 5 : 19, n.res === 'miss' ? 1 : null);
  }
  api.text(String(dd.hits), 159, 1, { align: 'right' });
  if (dd.streak > 1) api.text(`X${dd.streak}`, 159, 22, { align: 'right', v: 1 });
  if (t < dd.start - 0.6) api.text('READY', 90, 12, { align: 'center', v: Math.floor(t * 4) % 2 ? 2 : 1 });
}

export default { askout, friendzone, hug, plusone, hairflick, glasses };
