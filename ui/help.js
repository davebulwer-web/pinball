// The instructions screen: pages drawn over the playfield view. The first page is the controls (the same
// for every table); a table adds its own pages describing its goals:
//   instructions: [{ title: 'THE BIG TOP', items: [{ art: 'lamp-tent', text: '...' }, { marquee: 'F', text: '...' }] }]
// Each item has an optional picture (a name from the table's art) or bulb letter, and text that wraps.

import { drawText } from './font.js';
import { marquee } from './render.js';

const CONTROLS = (touch) => ({
  title: 'HOW TO PLAY',
  items: touch ? [
    { text: 'HOLD THE LEFT OR RIGHT HALF OF THE SCREEN FOR THE FLIPPERS.' },
    { text: 'TO LAUNCH, PULL DOWN ANYWHERE AND LET GO. THE FURTHER YOU PULL, THE HARDER IT GOES.' },
    { text: 'SWIPE UP TO NUDGE THE TABLE. NUDGE TOO OFTEN AND IT TILTS.' },
    { text: 'TAP THE SCORE AT THE TOP TO PAUSE.' },
  ] : [
    { text: 'FLIPPERS: Z AND / (OR THE SHIFT KEYS).' },
    { text: 'LAUNCH: HOLD SPACE AND LET GO. THE LONGER YOU HOLD, THE HARDER IT GOES.' },
    { text: 'NUDGE: ARROW KEYS. NUDGE TOO OFTEN AND IT TILTS.' },
    { text: 'P PAUSES, M TURNS THE SOUND OFF AND ON.' },
  ],
});

export function helpPages(cfg, touch) { return [CONTROLS(touch), ...(cfg.instructions ?? [])]; }

// split text into lines of at most n characters
function wrap(text, n) {
  const out = []; let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}

// Draw page `i` of `pages` in the view area (x 0..W, y top..top+h).
export function drawHelp(ctx, pages, i, art, { W, top, h, touch, t }) {
  const page = pages[i];
  ctx.fillStyle = 'rgba(6,6,18,0.9)'; ctx.fillRect(0, top, W, h);
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(8, top + 6, W - 16, 1); ctx.fillRect(8, top + h - 7, W - 16, 1);
  drawText(ctx, page.title, W / 2, top + 14, '#ffcc33', { scale: 2, align: 'center' });
  let y = top + 40;
  for (const it of page.items) {
    const lines = wrap(it.text, it.art || it.marquee ? 44 : 50);
    const x = it.art || it.marquee ? 34 : 16;
    const im = art?.[it.art];
    const blockH = Math.max(lines.length * 10, im ? im.height : 0);
    if (im) ctx.drawImage(im, Math.round(20 - im.width / 2), Math.round(y + blockH / 2 - im.height / 2 - 1));
    else if (it.marquee) marquee(ctx, it.marquee, 20, y + blockH / 2 - 1, true);
    lines.forEach((l, k) => drawText(ctx, l, x, y + k * 10 + Math.round((blockH - lines.length * 10) / 2), '#e8e2d0'));
    y += blockH + 9;
  }
  const foot = touch ? 'TAP LEFT OR RIGHT TO TURN, ? TO CLOSE' : '< > TO TURN THE PAGE, H TO CLOSE';
  drawText(ctx, `${i + 1}/${pages.length}`, W - 12, top + h - 18, '#8a8f9a', { align: 'right' });
  drawText(ctx, foot, 12, top + h - 18, Math.floor(t * 2) % 2 ? '#8a8f9a' : '#b8bcc6');
}

// the ? button drawn in the corner of the view (attract mode), and whether a point is on it
export const helpButton = (W, H) => ({ x: W - 24, y: H - 24, s: 18 });
export function drawHelpButton(ctx, W, H) {
  const b = helpButton(W, H);
  ctx.fillStyle = 'rgba(6,6,18,0.8)'; ctx.fillRect(b.x, b.y, b.s, b.s);
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(b.x, b.y, b.s, 1); ctx.fillRect(b.x, b.y + b.s - 1, b.s, 1); ctx.fillRect(b.x, b.y, 1, b.s); ctx.fillRect(b.x + b.s - 1, b.y, 1, b.s);
  drawText(ctx, '?', b.x + b.s / 2, b.y + 4, '#ffcc33', { scale: 2, align: 'center' });
}
