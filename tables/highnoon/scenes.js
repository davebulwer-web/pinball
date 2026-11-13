// High Noon dot-matrix scenes, for the tall 160 x 32 display (see ui/dmd.js). Each draws one frame: p runs 0..1
// over the scene, lines are the message's text, and api.set / api.lines draw dots (v: 1 dim, 2 lit).

// pictures as rows of characters: '#' lit, '+' dim
const pic = rows => rows.map(r => [...r].map(c => (c === '#' ? 2 : c === '+' ? 1 : 0)));
const flipX = p => p.map(r => [...r].reverse());
const draw = (api, p, x, y, v = null) => p.forEach((row, j) => row.forEach((d, i) => d && api.set(Math.round(x) + i, Math.round(y) + j, v ?? d)));
const words = (api, lines, opts) => api.lines(lines, opts);

// a gunslinger facing right, gun drawn (14 x 28)
const SLINGER = pic([
  '    #####     ',
  '    #####     ',
  '  #########   ',
  '    +###      ',
  '    ####      ',
  '     ##       ',
  '   ######     ',
  '  ########    ',
  '  ## #### ### ',
  '  ## #####++##',
  '  ## ####   ++',
  '  #  ####     ',
  '  # ######    ',
  '    ##++##    ',
  '    ##  ##    ',
  '    ##  ##    ',
  '    ##  ##    ',
  '    ##  ##    ',
  '    ##  ##    ',
  '    ##  ##    ',
  '   ###  ###   ',
  '   ###  ###   ',
]);
// the same man falling backwards
const FALLEN = pic([
  '                          ',
  '                          ',
  '                     #### ',
  '  ##  ##  ######## ###### ',
  '  ##############+#########',
  '  ##  ##  ######## ###### ',
  '                     #### ',
]);
const SUN = pic(['  + # +  ', ' +#####+ ', '+#######+', '#########', '+#######+', ' +#####+ ', '  + # +  ']);
const CACTUS = pic(['  ##   ', '  ## ##', '# ## ##', '# #### ', '####   ', '  ##   ', '  ##   ', '  ##   ', '  ##   ']);

// a steam locomotive facing left (40 x 22), smoke comes from its chimney
const LOCO = pic([
  '     ####                                ',
  '     ####                                ',
  '    ######             +#############+   ',
  '     ####              #+++++++++++++#   ',
  '     ####      ##      #+          + #   ',
  '  #######################+        +  #   ',
  ' ##########################++++++##  #   ',
  '###########################################',
  '#########################################  ',
  '++#######################################  ',
  ' ++#####################################   ',
  '  +++##### ######## ######## ##########    ',
  '     ###    ####      ####    ####         ',
  '    #   #  #    #    #    #  #    #        ',
  '    # # #  # ## #    # ## #  # ## #        ',
  '    #   #  #    #    #    #  #    #        ',
  '     ###    ####      ####    ####         ',
]);
// a stagecoach with two horses, facing right (52 x 20)
const COACH = pic([
  '   ++++++++++++                                     ',
  '  ##############                                    ',
  '  #            #                                    ',
  '  # ##  ##  ## #                         ##         ',
  '  # ##  ##  ## #                        ####  ##    ',
  '  #            #  #               #######   ####   ',
  '  ##############   #   ##########  ######  ###     ',
  '  ##############    ######  ######  ### #  #       ',
  '   ############      #  #    #  #   #   #          ',
  '   ###      ###     #    #  #    #  #   #          ',
  '  #   #    #   #                                    ',
  ' # # # #  # # # #                                   ',
  '  #   #    #   #                                    ',
  '   ###      ###                                     ',
]);
// a safe, door shut (24 x 24); the open door is drawn as a thin slab
const SAFE = pic([
  '########################',
  '#++++++++++++++++++++++#',
  '#+                    +#',
  '#+   ##############   +#',
  '#+   #            #   +#',
  '#+   #   ######   #   +#',
  '#+   #  #  ##  #  #   +#',
  '#+   #  # #### #  #   +#',
  '#+   #  #  ##  #  #####',
  '#+   #   ######   #   +#',
  '#+   #            #   +#',
  '#+   ##############   +#',
  '#+                    +#',
  '#++++++++++++++++++++++#',
  '########################',
  ' ##                  ## ',
]);
// swinging saloon doors (one leaf, 16 x 18)
const DOOR = pic([
  '  ##############',
  ' ###############',
  '################',
  '#+#+#+#+#+#+#+##',
  '#+#+#+#+#+#+#+##',
  '#+#+#+#+#+#+#+##',
  '################',
  '#++++++++++++++#',
  '#+            +#',
  '#+            +#',
  '#++++++++++++++#',
  '################',
  '#+#+#+#+#+#+#+##',
  '#+#+#+#+#+#+#+##',
  '################',
]);
// an outlaw's face behind bars (for the jail)
const FACE = pic([
  '   ########   ',
  '   ########   ',
  ' ############ ',
  '   #++++++#   ',
  '   +#+  +#+   ',
  '   +++++++   ',
  '   ########   ',
  '   ########   ',
  '    ######    ',
]);

