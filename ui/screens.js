// The screens drawn over the playfield view between games: the player buttons (1 to 4 players), the
// high score table, name entry for a new high score, and the button back to the table menu.
// Each layout function returns the boxes it draws, so the shell can test taps against the same boxes.

import { drawText, textWidth, commas } from './font.js';

const GOLD = '#ffcc33', INK = '#e8e2d0', DIM = '#8a8f9a', PANEL = 'rgba(6,6,18,0.9)';
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

function box(ctx, { x, y, w, h }, edge = GOLD, fill = 'rgba(6,6,18,0.82)') {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}
export const inside = (r, x, y, pad = 3) => x >= r.x - pad && y >= r.y - pad && x <= r.x + r.w + pad && y <= r.y + r.h + pad;

// ---------- 1 to 4 players: four buttons near the bottom of the view ----------
export function playerButtons(W, H) {
  const w = 34, h = 26, gap = 8, x0 = Math.round(W / 2 - (4 * w + 3 * gap) / 2), y = H - 64;
  return [1, 2, 3, 4].map(n => ({ n, x: x0 + (n - 1) * (w + gap), y, w, h }));
}
export function drawPlayerButtons(ctx, W, H, t, touch) {
  const bs = playerButtons(W, H);
  const label = touch ? 'HOW MANY PLAYERS?' : 'PLAYERS: PRESS 1 TO 4';
  const lw = textWidth(label) + 12;
  ctx.fillStyle = 'rgba(6,6,18,0.82)'; ctx.fillRect(Math.round(W / 2 - lw / 2), bs[0].y - 15, lw, 11);
  drawText(ctx, label, W / 2, bs[0].y - 13, Math.floor(t * 2) % 2 ? GOLD : INK, { align: 'center' });
  for (const b of bs) {
    box(ctx, b);
    drawText(ctx, String(b.n), b.x + b.w / 2, b.y + 6, GOLD, { scale: 2, align: 'center' });
  }
}

// ---------- back to the table menu: a small button at the top left of the view ----------
export const menuButton = top => ({ x: 6, y: top + 6, w: 58, h: 16 });
export function drawMenuButton(ctx, top) {
  const b = menuButton(top);
  box(ctx, b);
  drawText(ctx, '< TABLES', b.x + b.w / 2, b.y + 5, GOLD, { align: 'center' });
}

// ---------- the high score table ----------
// highlight: the place to flash (a score just entered), or -1
export function drawScores(ctx, list, { W, top, h, t, highlight = -1, title = 'HIGH SCORES' }) {
  const ph = 26 + list.length * 22 + 10, y0 = Math.round(top + Math.min(h * 0.3, h / 2 - ph / 2 - 20));
  ctx.fillStyle = PANEL; ctx.fillRect(16, y0, W - 32, ph);
  ctx.fillStyle = GOLD; ctx.fillRect(16, y0, W - 32, 1); ctx.fillRect(16, y0 + ph - 1, W - 32, 1);
  drawText(ctx, title, W / 2, y0 + 8, GOLD, { scale: 2, align: 'center' });
  list.forEach(([name, score], i) => {
    const y = y0 + 34 + i * 22;
    if (i === highlight && Math.floor(t * 4) % 2) return;
    const col = i === highlight ? '#fff' : i === 0 ? GOLD : INK;
    drawText(ctx, `${i + 1}`, 30, y, DIM, { scale: 2 });
    drawText(ctx, name, 56, y, col, { scale: 2 });
    drawText(ctx, commas(score), W - 30, y, col, { scale: 2, align: 'right' });
  });
}

// ---------- name entry ----------
// entry: { player, players, score, name: [i, i, i] (indexes into LETTERS), slot }
export function entryLayout(W, top) {
  const y = top + 120, w = 30, gap = 12, x0 = Math.round(W / 2 - (3 * w + 2 * gap) / 2);
  const slots = [0, 1, 2].map(i => {
    const x = x0 + i * (w + gap);
    return { i, letter: { x, y, w, h: 30 }, up: { x, y: y - 26, w, h: 20 }, down: { x, y: y + 36, w, h: 20 } };
  });
  return { slots, ok: { x: Math.round(W / 2 - 40), y: y + 76, w: 80, h: 24 } };
}
export function drawEntry(ctx, e, { W, top, h, t, touch }) {
  ctx.fillStyle = PANEL; ctx.fillRect(0, top, W, h);
  ctx.fillStyle = GOLD; ctx.fillRect(8, top + 6, W - 16, 1); ctx.fillRect(8, top + h - 7, W - 16, 1);
  drawText(ctx, 'NEW HIGH SCORE', W / 2, top + 16, Math.floor(t * 3) % 2 ? GOLD : '#fff', { scale: 2, align: 'center' });
  if (e.players > 1) drawText(ctx, `PLAYER ${e.player}`, W / 2, top + 38, INK, { align: 'center' });
  drawText(ctx, commas(e.score), W / 2, top + 52, '#fff', { scale: 2, align: 'center' });
  const L = entryLayout(W, top);
  for (const s of L.slots) {
    const on = s.i === e.slot;
    box(ctx, s.letter, on ? '#fff' : GOLD, on ? 'rgba(60,40,10,0.9)' : 'rgba(6,6,18,0.82)');
    const ch = LETTERS[e.name[s.i]];
    if (!(on && Math.floor(t * 3) % 3 === 2)) drawText(ctx, ch === ' ' ? '_' : ch, s.letter.x + s.letter.w / 2, s.letter.y + 5, '#fff', { scale: 3, align: 'center' });
    arrow(ctx, s.up, -1, on ? '#fff' : GOLD); arrow(ctx, s.down, 1, on ? '#fff' : GOLD);
  }
  box(ctx, L.ok);
  drawText(ctx, 'OK', L.ok.x + L.ok.w / 2, L.ok.y + 6, GOLD, { scale: 2, align: 'center' });
  const help = touch
    ? ['TAP THE ARROWS TO CHANGE A LETTER,', 'THEN OK']
    : ['TYPE YOUR NAME, OR USE THE FLIPPERS', 'TO CHANGE A LETTER AND SPACE TO MOVE ON'];
  help.forEach((l, i) => drawText(ctx, l, W / 2, L.ok.y + 40 + i * 12, DIM, { align: 'center' }));
}
function arrow(ctx, r, dir, col) {
  ctx.fillStyle = col;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  for (let k = 0; k < 6; k++) { const yy = cy + (dir < 0 ? k - 3 : 3 - k); ctx.fillRect(Math.round(cx - k - 0.5), Math.round(yy), k * 2 + 1, 1); }
}
