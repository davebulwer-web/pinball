// Star Siege theme: an original space march in D minor with a driving bass, for the chiptune player in
// ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: Dm, Dm, Bb, C / Dm, Dm, Gm, A / Bb, C, Dm, Dm / Gm, Bb, A, Dm
const BARS = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A', 'Dm'];
const ROOT = { Dm: 'D2', Bb: 'Bb1', C: 'C2', Gm: 'G2', A: 'A1' };
const ARP = { Dm: ['D4', 'F4', 'A4', 'F4'], Bb: ['Bb3', 'D4', 'F4', 'D4'], C: ['C4', 'E4', 'G4', 'E4'], Gm: ['G3', 'Bb3', 'D4', 'Bb3'], A: ['A3', 'C#4', 'E4', 'C#4'] };

export default {
  bpm: 132,
  tracks: [
    { // the tune: a heroic fanfare over the battle
      type: 'square', vol: 0.014, legato: 0.85,
      notes: `D5:1.5 A4:0.5 D5:1 F5:1  E5:1.5 D5:0.5 A4:2  F5:1.5 D5:0.5 Bb4:1 D5:1  E5:2 C5:2
              D5:1.5 A4:0.5 D5:1 F5:1  A5:2 G5:1 F5:1  G5:1 F5:1 E5:1 D5:1  C#5:3 -:1
              D5:1 F5:1 Bb5:1.5 A5:0.5  G5:1 E5:1 C5:2  F5:1 E5:1 D5:1 A4:1  D5:3 -:1
              G5:1.5 F5:0.5 E5:1 D5:1  F5:1.5 E5:0.5 D5:1 Bb4:1  C#5:1 E5:1 A5:1 G5:1  D5:3 -:1`,
    },
    { // the bass, driving eighth notes
      type: 'triangle', vol: 0.05, legato: 0.5,
      notes: BARS.map(c => Array(8).fill(`${ROOT[c]}:0.5`).join(' ')).join('  '),
    },
    { // arpeggios, like a ship's computer
      type: 'square', vol: 0.006, legato: 0.4,
      notes: BARS.map(c => [...ARP[c], ...ARP[c]].map(n => `${n}:0.5`).join(' ')).join('  '),
    },
  ],
};
