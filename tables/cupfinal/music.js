// Cup Final theme: an original terrace-style march in G major with a stomping beat, for the chiptune player in
// ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: G, G, C, D / G, Em, C, D / C, G, Am, D / G, C, D, G
const BARS = ['G', 'G', 'C', 'D', 'G', 'Em', 'C', 'D', 'C', 'G', 'Am', 'D', 'G', 'C', 'D', 'G'];
const ROOT = { G: ['G2', 'D3'], C: ['C3', 'G2'], D: ['D3', 'A2'], Em: ['E2', 'B2'], Am: ['A2', 'E3'] };
const CH = { G: 'B3', C: 'E4', D: 'F#4', Em: 'G4', Am: 'C4' };

export default {
  bpm: 120,
  tracks: [
    { // the tune, like a brass band on the terraces
      type: 'square', vol: 0.016, legato: 0.85,
      notes: `G4:1 B4:1 D5:1.5 B4:0.5  G5:2 D5:2  E5:1 G5:1 E5:1 C5:1  D5:3 -:1
              G4:1 B4:1 D5:1.5 B4:0.5  E5:2 G5:2  E5:1 D5:1 C5:1 E5:1  D5:3 -:1
              E5:1 E5:1 E5:1 G5:1  D5:1 D5:1 B4:2  C5:1 E5:1 A4:1 C5:1  D5:2 F#5:2
              G5:1.5 F#5:0.5 E5:1 D5:1  C5:2 E5:2  D5:1 C5:1 B4:1 A4:1  G4:3 -:1`,
    },
    { // the bass, on the beat
      type: 'triangle', vol: 0.05, legato: 0.6,
      notes: BARS.map(c => { const [r, f] = ROOT[c]; return `${r}:1 ${f}:1 ${r}:1 ${f}:1`; }).join('  '),
    },
    { // chords on the off-beats
      type: 'square', vol: 0.007, legato: 0.35,
      notes: BARS.map(c => `-:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5`).join('  '),
    },
    { // the crowd stamping and clapping: stamp, stamp, clap
      type: 'triangle', vol: 0.016, legato: 0.12,
      notes: BARS.map(() => 'C3:1 C3:1 G6:0.5 -:0.5 -:1').join('  '),
    },
  ],
};
