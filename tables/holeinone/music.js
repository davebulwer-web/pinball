// Hole in One theme: an original easy-going swing tune in F major, like a sunny afternoon on the course, for the
// chiptune player in ui/sound.js. Replace it with a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: F, Dm, Gm, C / F, F7, Bb, Bb / F, D7, Gm, C / F, C, F, F
const BARS = ['F', 'Dm', 'Gm', 'C', 'F', 'F7', 'Bb', 'Bb', 'F', 'D7', 'Gm', 'C', 'F', 'C', 'F', 'F'];
const WALK = { F: 'F2 A2 C3 A2', Dm: 'D2 F2 A2 F2', Gm: 'G2 Bb2 D3 Bb2', C: 'C2 E2 G2 E2', F7: 'F2 A2 C3 Eb3', Bb: 'Bb1 D2 F2 D2', D7: 'D2 F#2 A2 C3' };
const CH = { F: 'A3', Dm: 'F3', Gm: 'Bb3', C: 'E3', F7: 'Eb4', Bb: 'D4', D7: 'F#3' };

export default {
  bpm: 112,
  tracks: [
    { // the tune, swung
      type: 'triangle', vol: 0.05, legato: 0.8,
      notes: `C5:0.75 A4:0.25 C5:1 F5:2  D5:1 C5:1 A4:2  Bb4:0.75 D5:0.25 G5:1 F5:1 D5:1  E5:3 -:1
              C5:0.75 A4:0.25 C5:1 F5:1.5 A5:0.5  G5:1 F5:1 Eb5:2  D5:1 F5:1 Bb5:2  A5:1 G5:1 F5:1 D5:1
              C5:0.75 A4:0.25 F5:1 A5:2  F#5:1 A5:1 C6:1 A5:1  G5:1 Bb5:1 D5:1 G5:1  E5:2 C5:2
              F5:1 A5:1 C6:1 A5:1  G5:1 E5:1 C5:2  F5:1 C5:1 A4:1 C5:1  F5:3 -:1`,
    },
    { // walking bass
      type: 'triangle', vol: 0.045, legato: 0.6,
      notes: BARS.map(c => WALK[c].split(' ').map(n => `${n}:1`).join(' ')).join('  '),
    },
    { // chords on two and four
      type: 'square', vol: 0.006, legato: 0.3,
      notes: BARS.map(c => `-:1 ${CH[c]}:1 -:1 ${CH[c]}:1`).join('  '),
    },
  ],
};
