// High Noon theme: an original cowboy tune in A minor over a galloping bass, for the chiptune player in
// ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: Am, Am, G, Am / Am, C, G, E / F, C, G, Am / F, G, E, Am
const BARS = ['Am', 'Am', 'G', 'Am', 'Am', 'C', 'G', 'E', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'Am'];
const ROOT = { Am: ['A2', 'E3'], G: ['G2', 'D3'], C: ['C3', 'G2'], E: ['E2', 'B2'], F: ['F2', 'C3'] };
const CH = { Am: 'C4', G: 'B3', C: 'E4', E: 'G#3', F: 'A3' };

export default {
  bpm: 132,
  tracks: [
    { // the tune, a little like a harmonica
      type: 'square', vol: 0.016, legato: 0.8,
      notes: `A4:1.5 E5:0.5 A5:1 G5:0.5 E5:0.5  C5:1 D5:0.5 E5:0.5 A4:2  G4:1.5 B4:0.5 D5:1 G5:0.5 F5:0.5  E5:1 C5:0.5 B4:0.5 A4:2
              A4:0.5 C5:0.5 E5:1 E5:0.5 F5:0.5 E5:1  G5:1.5 E5:0.5 C5:2  D5:0.5 E5:0.5 F5:0.5 E5:0.5 D5:1 B4:1  G#4:1 B4:1 E5:2
              F5:1.5 E5:0.5 C5:1 A4:1  G4:0.5 A4:0.5 C5:0.5 E5:0.5 G5:2  F5:0.5 E5:0.5 D5:0.5 B4:0.5 G4:1 D5:1  E5:1 C5:1 A4:2
              A5:1 G5:0.5 F5:0.5 E5:1 C5:1  D5:1 B4:0.5 G4:0.5 D5:2  E5:0.5 F5:0.5 E5:0.5 D5:0.5 B4:1 G#4:1  A4:1 E4:1 A4:2`,
    },
    { // the galloping bass
      type: 'triangle', vol: 0.05, legato: 0.6,
      notes: BARS.map(c => { const [r, f] = ROOT[c]; return `${r}:0.75 ${r}:0.25 ${f}:1 ${r}:0.75 ${r}:0.25 ${f}:1`; }).join('  '),
    },
    { // chords on the off-beats
      type: 'square', vol: 0.007, legato: 0.35,
      notes: BARS.map(c => `-:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5`).join('  '),
    },
    { // hooves and spurs
      type: 'triangle', vol: 0.012, legato: 0.12,
      notes: BARS.map(() => 'E6:0.75 B5:0.25 E6:1 E6:0.75 B5:0.25 E6:1').join('  '),
    },
  ],
};
