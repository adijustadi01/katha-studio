import { render } from 'preact';
import './styles/app.css';
import { App } from './ui/App';
import { store } from './app/store';
import { prefs } from './app/prefs';
import { globalKeydown, runCommand } from './app/commands';
import { platform, isDesktop } from './platform';
import { trackProgress } from './app/writing';
import './features';
import { nativeMenus } from './ui/MenuBar';

render(<App />, document.getElementById('app')!);

store.initFonts();
window.addEventListener('keydown', globalKeydown);

// unsaved-work guard (web)
window.addEventListener('beforeunload', (e) => {
  if (store.project && store.dirty && !isDesktop) {
    // a recovery copy exists in IndexedDB, but warn anyway
    void store.autosave();
    e.preventDefault();
    e.returnValue = '';
  }
});
// flush an autosave whenever the tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && store.project) void store.autosave();
});

// writing stats
store.subscribe(() => {
  if (store.layout) trackProgress();
});

// desktop: native menu + files opened by double click
if (platform.onMenu)
  platform.onMenu((cmd, f) => {
    if (cmd === '__open__' && f) void store.openData(f.name, f.data, { name: f.name, path: f.path });
    else void runCommand(cmd);
  });
if (platform.setMenu) {
  let last = '';
  const send = () => {
    const m = nativeMenus();
    const sig = JSON.stringify(m);
    if (sig === last) return; // only tell the main process when something actually changed
    last = sig;
    platform.setMenu!(m);
  };
  send();
  let t: any = null;
  store.subscribe(() => {
    clearTimeout(t);
    t = setTimeout(send, 400);
  });
}
if (platform.pendingOpen) {
  platform.pendingOpen().then((f) => {
    if (f) store.openData(f.name, f.data, { name: f.name, path: f.path });
  });
}

// PWA: files opened through the OS file handler
const lq = (window as any).launchQueue;
if (lq) {
  lq.setConsumer(async (params: any) => {
    for (const h of params.files || []) {
      const f = await h.getFile();
      await store.openData(f.name, new Uint8Array(await f.arrayBuffer()), { name: f.name, handle: h });
    }
  });
}

// service worker for offline use (web build only)
if (!isDesktop && import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const update = registerSW({
        onNeedRefresh() {
          if (confirm('A new version of Katha Studio is available. Reload now? (Your work is autosaved.)')) {
            void store.autosave().then(() => update(true));
          }
        },
        onOfflineReady() {
          store.toast('Katha Studio is ready to work offline.', 'ok');
        },
      });
    })
    .catch(() => {});
}

// first launch → tutorial
if (!prefs.tutorialDone) setTimeout(() => store.openDialog('tutorial'), 800);

// test hook for automated checks
(window as any).__runCommand = runCommand;
(window as any).__cmdLog = [];
import { buildPrintHTML } from './app/exporter';
(window as any).__exporter = { buildPrintHTML };
