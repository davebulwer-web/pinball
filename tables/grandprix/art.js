// The Grand Prix images inlined into the page (see art/compose_grandprix.py and art/prompts/log.jsonl).
const dir = 'tables/grandprix/art/';
export default Object.fromEntries(
  ['playfield', 'tyres', 'car',
    ...['helmet', 'flag', 'tyre', 'wrench', 'lights', 'trophy', 'bottle', 'watch', 'wing', 'star', 'xball'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
