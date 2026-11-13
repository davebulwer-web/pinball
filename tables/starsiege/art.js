// The Star Siege images inlined into the page (see art/compose_starsiege.py and art/prompts/log.jsonl).
const dir = 'tables/starsiege/art/';
export default Object.fromEntries(
  ['playfield', 'mothership', 'asteroid', 'fighter', 'alien',
    ...['planet', 'rocket', 'star', 'laser', 'shield', 'medal', 'hole', 'alien', 'xball', 'fuel', 'beam', 'moon', 'earth'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
