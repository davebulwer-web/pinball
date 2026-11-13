// The Cup Final images inlined into the page (see art/compose_cupfinal.py and art/prompts/log.jsonl).
const dir = 'tables/cupfinal/art/';
export default Object.fromEntries(
  ['playfield', 'ball', 'keeper', 'defender',
    ...['boot', 'whistle', 'yellow', 'red', 'flag', 'cup', 'medal', 'scarf', 'glove', 'shirt', 'ball', 'xball', 'net', 'star'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
