// Headless smoke test: loads the built app, opens the sample, captures screenshots and console errors.
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'shots';
const URL = process.env.APP_URL || 'http://localhost:4173/katha-studio/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true, ...(JSON.parse(localStorage.getItem('katha.prefs') || '{}')) })));
  await page.goto(URL);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/01-welcome.png' });
  await page.click('text=Open sample screenplay');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/02-sample-page-view.png' });
  const info = await page.evaluate(() => ({ pages: window.__katha.layout?.pages.length, ms: window.__katha.lastLayoutMs }));
  console.log('layout', JSON.stringify(info));
  fs = require('fs');
  fs.writeFileSync(OUT + '/errors.txt', errors.join('\n'));
  console.log('errors:', errors.length, errors.slice(0, 10).join('\n'));
  await browser.close();
})();
