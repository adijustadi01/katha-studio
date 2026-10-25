// Katha Studio — Electron main process.
// Real files on disk, atomic saves, rolling backups, crash recovery, native
// menus, Chromium PDF export, file association and auto-update.
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const isDev = !app.isPackaged && process.env.KATHA_DEV === '1';
let win = null;
let dirty = false;
let pendingFile = null; // file passed on the command line before the window was ready
let allowClose = false;

// ------------------------------------------------------------------ paths
const userData = () => app.getPath('userData');
const recoveryDir = () => ensure(path.join(userData(), 'recovery'));
const backupRoot = () => ensure(path.join(app.getPath('documents'), 'Katha Studio Backups'));
function ensure(d) {
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const safeName = (s) => String(s || 'Untitled').replace(/\.katha$/i, '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'Untitled';

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJSON(file, data) {
  atomicWrite(file, Buffer.from(JSON.stringify(data, null, 1)));
}

/** Write to a temp file, flush, then rename over the target: a crash never leaves a half-written script. */
function atomicWrite(file, data) {
  const tmp = file + '.tmp-' + process.pid;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

function fileArg(argv) {
  return argv.slice(1).find((a) => /\.(katha|fdx|fountain|spmd|txt|docx)$/i.test(a) && fs.existsSync(a)) || null;
}

function readFileInfo(p) {
  const data = fs.readFileSync(p);
  return { name: path.basename(p), path: p, data: new Uint8Array(data) };
}

// ------------------------------------------------------------------ single instance + file association
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileArg(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (f) win.webContents.send('open-file', readFileInfo(f));
    }
  });
}
pendingFile = fileArg(process.argv);
app.on('open-file', (e, p) => {
  // macOS
  e.preventDefault();
  if (win) win.webContents.send('open-file', readFileInfo(p));
  else pendingFile = p;
});

// ------------------------------------------------------------------ window
function createWindow() {
  const state = readJSON(path.join(userData(), 'window.json'), { width: 1400, height: 900 });
  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Katha Studio',
    backgroundColor: '#1f1b2e',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  const index = path.join(__dirname, '..', 'dist-desktop', 'index.html');
  if (isDev && process.env.KATHA_URL) win.loadURL(process.env.KATHA_URL);
  else win.loadFile(index);

  // external links open in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // spell check: English plus the user's custom words, with a context menu
  try {
    session.defaultSession.setSpellCheckerLanguages(['en-US']);
  } catch {
    /* Windows uses the OS spell checker */
  }
  for (const w of readJSON(path.join(userData(), 'spell-words.json'), [])) session.defaultSession.addWordToSpellCheckerDictionary(w);
  win.webContents.on('context-menu', (_e, params) => {
    const items = [];
    for (const s of params.dictionarySuggestions || []) items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
    if (params.misspelledWord) {
      if (items.length) items.push({ type: 'separator' });
      items.push({
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () => {
          session.defaultSession.addWordToSpellCheckerDictionary(params.misspelledWord);
          const list = readJSON(path.join(userData(), 'spell-words.json'), []);
          list.push(params.misspelledWord);
          writeJSON(path.join(userData(), 'spell-words.json'), list);
        },
      });
      items.push({ type: 'separator' });
    }
    items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
    Menu.buildFromTemplate(items).popup();
  });

  win.on('close', async (e) => {
    const b = win.getBounds();
    writeJSON(path.join(userData(), 'window.json'), { ...b, maximized: win.isMaximized() });
    if (!dirty || allowClose) {
      markCleanExit();
      return;
    }
    e.preventDefault();
    const r = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Save', "Don't save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Save changes to your script before closing?',
      detail: 'A recovery copy is kept either way, so nothing is lost.',
    });
    if (r.response === 0) {
      win.webContents.send('menu', 'file.save');
      const start = Date.now();
      const t = setInterval(() => {
        if (!dirty || Date.now() - start > 30000) {
          clearInterval(t);
          if (!dirty) {
            allowClose = true;
            win.close();
          }
        }
      }, 200);
    } else if (r.response === 1) {
      allowClose = true;
      win.close();
    }
  });
  win.on('closed', () => (win = null));
}

