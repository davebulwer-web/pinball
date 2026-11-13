// The Fergus images inlined into the page (see art/compose_fergus.py and art/prompts/log.jsonl).
const dir = 'tables/fergus/art/';
export default Object.fromEntries(
  ['playfield', 'fergus', 'friend1', 'friend2', 'pint',
    ...['broken', 'glasses', 'coffee', 'rose', 'ring', 'phone', 'note', 'hug', 'star', 'xball', 'comb', 'disco', 'heart'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
