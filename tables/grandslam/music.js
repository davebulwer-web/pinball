// Grand Slam theme: an original bouncy ballpark-organ march in C major, for the chiptune player
// in ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: C, C, F, C / G, G7, C, C / C, C7, F, Fm / C, G7, C, C
const BARS = ['C', 'C', 'F', 'C', 'G', 'G7', 'C', 'C', 'C', 'C7', 'F', 'Fm', 'C', 'G7', 'C', 'C'];
const BASS = { C: 'C2 G2 E2 G2', F: 'F2 C3 A2 C3', G: 'G2 D3 B2 D3', G7: 'G2 F2 D2 B1', C7: 'C2 Bb2 E2 G2', Fm: 'F2 Ab2 C3 Ab2' };
const CH = { C: 'E4', F: 'A4', G: 'D4', G7: 'F4', C7: 'Bb4', Fm: 'Ab4' };

export default {
  bpm: 132,
  tracks: [
    { // the tune, on the organ
      type: 'square', vol: 0.03, legato: 0.85,
      notes: `G4:1 C5:1 E5:1 G5:1  E5:2 C5:1 E5:1  F5:1 A5:1 C6:1 A5:1  G5:3 -:1
              D5:1 G5:1 B5:1 D6:1  C6:1 B5:1 A5:1 F5:1  E5:1 G5:1 C6:1 G5:1  E5:3 -:1
              G4:1 C5:1 E5:1 G5:1  Bb5:2 G5:1 E5:1  F5:1 A5:1 C6:2  Ab5:2 F5:2
              G5:1 E5:1 C5:1 E5:1  D5:1 F5:1 B4:1 D5:1  C5:2 G4:2  C5:3 -:1`,
    },
    { // the organ's pedal bass
      type: 'triangle', vol: 0.05, legato: 0.6,
      notes: BARS.map(c => BASS[c].split(' ').map(n => `${n}:1`).join(' ')).join('  '),
    },
    { // chords on the off beats
      type: 'square', vol: 0.006, legato: 0.3,
      notes: BARS.map(c => `-:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5`).join('  '),
    },
  ],
};
