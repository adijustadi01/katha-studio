// Performance: a generated 200+ page script with Tamil/Telugu dialogue; measures typing latency and re-pagination time.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.goto(process.env.APP_URL || 'http://localhost:4173/katha-studio/');
  await page.waitForTimeout(800);
  await page.click('text=Open sample screenplay');
  await page.waitForTimeout(1000);
  const loadMs = await page.evaluate(async () => {
    const s = window.__katha;
    const base = s.project.elements;
    const els = [];
    for (let r = 0; r < 37; r++) for (const e of base) els.push({ ...e, id: e.id + '_' + r });
    const p = { ...s.project, elements: els, id: 'perf' };
    const t0 = performance.now();
    s.loadProject(p, null, 'perf.katha');
    await new Promise((r) => setTimeout(r, 50));
    return performance.now() - t0;
  });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({ pages: window.__katha.layout.pages.length, layoutMs: window.__katha.lastLayoutMs, elements: window.__katha.elements().length }));
  // click into the middle of the script and type
  await page.evaluate(() => { const v = window.__view; let target = 0, i = 0; v.state.doc.forEach((n, p) => { if (i++ === 1200) target = p + 1; }); v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(target)))); v.focus(); });
  const lat = [];
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); const v = window.__view; v.dispatch(v.state.tr.insertText('x')); requestAnimationFrame(() => res(performance.now() - t0)); }));
    lat.push(t);
  }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__katha.lastLayoutMs);
  lat.sort((a, b) => a - b);
  console.log(JSON.stringify({ ...info, loadMs: Math.round(loadMs), keystrokeMedianMs: lat[20].toFixed(1), keystrokeP95Ms: lat[37].toFixed(1), relayoutMs: Math.round(after) }));
  await browser.close();
})();
