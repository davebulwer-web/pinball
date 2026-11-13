// The game around the table: players taking turns, game over, and the high score list.
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Game } from '../engine/table.js';
import funfair from '../tables/funfair/config.js';
import { tables, tableIds } from '../tables/index.js';
import { loadScores, saveScores, qualifies, addScore, DEFAULT_SCORES } from '../ui/scores.js';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const drain = g => { g.world.balls.length = 0; g.drained(); };

test('players take turns, three balls each, then the game is over with every score', () => {
  const g = new Game(funfair);
  g.start(3);
  const turns = [];
  for (let i = 0; i < 20 && g.state !== 'over'; i++) {
    turns.push(`${g.player.n}.${g.player.ball}`);
    g.player.score += 1000 * g.player.n;
    drain(g);
  }
  assert.deepEqual(turns, ['1.1', '2.1', '3.1', '1.2', '2.2', '3.2', '1.3', '2.3', '3.3']);
  const over = g.events.find(e => e.type === 'over');
  assert.equal(g.state, 'over');
  assert.deepEqual(over.scores.map(s => s > 0), [true, true, true]);
  assert.ok(over.scores[2] > over.scores[0]);
});

test('each player keeps their own lamps, locks and extra balls', () => {
  const g = new Game(funfair);
  g.start(2);
  g.lamps.lock = 2; g.player.locks = 1; g.player.extra = 1;
  drain(g);                                   // player 1 shoots again
  assert.equal(g.player.n, 1);
  drain(g);                                   // now player 2, with nothing lit
  assert.equal(g.player.n, 2);
  assert.ok(!g.lamps.lock); assert.equal(g.player.locks, 0);
  drain(g);
  assert.equal(g.player.n, 1);
  assert.equal(g.lamps.lock, 2); assert.equal(g.player.locks, 1);
});

test('the high score list starts with the defaults, keeps five, and is kept per table', () => {
  const store = memory();
  let list = loadScores(funfair, store);
  assert.deepEqual(list, DEFAULT_SCORES);
  assert.ok(!qualifies(list, 100000), 'a tie with the lowest does not get on');
  assert.ok(qualifies(list, 100001));
  let r = addScore(list, 'DAV', 800000);
  assert.equal(r.place, 1);
  assert.equal(r.list.length, 5);
  assert.equal(r.list[4][0], 'BOB');          // FUN fell off the bottom
  r = addScore(r.list, 'NEW', 800000);
  assert.equal(r.place, 2, 'a tie goes below the older score');
  saveScores(funfair, r.list, store);
  assert.deepEqual(loadScores(funfair, store), r.list);
  assert.deepEqual(loadScores({ id: 'other' }, store), DEFAULT_SCORES);
  assert.equal(addScore(r.list, 'LOW', 5).place, -1);
});

test('a table can set its own starting scores, and bad saved data falls back to them', () => {
  const store = memory();
  const cfg = { id: 'mine', highScores: [['B', 20], ['A', 50]] };
  assert.deepEqual(loadScores(cfg, store), [['A', 50], ['B', 20]]);
  store.setItem('pinball.mine.scores', '{"broken"');
  assert.deepEqual(loadScores(cfg, store), [['A', 50], ['B', 20]]);
  assert.deepEqual(loadScores(cfg, null), [['A', 50], ['B', 20]]);   // no storage at all
});

test('every table in the menu has an id, a name and a tagline, and the ids match the folders', () => {
  assert.deepEqual(tableIds, tables.map(t => t.id));
  assert.equal(new Set(tableIds).size, tableIds.length);
  for (const t of tables) { assert.ok(t.name && t.tagline, t.id); assert.ok(existsSync(`tables/${t.id}/main.js`), t.id); }
  assert.ok(tables.some(t => !t.workshop), 'at least one table to play');
});