// "session.json" records whether the last run ended cleanly (crash recovery hint)
function markSession(running) {
  writeJSON(path.join(userData(), 'session.json'), { running, time: Date.now(), version: app.getVersion() });
}
function markCleanExit() {
  markSession(false);
}

// ------------------------------------------------------------------ menu (template sent by the renderer)
function accel(k) {
  if (!k) return undefined;
  return k
    .split('-')
    .filter(Boolean)
    .map((p) => (p === 'Mod' ? 'CmdOrCtrl' : p.length === 1 ? p.toUpperCase() : p))
    .join('+')
    .replace('CmdOrCtrl+=', 'CmdOrCtrl+Plus');
}
// The menu is built once and then only updated in place. Rebuilding the
// application menu while one of its menus is open can close it and deliver the
// pending click to an item of the new menu, so structural rebuilds wait until
// every menu is closed, and activations that arrive right after a menu opened
// (the release of the click that opened it) are ignored.
let menuSig = '';
let openMenus = 0;
let lastMenuShown = 0;
let pendingMenus = null;
const OPEN_GUARD_MS = 400;
const escLabel = (l) => String(l).replace(/&/g, '&&');

function structureOf(menus) {
  const strip = (items) => items.map((it) => (typeof it === 'string' ? it : it.role ? { role: it.role } : it.items ? { label: it.label, items: strip(it.items) } : { id: it.id, label: it.label, keys: it.keys, check: it.checked !== undefined }));
  return JSON.stringify(menus.map((m) => ({ label: m.label, items: strip(m.items) })));
}

function buildItems(items) {
  return items.map((it) => {
    if (it === '-') return { type: 'separator' };
    if (it.role) return { role: it.role };
    if (it.items) return { label: escLabel(it.label), submenu: buildItems(it.items) };
    return {
      id: it.id,
      label: escLabel(it.label),
      type: it.checked === undefined ? 'normal' : 'checkbox',
      checked: !!it.checked,
      enabled: it.enabled !== false,
      accelerator: accel(it.keys),
      // keys are handled inside the window so text fields keep their own shortcuts
      registerAccelerator: false,
      click: () => {
        if (Date.now() - lastMenuShown < OPEN_GUARD_MS) return; // the opening click never runs an item
        if (win) win.webContents.send('menu', it.id);
      },
    };
  });
}

function watchOpen(menu) {
  for (const item of menu.items) {
    if (!item.submenu) continue;
    item.submenu.on('menu-will-show', () => {
      openMenus++;
      lastMenuShown = Date.now();
    });
    item.submenu.on('menu-will-close', () => {
      openMenus = Math.max(0, openMenus - 1);
      if (!openMenus && pendingMenus) setTimeout(() => applyMenus(pendingMenus), 50);
    });
    watchOpen(item.submenu);
  }
}

function updateStates(items) {
  const m = Menu.getApplicationMenu();
  if (!m) return;
  for (const it of items) {
    if (!it || typeof it === 'string' || it.role) continue;
    if (it.items) {
      updateStates(it.items);
      continue;
    }
    const mi = m.getMenuItemById(it.id);
    if (!mi) continue;
    if (it.checked !== undefined && mi.checked !== !!it.checked) mi.checked = !!it.checked;
    const en = it.enabled !== false;
    if (mi.enabled !== en) mi.enabled = en;
  }
}

function applyMenus(menus) {
  if (openMenus > 0) {
    pendingMenus = menus; // never touch the menu while it is open
    return;
  }
  pendingMenus = null;
  const sig = structureOf(menus);
  if (sig === menuSig) {
    for (const m of menus) updateStates(m.items);
    return;
  }
  menuSig = sig;
  const template = menus.map((m) => ({ label: escLabel(m.label), submenu: buildItems(m.items) }));
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  const menu = Menu.buildFromTemplate(template);
  watchOpen(menu);
  Menu.setApplicationMenu(menu);
}
ipcMain.on('set-menu', (_e, menus) => applyMenus(menus));

