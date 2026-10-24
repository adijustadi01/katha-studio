// Captures illustrations for the built-in user manual from the running app (dev-time helper).
const { chromium } = require('playwright');
const OUT = 'public/help';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.goto(process.env.APP_URL || 'http://localhost:4173/katha-studio/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/welcome.png', type: 'png' });
  await page.click('text=Open sample screenplay');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/editor.png' });
  // bilingual: scroll to Surya's punch dialogue
  await page.evaluate(() => { const v = window.__view; v.state.doc.forEach((n, p) => { if (n.textContent.startsWith('கடல் யாருக்கும்')) v.nodeDOM(p).scrollIntoView({ block: 'center' }); }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/bilingual.png', clip: { x: 290, y: 150, width: 890, height: 520 } });
  // phonetic typing dropdown in a fresh scene at the top of the screen
  await page.evaluate(() => { const v = window.__view; let pos = 0; v.state.doc.forEach((n, p) => { if (n.textContent.startsWith('Mist rolls')) pos = p + n.nodeSize - 1; }); v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(pos)))); v.nodeDOM(pos - 5)?.scrollIntoView?.({ block: 'start' }); });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('AMMA');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await page.click('text=தமிழ்');
  await page.keyboard.type('vanakkam thambi, sapti');
  await page.waitForTimeout(300);
  const box = await page.$eval('.phonetic-box', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; });
  await page.screenshot({ path: OUT + '/phonetic.png', clip: { x: Math.max(0, box.x - 360), y: Math.max(0, box.y - 140), width: 760, height: box.h + 180 } });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.evaluate(() => window.__runCommand('view.main.cards'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/cards.png' });
  await page.evaluate(() => window.__runCommand('view.main.pulse'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/pulse.png' });
  await page.evaluate(() => window.__runCommand('view.main.script'));
  await page.evaluate(() => window.__runCommand('file.exportPdf'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/pdf.png' });
  await browser.close();
})();
