// High scores: the best five games on each table, kept in this browser only (localStorage, per table id).
// A table can set its starting list with `highScores: [[name, score], ...]` in its config; otherwise the
// list starts with the scores below. Names are three letters, entered at the end of a game.

export const DEFAULT_SCORES = [['ACE', 1000000], ['PIX', 750000], ['ZAP', 500000], ['BOB', 250000], ['FUN', 100000]];
const SIZE = 5;

const key = id => `pinball.${id}.scores`;

export function loadScores(cfg, store = globalThis.localStorage) {
  let list = null;
  try { list = JSON.parse(store?.getItem(key(cfg.id)) ?? 'null'); } catch { /* storage blocked or bad data */ }
  if (!Array.isArray(list) || !list.every(e => Array.isArray(e) && typeof e[1] === 'number')) list = cfg.highScores ?? DEFAULT_SCORES;
  return list.map(([n, s]) => [String(n).slice(0, 3), s]).sort((a, b) => b[1] - a[1]).slice(0, SIZE);
}

export function saveScores(cfg, list, store = globalThis.localStorage) {
  try { store?.setItem(key(cfg.id), JSON.stringify(list)); } catch { /* storage blocked */ }
}

// would this score get onto the list?
export const qualifies = (list, score) => score > 0 && (list.length < SIZE || score > list[list.length - 1][1]);

// put a score on the list; returns the new list and its place (0 = top), or -1 if it did not make it
export function addScore(list, name, score) {
  if (!qualifies(list, score)) return { list, place: -1 };
  const entry = [name, score];
  const out = [...list, entry].sort((a, b) => b[1] - a[1]).slice(0, SIZE);   // a tie goes below the older score
  return { list: out, place: out.indexOf(entry) };
}

// the best score on a table, for the table menu
export const bestScore = (cfg, store) => loadScores(cfg, store)[0];
