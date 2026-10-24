// Exposes a small, explicit API to the renderer (contextIsolation on, no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');

const menuListeners = [];
ipcRenderer.on('menu', (_e, cmd) => menuListeners.forEach((f) => f(cmd)));
ipcRenderer.on('open-file', (_e, f) => menuListeners.forEach((fn) => fn('__open__', f)));

contextBridge.exposeInMainWorld('kathaDesktop', {
  version: ipcRenderer.sendSync('get-version'),
  openDialog: (accept) => ipcRenderer.invoke('open-dialog', accept),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', p, data),
  saveDialog: (s, ext) => ipcRenderer.invoke('save-dialog', s, ext),
  exportDialog: (s, data) => ipcRenderer.invoke('export-dialog', s, data),
  printToPDF: (html, o) => ipcRenderer.invoke('print-to-pdf', html, o),
  print: (html) => ipcRenderer.invoke('print', html),
  writeRecovery: (meta, data) => ipcRenderer.invoke('write-recovery', meta, data),
  listRecovery: () => ipcRenderer.invoke('list-recovery'),
  readRecovery: (id) => ipcRenderer.invoke('read-recovery', id),
  clearRecovery: (id) => ipcRenderer.invoke('clear-recovery', id),
  writeBackup: (id, name, data) => ipcRenderer.invoke('write-backup', id, name, data),
  listBackups: (id) => ipcRenderer.invoke('list-backups', id),
  readBackup: (id) => ipcRenderer.invoke('read-backup', id),
  openBackupFolder: () => ipcRenderer.send('open-backup-folder'),
  recent: () => ipcRenderer.invoke('recent'),
  addRecent: (e) => ipcRenderer.invoke('add-recent', e),
  removeRecent: (e) => ipcRenderer.invoke('remove-recent', e),
  pendingOpen: () => ipcRenderer.invoke('pending-open'),
  onMenu: (cb) => menuListeners.push(cb),
  setMenu: (menus) => ipcRenderer.send('set-menu', menus),
  setTitle: (t) => ipcRenderer.send('set-title', t),
  setDirty: (d) => ipcRenderer.send('set-dirty', d),
  getSecret: (k) => ipcRenderer.invoke('get-secret', k),
  setSecret: (k, v) => ipcRenderer.invoke('set-secret', k, v),
  addSpellWord: (w) => ipcRenderer.send('add-spell-word', w),
  checkForUpdates: () => ipcRenderer.send('check-updates'),
});
