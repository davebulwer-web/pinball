// A flipper: a tapered bat that rotates about its pivot. It is driven straight to its up or rest angle
// (no mass), and a ball it touches picks up the speed of the flipper's surface at the contact point,
// which is what makes cradling, live catches and post passes work.
//
// Config: { id, pivot: [x, y], side: 'left' | 'right', length = 46, rest = 30, up = -26 (degrees below
//   horizontal, measured for a left flipper; a right flipper is mirrored), r1 = 6 (pivot end radius),
//   r2 = 3 (tip radius), upSpeed = 30 and downSpeed = 18 (rad/s), bounce = 0.45, key }

const D = Math.PI / 180;

export class Flipper {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = cfg.id; this.side = cfg.side;
    this.px = cfg.pivot[0]; this.py = cfg.pivot[1];
    this.len = cfg.length ?? 46;
    this.r1 = cfg.r1 ?? 6; this.r2 = cfg.r2 ?? 3;
    const mirror = a => (this.side === 'right' ? Math.PI - a : a);
    this.restA = mirror((cfg.rest ?? 30) * D);
    this.upA = mirror((cfg.up ?? -26) * D);
    this.upSpeed = cfg.upSpeed ?? 30; this.downSpeed = cfg.downSpeed ?? 18;
    this.angle = this.restA; this.omega = 0;
    this.held = false; this.enabled = true;
    this.shapes = [{ kind: 'flipper', part: this, bounce: cfg.bounce ?? 0.45, friction: 0.08, id: cfg.id, hitMin: 1e9 }];
  }
  set(held) { this.held = held && this.enabled; }
  moving() { return this.omega !== 0; }
  tipSpeed() { return Math.abs(this.omega) * this.len; }
  tip() { return [this.px + Math.cos(this.angle) * this.len, this.py + Math.sin(this.angle) * this.len]; }

  update(h) {
    const target = this.held ? this.upA : this.restA;
    const diff = target - this.angle;
    if (Math.abs(diff) < 1e-9) { this.omega = 0; return; }
    const speed = this.held ? this.upSpeed : this.downSpeed;
    const stepA = Math.sign(diff) * Math.min(Math.abs(diff), speed * h);
    this.omega = stepA / h;
    this.angle += stepA;
  }

  // Closest point on the flipper's centre line to (x, y), the bat's radius there and the surface speed.
  contact(x, y) {
    const [tx, ty] = this.tip();
    const dx = tx - this.px, dy = ty - this.py;
    let t = ((x - this.px) * dx + (y - this.py) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = this.px + dx * t, cy = this.py + dy * t;
    const rad = this.r1 + (this.r2 - this.r1) * t;
    // surface speed of the point on the bat nearest the ball (rotation about the pivot)
    const ox = x - this.px, oy = y - this.py;
    const ol = Math.hypot(ox, oy) || 1;
    const reach = Math.min(ol, this.len + this.r2);
    const vx = -this.omega * (oy / ol) * reach, vy = this.omega * (ox / ol) * reach;
    return { x: cx, y: cy, rad, vx, vy };
  }
}
