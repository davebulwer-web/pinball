// Builds self-contained pages (code and art inlined) that run offline:
//   dist/index.html              the table menu, with every table in it (pick one to play)
//   dist/pinball-artifact.html   the same menu, for publishing as a claude.ai artifact
//   dist/<table>.html            one page per table (its "< TABLES" button goes to index.html)
//   dist/<table>-artifact.html   one table, for publishing as a claude.ai artifact
// Needs esbuild: `npm install`. Table pictures for the menu come from previews.cjs (run it after a build,
// then build again).
// This is the build to publish: no developer tools. `node build.mjs --dev` (npm run build:dev) also builds the
// workshop tables (Parts Test, Feel Test) into the menu and turns on the collision view (D key or ?debug), the
// tuning sliders (?tune) and window.pinball for the browser console.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { tables as allTables } from './tables/index.js';

const DEV = process.argv.includes('--dev');
const tables = allTables.filter(t => DEV || !t.workshop);

// The Fruit Machine Arcade, when the two projects sit side by side (both checked out in one folder, or
// both on GitHub Pages under one account). The menu links to it and the arcade links back here.
const ARCADE_LINK = '../../fruitmachines/dist/index.html';

const bundle = async entry => (await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', define: { __DEV__: String(DEV) } })).outputFiles[0].text;
const uri = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const fill = (tpl, { title, art = '', js }) => readFileSync(tpl, 'utf8')
  .replace('<!--TITLE-->', title)
  .replace('<!--ART-->', () => (art ? `<script>${art}</script>` : ''))
  .replace('<!--SCRIPT-->', () => `<script>${js}</script>`);
// a claude.ai artifact is the page without its html/head/body wrapper
const artifact = (page, title) => page
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '')
  .replace('</head>', '').replace('<body>', '').replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(':root { --bg: #000; --fg: #8a8f9a; }', ':root { --bg: #000; --fg: #8a8f9a; color-scheme: dark; }');

mkdirSync('dist', { recursive: true });
const arts = {}, previews = {};
for (const cfg of tables) {
  const { id } = cfg;
  const artFile = `./tables/${id}/art.js`;
  arts[id] = existsSync(artFile) ? Object.fromEntries(Object.entries((await import(artFile)).default).map(([k, f]) => [k, uri(f)])) : {};
  if (existsSync(`tables/${id}/preview.png`)) previews[id] = uri(`tables/${id}/preview.png`);
  const art = Object.keys(arts[id]).length ? `window.TABLE_ART=${JSON.stringify(arts[id])}` : '';
  const js = await bundle(`tables/${id}/main.js`);
  writeFileSync(`dist/${id}.html`, fill('ui/index.html', { title: `${cfg.name} · Pixel Pinball`, art: `window.PINBALL_MENU='index.html';${art}`, js }));
  writeFileSync(`dist/${id}-artifact.html`, artifact(fill('ui/index.html', { title: '', art, js }), `Pinball ${cfg.name}`));
  console.log(`built dist/${id}.html and dist/${id}-artifact.html`);
}

// the menu: every table in one page
const menu = { title: 'Pixel Pinball', js: await bundle('ui/lobby.js') };
const data = `window.TABLE_ARTS=${JSON.stringify(arts)};window.TABLE_PREVIEWS=${JSON.stringify(previews)}`;
writeFileSync('dist/pinball-artifact.html', fill('ui/lobby.html', { ...menu, art: data }));
writeFileSync('dist/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${
  fill('ui/lobby.html', { ...menu, art: `window.ARCADE_LINK=${JSON.stringify(ARCADE_LINK)};${data}` })}`
  .replace('</style>', '</style></head><body>') + '</body></html>');
console.log(`built dist/index.html and dist/pinball-artifact.html${DEV ? ' (with developer tools)' : ''}`);
