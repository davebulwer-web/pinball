// Fun Fair dot-matrix scenes (see ui/dmd.js). Each draws one frame: p runs 0..1 over the scene, lines are
// the message's text, and api.set / api.text draw dots (v: 1 dim, 2 lit) on the 160 x 16 display.

// small pictures as rows of characters: '#' lit, '+' dim
const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const draw = (api, p, x, y) => p.forEach((row, j) => row.forEach((v, i) => v && api.set(Math.round(x) + i, Math.round(y) + j, v)));

const CAR = pic([
  '  ####   ',
  ' #+##+## ',
  '#########',
  ' #  #  # ',
]);
const DUCK = pic([
  '   ##  ',
  '  ###+#',
  '#  ### ',
  '###### ',
  ' ####  ',
  '  ++   ',
]);

// both lines of a message, centred (or one line if there is no second); clip limits them to columns x0..x1
function words(api, lines, v = 2, clip = null) {
  if (lines.length > 1) { api.text(lines[0], 80, 0, { align: 'center', v, clip }); api.text(lines[1], 80, 9, { align: 'center', v, clip }); }
  else api.text(lines[0], 80, 4, { align: 'center', v, clip });
}

// Coaster combo: a car races along a rolling track, the words appearing behind it
export const coaster = {
  secs: 2.6,
  draw(api, p, lines) {
    const x = -12 + Math.min(1, p / 0.6) * 184;
    if (x > 160) { words(api, lines); return; }
    const trackY = i => 11 + Math.round(Math.sin(i / 9) * 2);
    for (let i = Math.max(0, Math.round(x) + 10); i < 160; i += 2) api.set(i, trackY(i) + 4, 1);
    words(api, lines, 2, [0, x - 1]);
    draw(api, CAR, x, trackY(Math.max(0, Math.round(x + 4))));
  },
};

// Hook a Duck: a row of ducks bobs along, then they are knocked down one by one
export const ducks = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    const k = p / 0.55;
    for (let i = 0; i < 4; i++) {
      const x = 24 + i * 32 + Math.round(Math.sin(t * 6 + i) * 2);
      const fall = Math.max(0, (k - 0.2) * 5.5 - i) * 12;   // all stand, then each drops a little after the one before
      if (fall < 10) draw(api, DUCK, x, 5 + fall);
    }
    for (let i = 0; i < 160; i += 3) api.set(i, 13, 1);
  },
};

// Big Top: the curtains part from the middle to show the words, which flash
export const curtain = {
  secs: 3.2,
  draw(api, p, lines, t) {
    const open = Math.min(1, p / 0.45) * 80;
    if (Math.floor(t * 6) % 2 === 0 || p < 0.45) words(api, lines);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 160; x++) {
      const d = Math.abs(x - 79.5);
      if (d < open) continue;
      api.set(x, y, (x >> 2) % 2 ? 2 : 1);   // pleated stripes
    }
  },
};

export default { coaster, ducks, curtain };
