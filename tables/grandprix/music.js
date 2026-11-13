// Grand Prix theme: an original driving rock tune in E minor, revving along on a pulsing bass, for the chiptune
// player in ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: Em, Em, C, D / Em, Em, C, B / G, D, Em, C / Am, B, Em, Em
const BARS = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'G', 'D', 'Em', 'C', 'Am', 'B', 'Em', 'Em'];
const ROOT = { Em: 'E2', C: 'C2', D: 'D2', B: 'B1', G: 'G2', Am: 'A2' };
const CH = { Em: 'G4', C: 'E4', D: 'F#4', B: 'D#4', G: 'B4', Am: 'C5' };

export default {
  bpm: 148,
  tracks: [
    { // the lead
      type: 'square', vol: 0.03, legato: 0.8,
      notes: `E5:1 G5:0.5 B5:0.5 E6:1 D6:1  B5:2 G5:1 A5:1  G5:1 E5:1 C5:1 E5:1  F#5:3 -:1
              E5:1 G5:0.5 B5:0.5 E6:1 D6:1  B5:2 D6:1 E6:1  C6:1 B5:1 A5:1 G5:1  F#5:2 D#5:2
              D5:1 G5:1 B5:1 D6:1  A5:1 F#5:1 D5:1 F#5:1  G5:1 B5:1 E6:1 B5:1  C6:2 G5:2
              A5:1 C6:1 E6:1 C6:1  B5:1 D#6:1 F#6:1 D#6:1  E6:2 B5:2  E6:3 -:1`,
    },
    { // the pulsing bass, eighth notes
      type: 'triangle', vol: 0.05, legato: 0.5,
      notes: BARS.map(c => Array(8).fill(`${ROOT[c]}:0.5`).join(' ')).join('  '),
    },
    { // stabs on the off beats
      type: 'square', vol: 0.006, legato: 0.3,
      notes: BARS.map(c => `-:1 ${CH[c]}:1 -:1 ${CH[c]}:1`).join('  '),
    },
  ],
};
