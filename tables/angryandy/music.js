// Angry Andy theme: an original grumpy office march in A minor that gets crosser as it goes, for the chiptune
// player in ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: Am, Am, Dm, E / Am, Am, F, E / Dm, Am, E, Am / Dm, E, Am, Am
const BARS = ['Am', 'Am', 'Dm', 'E', 'Am', 'Am', 'F', 'E', 'Dm', 'Am', 'E', 'Am', 'Dm', 'E', 'Am', 'Am'];
const ROOT = { Am: ['A1', 'E2'], Dm: ['D2', 'A2'], E: ['E2', 'B2'], F: ['F2', 'C3'] };
const STAB = { Am: 'C4', Dm: 'F4', E: 'G#3', F: 'A3' };

export default {
  bpm: 126,
  tracks: [
    { // the tune: stomping about the office
      type: 'square', vol: 0.014, legato: 0.6,
      notes: `A4:1 A4:0.5 C5:0.5 E5:1 A4:1  B4:1 C5:1 B4:1 A4:1  D5:1 F5:1 E5:1 D5:1  E5:2 G#4:2
              A4:1 A4:0.5 C5:0.5 E5:1 A5:1  G5:1 F5:1 E5:1 C5:1  F5:1 E5:1 D5:1 C5:1  B4:3 -:1
              D5:1 F5:1 A5:1 F5:1  E5:1 C5:1 A4:2  B4:1 D5:1 G#5:1 E5:1  A5:3 -:1
              F5:1 E5:1 D5:1 A4:1  G#4:1 B4:1 E5:2  A4:1 C5:1 E5:1 A5:1  A4:3 -:1`,
    },
    { // the bass, plodding
      type: 'triangle', vol: 0.05, legato: 0.5,
      notes: BARS.map(c => { const [r, f] = ROOT[c]; return `${r}:1 ${f}:1 ${r}:1 ${f}:1`; }).join('  '),
    },
    { // angry stabs on the off-beat
      type: 'square', vol: 0.006, legato: 0.25,
      notes: BARS.map(c => `-:0.5 ${STAB[c]}:0.5 -:0.5 ${STAB[c]}:0.5 -:0.5 ${STAB[c]}:0.5 -:0.5 ${STAB[c]}:0.5`).join('  '),
    },
  ],
};
