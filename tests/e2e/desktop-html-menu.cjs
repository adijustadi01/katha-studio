// Desktop app, default (built-in) menu bar, driven with OS-level mouse/keyboard input
// (XTEST on Linux, SendInput on Windows) inside the real Electron window.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { input, glide } = require('./input.cjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'katha-ud-'));
  const extra = process.env.SCALE ? [`--force-device-scale-factor=${process.env.SCALE}`] : [];
  const app = await _electron.launch({ executablePath: require('electron'), args: ['.', `--user-data-dir=${ud}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...extra], env: { ...process.env, HOME: ud } });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.reload();
  await sleep(1500);
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  };
  const sysMenu = await app.evaluate(({ Menu }) => !!Menu.getApplicationMenu());
  check('no system (Electron) menu bar is shown', !sysMenu, { sysMenu });
  await page.click('text=Open sample screenplay');
  await sleep(1500);
  await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0];
    // keep the whole window on screen (at 150% scaling the default size overflows a small display)
    const wa = screen.getPrimaryDisplay().workArea;
    w.unmaximize();
    w.setBounds({ x: wa.x, y: wa.y, width: Math.min(1024, wa.width), height: Math.min(720, wa.height) });
    w.focus();
  });
  await sleep(500);
  const geometry = () =>
    app.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows()[0];
      const d = screen.getPrimaryDisplay();
      return { content: w.getContentBounds(), sf: d.scaleFactor, display: d.bounds, workArea: d.workArea };
    });
  // window geometry is read fresh for every target (the window may still be settling after the resize)
  const box = async (sel) => {
    const geo = await geometry();
    const b = await page.locator(sel).first().boundingBox();
    return { x: Math.round((geo.content.x + b.x + b.width / 2) * geo.sf), y: Math.round((geo.content.y + b.y + b.height / 2) * geo.sf), geo, inner: [await page.evaluate(() => [innerWidth, innerHeight])] };
  };
  const openMenu = () => page.evaluate(() => document.querySelector('.menu.open > button')?.dataset.menu || null);
  const cmds = () => page.evaluate(() => window.__cmdLog.slice());
  const dialog = () => page.evaluate(() => (window.__katha.dialog && window.__katha.dialog.kind) || null);
  const reset = () => page.evaluate(() => (window.__cmdLog.length = 0));
  const pos = await page.evaluate(() => {
    const v = window.__view;
    let p = 0;
    v.state.doc.forEach((n, q) => n.textContent.startsWith('Mist rolls') && (p = q + 5));
    v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(p))));
    v.focus();
    return p;
  });
  const labels = await page.$$eval('.menubar .menu > button', (bs) => bs.map((b) => b.dataset.menu));
  await reset();

  for (const l of labels) {
    const t = await box(`.menu > button[data-menu="${l}"]`);
    input([['press', t.x, t.y, 90]]);
    await sleep(2000);
    check(`one click opens ${l}; still open after 2 s`, (await openMenu()) === l, { open: await openMenu() });
    check(`opening click of ${l} runs nothing`, !(await cmds()).length && !(await dialog()), { cmds: await cmds(), dialog: await dialog() });
    input([['key', 'Escape']]);
    await sleep(250);
    check(`Esc closes ${l}`, (await openMenu()) === null, {});
    await reset();
  }

  const file = await box('.menu > button[data-menu="File"]');
  const variants = [
    ['tap (8 ms press)', [['press', file.x, file.y, 8]]],
    ['slow press (400 ms)', [['press', file.x, file.y, 400]]],
    ['press, drift down onto "New…", release', [['move', file.x, file.y], ['down'], ['sleep', 120], ['move', file.x, file.y + 14], ['move', file.x, file.y + 30], ['up']]],
  ];
  for (const [name, seq] of variants) {
    input(seq);
    await sleep(1500);
    check(`${name}: File stays open`, (await openMenu()) === 'File', { open: await openMenu() });
    check(`${name}: nothing runs`, !(await cmds()).length && !(await dialog()), { cmds: await cmds(), dialog: await dialog() });
    input([['key', 'Escape']]);
    await sleep(250);
    await reset();
  }

  // the app keeps working while a menu is open (typing, autosave, toasts)
  input([['press', file.x, file.y, 90]]);
  await sleep(300);
  await page.evaluate(() => {
    window.__katha.toast('working…');
    void window.__katha.autosave();
    window.__katha.emit();
  });
  await sleep(1500);
  check('menu stays open while the app is busy', (await openMenu()) === 'File', {});
  check('…and nothing runs', !(await cmds()).length, await cmds());

  // hover switching with real pointer motion
  const edit = await box('.menu > button[data-menu="Edit"]');
  const view = await box('.menu > button[data-menu="View"]');
  glide(file.x, file.y, edit.x, edit.y);
  await sleep(300);
  check('hover switches File → Edit', (await openMenu()) === 'Edit', { open: await openMenu() });
  glide(edit.x, edit.y, view.x, view.y);
  await sleep(300);
  check('hover switches Edit → View', (await openMenu()) === 'View', { open: await openMenu() });

  // click outside closes; nothing runs
  const sb = await box('.statusbar');
  input([['press', sb.x, sb.y, 80]]);
  await sleep(300);
  check('click outside closes', (await openMenu()) === null, sb);
  if (await openMenu()) {
    input([['key', 'Escape']]);
    await page.evaluate(() => window.focus());
    await sleep(200);
  }
  check('…and nothing runs', !(await cmds()).length, await cmds());

  // submenu by hover, then a deliberate click (View → Go to View → Outline)
  const viewT = await box('.menu > button[data-menu="View"]');
  input([['press', viewT.x, viewT.y, 90]]);
  await sleep(400);
  const go = await box('.menu.open .menu-item.has-sub');
  glide(viewT.x, viewT.y + 30, viewT.x, go.y, 6);
  glide(viewT.x, go.y, go.x, go.y, 4);
  await sleep(400);
  const outl = await box('.menu.open .submenu .menu-item[data-cmd="view.main.outline"]');
  glide(go.x, go.y, outl.x, outl.y, 8);
  await sleep(600);
  check('submenu stays open while moving into it', await page.locator('.menu.open .submenu').isVisible(), {});
  input([['press', outl.x, outl.y, 80]]);
  await sleep(600);
  check('deliberate click on a submenu item runs it', (await cmds()).includes('view.main.outline'), await cmds());
  await page.evaluate(() => window.__runCommand('view.main.script'));
  await sleep(300);
  await page.evaluate((p) => {
    const v = window.__view;
    v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(p))));
    v.focus();
  }, pos);
  await reset();

  // keyboard: F10 / Alt, arrows, Enter, Esc
  input([['key', 'F10']]);
  await sleep(200);
  check('F10 focuses the menu bar', (await page.evaluate(() => document.querySelector('.menu > button.kb-focus')?.dataset.menu)) === 'File', {});
  input([['key', 'Right'], ['key', 'Right'], ['key', 'Down'], ['key', 'Down'], ['key', 'Return']]);
  await sleep(400);
  check('arrows + Enter run View → Draft View', (await cmds())[0] === 'view.draft', await cmds());
  await page.evaluate(() => window.__runCommand('view.page'));
  await reset();
  input([['key', 'Alt']]);
  await sleep(200);
  check('Alt focuses the menu bar', !!(await page.evaluate(() => document.querySelector('.menu > button.kb-focus'))), {});
  input([['key', 'Escape']]);
  await sleep(200);

  const after = await page.evaluate(() => window.__view.state.selection.from);
  check('script cursor unchanged by all menu use', after === pos, { pos, after });
  check('no page errors', !errors.length, errors);

  await Promise.race([app.close(), sleep(5000)]);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
