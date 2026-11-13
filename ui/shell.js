// The shared screen for every table: owns the canvas, scaling, the scrolling camera, touch and keyboard
// input, the dot-matrix strip, sound, pause, the debug overlay (D key or ?debug) and the tuning panel
// (?tune), and the screens between games: 1 to 4 players, high scores and name entry, and the way back
// to the table menu. A table's page just calls startTable(config), or startTable(config, { art }) with
// images from ui/art.js loadArt(). Pass onMenu to show a "< TABLES" button (the menu page passes one;
// a single table page gets one that opens window.PINBALL_MENU, set by build.mjs). stop() ends the table.
//
// Screen: 320 pixels wide. The height follows the window shape (480 to 600), so a phone in portrait is
// filled; the top 32 rows (64 for a table with a tall dot matrix) are the dot-matrix strip and the rest is the view onto the playfield.

import { Game } from '../engine/table.js';
import { buildPlayfield, ballSprite, drawDynamic, drawDebug } from './render.js';
import { createDmd } from './dmd.js';
import { sound } from './sound.js';
import { commas, drawText } from './font.js';
import { helpPages, drawHelp, drawHelpButton, helpButton } from './help.js';
import { loadScores, saveScores, qualifies, addScore } from './scores.js';
import { LETTERS, inside, playerButtons, drawPlayerButtons, menuButton, drawMenuButton, drawScores, entryLayout, drawEntry } from './screens.js';

const W = 320;

