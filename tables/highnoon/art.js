// The High Noon images inlined into the page (see art/compose_highnoon.py and art/prompts/log.jsonl).
const dir = 'tables/highnoon/art/';
export default Object.fromEntries(
  ['playfield', 'barrel', 'outlaw', 'outlaw2', 'folk', 'folk2', 'coach',
    ...['star', 'bullet', 'dynamite', 'gold', 'wanted', 'key', 'train', 'hat', 'cactus', 'bag', 'xball', 'whiskey', 'safe', 'coach'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
