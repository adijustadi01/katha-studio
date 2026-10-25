// Desktop menu test: drives the real Electron menu bar with OS-level input and checks that
// one click opens a menu that stays open, the opening click never runs a command, hovering
// switches menus, Esc and click-outside close, and Down+Enter deliberately runs an item.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { input, glide } = require('./input.cjs');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'katha-menu-test');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'katha-ud-'));
  const exe = require('electron');
  const extra = process.env.SCALE ? [`--force-device-scale-factor=${process.env.SCALE}`] : [];
  const app = await _electron.launch({ executablePath: exe, args: ['.', `--user-data-dir=${ud}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...extra], env: { ...process.env, HOME: ud } });
  const page = await app.firstWindow();
  await page.evaluate(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.reload();
  await sleep(1500);
  await page.click('text=Open sample screenplay');
  await sleep(1500);
  // place the cursor somewhere known so we can check it survives the menu
  await page.evaluate(() => {
    const v = window.__view;
    let pos = 0;
    v.state.doc.forEach((n, p) => n.textContent.startsWith('Mist rolls') && (pos = p + 5));
    v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(pos))));
    v.focus();
  });
  const selBefore = await page.evaluate(() => window.__view.state.selection.from);
  await app.evaluate(({ BrowserWindow, Menu }) => {
    global.mlog = [];
    const w = BrowserWindow.getAllWindows()[0];
    const send = w.webContents.send.bind(w.webContents);
    w.webContents.send = (ch, ...a) => {
      if (ch === 'menu') global.mlog.push('CMD ' + a[0]);
      return send(ch, ...a);
    };
    const hook = () =>
      Menu.getApplicationMenu().items.forEach((it) => {
        if (!it.submenu || it.submenu.__hooked) return;
        it.submenu.__hooked = true;
        it.submenu.on('menu-will-show', () => global.mlog.push('show ' + it.label));
        it.submenu.on('menu-will-close', () => global.mlog.push('close ' + it.label));
      });
    hook();
    const orig = Menu.setApplicationMenu;
    Menu.setApplicationMenu = (m) => {
      global.mlog.push('REBUILD');
      orig.call(Menu, m);
      hook();
    };
  });
  const info = await app.evaluate(({ BrowserWindow, screen, Menu }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.focus();
    return { win: w.getBounds(), content: w.getContentBounds(), sf: screen.getPrimaryDisplay().scaleFactor, labels: Menu.getApplicationMenu().items.map((i) => i.label) };
  });
  const sf = info.sf;
  const px = (v) => Math.round(v * sf);
  const barY = px((info.win.y + info.content.y) / 2 + 0.5);
  const take = async () => (await app.evaluate(() => global.mlog.splice(0)));
  // locate each title by probing the menu bar with real clicks (font metrics differ per OS)
  const hits = {};
  for (let dx = 4; dx < 520; dx += 8) {
    const xx = px(info.win.x + dx);
    input([['click', xx, barY]]);
    await sleep(250);
    const l = await take();
    const shown = l.filter((e) => e.startsWith('show ')).pop();
    if (shown) (hits[shown.slice(5)] ||= []).push(xx);
    input([['key', 'Escape']]);
    await sleep(150);
    await take();
    if (Object.keys(hits).length === info.labels.length && !shown) break;
  }
  await page.evaluate(() => window.__katha.closeDialog());
  const titles = info.labels.filter((l) => hits[l]).map((l) => ({ label: l, x: Math.round((Math.min(...hits[l]) + Math.max(...hits[l])) / 2) }));
  console.log('titles', JSON.stringify(titles));
  const dialog = () => page.evaluate(() => window.__katha.dialog && window.__katha.dialog.kind);
  const shot = (name) => {
    try {
      if (process.platform === 'linux') require('child_process').execFileSync('import', ['-window', 'root', path.join(OUT, name + '.png')]);
    } catch {}
  };
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail ? JSON.stringify(detail) : ''}`);
  };
  await take();

  await page.evaluate((pos) => {
    const v = window.__view;
    v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(pos))));
    v.focus();
  }, selBefore);
  await take();
  // 1. one click opens each menu; it stays open 2 s; nothing is triggered
  for (const t of titles) {
    input([['click', t.x, barY]]);
    await sleep(2000);
    const log = await take();
    const d = await dialog();
    shot('open-' + t.label);
    check(`click opens ${t.label} and it stays open for 2s`, log.includes('show ' + t.label) && !log.includes('close ' + t.label), log);
    check(`opening click of ${t.label} triggers nothing`, !log.some((l) => l.startsWith('CMD')) && !d, { log, dialog: d });
    input([['key', 'Escape']]);
    await sleep(400);
    const l2 = await take();
    check(`Esc closes ${t.label}`, l2.includes('close ' + t.label) || !l2.length, l2);
    if (d) await page.evaluate(() => window.__katha.closeDialog());
  }

  // 2. hover switching
  input([['click', titles[0].x, barY]]);
  await sleep(600);
  glide(titles[0].x, barY, titles[1].x, barY);
  await sleep(800);
  glide(titles[1].x, barY, titles[2].x, barY);
  await sleep(800);
  let log = await take();
  check('hovering switches between open menus', log.includes('show ' + titles[1].label) && log.includes('show ' + titles[2].label), log);

  // 3. clicking outside closes, without running anything
  input([['click', px(info.content.x + info.content.width / 2), px(info.content.y + info.content.height - 8)]]);
  await sleep(600);
  log = await take();
  check('click outside closes the menu without running a command', log.some((l) => l.startsWith('close')) && !log.some((l) => l.startsWith('CMD')), log);

  // 4. a deliberate keyboard selection works: open Help, Down, Enter → first Help item
  input([['click', titles[titles.length - 1].x, barY]]);
  await sleep(800);
  input([['key', 'Down'], ['key', 'Return']]);
  await sleep(800);
  log = await take();
  check('Down + Enter runs the highlighted item', log.some((l) => l.startsWith('CMD help.')), log);
  await page.evaluate(() => window.__katha.closeDialog());

  // 5. the script cursor survived all of this
  const selAfter = await page.evaluate(() => window.__view.state.selection.from);
  check('cursor position in the script is unchanged', selAfter === selBefore, { selBefore, selAfter });

  fs.writeFileSync(path.join(OUT, 'desktop-menu-results.json'), JSON.stringify({ platform: process.platform, info, results }, null, 1));
  await Promise.race([app.close(), sleep(5000)]);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
