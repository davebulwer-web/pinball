// The Grand Slam images inlined into the page (see art/compose_grandslam.py and art/prompts/log.jsonl).
const dir = 'tables/grandslam/art/';
export default Object.fromEntries(
  ['playfield', 'baseball', 'fielder', 'runner',
    ...['ball', 'base', 'bat', 'glove', 'ump', 'xball', 'trophy', 'foam', 'star', 'pennant', 'hotdog'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
