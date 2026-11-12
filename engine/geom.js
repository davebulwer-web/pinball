// Small geometry helpers for writing table configs.

// Points along a circle from angle `from` to `to` (degrees, screen style: 0 right, 90 down),
// one every `step` degrees. Use it to build smooth curved walls, ramps and rails from straight pieces.
export function arcPts([cx, cy], R, from, to, step = 8) {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + (to - from) * i / n) * Math.PI) / 180;
    out.push([+(cx + Math.cos(a) * R).toFixed(2), +(cy + Math.sin(a) * R).toFixed(2)]);
  }
  return out;
}

// Join path pieces, dropping a point that repeats the end of the previous piece.
export function joinPath(...pieces) {
  const out = [];
  for (const p of pieces) for (const pt of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 0.01) out.push(pt);
  }
  return out;
}

// A polyline moved sideways by d (positive = to the left of the direction of travel, in screen terms
// the side you get by turning the travel direction 90 degrees anticlockwise on screen).
export function offsetPath(path, d) {
  const n = path.length, out = [];
  const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  for (let i = 0; i < n; i++) {
    const d0 = i > 0 ? dir(path[i - 1], path[i]) : dir(path[0], path[1]);
    const d1 = i < n - 1 ? dir(path[i], path[i + 1]) : d0;
    let tx = d0[0] + d1[0], ty = d0[1] + d1[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty, ny = -tx;                          // left normal of the averaged direction
    const cos = Math.max(0.35, nx * d0[1] + ny * -d0[0]); // stretch at corners so the width stays even
    out.push([+(path[i][0] + nx * d / cos).toFixed(2), +(path[i][1] + ny * d / cos).toFixed(2)]);
  }
  return out;
}

export const mirrorX = (cx, pts) => pts.map(([x, y]) => [2 * cx - x, y]);
