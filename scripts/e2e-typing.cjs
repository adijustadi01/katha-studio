// Types a short scene with the keyboard to verify smart flow, SmartType and phonetic typing.
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'shots';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.goto(process.env.APP_URL || 'http://localhost:4173/katha-studio/');
  await page.waitForTimeout(800);
  await page.click('text=Indian Standard (A4)');
  await page.waitForTimeout(600);
  const k = page.keyboard;
  await k.type('int. ');           // SmartType offers INT. — we type it
  await k.type('temple pond - dawn');
  await k.press('Enter');          // → Action
  await k.type('Water ripples. MEERA (20s) lights a lamp.');
  await k.press('Enter');          // → Action
  await k.press('Tab');            // empty action → Character
  await k.type('meera');
  await k.press('Enter');          // → Dialogue
  await k.type('Amma, are you there?');
  await k.press('Tab');            // dialogue → Parenthetical
  await k.type('beat');
  await k.press('Enter');          // → Dialogue
  await k.press('Control+Space');  // phonetic Tamil on
  await k.type('vanakkam amma ');
  await k.press('Control+Space');  // off
  await k.press('Enter');          // → Action
  await k.press('Tab');            // → Character
  await k.type('me');              // SmartType suggests MEERA
  await page.waitForTimeout(200);
  const sugg = await page.$eval('.smarttype', (e) => e.style.display !== 'none' && e.textContent);
  await k.press('Enter');          // accept suggestion
  await k.press('Enter');          // → Dialogue
  await k.type('Again.');
  await k.press('Enter');
  await k.press('Tab');
  await k.press('Tab');            // empty character → Transition
  await k.type('cut to:');
  await page.waitForTimeout(800);
  const els = await page.evaluate(() => window.__katha.elements().map((e) => [e.type, e.text]));
  console.log(JSON.stringify(els, null, 0));
  console.log('smarttype suggestion shown:', sugg);
  await page.screenshot({ path: OUT + '/03-typing.png' });
  console.log('errors', errors);
  await browser.close();
})();
