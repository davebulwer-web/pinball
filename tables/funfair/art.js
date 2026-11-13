// The Fun Fair images inlined into the page (see art/compose_funfair.py and art/prompts/log.jsonl).
const dir = 'tables/funfair/art/';
export default Object.fromEntries(
  ['playfield', 'dodgem-red', 'dodgem-blue', 'dodgem-yellow', 'duck', 'coconut', 'ghost',
    ...['ticket', 'tent', 'coins', 'xball', 'car', 'coco', 'arrow', 'ghost', 'buoy', 'star'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