// ------------------------------------------------------------------ files
const FILTERS = [
  { name: 'Scripts', extensions: ['katha', 'fdx', 'fountain', 'spmd', 'txt', 'docx'] },
  { name: 'Katha Studio project', extensions: ['katha'] },
  { name: 'Final Draft', extensions: ['fdx'] },
  { name: 'Fountain', extensions: ['fountain', 'spmd'] },
  { name: 'All files', extensions: ['*'] },
];
ipcMain.handle('open-dialog', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILTERS });
  if (r.canceled || !r.filePaths[0]) return null;
  app.addRecentDocument(r.filePaths[0]);
  return readFileInfo(r.filePaths[0]);
});
ipcMain.handle('read-file', async (_e, p) => {
  try {
    return readFileInfo(p);
  } catch {
    return null;
  }
});
ipcMain.handle('write-file', async (_e, p, data) => {
  try {
    atomicWrite(p, Buffer.from(data));
    app.addRecentDocument(p);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
});
ipcMain.handle('save-dialog', async (_e, suggested, ext) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), suggested),
    filters: [{ name: 'Katha Studio project', extensions: [ext.replace('.', '')] }],
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('export-dialog', async (_e, suggested, data) => {
  const ext = path.extname(suggested).slice(1);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), suggested),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return false;
  atomicWrite(r.filePath, typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data));
  if (ext === 'pdf') shell.openPath(r.filePath);
  return true;
});

