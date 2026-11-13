// Race Day theme: an original galop (a fast 2/4 dance) for the chiptune player in ui/sound.js. Replace it with
// a recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: D, D, A7, D / D, G, A7, D / G, D, E7, A7 / D, G, A7, D
const CH = { D: 'F#4', A7: 'G4', G: 'B4', E7: 'G#4' };
const BARS = ['D', 'D', 'A7', 'D', 'D', 'G', 'A7', 'D', 'G', 'D', 'E7', 'A7', 'D', 'G', 'A7', 'D'];
const BASS = { D: 'D3 A2', A7: 'A2 E3', G: 'G2 D3', E7: 'E2 B2' };

export default {
  bpm: 150,
  tracks: [
    { // tune
      type: 'square', vol: 0.018, legato: 0.7,
      notes: `D5:0.5 F#5:0.5 A5:0.5 D6:0.5  F#6:0.5 E6:0.5 D6:1  C#6:0.5 E6:0.5 A5:0.5 C#6:0.5  E6:0.5 D6:0.5 A5:1
              D5:0.5 F#5:0.5 A5:0.5 D6:0.5  G6:0.5 F#6:0.5 E6:0.5 D6:0.5  C#6:0.5 B5:0.5 A5:0.5 G5:0.5  F#5:1 D5:1
              B5:0.5 D6:0.5 G6:0.5 D6:0.5  A5:0.5 D6:0.5 F#6:0.5 D6:0.5  G#5:0.5 B5:0.5 E6:0.5 D6:0.5  C#6:0.5 E6:0.5 A6:1
              F#6:0.5 A6:0.5 F#6:0.5 D6:0.5  B5:0.5 D6:0.5 B5:0.5 G5:0.5  A5:0.5 C#6:0.5 E6:0.5 G6:0.5  F#6:1 D6:1`,
    },
    { // bass on the beat
      type: 'triangle', vol: 0.05, legato: 0.5,
      notes: BARS.map(c => BASS[c]).join('  '),
    },
    { // chords on the off-beats
      type: 'square', vol: 0.008, legato: 0.4,
      notes: BARS.map(c => `-:0.5 ${CH[c]}:0.5 -:0.5 ${CH[c]}:0.5`).join('  '),
    },
    { // hooves: a soft clip-clop under it all
      type: 'triangle', vol: 0.014, legato: 0.15,
      notes: BARS.map(() => 'A6:0.25 -:0.25 E6:0.25 -:0.25 A6:0.25 -:0.25 E6:0.25 -:0.25').join('  '),
    },
  ],
};
