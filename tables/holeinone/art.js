// The Hole in One images inlined into the page (see art/compose_holeinone.py and art/prompts/log.jsonl).
const dir = 'tables/holeinone/art/';
export default Object.fromEntries(
  ['playfield', 'tree', 'ball', 'flag', 'buggy',
    ...['club', 'trophy', 'tee', 'bird', 'eagle', 'wind', 'flag', 'house', 'xball', 'star', 'sand', 'card'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