// ------------------------------------------------------------------ PDF + print via Chromium
async function renderWindow(html) {
  const tmp = path.join(os.tmpdir(), `katha-print-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  await w.loadFile(tmp);
  await w.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  return { w, tmp };
}
ipcMain.handle('print-to-pdf', async (_e, html, o) => {
  const { w, tmp } = await renderWindow(html);
  try {
    const pdf = await w.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: { width: o.pageWidthIn, height: o.pageHeightIn },
      margins: { marginType: 'none' },
    });
    return new Uint8Array(pdf);
  } finally {
    w.destroy();
    fs.rm(tmp, () => {});
  }
});
ipcMain.handle('print', async (_e, html) => {
  const { w, tmp } = await renderWindow(html);
  await new Promise((res) => w.webContents.print({ printBackground: true }, () => res()));
  w.destroy();
  fs.rm(tmp, () => {});
});

// ------------------------------------------------------------------ recovery (autosave copies)
ipcMain.handle('write-recovery', async (_e, meta, data) => {
  const d = recoveryDir();
  atomicWrite(path.join(d, meta.projectId + '.katha'), Buffer.from(data));
  writeJSON(path.join(d, meta.projectId + '.json'), meta);
});
ipcMain.handle('list-recovery', async () => {
  const d = recoveryDir();
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(path.join(d, f), null))
    .filter(Boolean);
});
ipcMain.handle('read-recovery', async (_e, id) => {
  try {
    return new Uint8Array(fs.readFileSync(path.join(recoveryDir(), id + '.katha')));
  } catch {
    return null;
  }
});
ipcMain.handle('clear-recovery', async (_e, id) => {
  for (const ext of ['.katha', '.json']) fs.rm(path.join(recoveryDir(), id + ext), () => {});
});

// ------------------------------------------------------------------ backups: last 50 + one per day
const MAX_BACKUPS = 50;
ipcMain.handle('write-backup', async (_e, projectId, name, data) => {
  const dir = ensure(path.join(backupRoot(), safeName(name) + ' [' + String(projectId).slice(-6) + ']'));
  const now = new Date();
  const stamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const day = stamp.slice(0, 10);
  const dailyDir = ensure(path.join(dir, 'daily'));
  const dailyFile = path.join(dailyDir, `${safeName(name)} ${day}.katha`);
  atomicWrite(path.join(dir, `${safeName(name)} ${stamp}.katha`), Buffer.from(data));
  atomicWrite(dailyFile, Buffer.from(data)); // last save of the day wins
  writeJSON(path.join(dir, 'project.json'), { projectId, name });
  const rolling = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.katha'))
    .sort();
  for (const f of rolling.slice(0, Math.max(0, rolling.length - MAX_BACKUPS))) fs.rmSync(path.join(dir, f), { force: true });
});
ipcMain.handle('list-backups', async (_e, projectId) => {
  const out = [];
  const root = backupRoot();
  for (const d of fs.readdirSync(root)) {
    const dir = path.join(root, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    const meta = readJSON(path.join(dir, 'project.json'), {});
    if (projectId && meta.projectId !== projectId) continue;
    const add = (folder, daily) => {
      if (!fs.existsSync(folder)) return;
      for (const f of fs.readdirSync(folder)) {
        if (!f.endsWith('.katha')) continue;
        const p = path.join(folder, f);
        const st = fs.statSync(p);
        out.push({ id: p, projectId: meta.projectId, name: meta.name || d, time: st.mtimeMs, daily, size: st.size });
      }
    };
    add(dir, false);
    add(path.join(dir, 'daily'), true);
  }
  return out.sort((a, b) => b.time - a.time);
});
ipcMain.handle('read-backup', async (_e, id) => {
  if (!path.resolve(id).startsWith(path.resolve(backupRoot()))) return null;
  try {
    return new Uint8Array(fs.readFileSync(id));
  } catch {
    return null;
  }
});
ipcMain.on('open-backup-folder', () => shell.openPath(backupRoot()));

// ------------------------------------------------------------------ recent files
const recentFile = () => path.join(userData(), 'recent.json');
ipcMain.handle('recent', async () => readJSON(recentFile(), []).filter((r) => !r.path || fs.existsSync(r.path)).slice(0, 15));
ipcMain.handle('add-recent', async (_e, entry) => {
  const list = readJSON(recentFile(), []).filter((x) => !(entry.path && x.path === entry.path) && !(entry.projectId && x.projectId === entry.projectId));
  list.unshift(entry);
  writeJSON(recentFile(), list.slice(0, 20));
  if (entry.path) app.addRecentDocument(entry.path);
});
ipcMain.handle('remove-recent', async (_e, entry) => {
  writeJSON(
    recentFile(),
    readJSON(recentFile(), []).filter((x) => !(x.path === entry.path && x.time === entry.time)),
  );
});

ipcMain.handle('pending-open', async () => {
  const f = pendingFile;
  pendingFile = null;
  return f ? readFileInfo(f) : null;
});

// ------------------------------------------------------------------ misc
ipcMain.on('set-title', (_e, t) => win && win.setTitle(t));
ipcMain.on('set-dirty', (_e, d) => {
  dirty = !!d;
  if (win) win.setDocumentEdited(dirty);
});
const secretsFile = () => path.join(userData(), 'secrets.json');
ipcMain.handle('get-secret', async (_e, k) => {
  const s = readJSON(secretsFile(), {});
  if (!s[k]) return null;
  try {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(s[k], 'base64')) : Buffer.from(s[k], 'base64').toString('utf8');
  } catch {
    return null;
  }
});
ipcMain.handle('set-secret', async (_e, k, v) => {
  const s = readJSON(secretsFile(), {});
  if (v === null) delete s[k];
  else s[k] = (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(v) : Buffer.from(v, 'utf8')).toString('base64');
  writeJSON(secretsFile(), s);
});
ipcMain.on('add-spell-word', (_e, w) => {
  session.defaultSession.addWordToSpellCheckerDictionary(w);
  const list = readJSON(path.join(userData(), 'spell-words.json'), []);
  list.push(w);
  writeJSON(path.join(userData(), 'spell-words.json'), list);
});

// ------------------------------------------------------------------ auto-update (GitHub Releases)
function setupUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox(win, { message: 'Updates are checked in the installed app only.' });
    return;
  }
  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      message: `Katha Studio ${info.version} is ready to install.`,
      detail: 'Your script is autosaved. Restart to update?',
    });
    if (r.response === 0) {
      allowClose = true;
      autoUpdater.quitAndInstall();
    }
  });
  if (manual)
    autoUpdater.on('update-not-available', () => dialog.showMessageBox(win, { message: `You have the latest version (${app.getVersion()}).` }));
  autoUpdater.on('error', (err) => manual && dialog.showMessageBox(win, { type: 'warning', message: 'Could not check for updates', detail: String(err && err.message) }));
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.on('check-updates', () => setupUpdates(true));
ipcMain.on('get-version', (e) => (e.returnValue = app.getVersion()));

app.whenReady().then(() => {
  const last = readJSON(path.join(userData(), 'session.json'), { running: false });
  if (last.running) console.log('Previous session did not exit cleanly — recovery copies will be offered.');
  markSession(true);
  createWindow();
  setTimeout(() => setupUpdates(false), 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  markCleanExit();
  if (process.platform !== 'darwin') app.quit();
});