export function startTable(cfg, { canvas = document.getElementById('screen'), art = {}, onMenu } = {}) {
  const life = new AbortController(), on = { signal: life.signal };   // every listener goes when the table stops
  const toMenu = onMenu ?? (typeof window !== 'undefined' && window.PINBALL_MENU ? () => { location.href = window.PINBALL_MENU; } : null);
  const ctx = canvas.getContext('2d');
  const game = new Game(cfg);
  const { base: playfield, overlay } = buildPlayfield(cfg, art);
  const sprites = { ball: ballSprite(cfg.ballRadius ?? 5), overlay, art };
  const dmd = createDmd(cfg.dmd);
  const DMD_ROWS = dmd.rows;                        // screen rows the dot matrix takes (32, or 64 for a tall one)
  sound.load(cfg.sounds);
  sound.setSong(cfg.music);
  const params = new URLSearchParams(location.search);
  let debug = params.has('debug');
  let paused = false, H = 480, camY = cfg.size[1], shakeUntil = 0, shakeDx = 0, touchSeen = false;
  let lastScore = load('lastScore', 0), overAt = -9;
  let help = -1;                                   // instructions page showing, or -1
  let scores = loadScores(cfg);
  let entry = null, entries = [];                   // name entry showing, and players still to enter
  let showScores = { until: -1, place: -1 };        // high score table showing after a game, and the place to flash
  let lastName = load('name', 'AAA'), quietUntil = 0;   // no new game until a moment after name entry
  const isTouch = () => touchSeen || 'ontouchstart' in window;
  const pages = () => helpPages(cfg, isTouch());
  // between games: the game is over (and names are entered) or not started yet
  const between = () => !entry && now > quietUntil && (game.state === 'attract' || (game.state === 'over' && game.world.time - overAt > 1.2));
  const helpOffered = () => (game.state === 'attract' || game.state === 'over' || paused) && !entry;
  const turnHelp = d => { help += d; if (help < 0) help = 0; if (help >= pages().length) help = -1; };

  // ---------- sizing ----------
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    H = vh > vw ? Math.max(480, Math.min(600, Math.round(W * vh / vw))) : 480;
    if (canvas.height !== H) { canvas.width = W; canvas.height = H; ctx.imageSmoothingEnabled = false; }
    const s = Math.min(vw / W, vh / H);
    const scale = s >= 2 ? Math.floor(s) : s;
    canvas.style.width = `${Math.floor(W * scale)}px`;
    canvas.style.height = `${Math.floor(H * scale)}px`;
  }
  window.addEventListener('resize', fit, on);
  fit();

  // ---------- input ----------
  const startGame = (players = 1) => {
    if (!between()) return false;
    dmd.clearQueue(); showScores.until = -1; game.start(players);
    return true;
  };

  // name entry for each player whose score makes the high score table, in turn
  const nextEntry = () => {
    while (entries.length) {
      const p = entries.shift();
      if (!qualifies(scores, p.score)) continue;
      const name = [...lastName.padEnd(3).slice(0, 3)].map(c => Math.max(0, LETTERS.indexOf(c)));
      entry = { player: p.n, players: game.players.length, score: p.score, name, slot: 0 };
      sound.play('highScore');
      return;
    }
    entry = null;
  };
  const finishEntry = () => {
    const name = entry.name.map(i => LETTERS[i]).join('');
    const r = addScore(scores, name, entry.score);
    scores = r.list; saveScores(cfg, scores);
    lastName = name; save('name', name);
    showScores = { until: now + 6, place: r.place }; quietUntil = now + 0.8;
    sound.play('award');
    nextEntry();
  };
  const turnLetter = d => { entry.name[entry.slot] = (entry.name[entry.slot] + d + LETTERS.length) % LETTERS.length; sound.play('lane'); };
  const nextSlot = () => { if (entry.slot < 2) { entry.slot++; sound.play('target'); } else finishEntry(); };
  function tapEntry(cx, cy) {
    const L = entryLayout(W, DMD_ROWS);
    if (inside(L.ok, cx, cy)) return finishEntry();
    for (const s of L.slots) {
      if (inside(s.up, cx, cy, 5)) { entry.slot = s.i; return turnLetter(1); }
      if (inside(s.down, cx, cy, 5)) { entry.slot = s.i; return turnLetter(-1); }
      if (inside(s.letter, cx, cy)) { entry.slot = s.i; return; }
    }
  }
  const canPlunge = () => game.state === 'ready' && game.ballInLane();
  const held = { left: new Set(), right: new Set() };          // which pointers/keys hold each flipper
  const setFlip = (side, who, down) => {
    const s = held[side];
    down ? s.add(who) : s.delete(who);
    game.flip(side, s.size > 0);   // always pass the state on, so the game never keeps a stale one
  };
  let plungeBy = null, plungeStart = 0, plungeDrag = 0;        // who is pulling the plunger
  const beginPlunge = who => { plungeBy = who; plungeStart = performance.now(); plungeDrag = 0; };
  const endPlunge = who => { if (plungeBy !== who) return; plungeBy = null; game.launch(); };

  const pointers = new Map();
  const onDown = ev => {
    sound.unlock();
    if (ev.pointerType === 'touch') touchSeen = true;
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const cx = (ev.clientX - r.left) / r.width * W, cy = (ev.clientY - r.top) / r.height * H;
    const b = helpButton(W, H), onButton = cx >= b.x - 6 && cy >= b.y - 6 && cx <= b.x + b.s + 4 && cy <= b.y + b.s + 4;
    if (help >= 0) { if (onButton) help = -1; else turnHelp(cx < W / 2 ? -1 : 1); return; }
    if (entry) { tapEntry(cx, cy); return; }
    if (onButton && helpOffered()) { help = 0; return; }
    if (between() && !paused) {
      if (toMenu && inside(menuButton(DMD_ROWS), cx, cy)) { toMenu(); return; }
      const pick = playerButtons(W, H).find(b => inside(b, cx, cy));
      if (pick) { startGame(pick.n); pointers.set(ev.pointerId, { mode: 'none', type: ev.pointerType }); return; }
    }
    if (paused) { paused = false; return; }
    if (ev.clientY - r.top < (DMD_ROWS / H) * r.height && game.state !== 'attract' && game.state !== 'over') { paused = true; return; }
    if (startGame()) { pointers.set(ev.pointerId, { mode: 'none', type: ev.pointerType }); return; }
    const p = { x: ev.clientX, y: ev.clientY, t: performance.now(), nudged: false, type: ev.pointerType };
    if (canPlunge() && !plungeBy) { p.mode = 'plunge'; beginPlunge(ev.pointerId); }
    else { p.mode = 'flip'; p.side = ev.clientX < window.innerWidth / 2 ? 'left' : 'right'; setFlip(p.side, ev.pointerId, true); if (ev.pointerType === 'touch') navigator.vibrate?.(6); }
    pointers.set(ev.pointerId, p);
  };
  const onMove = ev => {
    const p = pointers.get(ev.pointerId); if (!p) return;
    if (ev.pointerType === 'mouse' && ev.buttons === 0) { onUp(ev); return; }   // button let go outside the page
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (p.mode === 'plunge') plungeDrag = Math.max(0, Math.min(1, dy / (window.innerHeight * 0.18)));
    else if (p.mode === 'flip' && !p.nudged && performance.now() - p.t < 350 && dy < -Math.max(40, window.innerHeight * 0.06)) {
      p.nudged = true;
      game.nudge(Math.abs(dx) > -dy * 0.5 ? Math.sign(dx) : 0, -1);
    }
  };
  const onUp = ev => {
    const p = pointers.get(ev.pointerId); if (!p) return;
    pointers.delete(ev.pointerId);
    if (p.mode === 'plunge') endPlunge(ev.pointerId);
    if (p.mode === 'flip') setFlip(p.side, ev.pointerId, false);
  };
  window.addEventListener('pointerdown', onDown, { passive: false, signal: life.signal });
  window.addEventListener('pointermove', onMove, on);
  window.addEventListener('pointerup', onUp, on);
  window.addEventListener('pointercancel', onUp, on);
  window.addEventListener('contextmenu', e => e.preventDefault(), on);
  // Safety nets for a lost pointerup (it can happen on phones and inside frames): when no finger is
  // left on the glass, or the page loses focus, let go of everything.
  const releaseAll = type => {
    for (const [id, p] of [...pointers]) if (!type || p.type === type) onUp({ pointerId: id });
  };
  window.addEventListener('touchend', e => { if (e.touches.length === 0) releaseAll('touch'); }, on);
  window.addEventListener('touchcancel', e => { if (e.touches.length === 0) releaseAll('touch'); }, on);
  window.addEventListener('blur', () => { releaseAll(); for (const side of ['left', 'right']) { held[side].clear(); game.flip(side, false); } }, on);

  const keys = {
    KeyZ: 'left', ShiftLeft: 'left', ControlLeft: 'left',
    Slash: 'right', ShiftRight: 'right', ControlRight: 'right',
  };
  const onKey = (ev, down) => {
    const c = ev.code;
    // Windows sends no keyup for the first Shift (or Ctrl) let go while both are held, so trust the
    // modifier flags on every key event: if Shift isn't down, neither Shift key holds a flipper.
    for (const [mod, codes] of [['shiftKey', ['ShiftLeft', 'ShiftRight']], ['ctrlKey', ['ControlLeft', 'ControlRight']]])
      if (!ev[mod]) for (const k of codes) if (k !== c || !down) for (const side of ['left', 'right']) if (held[side].has(k)) setFlip(side, k, false);
    if (ev.repeat) { ev.preventDefault(); return; }
    sound.unlock();
    if (help >= 0) {   // the instructions screen takes the keys while it is showing
      if (keys[c]) { if (!down) setFlip(keys[c], c, false); ev.preventDefault(); return; }
      if (!down) return;
      ev.preventDefault();
      if (c === 'ArrowLeft') turnHelp(-1);
      else if (c === 'ArrowRight' || c === 'Enter') turnHelp(1);
      else if (c === 'KeyH' || c === 'KeyI' || c === 'Escape' || c === 'Space') help = -1;
      return;
    }
    if (entry) {        // name entry takes the keys too: type letters, or flippers to change one and Space to move on
      ev.preventDefault();
      if (!down) { if (keys[c]) setFlip(keys[c], c, false); return; }
      const ch = ev.key?.length === 1 ? ev.key.toUpperCase() : '';
      if (c === 'Enter') finishEntry();
      else if (c === 'Space' || c === 'ArrowRight') nextSlot();
      else if (c === 'Backspace' || c === 'ArrowLeft') { if (entry.slot > 0) entry.slot--; }
      else if (keys[c] === 'left' || c === 'ArrowDown') turnLetter(-1);
      else if (keys[c] === 'right' || c === 'ArrowUp') turnLetter(1);
      else if (ch && ch !== ' ' && LETTERS.includes(ch)) { entry.name[entry.slot] = LETTERS.indexOf(ch); nextSlot(); }
      return;
    }
    if (down && between() && /^(Digit|Numpad)[1-4]$/.test(c)) { ev.preventDefault(); startGame(+c.slice(-1)); return; }
    if (down && (c === 'Escape' || c === 'Backspace') && between() && toMenu) { ev.preventDefault(); toMenu(); return; }
    if (down && (c === 'KeyH' || c === 'KeyI')) { if (game.state === 'play' || game.state === 'ready') paused = true; help = 0; return; }
    if (keys[c]) { ev.preventDefault(); if (!paused || !down) setFlip(keys[c], c, down); return; }
    if (c === 'Space' || c === 'Enter' || c === 'ArrowDown') {
      ev.preventDefault();
      if (down) { if (paused) paused = false; else if (!startGame() && canPlunge() && !plungeBy) beginPlunge(c); }
      else endPlunge(c);
      return;
    }
    if (!down) return;
    if (c === 'ArrowUp') { ev.preventDefault(); game.nudge(0, -1); }
    else if (c === 'ArrowLeft') { ev.preventDefault(); game.nudge(-1, -0.4); }
    else if (c === 'ArrowRight') { ev.preventDefault(); game.nudge(1, -0.4); }
    else if (c === 'KeyP' || c === 'Escape') paused = !paused && game.state !== 'attract';
    else if (c === 'KeyM') sound.toggle();
    else if (c === 'KeyD') debug = !debug;
  };
  window.addEventListener('keydown', e => onKey(e, true), on);
  window.addEventListener('keyup', e => onKey(e, false), on);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (game.state === 'play') paused = true;
    releaseAll(); for (const side of ['left', 'right']) { held[side].clear(); game.flip(side, false); }
    for (const c of Object.keys(keys)) for (const side of ['left', 'right']) held[side].delete(c);
  }, on);

  // ---------- events from the game ----------
  function handle(e) {
    switch (e.type) {
      case 'flip': sound.play(cfg.flipSound ?? 'flipper'); break;
      case 'bumper': case 'sling': case 'lane': case 'launch': case 'knock': case 'drop': case 'spin': case 'saucer':
      case 'eject': case 'kickback': case 'rampEnter': case 'ramp': case 'bankReset': case 'bonusX':
        sound.play(e.type, e); break;
      case 'hit': sound.play('target'); break;
      case 'sound': sound.play(e.name); break;
      case 'start': sound.play('start'); sound.startMusic(); break;
      case 'serve': dmd.show([`PLAYER ${e.player}`, `BALL ${e.ball}`], { secs: 1.5 }); break;
      case 'saved': sound.play('saved'); dmd.show('BALL SAVED', { blink: true, secs: 1.6 }); break;
      case 'drain': sound.play('drain'); if (!e.tilted) dmd.show('BALL LOST', { secs: 1.2 }); break;
      case 'bonus': sound.play('bonus'); dmd.show([`BONUS ${commas(e.bonus)} X${e.x}`, commas(e.total)], { secs: 2.2 }); break;
      case 'shootAgain': sound.play('extraBall'); dmd.show('SHOOT AGAIN', { blink: true, secs: 2 }); break;
      case 'locked': sound.play('locked'); break;
      case 'multiball': sound.play('multiball'); break;
      case 'addBall': sound.play('locked'); dmd.show('ADD A BALL', { blink: true, secs: 1.5 }); break;
      case 'jackpot': sound.play('jackpot'); break;
      case 'extraBall': sound.play('extraBall'); break;
      case 'modeStart': sound.play('modeStart'); dmd.show([e.name, `${e.secs} SECONDS`], { secs: 2 }); break;
      case 'modeEnd': sound.play('modeEnd'); dmd.show([e.name, 'OVER'], { secs: 1.5 }); break;
      case 'nudge': sound.play('nudge'); shakeUntil = game.world.time + 0.12; shakeDx = e.dx ? -Math.sign(e.dx) * 2 : 0; break;
      case 'danger': sound.play('danger'); dmd.show('DANGER', { blink: true, secs: 1.5 }); break;
      case 'tilt': sound.play('tilt'); dmd.clearQueue(); dmd.show('TILT', { blink: true, secs: 3 }); break;
      case 'message': {
        const scene = e.scene && cfg.scenes?.[e.scene];
        sound.play(e.sound ?? 'award');
        if (e.now) dmd.clearQueue();   // replaces whatever is showing (a choice being made)
        dmd.show(e.sub ? [e.text, e.sub] : e.text, scene ? { secs: scene.secs ?? 3, scene: scene.draw ?? scene } : { secs: 2, blink: /JACKPOT|MULTIBALL/.test(e.text) });
        break;
      }
      case 'over':
        sound.play('over'); sound.stopMusic(); overAt = game.world.time; dmd.clearQueue();
        lastScore = Math.max(...e.scores); save('lastScore', lastScore);
        dmd.show('GAME OVER', { secs: 2 });
        if (e.scores.length === 1) dmd.show(['FINAL SCORE', commas(lastScore)], { secs: 3 });
        else for (let i = 0; i < e.scores.length; i += 2) dmd.show(e.scores.slice(i, i + 2).map((s, k) => `P${i + k + 1}  ${commas(s)}`), { secs: 2.5 });
        entries = game.players.map(p => ({ n: p.n, score: p.score }));
        nextEntry();
        if (!entry) showScores = { until: now + 5, place: -1 };
        break;
      case 'lost': console.warn('ball escaped the table', e); break;
    }
  }

  // ---------- tuning panel (?tune) ----------
  if (params.has('tune')) tuningPanel(game);

  // ---------- loop ----------
  let last = performance.now(), now = 0, stopped = false;
  function frame(ms) {
    if (stopped) return;
    const dt = Math.min(0.05, (ms - last) / 1000); last = ms; now += dt;
    if (plungeBy !== null) game.pull(Math.max(plungeDrag, Math.min(1, (performance.now() - plungeStart) / 1000)));
    sound.pauseMusic(paused);
    if (!paused) game.update(dt);
    for (const e of game.events) handle(e);
    game.events.length = 0;

    // camera: keep the lowest ball in the lower part of the view, looking ahead a little
    const viewH = H - DMD_ROWS, maxCam = cfg.size[1] - viewH;
    const live = game.world.balls.filter(b => game.inPlay(b));
    const focus = live.length ? live.reduce((a, b) => (b.y > a.y ? b : a)) : null;
    let target = focus ? focus.y - viewH * 0.6 + Math.max(-50, Math.min(50, focus.vy * 0.08)) : maxCam;
    if (game.lookAt != null) target = game.lookAt - viewH * 0.6;   // the table wants to show something (a shootout)
    if (game.state === 'attract') target = maxCam * (0.5 + 0.5 * Math.sin(now * 0.25));
    target = Math.max(0, Math.min(maxCam, target));
    camY += (target - camY) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - camY) < 0.3) camY = target;

    // draw
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const shake = game.world.time < shakeUntil ? 1 : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, DMD_ROWS, W, viewH); ctx.clip();
    ctx.translate(shake * shakeDx, DMD_ROWS - Math.round(camY) - shake * 2);
    ctx.drawImage(playfield, 0, 0);
    drawDynamic(ctx, game, sprites, game.world.time);
    if (debug) drawDebug(ctx, game);
    ctx.restore();
    dmd.frame(now, () => ({
      attract: game.state === 'attract' || (game.state === 'over' && !dmd.busy()),
      title: cfg.name.toUpperCase(), touch: isTouch(), lastScore, champion: scores[0],
      entry: entry && { player: entry.player, players: entry.players, name: entry.name.map(i => LETTERS[i]).join(''), slot: entry.slot },
      player: game.player?.n ?? 1, ball: game.player?.ball ?? 1, score: game.player?.score ?? 0,
      mode: Object.values(game.modes).map(m => `${Math.ceil(m.left)}`)[0],
      status: game.state === 'play' || game.state === 'ready' ? cfg.status?.(game) : null,
      video: game.video && game.state !== 'over' ? api => game.video.draw(api, game.world.time) : null,
    }));
    dmd.paint(ctx, 0, 0);
    const view = { W, top: DMD_ROWS, h: viewH, touch: isTouch(), t: now };
    if (help >= 0) drawHelp(ctx, pages(), help, sprites.art, view);
    else if (entry) drawEntry(ctx, entry, view);
    else {
      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, DMD_ROWS, W, viewH);
        drawPaused(ctx, H);
      }
      if (between() && !paused) {
        // the high score table: after a game, then for 5 seconds in every 15 while the table waits
        if (now < showScores.until || now % 15 > 10) drawScores(ctx, scores, { ...view, highlight: now < showScores.until ? showScores.place : -1 });
        drawPlayerButtons(ctx, W, H, now, isTouch());
        if (toMenu) drawMenuButton(ctx, DMD_ROWS);
      }
      if (helpOffered()) drawHelpButton(ctx, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(t => { last = t; frame(t); });
  const stop = () => { stopped = true; life.abort(); sound.stopMusic(); };
  window.pinball = { game, dmd, sound, stop, scores: () => scores };   // handy in the browser console
  return window.pinball;
}