// Quick Draw / skill shot / Dead Eye: two gunfighters at high noon. DRAW, a flash, the outlaw falls.
export const duel = {
  secs: 3.4,
  draw(api, p, lines, t) {
    if (p > 0.62) { words(api, lines); return; }
    for (let x = 0; x < 160; x += 3) api.set(x, 31, 1);                       // the street
    draw(api, SUN, 76, 1, 1);
    draw(api, CACTUS, 104, 22, 1);
    const fired = p > 0.36;
    draw(api, SLINGER, 10, 9);
    if (!fired || p < 0.42) draw(api, flipX(SLINGER), 136, 9);
    else draw(api, FALLEN, 128, 24);
    if (p > 0.18 && p < 0.36 && Math.floor(t * 8) % 2 === 0) api.text('DRAW', 80, 13, { sc: 2, align: 'center' });
    if (fired && p < 0.42) {                                                    // the shot
      for (let x = 26; x < 136; x += 2) api.set(x, 18, 2);
      for (const [dx, dy] of [[0, 0], [1, -1], [1, 1], [2, 0], [-1, -1], [-1, 1], [3, -2], [3, 2]]) api.set(26 + dx, 18 + dy, 2);
    }
  },
};

// Railroad: the train steams across, the words come in behind it
export const train = {
  secs: 3,
  draw(api, p, lines, t) {
    const x = 165 - p * 300;
    words(api, lines, { clip: [Math.max(0, Math.round(x + 44)), 160] });
    draw(api, LOCO, x, 13);
    for (let i = 0; i < 4; i++) {                                               // smoke puffs drifting back
      const age = ((t * 2 + i * 0.25) % 1), sx = x + 7 + age * 30, sy = 11 - age * 10, r = 1 + age * 3;
      for (let a = 0; a < 6.28; a += 0.5) api.set(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.7), 1);
    }
    for (let k = (Math.floor(t * 30) % 4); k < 160; k += 4) api.set(k, 31, 1);   // sleepers
  },
};

// Stagecoach: it rattles across left to right
export const coach = {
  secs: 2.4,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    const x = -52 + (p / 0.6) * 212, bob = Math.floor(t * 12) % 2;
    draw(api, COACH, x, 14 + bob);
    for (let k = 0; k < 160; k += 5) api.set((k + Math.floor(t * 60)) % 160, 31, 1);
  },
};

// Jail: the cell door slams; for Jailbreak the bars burst
export const jail = {
  secs: 2.8,
  draw(api, p, lines, t) {
    if (p > 0.6) { words(api, lines); return; }
    draw(api, FACE, 73, 12);
    const brk = /BREAK/.test(lines[0] ?? '');
    const shut = Math.min(1, p / 0.3);
    for (let i = 0; i < 9; i++) {
      let x = 52 + i * 7;
      if (!brk) x = Math.round(-10 + i * 7 + shut * 62);                       // the door slides shut
      const bend = brk && p > 0.3 ? Math.round((i - 4) * (p - 0.3) * 20) : 0;
      for (let y = 2; y < 30; y++) api.set(x + Math.round(bend * Math.sin((y / 30) * Math.PI)), y, 2);
    }
    for (let x = 48; x < 116; x++) { api.set(x, 1, 2); api.set(x, 30, 2); }
  },
};

// The Bank: the safe door swings open and gold spills out
export const safe = {
  secs: 3,
  draw(api, p, lines, t) {
    if (p > 0.62) { words(api, lines); return; }
    const open = Math.max(0, Math.min(1, (p - 0.2) / 0.2));
    if (open < 0.5) draw(api, SAFE, 68, 2);
    else {
      for (let y = 2; y < 17; y++) for (let x = 68; x < 92; x++) if (y === 2 || y === 16 || x === 68 || x === 91) api.set(x, y, 2);
      for (let y = 4; y < 15; y++) for (let x = 70; x < 90; x++) if ((x + y) % 3 === 0) api.set(x, y, 1);      // gold inside
      for (let y = 2; y < 17; y++) { api.set(64, y, 2); api.set(65, y, 1); }                                 // the door, open
    }
    if (open >= 1) for (let i = 0; i < 14; i++) {                               // coins flying
      const a = i * 0.45, s = (p - 0.4) * 140;
      api.set(Math.round(80 + Math.cos(a) * s), Math.round(14 + Math.sin(a) * s * 0.5 - s * 0.2 + s * s * 0.004), 2);
    }
    for (let x = 60; x < 100; x++) api.set(x, 20, 1);
  },
};

// WANTED: a poster with the message on it
export const wanted = {
  secs: 2.6,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    for (let x = 36; x < 124; x++) { api.set(x, 0, 2); api.set(x, 31, 2); }
    for (let y = 0; y < 32; y++) { api.set(36, y, 2); api.set(123, y, 2); }
    api.text('WANTED', 80, 3, { sc: 2, align: 'center' });
    draw(api, FACE, 73, 20);
  },
};

// Saloon: the swing doors flap open, then the words
export const saloon = {
  secs: 2.2,
  draw(api, p, lines, t) {
    if (p > 0.55) { words(api, lines); return; }
    const swing = Math.abs(Math.sin(p * 9));
    words(api, lines, { clip: [80 - Math.round(swing * 60), 80 + Math.round(swing * 60)] });
    const w = Math.round(16 * (1 - swing));
    if (w > 1) for (const side of [-1, 1]) DOOR.forEach((row, j) => row.forEach((d, i) => {
      if (!d || i >= 16) return;
      const x = side < 0 ? 80 - 1 - Math.round(i * w / 16) - Math.round(swing * 60) : 80 + Math.round(i * w / 16) + Math.round(swing * 60);
      api.set(x, 8 + j, d);
    }));
  },
};

export default { duel, train, coach, jail, safe, wanted, saloon };
