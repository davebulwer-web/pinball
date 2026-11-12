// The plunger: a flat tip across the bottom of the shooter lane. Pulling moves it down; releasing drives
// it back up at a speed set by how far it was pulled, carrying the ball with it.
//
// Config: { x0, x1 (lane walls), y (rest height of the tip), maxPull = 22, minSpeed = 250, maxSpeed = 1350 }

export class Plunger {
  constructor(cfg) {
    this.cfg = cfg;
    this.x0 = cfg.x0; this.x1 = cfg.x1; this.restY = cfg.y;
    this.maxPull = cfg.maxPull ?? 22;
    this.minSpeed = cfg.minSpeed ?? 250; this.maxSpeed = cfg.maxSpeed ?? 1350;
    this.pull = 0;                      // 0..1 as set by the player
    this.y = this.restY;                // current tip height
    this.firing = 0;                    // upward speed while firing, else 0
    this.tipShape = { kind: 'seg', a: [this.x0, this.y], b: [this.x1, this.y], bounce: 0, friction: 0, vel: [0, 0] };
    this.shapes = [this.tipShape];
  }
  setPull(p) { if (!this.firing) this.pull = Math.max(0, Math.min(1, p)); }
  release() {
    if (this.firing || this.pull <= 0.02) { this.pull = 0; return 0; }
    const power = this.pull;
    this.firing = this.minSpeed + (this.maxSpeed - this.minSpeed) * power;
    this.pull = 0;
    return power;
  }
  moving() { return this.firing > 0; }
  tipSpeed() { return this.firing; }
  update(h) {
    const want = this.restY + this.pull * this.maxPull;
    let vy = 0;
    if (this.firing) {
      const ny = Math.max(this.restY, this.y - this.firing * h);
      vy = (ny - this.y) / h; this.y = ny;
      if (this.y <= this.restY) this.firing = 0;
    } else if (this.y !== want) {
      // drawn back slowly, so a resting ball follows it down
      const step = Math.sign(want - this.y) * Math.min(Math.abs(want - this.y), 120 * h);
      vy = step / h; this.y += step;
    }
    // the shape moves with the tip; its upward speed is handed to a ball sitting on it
    this.tipShape.a[1] = this.tipShape.b[1] = this.y;
    this.tipShape.vel[1] = vy < 0 ? vy : 0;
  }
}
