// Renders the sample screenplay's print layout to PDF with Chromium (same path as Electron printToPDF),
// then rasterises pages with pdftoppm for visual inspection of formatting and Indic shaping.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || 'shots';
const URL = process.env.APP_URL || 'http://localhost:4173/katha-studio/';
const opts = JSON.parse(process.env.PDF_OPTS || '{"titlePage":true,"layers":{"roman":true,"meaning":true},"watermark":"CONFIDENTIAL – Sent to Producer – 24/10/2026","revisionColors":true,"revisionMarks":true}');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.goto(URL);
  await page.waitForTimeout(800);
  if (process.env.SETUP) await page.evaluate(process.env.SETUP);
  else await page.click('text=Open sample screenplay');
  await page.waitForTimeout(1500);
  const { html } = await page.evaluate((o) => window.__exporter.buildPrintHTML(o), opts);
  fs.writeFileSync(OUT + '/print.html', html);
  const pdfPage = await browser.newPage();
  await pdfPage.goto(URL);
  await pdfPage.setContent(html, { waitUntil: 'networkidle' });
  await pdfPage.evaluate(() => document.fonts.ready);
  await pdfPage.pdf({ path: OUT + '/script.pdf', preferCSSPageSize: true, printBackground: true });
  execSync(`pdftoppm -r 70 -png ${OUT}/script.pdf ${OUT}/pdfpage`);
  console.log(fs.readdirSync(OUT).filter((f) => f.startsWith('pdfpage')).join(' '));
  await browser.close();
})();
