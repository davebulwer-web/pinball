// The sound board. Every sound is a named event (flipper, bumper, sling, ...). By default each one is a
// synthesised placeholder; a table can replace any of them with an audio file by name:
//   sound.load({ bumper: 'data:audio/ogg;base64,...', drain: 'sounds/drain.mp3' })
// Names in use: flipper, bumper, sling, target, lane, knock, launch, drain, saved, nudge, danger, tilt,
// start, over, award, drop, bankReset, spin, saucer, eject, kickback, rampEnter, ramp, bonusX, locked,
// multiball, jackpot, extraBall, bonus, modeStart, modeEnd (the list is also in sound.names)
// Music: a table's `music` song (see below) plays as a chiptune loop during a game; a table can replace it
// with an audio file the same way: sound.load({ music: 'sounds/theme.mp3' }), which then loops instead.

let ac = null, on = true;
const buffers = {};      // name -> AudioBuffer (loaded replacements)
const pending = {};      // name -> url, loaded once audio is unlocked

function tone(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
  if (!ac || !on) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.08, at = 0, freq = 1200 } = {}) {
  if (!ac || !on) return;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(ac.currentTime + at);
}

// the placeholder synth for each sound name
const synth = {
  flipper: () => { noise(0.05, { vol: 0.12, freq: 900 }); tone(70, 0.05, { type: 'triangle', vol: 0.12 }); },
  bumper: () => { tone(220, 0.09, { vol: 0.07, slide: -120 }); noise(0.04, { vol: 0.1, freq: 2500 }); },
  sling: () => { tone(160, 0.06, { vol: 0.07, slide: -60 }); noise(0.03, { vol: 0.08, freq: 1800 }); },
  target: () => tone(660, 0.06, { vol: 0.05 }),
  lane: () => tone(990, 0.07, { vol: 0.04, type: 'triangle' }),
  knock: o => noise(0.03, { vol: Math.min(0.1, (o?.impact ?? 300) / 6000), freq: 700 }),
  launch: o => { noise(0.12, { vol: 0.1, freq: 500 }); tone(90 + 120 * (o?.power ?? 1), 0.15, { type: 'triangle', vol: 0.08, slide: 200 }); },
  drain: () => tone(300, 0.6, { type: 'sawtooth', vol: 0.05, slide: -250 }),
  saved: () => [523, 659, 784].forEach((f, i) => tone(f, 0.08, { at: i * 0.07, vol: 0.05 })),
  nudge: () => noise(0.08, { vol: 0.12, freq: 300 }),
  danger: () => [0, 0.2].forEach(at => tone(880, 0.12, { at, vol: 0.06 })),
  tilt: () => tone(110, 0.8, { type: 'sawtooth', vol: 0.07, slide: -40 }),
  start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.09, { at: i * 0.08, vol: 0.05 })),
  over: () => [523, 392, 330, 262].forEach((f, i) => tone(f, 0.18, { at: i * 0.16, vol: 0.05, type: 'triangle' })),
  drop: () => { tone(180, 0.05, { vol: 0.07, type: 'triangle', slide: -80 }); noise(0.04, { vol: 0.08, freq: 1200 }); },
  bankReset: () => [0, 0.05, 0.1].forEach(at => noise(0.03, { vol: 0.07, freq: 900, at })),
  spin: () => tone(1500 + Math.random() * 200, 0.02, { vol: 0.03 }),
  saucer: () => { tone(120, 0.15, { type: 'triangle', vol: 0.1, slide: -50 }); },
  eject: () => { noise(0.06, { vol: 0.12, freq: 600 }); tone(90, 0.08, { type: 'triangle', vol: 0.1 }); },
  kickback: () => { noise(0.08, { vol: 0.14, freq: 500 }); tone(100, 0.12, { type: 'square', vol: 0.06, slide: 300 }); },
  rampEnter: () => tone(300, 0.25, { type: 'triangle', vol: 0.04, slide: 400 }),
  ramp: () => [523, 784].forEach((f, i) => tone(f, 0.08, { at: i * 0.07, vol: 0.05 })),
  bonusX: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.06, { at: i * 0.05, vol: 0.05 })),
  locked: () => [392, 392, 523].forEach((f, i) => tone(f, 0.12, { at: i * 0.13, vol: 0.06 })),
  multiball: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, { at: i * 0.09, vol: 0.06 })),
  jackpot: () => { for (let i = 0; i < 12; i++) tone(i % 2 ? 1319 : 1047, 0.07, { at: i * 0.07, vol: 0.06 }); },
  extraBall: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, { at: i * 0.1, vol: 0.06, type: 'triangle' })),
  bonus: () => { for (let i = 0; i < 10; i++) tone(440 + i * 60, 0.04, { at: i * 0.06, vol: 0.04 }); },
  modeStart: () => [330, 440, 554, 659].forEach((f, i) => tone(f, 0.1, { at: i * 0.08, vol: 0.05, type: 'sawtooth' })),
  modeEnd: () => [659, 554, 440].forEach((f, i) => tone(f, 0.1, { at: i * 0.08, vol: 0.05, type: 'triangle' })),
  award: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.07, { at: i * 0.06, vol: 0.05 })),
};

