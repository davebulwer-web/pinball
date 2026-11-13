// The rules system: a table describes its rules as data, so missions, lamps, combos and modes can be
// mixed and reused between tables without new code.
//
// Every scoring event in the game is a trigger, named `type:id` (and also plain `type`):
//   lane:laneF  hit:tgt1  bumper:bump1  sling:slingL  drop:ducks  bankDown:ducks  spin:spinR
//   saucer:hole  ramp:bigWheel (ball made it to the end)  rampFail:bigWheel  kickback:kbL
//   complete:fun (every lamp of a lamp group lit)  start  serve  drain  multiballStart  multiballEnd
//   modeStart:frenzy  modeEnd:frenzy  and any name fired by an `event` action.
//
// A rule: { on: 'ramp:bigWheel' | [...], if: {conditions}, do: [actions], else: [actions] }
// Conditions (all must hold):
//   lit: 'id' | ['id', ...]       those lamps are on (or blinking)
//   unlit: 'id' | [...]           those lamps are off
//   mode: 'id'   notMode: 'id'    a timed mode is (not) running
//   multiball: true | false
//   count: ['name', '>=', n]      a counter (see `count` action); ops: >= > <= < ==
//   locks: ['>=', n]              balls locked by the player
//   after: ['ramp:wire', 4]       that trigger happened in the last 4 seconds (for combos)
// Actions (each an array, or a function (game) => {} for anything unusual):
//   ['score', n]  ['bonus', n]  ['bonusX', 1]  ['jackpot', n]
//   ['lamp', 'id' | [...], 0 | 1 | 2]           2 = blinking
//   ['message', 'TEXT', 'second line', scene?]  ['sound', 'name']   scene: a dot-matrix animation from config.scenes
//   ['count', 'name', n]  ['setCount', 'name', n]
//   ['resetBank', 'id']  ['dropBank', 'id']  ['lock']  ['multiball', balls]  ['extraBall']  ['ballSave', secs]
//   ['mode', 'id']  ['endMode', 'id']          modes come from config.modes
//   ['event', 'name']                           fire another trigger (chains rules)
//
// Lamp groups (config.lampGroups): { fun: { lamps: [...], rotate: true, reset: true } }
//   rotate: the flipper buttons move the lit lamps along (lane change)
//   reset: once complete, the group goes out (after a short blink)
//
// Modes (config.modes): { frenzy: { name: 'SPIN FRENZY', secs: 20, scoreX: { spin: 5 }, lamps: ['frenzy'] } }
//   scoreX multiplies the score of a trigger type (or a type:id) while the mode runs.

const asList = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const OPS = { '>=': (a, b) => a >= b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '<': (a, b) => a < b, '==': (a, b) => a === b };

export class Rules {
  constructor(game, cfg) {
    this.game = game;
    this.rules = (cfg.rules ?? []).map(r => ({ ...r, on: asList(r.on) }));
    this.groups = cfg.lampGroups ?? {};
    this.modeDefs = cfg.modes ?? {};
    this.complete = {};       // group -> true while complete (so it fires once)
    this.depth = 0;
  }

  // ---- triggers ----
  fire(type, id) {
    const g = this.game;
    const keys = id ? [`${type}:${id}`, type] : [type];
    for (const k of keys) g.lastTrigger[k] = g.world.time;
    if (this.depth > 8) return;   // a rule chain looping on itself
    this.depth++;
    for (const r of this.rules) if (r.on.some(o => keys.includes(o))) this.run(r);
    this.depth--;
  }

  run(r) {
    const ok = this.check(r.if);
    this.act(ok ? r.do : r.else);
  }

  check(c) {
    if (!c) return true;
    const g = this.game, p = g.player;
    if (asList(c.lit).some(id => !g.lamps[id])) return false;
    if (asList(c.unlit).some(id => g.lamps[id])) return false;
    if (c.mode && !g.modes[c.mode]) return false;
    if (c.notMode && g.modes[c.notMode]) return false;
    if (c.multiball !== undefined && (g.liveBalls() > 1 || g.launchQueue > 0) !== c.multiball) return false;
    if (c.count && !OPS[c.count[1]]((p.counts[c.count[0]] ?? 0), c.count[2])) return false;
    if (c.locks && !OPS[c.locks[0]](p.locks, c.locks[1])) return false;
    if (c.after) { const t = g.lastTrigger[c.after[0]]; if (t === undefined || g.world.time - t > c.after[1]) return false; }
    return true;
  }

