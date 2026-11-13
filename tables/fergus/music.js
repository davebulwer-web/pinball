// Fergus theme: an original soppy love song in C major, slow-dance style, for the chiptune player in
// ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: C, Am, F, G / C, Am, F, G / F, G, Em, Am / F, G, C, C
const BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];
const ROOT = { C: 'C2', Am: 'A1', F: 'F1', G: 'G1', Em: 'E2' };
const ARP = { C: ['C4', 'E4', 'G4', 'E4'], Am: ['A3', 'C4', 'E4', 'C4'], F: ['F3', 'A3', 'C4', 'A3'], G: ['G3', 'B3', 'D4', 'B3'], Em: ['E3', 'G3', 'B3', 'G3'] };

export default {
  bpm: 84,
  tracks: [
    { // the tune: heartfelt
      type: 'triangle', vol: 0.05, legato: 0.9,
      notes: `E5:1.5 D5:0.5 C5:1 G4:1  A4:2 C5:2  F5:1.5 E5:0.5 D5:1 C5:1  D5:3 -:1
              E5:1.5 D5:0.5 C5:1 G4:1  A4:1 C5:1 E5:2  F5:1 A5:1 G5:1 F5:1  G5:3 -:1
              A5:1.5 G5:0.5 F5:1 E5:1  D5:1.5 E5:0.5 F5:2  G5:1 E5:1 B4:1 E5:1  C5:3 A4:1
              F5:1.5 E5:0.5 D5:1 C5:1  D5:2 B4:2  C5:4  -:4`,
    },
    { // the bass
      type: 'triangle', vol: 0.045, legato: 0.8,
      notes: BARS.map(c => `${ROOT[c]}:2 ${ROOT[c]}:2`).join('  '),
    },
    { // a soft arpeggio
      type: 'square', vol: 0.005, legato: 0.5,
      notes: BARS.map(c => ARP[c].map(n => `${n}:1`).join(' ')).join('  '),
    },
  ],
};