async function loadOne(name, url) {
  try {
    const data = await (await fetch(url)).arrayBuffer();
    buffers[name] = await ac.decodeAudioData(data);
  } catch { /* keep the placeholder */ }
}

// ---------- music ----------
// A song: { bpm, tracks: [{ type, vol, notes: 'E5:2 G5 C6:2 -:1 ...' }] } where each note is a pitch (or - for
// a rest) and a length in beats (default 1). Every track loops over the length of the longest one.
const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const freqOf = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) return 0; const k = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (m[3] - 4) * 12; return 440 * 2 ** (k / 12); };
function parseSong(song) {
  const tracks = song.tracks.map(tr => {
    let at = 0; const notes = [];
    for (const tok of tr.notes.trim().split(/\s+/)) {
      const [p, len = '1'] = tok.split(':'); const d = +len;
      if (p !== '-') notes.push({ at, d, f: freqOf(p) });
      at += d;
    }
    return { ...tr, notes, len: at };
  });
  return { beat: 60 / (song.bpm ?? 120), tracks, len: Math.max(...tracks.map(t => t.len)) };
}
let song = null, musicOn = false, musicPaused = false, musicTimer = null, songStart = 0, lastTick = 0, musicSrc = null;
function scheduleMusic() {
  if (!ac || !musicOn || !song) return;
  const now = ac.currentTime;
  // while muted or paused, slide the song along so it carries on from the same place afterwards
  if (!on || musicPaused) { songStart += now - lastTick; lastTick = now; return; }
  lastTick = now;
  const ahead = now + 0.3;
  for (const tr of song.tracks) {
    if (!tr.notes.length) continue;
    for (;;) {
      const n = tr.notes[tr.i], t = songStart + (tr.loop * song.len + n.at) * song.beat;
      if (t >= ahead) break;
      if (t >= now - 0.02) tone(n.f, n.d * song.beat * (tr.legato ?? 0.85), { type: tr.type ?? 'square', vol: tr.vol ?? 0.02, at: t - now });
      if (++tr.i >= tr.notes.length) { tr.i = 0; tr.loop++; }
    }
  }
}

export const sound = {
  unlock() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
      if (ac) for (const [n, u] of Object.entries(pending)) loadOne(n, u);
    }
    if (ac && ac.state === 'suspended') ac.resume();
  },
  toggle() { on = !on; return on; },
  get on() { return on; },
  load(map) { for (const [n, u] of Object.entries(map ?? {})) { pending[n] = u; if (ac) loadOne(n, u); } },
  play(name, opts) {
    if (!ac || !on) return;
    const b = buffers[name];
    if (b) { const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); return; }
    synth[name]?.(opts);
  },
  names: Object.keys(synth),
  // the table's song (a song object, see above); used unless a `music` file was loaded
  setSong(s) { song = s ? parseSong(s) : null; },
  startMusic() {
    if (!ac || musicOn) return;
    musicOn = true;
    if (buffers.music) {
      musicSrc = ac.createBufferSource(); musicSrc.buffer = buffers.music; musicSrc.loop = true;
      const g = ac.createGain(); g.gain.value = on ? 0.5 : 0; musicSrc.gain = g;
      musicSrc.connect(g).connect(ac.destination); musicSrc.start();
      return;
    }
    if (!song) return;
    songStart = lastTick = ac.currentTime + 0.1;
    for (const tr of song.tracks) { tr.i = 0; tr.loop = 0; }
    musicTimer = setInterval(scheduleMusic, 100); scheduleMusic();
  },
  stopMusic() {
    musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicSrc) { try { musicSrc.stop(); } catch { /* already stopped */ } musicSrc = null; }
  },
  // pause or mute: a loaded music file is silenced, the chiptune just stops scheduling notes
  pauseMusic(p) {
    musicPaused = p;
    if (musicSrc?.gain) musicSrc.gain.gain.value = p || !on ? 0 : 0.5;
  },
};
