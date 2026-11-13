// The Angry Andy images inlined into the page (see art/compose_angryandy.py and art/prompts/log.jsonl).
const dir = 'tables/angryandy/art/';
export default Object.fromEntries(
  ['playfield', 'andy', 'andy-red', 'monitor',
    ...['printer', 'phone', 'email', 'key', 'coffee', 'ticket', 'wifi', 'floppy', 'fire', 'star', 'xball', 'plug', 'band', 'angry'].map(n => `lamp-${n}`)].map(n => [n, `${dir}${n}.png`]),
);
