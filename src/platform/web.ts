import type { Platform, OpenedFile, SaveTarget, BackupEntry, RecoveryEntry, RecentEntry } from './types';

// ------------------------------------------------------------- IndexedDB helpers
const DB_NAME = 'katha-studio';
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('recovery', { keyPath: 'projectId' });
        const b = d.createObjectStore('backups', { keyPath: 'id' });
        b.createIndex('projectId', 'projectId');
        d.createObjectStore('kv');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req ? (req.result as T) : (undefined as T));
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const kv = {
  get: <T>(k: string) => tx<T>('kv', 'readonly', (s) => s.get(k) as IDBRequest<T>),
  set: (k: string, v: unknown) => tx('kv', 'readwrite', (s) => s.put(v, k)),
};

// ------------------------------------------------------------- file helpers
function download(name: string, data: Uint8Array | string, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const hasFSA = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

function pickFile(accept: string[]): Promise<File | null> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept.join(',');
    inp.onchange = () => res(inp.files?.[0] || null);
    inp.addEventListener('cancel', () => res(null));
    inp.click();
  });
}

const MAX_BACKUPS = 50;

export const webPlatform: Platform = {
  kind: 'web',
  canSaveInPlace: hasFSA,
  async open(accept) {
    if (hasFSA) {
      try {
        const [h] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Scripts', accept: { 'application/octet-stream': accept } }],
          excludeAcceptAllOption: false,
        });
        const f: File = await h.getFile();
        return { name: f.name, data: new Uint8Array(await f.arrayBuffer()), handle: h } as OpenedFile;
      } catch (e: any) {
        if (e?.name === 'AbortError') return null;
      }
    }
    const f = await pickFile(accept);
    if (!f) return null;
    return { name: f.name, data: new Uint8Array(await f.arrayBuffer()) };
  },
  async write(target, data) {
    const h = target.handle as any;
    if (!h) return false;
    try {
      if ((await h.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
        if ((await h.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return false;
      }
      const w = await h.createWritable();
      await w.write(data);
      await w.close();
      return true;
    } catch (e) {
      console.warn('write failed', e);
      return false;
    }
  },
  async saveAs(suggested, data, ext, mime) {
    if (hasFSA) {
      try {
        const h = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: 'Katha Studio project', accept: { [mime]: [ext] } }],
        });
        const w = await h.createWritable();
        await w.write(data);
        await w.close();
        return { name: h.name, handle: h } as SaveTarget;
      } catch (e: any) {
        if (e?.name === 'AbortError') return null;
      }
    }
    download(suggested, data, mime);
    return { name: suggested };
  },
  async exportFile(name, data, mime) {
    download(name, data, mime);
  },
  async print(html) {
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(ifr);
    const doc = ifr.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((r) => setTimeout(r, 50));
    try {
      await (ifr.contentDocument as any).fonts?.ready;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 300));
    ifr.contentWindow!.focus();
    ifr.contentWindow!.print();
    setTimeout(() => ifr.remove(), 60000);
  },

  async writeRecovery(e, data) {
    await tx('recovery', 'readwrite', (s) => s.put({ ...e, data }));
  },
  async listRecovery() {
    const all = await tx<any[]>('recovery', 'readonly', (s) => s.getAll());
    return (all || []).map(({ data, ...e }) => e as RecoveryEntry);
  },
  async readRecovery(id) {
    const r = await tx<any>('recovery', 'readonly', (s) => s.get(id));
    return r?.data || null;
  },
  async clearRecovery(id) {
    await tx('recovery', 'readwrite', (s) => s.delete(id));
  },

  async writeBackup(projectId, name, data) {
    const now = Date.now();
    const day = new Date().toISOString().slice(0, 10);
    const list = await this.listBackups(projectId);
    const hasDaily = list.some((b) => b.daily && new Date(b.time).toISOString().slice(0, 10) === day);
    const entry = { id: projectId + ':' + now, projectId, name, time: now, daily: !hasDaily, size: data.length, data };
    await tx('backups', 'readwrite', (s) => s.put(entry));
    // keep last 50 rolling + all daily (daily older than 60 days pruned)
    const rolling = list.filter((b) => !b.daily).sort((a, b) => b.time - a.time);
    const drop = rolling.slice(MAX_BACKUPS - 1).map((b) => b.id);
    const oldDaily = list.filter((b) => b.daily && now - b.time > 60 * 86400000).map((b) => b.id);
    if (drop.length || oldDaily.length)
      await tx('backups', 'readwrite', (s) => {
        for (const id of [...drop, ...oldDaily]) s.delete(id);
      });
  },
  async listBackups(projectId) {
    const all = await tx<any[]>('backups', 'readonly', (s) =>
      projectId ? s.index('projectId').getAll(projectId) : s.getAll(),
    );
    return (all || []).map(({ data, ...b }) => b as BackupEntry).sort((a, b) => b.time - a.time);
  },
  async readBackup(id) {
    const r = await tx<any>('backups', 'readonly', (s) => s.get(id));
    return r?.data || null;
  },

  async recent() {
    return ((await kv.get<RecentEntry[]>('recent')) || []).slice(0, 15);
  },
  async addRecent(e) {
    const list = ((await kv.get<RecentEntry[]>('recent')) || []).filter(
      (x) => !(x.projectId && x.projectId === e.projectId) && !(x.path && x.path === e.path),
    );
    list.unshift(e);
    await kv.set('recent', list.slice(0, 20));
  },
  async removeRecent(e) {
    const list = ((await kv.get<RecentEntry[]>('recent')) || []).filter((x) => !(x.projectId === e.projectId && x.time === e.time));
    await kv.set('recent', list);
  },
  setTitle(t) {
    document.title = t;
  },
  async getSecret(k) {
    try {
      return localStorage.getItem('katha.secret.' + k);
    } catch {
      return null;
    }
  },
  async setSecret(k, v) {
    try {
      if (v === null) localStorage.removeItem('katha.secret.' + k);
      else localStorage.setItem('katha.secret.' + k, v);
    } catch {
      /* ignore */
    }
  },
  appVersion: () => (import.meta as any).env?.VITE_APP_VERSION || '1.0.1',
};
