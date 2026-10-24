import type { Platform } from './types';
import { webPlatform } from './web';

/** API exposed by electron/preload.ts */
export interface KathaBridge {
  openDialog(accept: string[]): Promise<{ name: string; path: string; data: Uint8Array } | null>;
  readFile(path: string): Promise<{ name: string; path: string; data: Uint8Array } | null>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  saveDialog(suggested: string, ext: string): Promise<string | null>;
  exportDialog(suggested: string, data: Uint8Array | string): Promise<boolean>;
  printToPDF(html: string, opts: { pageWidthIn: number; pageHeightIn: number }): Promise<Uint8Array | null>;
  print(html: string): Promise<void>;
  writeRecovery(meta: unknown, data: Uint8Array): Promise<void>;
  listRecovery(): Promise<any[]>;
  readRecovery(id: string): Promise<Uint8Array | null>;
  clearRecovery(id: string): Promise<void>;
  writeBackup(projectId: string, name: string, data: Uint8Array): Promise<void>;
  listBackups(projectId?: string): Promise<any[]>;
  readBackup(id: string): Promise<Uint8Array | null>;
  openBackupFolder(): void;
  recent(): Promise<any[]>;
  addRecent(e: unknown): Promise<void>;
  removeRecent(e: unknown): Promise<void>;
  pendingOpen(): Promise<{ name: string; path: string; data: Uint8Array } | null>;
  onMenu(cb: (cmd: string, data?: any) => void): void;
  setMenu(menus: unknown): void;
  setTitle(t: string): void;
  setDirty(d: boolean): void;
  getSecret(k: string): Promise<string | null>;
  setSecret(k: string, v: string | null): Promise<void>;
  addSpellWord(w: string): void;
  checkForUpdates(): void;
  version: string;
}

export function desktopPlatform(b: KathaBridge): Platform {
  return {
    ...webPlatform,
    kind: 'desktop',
    canSaveInPlace: true,
    open: (accept) => b.openDialog(accept),
    readPath: (p) => b.readFile(p),
    async write(target, data) {
      if (!target.path) return false;
      return b.writeFile(target.path, data);
    },
    async saveAs(suggested, data, ext) {
      const p = await b.saveDialog(suggested, ext);
      if (!p) return null;
      const ok = await b.writeFile(p, data);
      if (!ok) throw new Error('Could not write ' + p);
      return { name: p.split(/[\\/]/).pop() || suggested, path: p };
    },
    async exportFile(name, data) {
      await b.exportDialog(name, data);
    },
    printToPDF: (html, o) => b.printToPDF(html, o),
    print: (html) => b.print(html),
    writeRecovery: (e, d) => b.writeRecovery(e, d),
    listRecovery: () => b.listRecovery(),
    readRecovery: (id) => b.readRecovery(id),
    clearRecovery: (id) => b.clearRecovery(id),
    writeBackup: (p, n, d) => b.writeBackup(p, n, d),
    listBackups: (p) => b.listBackups(p),
    readBackup: (id) => b.readBackup(id),
    openBackupFolder: () => b.openBackupFolder(),
    recent: () => b.recent(),
    addRecent: (e) => b.addRecent(e),
    removeRecent: (e) => b.removeRecent(e),
    pendingOpen: () => b.pendingOpen(),
    onMenu: (cb) => b.onMenu(cb),
    setMenu: (m) => b.setMenu(m),
    setTitle: (t) => b.setTitle(t),
    setDirty: (d) => b.setDirty(d),
    getSecret: (k) => b.getSecret(k),
    setSecret: (k, v) => b.setSecret(k, v),
    addSpellWord: (w) => b.addSpellWord(w),
    checkForUpdates: () => b.checkForUpdates(),
    appVersion: () => b.version,
  };
}
