// The Race Day images inlined into the page (see art/compose_raceday.py and art/prompts/log.jsonl).
const dir = 'tables/raceday/art/';
export default Object.fromEntries(
  ['playfield', 'bale', 'horse0', 'horse1', 'horse2', 'horse3',
    ...['horse', 'tip', 'trophy', 'rosette', 'xball', 'coins', 'hurdle', 'hay', 'shoe', 'cap', 'flag'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
