// Angry Andy dot-matrix scenes for the tall 160 x 32 display (see ui/dmd.js), and the Desk Pranks reaction game
// played on it (drawPranks; its rules are in config.js).

const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);
const box = (api, x0, y0, x1, y1, v = 2) => { for (let x = x0; x <= x1; x++) { api.set(x, y0, v); api.set(x, y1, v); } for (let y = y0; y <= y1; y++) { api.set(x0, y, v); api.set(x1, y, v); } };

// Andy's head and shoulders: a shiny bald head, glasses, a moustache, a shirt and tie (16 x 16)
export const ANDY = pic([
  '     ######     ', '   ##########   ', '  ###+#######   ', '  ############  ', ' +############+ ', ' +#++###++###+ ',
  ' +############+ ', '  ###########   ', '  ###+++++###   ', '   #########    ', '     #####      ', '  ##########    ',
  ' ######+#####   ', '#######+######  ', '#######+######  ', '#######+######  ',
]);
// the boss: hair in a bun (14 x 16)
const BOSS = pic([
  '    ####      ', '   ######     ', '  ++++++++    ', ' ++######++   ', ' +########+   ', ' +#++##++#+   ', ' +########+   ',
  '  ###++###    ', '   ######     ', '    ####      ', '  ########    ', ' ##########   ', '###########   ', '###+####+###  ', '###+####+###  ',
  '###########   ',
]);
const STEAM = [pic([' + ', '+ +', ' + ', '+  ']), pic(['+  ', ' + ', '+ +', ' + '])];
const ENVELOPE = pic(['#########', '##+++++##', '#+#+++#+#', '#++#+#++#', '#+++#+++#', '#########']);

// a ticket printing out
export const ticket = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    box(api, 60, 0, 100, 4);
    const k = Math.min(1, p / 0.4), h = Math.round(k * 26);
    for (let y = 5; y < 5 + h; y++) { api.set(64, y, 2); api.set(96, y, 2); if (y % 4 === 2) for (let x = 68; x < 92; x += 2) api.set(x, y, 1); }
  },
};
// rebooting: a progress bar that crawls along, then stalls
export const reboot = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    api.text('RESTARTING', 80, 4, { align: 'center' });
    box(api, 30, 18, 130, 25);
    const k = Math.min(0.97, (p / 0.55) * 1.4);
    for (let x = 32; x < 32 + k * 96; x++) for (let y = 20; y < 24; y++) api.set(x, y, 1);
  },
};
// the blue screen: a sad face and a long code
export const bluescreen = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    for (let y = 0; y < 32; y++) for (let x = 0; x < 160; x += 2) api.set(x + (y % 2), y, 1);
    api.text(':(', 20, 4, { sc: 2, v: 2 });
    api.text('0X0000DEAD', 60, 20, { v: 2 });
  },
};
// reply all: envelopes fly everywhere
export const email = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.5) { words(api, lines); return; }
    const n = 1 + Math.floor((p / 0.5) * 12);
    for (let i = 0; i < n; i++) draw(api, ENVELOPE, (i * 41 + t * 60 * (1 + (i % 3))) % 170 - 10, (i * 13) % 26);
  },
};
// meltdown: Andy, steaming, shaking with rage
export const meltdown = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines, { v: Math.floor(t * 8) % 2 ? 2 : 1 }); return; }
    const shake = Math.round(Math.sin(t * 70) * (1 + p * 4));
    draw(api, ANDY, 72 + shake, 14);
    const f = Math.floor(t * 8) % 2;
    draw(api, STEAM[f], 70 + shake, 8); draw(api, STEAM[1 - f], 86 + shake, 7); draw(api, STEAM[f], 78 + shake, 4);
    if (p > 0.3) for (let a = 0; a < 6.3; a += 0.3) { const r = (p - 0.3) * 120; api.set(Math.round(80 + Math.cos(a) * r * 1.4), Math.round(20 + Math.sin(a) * r * 0.5), 1); }
  },
};

// ---------- Desk Pranks ----------
// dp: { pops: [{ side, who, at, until, res, resAt }], start, secs, hits, strikes, over }. Two desks with monitors;
// a head pops up behind one; a rubber band flies at it when pinged.
const DESK_X = { left: 18, right: 82 };
export function drawPranks(api, dp, t) {
  for (const side of ['left', 'right']) {
    const x = DESK_X[side];
    const p = dp.pops.find(q => q.side === side && t >= q.at && (!q.res || t - (q.resAt ?? q.until) < 0.4));
    if (p && p.res !== 'gone') {
      const up = Math.min(1, (t - p.at) / 0.12) * (p.res ? Math.max(0, 1 - (t - p.resAt) / 0.4) : 1);
      draw(api, p.who === 'andy' ? ANDY : BOSS, x + 12, 26 - up * 16);
      if (p.res === 'hit') { draw(api, STEAM[Math.floor(t * 8) % 2], x + 14, 4); api.text('PING', x + 20, 0, { align: 'center', v: 1 }); }
      if (p.res === 'strike') api.text('OI!', x + 20, 2, { align: 'center' });
    }
    // the desk and its monitor
    for (let i = 0; i < 40; i++) { api.set(x + i, 26, 2); api.set(x + i, 27, 1); }
    box(api, x + 2, 16, x + 12, 24, 1);
  }
  api.text(String(dp.hits), 159, 1, { align: 'right' });
  for (let i = 0; i < 3; i++) { const sx = 136 + i * 8; if (i < dp.strikes) { api.set(sx, 26, 2); api.set(sx + 2, 26, 2); api.set(sx + 1, 27, 2); api.set(sx, 28, 2); api.set(sx + 2, 28, 2); } else api.set(sx + 1, 27, 1); }
  if (t < dp.start) api.text('READY', 80, 2, { align: 'center', v: Math.floor(t * 4) % 2 ? 2 : 1 });
}

export default { ticket, reboot, bluescreen, email, meltdown };
