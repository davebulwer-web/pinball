// The Fun Fair images inlined into the page (see art/compose_funfair.py and art/prompts/log.jsonl).
const dir = 'tables/funfair/art/';
export default Object.fromEntries(
  ['playfield', 'dodgem-red', 'dodgem-blue', 'dodgem-yellow', 'duck', 'coconut', 'ghost'].map(n => [n, `${dir}${n}.png`]),
);
