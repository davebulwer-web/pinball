// Captures a picture of each table in play (its screen at 320 x 560) for the table menu.
// Run after a build, then build again so the menu includes them:
//   node build.mjs && node previews.cjs && node build.mjs
// Needs Playwright with Chromium. Pictures go to tables/<id>/preview.png (workshop tables are skipped).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const { tables } = await import('./tables/index.js');
  const browser = await chromium.launch();
  for (const t of tables.filter(t => !t.workshop)) {
    const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
    await page.goto('file://' + path.join(__dirname, 'dist', `${t.id}.html`));
    await page.waitForTimeout(600);
    // start a game and launch, so the picture shows a ball in play and a score
    await page.keyboard.press('Space');
    await page.waitForTimeout(1800);
    await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
    await page.waitForTimeout(1100);
    const data = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png'));
    fs.writeFileSync(path.join(__dirname, 'tables', t.id, 'preview.png'), Buffer.from(data.split(',')[1], 'base64'));
    console.log('preview', t.id);
    await page.close();
  }
  await browser.close();
})();
