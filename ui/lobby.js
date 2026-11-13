// The table menu (dist/index.html): a cabinet for each table with its picture and best score, and the
// table you pick, started full screen on the same page. Every table and its art is inlined, so the one
// page works offline. Tables come from tables/index.js; pictures from previews.cjs (tables/<id>/preview.png).
// A link to the table, such as index.html#funfair, opens it straight away.

import { tables } from '../tables/index.js';
import { startTable } from './shell.js';
import { loadArt } from './art.js';
import { bestScore } from './scores.js';
import { commas } from './font.js';

const arts = window.TABLE_ARTS || {}, previews = window.TABLE_PREVIEWS || {};
const lobby = document.getElementById('lobby'), stage = document.getElementById('stage');
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
let current = null;

function showLobby() {
  current?.stop(); current = null;
  document.body.classList.remove('playing');
  stage.hidden = true; lobby.hidden = false;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  fillScores();
}

async function play(id) {
  const cfg = tables.find(t => t.id === id);
  if (!cfg) return showLobby();
  current?.stop();
  lobby.hidden = true; stage.hidden = false;
  document.body.classList.add('playing');
  const old = document.getElementById('screen'), canvas = old.cloneNode(false);   // a fresh canvas each time
  canvas.setAttribute('aria-label', `${cfg.name} pinball table. Space to start or launch, 1 to 4 for players, Z and slash for the flippers, H for the rules, Escape between games for the menu.`);
  old.replaceWith(canvas);
  const art = await loadArt(arts[id] || {});
  current = startTable(cfg, { canvas, art, onMenu: showLobby });
  canvas.focus();
  history.replaceState(null, '', '#' + id);
}

const list = document.getElementById('tables'), workshop = document.getElementById('workshop');
const scoreLines = {};
for (const cfg of tables) {
  if (cfg.workshop) {
    const b = el('button', null, cfg.name);
    b.title = cfg.tagline ?? '';
    b.addEventListener('click', () => play(cfg.id));
    workshop.lastElementChild.append(b);
    workshop.hidden = false;
    continue;
  }
  const li = el('li'), b = el('button', 'cabinet');
  b.style.setProperty('--accent', cfg.colours?.ramp ?? '#ff3fae');
  b.setAttribute('aria-label', `Play ${cfg.name}`);
  const screen = el('div', 'screen');
  if (previews[cfg.id]) { const img = el('img'); img.src = previews[cfg.id]; img.alt = `${cfg.name} table`; img.width = 320; img.height = 560; screen.append(img); }
  else screen.append(el('div', 'blank'));
  const plinth = el('div', 'plinth');
  scoreLines[cfg.id] = el('span', 'meta');
  plinth.append(el('span', 'tag', cfg.tagline ?? ''), scoreLines[cfg.id], el('span', 'play', 'PLAY'));
  b.append(el('span', 'marquee', cfg.name.toUpperCase()), screen, plinth);
  b.addEventListener('click', () => play(cfg.id));
  li.append(b);
  list.append(li);
}
function fillScores() {
  for (const cfg of tables) {
    const line = scoreLines[cfg.id]; if (!line) continue;
    const [name, score] = bestScore(cfg);
    line.replaceChildren('High score ', el('b', null, `${name} ${commas(score)}`));
  }
}

// the way back to the Fruit Machine Arcade, when this page is built next to it (build.mjs sets the address)
if (window.ARCADE_LINK) { const a = document.getElementById('arcade'); a.href = window.ARCADE_LINK; a.hidden = false; }

window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== current?.game?.cfg.id) play(id); else if (!id && current) showLobby(); });
const start = location.hash.slice(1);
start ? play(start) : showLobby();
