// Builds self-contained pages (code and art inlined) that run offline:
//   dist/<table>.html    one page per table
//   dist/index.html      a menu of the tables
// Needs esbuild: `npm install`.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { tableIds } from './tables/index.js';

const bundle = async entry => (await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' })).outputFiles[0].text;
const uri = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const fill = (tpl, { title, art = '', js }) => readFileSync(tpl, 'utf8')
  .replace('<!--TITLE-->', title)
  .replace('<!--ART-->', () => (art ? `<script>${art}</script>` : ''))
  .replace('<!--SCRIPT-->', () => `<script>${js}</script>`);

mkdirSync('dist', { recursive: true });
const names = {};
for (const id of tableIds) {
  const config = (await import(`./tables/${id}/config.js`)).default;
  names[id] = config.name;
  const artFile = `./tables/${id}/art.js`;
  const art = existsSync(artFile) ? `window.TABLE_ART=${JSON.stringify(Object.fromEntries(Object.entries((await import(artFile)).default).map(([k, f]) => [k, uri(f)])))}` : '';
  writeFileSync(`dist/${id}.html`, fill('ui/index.html', { title: `${config.name} · Pixel Pinball`, art, js: await bundle(`tables/${id}/main.js`) }));
  console.log(`built dist/${id}.html`);
}
const links = tableIds.map(id => `<li><a href="${id}.html">${names[id]}</a></li>`).join('');
writeFileSync('dist/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pixel Pinball</title>
<style>body{margin:0;min-height:100vh;background:#0b0d16;color:#e8e2d0;font:16px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center}h1{letter-spacing:.1em}a{color:#ffb040;font-size:20px}li{list-style:none;margin:8px 0}</style>
</head><body><h1>PIXEL PINBALL</h1><ul>${links}</ul></body></html>`);
console.log('built dist/index.html');
