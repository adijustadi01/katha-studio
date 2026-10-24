// Drives the real Electron app: sample → save .katha via IPC → backups → Chromium printToPDF.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || 'shots';
(async () => {
  const userData = fs.mkdtempSync('/tmp/katha-ud-');
  const app = await _electron.launch({
    executablePath: require('path').resolve('node_modules/electron/dist/electron'),
    args: ['.', '--no-sandbox', `--user-data-dir=${userData}`],
    env: { ...process.env, HOME: userData },
  });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(e.message));
  await win.evaluate(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await win.reload();
  await win.waitForTimeout(1500);
  await win.click('text=Open sample screenplay');
  await win.waitForTimeout(2000);
  await win.screenshot({ path: OUT + '/electron-main.png' });
  const file = path.join(userData, 'Theeram.katha');
  const res = await win.evaluate(async (file) => {
    const s = window.__katha;
    const data = await s.packCurrent();
    const ok = await window.kathaDesktop.writeFile(file, data);
    s.target = { name: 'Theeram.katha', path: file };
    await s.save();
    const backups = await window.kathaDesktop.listBackups(s.project.id);
    const { html } = window.__exporter.buildPrintHTML({ titlePage: true, layers: { roman: true, meaning: true }, watermark: '', revisionColors: false, revisionMarks: false });
    const pdf = await window.kathaDesktop.printToPDF(html, { pageWidthIn: 8.27, pageHeightIn: 11.69 });
    const rec = await window.kathaDesktop.listRecovery();
    return { ok, backups: backups.length, pdfBytes: pdf.length, pdf: Array.from(pdf), recovery: rec.length, title: document.title, version: window.kathaDesktop.version };
  }, file);
  fs.writeFileSync(OUT + '/electron.pdf', Buffer.from(res.pdf));
  delete res.pdf;
  res.fileSize = fs.statSync(file).size;
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map((i) => i.label));
  console.log(JSON.stringify({ ...res, menu, errors }));
  await app.close();
})();
