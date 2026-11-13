// Race Day dot-matrix scenes (see ui/dmd.js). Each draws one frame: p runs 0..1 over the scene, lines are
// the message's text, and api.set / api.text draw dots (v: 1 dim, 2 lit) on the 160 x 16 display.

// small pictures as rows of characters: '#' lit, '+' dim
const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const draw = (api, p, x, y) => p.forEach((row, j) => row.forEach((v, i) => v && api.set(Math.round(x) + i, Math.round(y) + j, v)));

// a galloping horse with its jockey, facing right, in two frames (legs stretched, then gathered)
const HORSE = [
  pic([
    '     ++       ',
    '     ##    ## ',
    '  #######+####',
    ' ######### #  ',
    '# #######     ',
    '  #     #     ',
    ' #       #    ',
    '#         #   ',
  ]),
  pic([
    '     ++       ',
    '     ##    ## ',
    '  #######+####',
    ' ######### #  ',
    '# #######     ',
    '   #   #      ',
    '   #   #      ',
    '  #   #       ',
  ]),
];
const horse = (api, x, y, t) => draw(api, HORSE[Math.floor(t * 10) % 2], x, y);
const FENCE = pic(['+ + + +', '#######', '+#+#+#+', '#######', '#     #', '#     #']);

// both lines of a message, centred (or one line if there is no second); clip limits them to columns x0..x1
function words(api, lines, v = 2, clip = null) {
  if (lines.length > 1) { api.text(lines[0], 80, 0, { align: 'center', v, clip }); api.text(lines[1], 80, 9, { align: 'center', v, clip }); }
  else api.text(lines[0], 80, 4, { align: 'center', v, clip });
}

// Pick your horse / they're off: the starting stalls, whose gates spring open
export const gate = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    const open = p > 0.3;
    for (let s = 0; s < 4; s++) {
      const x0 = 30 + s * 28;
      for (let y = 2; y < 16; y++) { api.set(x0, y, 1); api.set(x0 + 24, y, 1); }
      for (let x = x0; x <= x0 + 24; x++) api.set(x, 2, 1);
      horse(api, x0 + 4 + (open ? (p - 0.3) * 160 : 0), 7, open ? t : 0);
      if (!open) for (let y = 3; y < 16; y += 2) api.set(x0 + 24, y, 2);   // the gates, shut
    }
  },
};

// The race is on: horses gallop across, the words following them
export const gallop = {
  secs: 2.6,
  draw(api, p, lines, t) {
    const lead = -20 + Math.min(1, p / 0.7) * 210;
    words(api, lines, 2, [0, Math.max(0, lead - 30)]);
    for (let i = 0; i < 3; i++) { const x = lead - i * 22; if (x < 175) horse(api, x, i === 1 ? 8 : 4, t + i * 0.05); }
    for (let x = (Math.floor(t * 40) % 6); x < 160; x += 6) api.set(159 - x, 15, 1);   // the rail rushing past
  },
};

// Photo finish: two horses nose to nose at the post, a camera flash, then the result
export const photo = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, Math.floor(t * 6) % 2 ? 2 : 1); return; }
    for (let y = 0; y < 16; y++) api.set(118, y, y % 2 ? 2 : 1);           // the finishing post
    const k = Math.min(1, p / 0.4);
    horse(api, -14 + k * 120, 1, t);
    horse(api, -16 + k * 121, 8, t + 0.05);
    if (p > 0.4 && p < 0.47) for (let y = 0; y < 16; y++) for (let x = 0; x < 160; x++) api.set(x, y, 2);   // flash
  },
};

// Clear round: a horse jumps the fence
export const fences = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    const k = p / 0.6, x = -14 + k * 180;
    draw(api, FENCE, 78, 10);
    const over = x > 58 && x < 92 ? Math.sin((x - 58) / 34 * Math.PI) * 9 : 0;
    horse(api, x, 8 - over, over ? 0 : t);
  },
};

export default { gate, gallop, photo, fences };
