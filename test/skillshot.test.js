// Every table's plunge: across a range of launch strengths, most plunges should roll into the top lanes,
// so the skill shot can be made (Cup Final, Star Siege and Hole in One once sent every plunge back down the
// right orbit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import { tables } from '../tables/index.js';

const run = (g, secs, each) => { for (let i = 0; i < secs * 120; i++) { g.update(1 / 120); each?.(g); } };

for (const cfg of tables.filter(t => !t.workshop && t.lampGroups?.skill)) {
  test(`${cfg.name}: a plunge reaches the skill shot lanes`, () => {
    const lanes = new Set(cfg.lampGroups[Object.keys(cfg.lampGroups).find(k => k !== 'skill' && cfg.lampGroups[k].rotate)]?.lamps ?? []);
    let n = 0, hits = 0;
    for (let p = 0.6; p <= 1.0001; p += 0.02) {
      const g = new Game(cfg); g.start(1); g.state = 'ready'; g.pull(p); run(g, 20 / 60); g.launch(); g.events.length = 0;
      let found = false;
      run(g, 4, () => { found ||= g.events.some(e => e.type === 'lane' && lanes.has(e.id)); g.events.length = 0; });
      n++; if (found) hits++;
    }
    assert.ok(hits >= n / 2, `${hits} of ${n} plunges reached the lanes`);
  });
}