function drawPaused(ctx, H) {
  drawText(ctx, 'PAUSED', W / 2, H / 2 - 20, '#fff', { scale: 3, align: 'center' });
  drawText(ctx, 'TAP OR PRESS P TO PLAY', W / 2, H / 2 + 10, '#ccc', { align: 'center' });
  drawText(ctx, 'RULES: H OR THE ? BUTTON', W / 2, H / 2 + 24, '#ccc', { align: 'center' });
}

function load(k, d) { try { const v = localStorage.getItem('pinball.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }
function save(k, v) { try { localStorage.setItem('pinball.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } }

// Sliders for the main feel settings, so a player can tune the table and report the numbers.
function tuningPanel(game) {
  const w = game.world, fl = game.flippers, pl = game.plunger;
  const bumpers = w.shapes.filter(s => s.tag === 'bumper'), slings = w.shapes.filter(s => s.tag === 'sling');
  const walls = w.shapes.filter(s => s.tag === 'wall');
  const knobs = [
    ['Gravity', 300, 1800, 10, () => w.gravity, v => (w.gravity = v)],
    ['Flipper up speed', 10, 60, 1, () => fl[0].upSpeed, v => fl.forEach(f => (f.upSpeed = v))],
    ['Flipper down speed', 5, 40, 1, () => fl[0].downSpeed, v => fl.forEach(f => (f.downSpeed = v))],
    ['Flipper bounce', 0, 0.9, 0.05, () => fl[0].shapes[0].bounce, v => fl.forEach(f => (f.shapes[0].bounce = v))],
    ['Wall bounce', 0, 0.9, 0.05, () => walls[0]?.bounce ?? 0.35, v => walls.forEach(s => (s.bounce = v))],
    ['Bumper kick', 100, 900, 10, () => bumpers[0]?.kick ?? 0, v => bumpers.forEach(s => (s.kick = v))],
    ['Sling kick', 100, 900, 10, () => slings[0]?.kick ?? 0, v => slings.forEach(s => (s.kick = v))],
    ['Plunger max', 600, 2000, 10, () => pl.maxSpeed, v => (pl.maxSpeed = v)],
  ];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;top:8px;background:rgba(10,12,20,.88);color:#dde;font:12px system-ui;padding:8px;border-radius:6px;z-index:9;max-width:230px';
  box.addEventListener('pointerdown', e => e.stopPropagation());
  const out = document.createElement('pre'); out.style.cssText = 'white-space:pre-wrap;margin:6px 0 0;font-size:11px;user-select:text';
  const sync = () => (out.textContent = knobs.map(([n, , , , get]) => `${n}: ${+get().toFixed(2)}`).join('\n'));
  for (const [name, min, max, step, get, set] of knobs) {
    const row = document.createElement('label'); row.style.cssText = 'display:block;margin:2px 0';
    row.textContent = name;
    const inp = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: get() });
    inp.style.cssText = 'width:100%';
    inp.oninput = () => { set(+inp.value); sync(); };
    row.appendChild(inp); box.appendChild(row);
  }
  box.appendChild(out); sync();
  document.body.appendChild(box);
}
