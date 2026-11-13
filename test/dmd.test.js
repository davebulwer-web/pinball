// The dot-matrix display fits any message: lines too long for the 5x7 font drop to a 3x5 one, a single line too
// long is split over two, and a line too long even for the small font scrolls across.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDmd } from '../ui/dmd.js';

// render one frame and read back which dots are lit (2 screen pixels per dot; lit dots are the 'on' colour)
const snap = (d, t, state = () => ({})) => {
  d.frame(t, state);
  let img;
  d.paint({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w }), putImageData: i => (img = i) }, 0, 0);
  const lit = [];
  for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) if (img.data[((y * 2) * d.W * 2 + x * 2) * 4] === 255) lit.push([x, y]);
  return lit;
};
const extent = lit => ({ x0: Math.min(...lit.map(p => p[0])), x1: Math.max(...lit.map(p => p[0])), y0: Math.min(...lit.map(p => p[1])), y1: Math.max(...lit.map(p => p[1])) });

for (const rows of [16, 32]) {
  test(`a ${rows}-row display: a 36-letter line fits in the small font, inside the edges`, () => {
    const d = createDmd({ rows });
    d.show(['PING', 'HAVE YOU TRIED TURNING IT OFF AND ON'], { secs: 3 });
    const e = extent(snap(d, 0));
    assert.ok(e.x0 > 0 && e.x1 < d.W - 1, JSON.stringify(e));
  });

  test(`a ${rows}-row display: a long single line is split over two`, () => {
    const d = createDmd({ rows });
    d.show('CAN YOU JUST HAVE A QUICK LOOK AT MY COMPUTER', { secs: 3 });
    const lit = snap(d, 0), e = extent(lit);
    assert.ok(e.x0 > 0 && e.x1 < d.W - 1, JSON.stringify(e));
    assert.ok(lit.some(p => p[1] < d.H / 2 - 1) && lit.some(p => p[1] > d.H / 2), 'two lines');
  });

  test(`a ${rows}-row display: a line too long even for the small font scrolls across`, () => {
    const d = createDmd({ rows });
    const long = 'THIS LINE IS FAR TOO LONG TO FIT ON THE DISPLAY EVEN IN THE SMALL FONT';
    d.show(['SCROLLING', long], { secs: 8 });
    const start = extent(snap(d, 0)), later = extent(snap(d, 3));
    assert.ok(start.x0 >= 0 && start.x1 >= d.W - 4, JSON.stringify(start));
    assert.notDeepEqual(snap(d, 0.1), snap(d, 3));
    assert.ok(later.x1 <= d.W - 1);
  });
}

test('short lines keep the big letters', () => {
  const d = createDmd({ rows: 32 });
  d.show('JACKPOT', { secs: 2 });
  const e = extent(snap(d, 0));
  assert.ok(e.y1 - e.y0 >= 20, 'triple size on the tall display');
});
