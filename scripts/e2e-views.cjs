// Screenshots every main view of the sample project and collects console errors.
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'shots';
const VIEWS = (process.env.VIEWS || 'cards,beats,outline,tracks,pulse,punches,reports,stripboard').split(',');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true, theme: localStorage.getItem('theme') || 'light' })));
  await page.goto(process.env.APP_URL || 'http://localhost:4173/katha-studio/');
  await page.waitForTimeout(800);
  await page.click('text=Open sample screenplay');
  await page.waitForTimeout(1500);
  for (const v of VIEWS) {
    await page.evaluate((v) => window.__runCommand('view.main.' + v), v);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/view-${v}.png` });
  }
  if (process.env.EXTRA) await eval(process.env.EXTRA);
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