  act(list) {
    const g = this.game, p = g.player;
    if (typeof list === 'function') { list(g); return; }
    for (const a of list ?? []) {
      if (typeof a === 'function') { a(g); continue; }
      const [name, x, y] = a;
      switch (name) {
        case 'score': g.addScore(x); break;
        case 'bonus': p.bonus += x; break;
        case 'bonusX': if (p.bonusX < (g.cfg.maxBonusX ?? 5)) { p.bonusX = Math.min(g.cfg.maxBonusX ?? 5, p.bonusX + x); g.emit('bonusX', { x: p.bonusX }); } break;
        case 'jackpot': g.addScore(x); g.emit('jackpot', { score: x }); break;
        case 'lamp': for (const id of asList(x)) g.lamps[id] = y; this.checkGroups(); break;
        case 'message': g.emit('message', { text: x, sub: y, scene: a[3] }); break;
        case 'sound': g.emit('sound', { name: x }); break;
        case 'count': p.counts[x] = (p.counts[x] ?? 0) + (y ?? 1); break;
        case 'setCount': p.counts[x] = y; break;
        case 'resetBank': g.resetBank(x); break;
        case 'dropBank': g.dropBank(x); break;
        case 'lock': g.lock(); break;
        case 'multiball': g.multiball(x); break;
        case 'extraBall': p.extra++; g.emit('extraBall'); break;
        case 'ballSave': g.timeLeftSave = Math.max(g.timeLeftSave, x); break;
        case 'mode': this.startMode(x); break;
        case 'endMode': this.endMode(x); break;
        case 'event': this.fire(x); break;
        default: console.warn('unknown rule action', name);
      }
    }
  }

  // ---- lamp groups ----
  checkGroups() {
    const g = this.game;
    for (const [id, grp] of Object.entries(this.groups)) {
      const all = grp.lamps.every(l => g.lamps[l]);
      if (all && !this.complete[id]) {
        this.complete[id] = true;
        if (grp.reset) {
          grp.lamps.forEach(l => (g.lamps[l] = 2));
          g.after(0.8, () => { grp.lamps.forEach(l => (g.lamps[l] = 0)); this.complete[id] = false; });
        }
        this.fire('complete', id);
      } else if (!all && !grp.reset) this.complete[id] = false;
    }
  }
  flip(side) {
    const g = this.game;
    for (const grp of Object.values(this.groups)) {
      if (!grp.rotate) continue;
      const v = grp.lamps.map(l => g.lamps[l] ? 1 : 0);
      if (v.every(x => x === v[0])) continue;
      const r = side === 'left' ? [...v.slice(1), v[0]] : [v[v.length - 1], ...v.slice(0, -1)];
      grp.lamps.forEach((l, i) => (g.lamps[l] = r[i]));
    }
  }

  // ---- modes ----
  startMode(id) {
    const g = this.game, def = this.modeDefs[id];
    if (!def) return console.warn('unknown mode', id);
    const fresh = !g.modes[id];
    g.modes[id] = { left: def.secs ?? 20, def };
    for (const l of asList(def.lamps)) g.lamps[l] = 2;
    if (fresh) { g.emit('modeStart', { id, name: def.name ?? id.toUpperCase(), secs: def.secs }); this.fire('modeStart', id); }
  }
  endMode(id) {
    const g = this.game, m = g.modes[id];
    if (!m) return;
    delete g.modes[id];
    for (const l of asList(m.def.lamps)) g.lamps[l] = 0;
    g.emit('modeEnd', { id, name: m.def.name ?? id.toUpperCase() });
    this.fire('modeEnd', id);
  }
  tick(dt) {
    for (const [id, m] of Object.entries(this.game.modes)) { m.left -= dt; if (m.left <= 0) this.endMode(id); }
  }
  // score multiplier from running modes for a trigger
  multiplier(type, id) {
    let k = 1;
    for (const m of Object.values(this.game.modes)) {
      const x = m.def.scoreX ?? {};
      k *= x[`${type}:${id}`] ?? x[type] ?? 1;
    }
    return k;
  }
}
