// Web/PWA menu test with real mouse/keyboard events in Chromium.
// Checks: one click opens each menu and it stays open 2 s; the opening click runs nothing;
// press-on-title + release-on-item runs nothing; hover switches menus; submenus open on hover
// and stay open while the pointer moves into them; Esc / click-outside / title-click close;
// a deliberate click and Enter run items; the script cursor is preserved; popups don't click through.
const { chromium } = require('playwright');
const URL = process.env.APP_URL || 'http://localhost:4173/katha-studio/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('katha.prefs', JSON.stringify({ tutorialDone: true })));
  await page.goto(URL);
  await sleep(800);
  await page.click('text=Open sample screenplay');
  await sleep(1500);
  const setCursor = () =>
    page.evaluate(() => {
      const v = window.__view;
      let pos = 0;
      v.state.doc.forEach((n, p) => n.textContent.startsWith('Mist rolls') && (pos = p + 5));
      v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(pos))));
      v.focus();
      return pos;
    });
  const selBefore = await setCursor();
  const reset = () => page.evaluate(() => (window.__cmdLog.length = 0));
  const cmds = () => page.evaluate(() => window.__cmdLog.slice());
  const dialog = () => page.evaluate(() => window.__katha.dialog && window.__katha.dialog.kind);
  const openMenu = () => page.evaluate(() => document.querySelector('.menu.open > button')?.dataset.menu || null);
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  };
  const center = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const labels = await page.$$eval('.menubar .menu > button', (bs) => bs.map((b) => b.dataset.menu));
  await reset();

  // 1. a single click opens each menu; it stays open; nothing runs
  for (const l of labels) {
    const c = await center(`.menu > button[data-menu="${l}"]`);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await sleep(90);
    await page.mouse.up();
    await sleep(2000);
    const o = await openMenu();
    check(`click opens ${l} and it stays open for 2s`, o === l, { open: o });
    const log = await cmds();
    const d = await dialog();
    check(`opening click of ${l} runs nothing`, !log.length && !d, { log, d });
    await page.keyboard.press('Escape');
    await sleep(150);
    check(`Esc closes ${l}`, (await openMenu()) === null, {});
    await reset();
  }

  // 2. press on the title, release on the first item: must not run the item
  {
    await page.evaluate(() => { window.__ev = []; for (const t of ['mousedown', 'mouseup', 'click', 'keydown']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.target.dataset?.cmd || e.target.dataset?.menu || e.target.className || e.target.tagName)), true); });
    const c = await center('.menu > button[data-menu="File"]');
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await sleep(60);
    const first = await center('.menu.open .menu-item[data-cmd]');
    await page.mouse.move(c.x, first.y, { steps: 4 }); // straight down onto New
    await page.mouse.up();
    await sleep(500);
    check('press on title + release on "New…" runs nothing', !(await cmds()).length && !(await dialog()), await cmds());
    check('…and the menu is still open', (await openMenu()) === 'File', await page.evaluate(() => window.__ev));
  }

  // 3. hover switching between menus
  for (const l of ['Edit', 'View', 'Script']) {
    const c = await center(`.menu > button[data-menu="${l}"]`);
    await page.mouse.move(c.x, c.y, { steps: 5 });
    await sleep(200);
    check(`hovering ${l} switches to it`, (await openMenu()) === l, { open: await openMenu() });
  }

  // 4. submenu opens on hover and stays open while moving into it
  {
    const sub = await center('.menu.open .menu-item.has-sub');
    await page.mouse.move(sub.x, sub.y, { steps: 4 });
    await sleep(300);
    const visible = await page.locator('.menu.open .submenu').isVisible();
    check('submenu opens on hover', visible, {});
    const target = await center('.menu.open .submenu .menu-item[data-cmd]');
    // move diagonally into the submenu (passes over other items briefly)
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await sleep(800);
    check('submenu stays open while the pointer moves into it', await page.locator('.menu.open .submenu').isVisible(), {});
    await page.mouse.down();
    await sleep(80);
    await page.mouse.up();
    await sleep(300);
    const log = await cmds();
    if (!log.length) console.log('events', JSON.stringify(await page.evaluate(() => window.__ev.slice(-8))));
    check('deliberate click on a submenu item runs it', log.length === 1 && log[0].startsWith('script.phonetic'), log);
    check('…and closes the menu', (await openMenu()) === null, {});
    await page.evaluate(() => window.__runCommand('script.phonetic.off'));
    await reset();
  }

  // 5. title click again closes; click outside closes without running anything
  {
    const c = await center('.menu > button[data-menu="Edit"]');
    await page.mouse.click(c.x, c.y);
    await sleep(300);
    await page.mouse.click(c.x, c.y);
    await sleep(200);
    check('clicking the open title again closes it', (await openMenu()) === null, {});
    await page.mouse.click(c.x, c.y);
    await sleep(300);
    const sb = await center('.statusbar');
    await page.mouse.click(sb.x, sb.y);
    await sleep(200);
    check('click outside closes the menu', (await openMenu()) === null, {});
    check('…without running anything', !(await cmds()).length, await cmds());
  }

  // 6. deliberate mouse click on an item runs it (Help → About)
  {
    const c = await center('.menu > button[data-menu="Help"]');
    await page.mouse.click(c.x, c.y);
    await sleep(500);
    const about = await center('.menu.open .menu-item[data-cmd="help.about"]');
    await page.mouse.click(about.x, about.y);
    await sleep(400);
    check('deliberate click runs the item (About dialog)', (await dialog()) === 'about', await cmds());
    // the About dialog must survive: the click that opened it does not hit its buttons
    await sleep(500);
    check('…and the dialog stays open', (await dialog()) === 'about', {});
    await page.keyboard.press('Escape');
    await sleep(200);
    await reset();
  }

  // 7. keyboard: F10 focuses the bar, arrows move, Enter selects, Esc closes
  {
    await setCursor();
    await page.keyboard.press('F10');
    await sleep(150);
    const kb = await page.evaluate(() => document.querySelector('.menu > button.kb-focus')?.dataset.menu);
    check('F10 focuses the menu bar (File)', kb === 'File', { kb });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await sleep(150);
    check('arrows move and open (View)', (await openMenu()) === 'View', { open: await openMenu() });
    await page.keyboard.press('ArrowDown'); // Page View → Draft View
    await page.keyboard.press('Enter');
    await sleep(300);
    const log = await cmds();
    check('Enter runs the highlighted item (Draft View)', log[0] === 'view.draft', log);
    await page.evaluate(() => window.__runCommand('view.page'));
    await reset();
    await page.keyboard.press('Alt');
    await sleep(150);
    const kb2 = await page.evaluate(() => document.querySelector('.menu > button.kb-focus')?.dataset.menu);
    check('Alt focuses the menu bar', kb2 === 'File', { kb2 });
    await page.keyboard.press('Escape');
    await sleep(100);
    check('Esc leaves the menu bar', !(await page.evaluate(() => document.querySelector('.menu > button.kb-focus'))), {});
  }

  // 8. the cursor in the script survived all menu use
  {
    const pos = await setCursor();
    for (const l of ['File', 'Edit', 'Format']) {
      const c = await center(`.menu > button[data-menu="${l}"]`);
      await page.mouse.click(c.x, c.y);
      await sleep(200);
    }
    await page.keyboard.press('Escape');
    await sleep(100);
    const after = await page.evaluate(() => ({ from: window.__view.state.selection.from, focused: window.__view.hasFocus() }));
    check('cursor position unchanged after using menus', after.from === pos, after);
    check('script keeps keyboard focus', after.focused, after);
  }

  // 9. other popups: element selector, SmartType and phonetic suggestions don't click through
  {
    await reset();
    const before = await page.evaluate(() => window.__katha.elements().length);
    const sel = await center('select.element-select');
    await page.mouse.click(sel.x, sel.y);
    await sleep(300);
    await page.keyboard.press('Escape');
    await sleep(200);
    const typeAfter = await page.evaluate(() => window.__view.state.selection.$from.parent.attrs.type);
    check('opening the element selector changes nothing', typeAfter === 'action' && (await cmds()).length === 0, { typeAfter });
    // SmartType: press on a suggestion and release elsewhere → not accepted
    await page.evaluate(() => {
      const v = window.__view;
      const end = v.state.doc.content.size - 1;
      v.dispatch(v.state.tr.setSelection(v.state.selection.constructor.near(v.state.doc.resolve(end))));
      v.focus();
    });
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.__runCommand('format.character'));
    await page.keyboard.type('SU');
    await sleep(300);
    const st = await center('.smarttype .st-item');
    await page.mouse.move(st.x, st.y);
    await page.mouse.down();
    await page.mouse.move(st.x + 400, st.y + 200, { steps: 3 });
    await page.mouse.up();
    await sleep(200);
    const txt = await page.evaluate(() => window.__view.state.selection.$from.parent.textContent);
    check('SmartType: press-and-drag away does not accept', txt === 'SU', { txt });
    const st2 = await center('.smarttype .st-item');
    await page.mouse.click(st2.x, st2.y);
    await sleep(200);
    const txt2 = await page.evaluate(() => window.__view.state.selection.$from.parent.textContent);
    check('SmartType: a deliberate click accepts', txt2 === 'SURYA', { txt2 });
    void before;
  }

  console.log('errors', JSON.stringify(errors));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
