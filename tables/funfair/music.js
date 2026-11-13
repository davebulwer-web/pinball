// Fun Fair theme: an original fairground waltz (3/4) for the chiptune player in ui/sound.js. Replace it with a
// recording by adding `music: 'url'` to the table's sounds.
// Sixteen bars: C, F, C, G7 / C, F, C, G / F, Dm, G7, C / Am, F, G7, C
export default {
  bpm: 168,
  tracks: [
    { // tune
      type: 'square', vol: 0.018,
      notes: `E5:2 G5 C6:2 G5 A5 F5 A5 G5:3
              E5:2 G5 C6 B5 A5 G5 F5 E5 D5:3
              F5:2 A5 D6:2 A5 B5 G5 B5 C6:3
              E6 D6 C6 B5 A5 G5 A5 B5 D6 C6:3`,
    },
    { // oom (bass on the first beat)
      type: 'triangle', vol: 0.05, legato: 0.6,
      notes: `C3:3 F3:3 C3:3 G2:3  C3:3 F3:3 C3:3 G2:3  F2:3 D3:3 G2:3 C3:3  A2:3 F2:3 G2:3 C3:3`,
    },
    { // pah-pah (chord on beats two and three)
      type: 'square', vol: 0.008, legato: 0.4,
      notes: `- G4 G4 - A4 A4 - G4 G4 - F4 F4  - G4 G4 - A4 A4 - G4 G4 - B4 B4
              - A4 A4 - F4 F4 - F4 F4 - E4 E4  - E4 E4 - A4 A4 - F4 F4 - E4 E4`,
    },
    { // a twinkle on top every other bar
      type: 'triangle', vol: 0.012, legato: 0.3,
      notes: `-:3 C7:0.5 G6:0.5 E6:0.5 -:1.5  -:3 C7:0.5 A6:0.5 F6:0.5 -:1.5  -:3 B6:0.5 G6:0.5 D6:0.5 -:1.5  -:3 C7:0.5 G6:0.5 E6:0.5 -:1.5`,
    },
  ],
};
