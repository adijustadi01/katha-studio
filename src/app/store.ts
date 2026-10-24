import type { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import type { Project, ScriptElement } from '../core/types';
import { newProject, normalizeProject, uid, cloneElements } from '../core/project';
import { paginate, Layout } from '../core/paginate';
import { getTemplate, setCustomTemplates } from '../core/templates';
import { canvasMeasurer, estimateMeasurer, Measurer } from '../core/measure';
import { packProject, unpackProject } from '../core/katha-file';
import { elementsFromDoc } from '../editor/schema';
import { decoKey, DecoConfig } from '../editor/decorations';
import { replaceDoc } from '../editor';
import { setRevisionMode } from '../editor/revision';
import { fontStack } from '../core/print';
import { platform } from '../platform';
import type { SaveTarget } from '../platform/types';
import { prefs, savePrefs } from './prefs';
import { setDictStorage } from '../core/translit';
import { setExtraCharacters } from '../editor/smarttype';

setDictStorage({
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
});
setCustomTemplates(prefs.customTemplates);

export type MainView = 'script' | 'cards' | 'beats' | 'outline' | 'tracks' | 'pulse' | 'stripboard' | 'reports' | 'punches';

export interface FindState {
  query: string;
  replace: string;
  matchCase: boolean;
  types: string[]; // element type filter; empty = all
  hits: { from: number; to: number }[];
  index: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'ok';
}

class Store {
  project: Project | null = null;
  target: SaveTarget | null = null;
  fileName = 'Untitled.katha';
  dirty = false; // changes not yet written to the real file
  saving = false;
  lastSaved = 0;
  lastBackup = 0;
  view: EditorView | null = null;
  state: EditorState | null = null;
  layout: Layout | null = null;
  main: MainView = 'script';
  dialog: { kind: string; data?: any } | null = null;
  find: FindState = { query: '', replace: '', matchCase: false, types: [], hits: [], index: 0 };
  toasts: Toast[] = [];
  version = 0;
  selVersion = 0;
  sessionStart = Date.now();
  sessionWordsStart = 0;
  private subs = new Set<() => void>();
  private selSubs = new Set<() => void>();
  private layoutTimer: any = null;
  private autosaveTimer: any = null;
  private emitTimer: any = null;
  private measurer: Measurer = estimateMeasurer;
  private fontsReady = false;

  subscribe(f: () => void) {
    this.subs.add(f);
    return () => this.subs.delete(f);
  }
  subscribeSel(f: () => void) {
    this.selSubs.add(f);
    return () => this.selSubs.delete(f);
  }
  emit() {
    this.version++;
    this.subs.forEach((f) => f());
  }
  /** batched emit for frequent doc changes */
  emitSoon(ms = 250) {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.emit();
    }, ms);
  }
  emitSel() {
    this.selVersion++;
    this.selSubs.forEach((f) => f());
  }

  toast(text: string, kind: Toast['kind'] = 'info', ms = 3500) {
    const id = Date.now() + Math.random();
    this.toasts = [...this.toasts, { id, text, kind }];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.emit();
    }, ms);
  }

  // ------------------------------------------------------------------ fonts
  async initFonts() {
    if (typeof document === 'undefined' || !(document as any).fonts) return;
    try {
      const fams = ['Courier Prime', 'Katha Tamil', 'Katha Telugu', 'Katha Devanagari', 'Katha Malayalam', 'Katha Kannada', 'Katha Tamil Serif', 'Katha Telugu Serif'];
      const samples: Record<string, string> = {
        'Courier Prime': 'Aa',
        'Katha Tamil': 'அ',
        'Katha Tamil Serif': 'அ',
        'Katha Telugu': 'అ',
        'Katha Telugu Serif': 'అ',
        'Katha Devanagari': 'अ',
        'Katha Malayalam': 'അ',
        'Katha Kannada': 'ಅ',
      };
      await Promise.all(
        fams.flatMap((f) => [
          (document as any).fonts.load(`12pt '${f}'`, samples[f]),
          (document as any).fonts.load(`bold 12pt '${f}'`, samples[f]),
        ]),
      );
    } catch (e) {
      console.warn('font load', e);
    }
    this.fontsReady = true;
    this.measurer = canvasMeasurer(fontStack(this.project?.settings.indicFontStyle));
    this.scheduleLayout(0);
  }

  // ------------------------------------------------------------------ project
  elements(): ScriptElement[] {
    if (this.view) return elementsFromDoc(this.view.state.doc);
    return this.project?.elements || [];
  }

  /** Bring project.elements up to date with the editor. */
  sync(): Project {
    const p = this.project!;
    p.elements = this.elements();
    return p;
  }

  loadProject(p: Project, target: SaveTarget | null, name: string) {
    this.project = normalizeProject(p);
    this.target = target;
    this.fileName = name;
    this.dirty = false;
    this.layout = null;
    this.main = 'script';
    this.find = { ...this.find, hits: [], index: 0 };
    if (this.view) replaceDoc(this.view, this.project.elements);
    this.sessionWordsStart = countWords(this.project.elements);
    setRevisionMode(this.project.revision.active, this.project.revision.color);
    this.measurer = this.fontsReady ? canvasMeasurer(fontStack(this.project.settings.indicFontStyle)) : estimateMeasurer;
    setExtraCharacters(Object.keys(this.project.characters));
    this.updateTitle();
    this.scheduleLayout(0);
    this.emit();
  }

  newProject(templateId = 'indian-a4', elements?: ScriptElement[]) {
    const p = newProject(elements);
    p.settings.template = templateId;
    this.loadProject(p, null, 'Untitled.katha');
  }

  closeProject() {
    this.project = null;
    this.target = null;
    this.layout = null;
    this.emit();
  }

  updateTitle() {
    if (!this.project) {
      platform.setTitle('Katha Studio');
      return;
    }
    platform.setTitle(`${this.dirty ? '• ' : ''}${this.fileName.replace(/\.katha$/, '')} — Katha Studio`);
    platform.setDirty?.(this.dirty);
  }

  /** Called by the editor on every document change. */
  onDocChange() {
    if (!this.project) return;
    this.project.modified = Date.now();
    if (!this.dirty) {
      this.dirty = true;
      this.updateTitle();
    }
    this.scheduleLayout();
    this.scheduleAutosave();
    this.emitSoon(400);
  }

  /** Mark non-text project data (scene meta, characters, notes…) as changed. */
  touch() {
    if (!this.project) return;
    this.project.modified = Date.now();
    this.dirty = true;
    this.updateTitle();
    this.scheduleAutosave();
    this.pushDecorations();
    this.emit();
  }

  // ------------------------------------------------------------------ layout
  scheduleLayout(ms = 300) {
    clearTimeout(this.layoutTimer);
    this.layoutTimer = setTimeout(() => this.computeLayout(), ms);
  }

  computeLayout(): Layout | null {
    if (!this.project) return null;
    const p = this.project;
    const els = this.elements();
    const t0 = performance.now();
    this.layout = paginate(els, getTemplate(p.settings.template), {
      measurer: this.measurer,
      layers: p.settings.layers,
      settings: p.settings,
      lockedPages: p.revision.pagesLocked ? p.revision.lockedPages : undefined,
    });
    (this as any).lastLayoutMs = performance.now() - t0;
    this.pushDecorations();
    this.emitSoon(50);
    return this.layout;
  }

  /** Layout for export (uses export layers instead of on-screen layers). */
  exportLayout(layers?: { roman: boolean; meaning: boolean }): Layout {
    const p = this.sync();
    return paginate(p.elements, getTemplate(p.settings.template), {
      measurer: this.measurer,
      layers: layers || p.settings.exportLayers,
      settings: p.settings,
      lockedPages: p.revision.pagesLocked ? p.revision.lockedPages : undefined,
    });
  }

  decoConfig(): DecoConfig | null {
    if (!this.project) return null;
    const p = this.project;
    const colors: Record<string, string | undefined> = {};
    const tags: Record<string, string[] | undefined> = {};
    for (const [id, m] of Object.entries(p.scenes)) {
      colors[id] = m.color;
      tags[id] = m.tags;
    }
    return {
      layout: this.layout,
      mode: prefs.mode,
      template: getTemplate(p.settings.template),
      sceneNumbers: p.settings.sceneNumbers,
      autoContd: p.settings.autoContd,
      layers: p.settings.layers,
      focusMode: prefs.focusMode,
      revisionMarks: true,
      find: this.find.hits.map((h, i) => ({ ...h, current: i === this.find.index })),
      sceneColors: colors,
      sceneTags: tags,
      onEditBlock: (id) => this.openDialog('block', { id }),
      onMeaning: (id, meaning) => this.setElementAttrs(id, { meaning: meaning || null }),
    };
  }

  pushDecorations() {
    const cfg = this.decoConfig();
    if (!cfg || !this.view) return;
    const tr = this.view.state.tr.setMeta(decoKey, cfg).setMeta('addToHistory', false);
    this.view.dispatch(tr);
  }

  setElementAttrs(id: string, attrs: Record<string, unknown>) {
    const v = this.view;
    if (!v) return;
    let found = -1;
    v.state.doc.forEach((n, pos) => {
      if (n.attrs.id === id) found = pos;
    });
    if (found < 0) return;
    const n = v.state.doc.nodeAt(found)!;
    v.dispatch(v.state.tr.setNodeMarkup(found, undefined, { ...n.attrs, ...attrs }));
  }

  // ------------------------------------------------------------------ dialogs
  openDialog(kind: string, data?: any) {
    this.dialog = { kind, data };
    this.emit();
  }
  closeDialog() {
    this.dialog = null;
    this.emit();
    this.view?.focus();
  }
  setMain(m: MainView) {
    this.main = m;
    this.emit();
    if (m === 'script') setTimeout(() => this.view?.focus(), 0);
  }

  // ------------------------------------------------------------------ saving
  async packCurrent(): Promise<Uint8Array> {
    const p = this.sync();
    return packProject(p);
  }

  scheduleAutosave() {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.autosave(), Math.max(1, prefs.autosaveSeconds) * 1000);
  }

  /** Autosave: recovery copy always; the real file too when it has one. */
  async autosave() {
    if (!this.project || this.saving) return;
    try {
      const data = await this.packCurrent();
      const p = this.project;
      let wroteFile = false;
      if (this.target && (this.target.path || this.target.handle) && platform.canSaveInPlace) {
        wroteFile = await platform.write(this.target, data);
        if (wroteFile) {
          this.dirty = false;
          this.lastSaved = Date.now();
        }
      }
      await platform.writeRecovery(
        { projectId: p.id, name: this.fileName, time: Date.now(), unsaved: !wroteFile && this.dirty, path: this.target?.path },
        data,
      );
      if (Date.now() - this.lastBackup > 5 * 60 * 1000) {
        await platform.writeBackup(p.id, this.fileName, data);
        this.lastBackup = Date.now();
      }
      this.maybeAutoSnapshot();
      this.updateTitle();
      this.emit();
    } catch (e) {
      console.error('autosave failed', e);
      this.toast('Autosave failed: ' + (e as Error).message, 'error', 6000);
    }
  }

  /** Automatic snapshot for version history every 30 minutes of work. */
  maybeAutoSnapshot() {
    const p = this.project!;
    const last = p.snapshots.filter((s) => s.auto).sort((a, b) => b.created - a.created)[0];
    if (!last || Date.now() - last.created > 30 * 60 * 1000) {
      this.snapshot(`Auto ${new Date().toLocaleString('en-IN')}`, true);
    }
  }

  snapshot(name: string, auto = false) {
    const p = this.sync();
    p.snapshots.push({ id: uid('v'), name, created: Date.now(), auto, elements: cloneElements(p.elements), titlePage: { ...p.titlePage } });
    // keep at most 40 auto snapshots
    const autos = p.snapshots.filter((s) => s.auto).sort((a, b) => a.created - b.created);
    while (autos.length > 40) {
      const old = autos.shift()!;
      p.snapshots = p.snapshots.filter((s) => s !== old);
    }
    if (!auto) this.touch();
  }

  async save(): Promise<boolean> {
    if (!this.project) return false;
    if (!this.target || (!this.target.path && !this.target.handle) || !platform.canSaveInPlace) return this.saveAs();
    this.saving = true;
    this.emit();
    try {
      const data = await this.packCurrent();
      const ok = await platform.write(this.target, data);
      if (!ok) return this.saveAs();
      await this.afterSave(data);
      return true;
    } finally {
      this.saving = false;
      this.emit();
    }
  }

  async saveAs(): Promise<boolean> {
    if (!this.project) return false;
    const data = await this.packCurrent();
    const name = (this.project.titlePage.title || 'Untitled').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Untitled';
    const t = await platform.saveAs(name + '.katha', data, '.katha', 'application/x-katha-studio');
    if (!t) return false;
    this.target = t.handle || t.path ? t : null;
    this.fileName = t.name;
    await this.afterSave(data);
    return true;
  }

  private async afterSave(data: Uint8Array) {
    const p = this.project!;
    this.dirty = !this.target; // a plain download doesn't keep a live file
    if (!this.target) this.dirty = false;
    this.lastSaved = Date.now();
    await platform.writeBackup(p.id, this.fileName, data);
    this.lastBackup = Date.now();
    await platform.writeRecovery({ projectId: p.id, name: this.fileName, time: Date.now(), unsaved: false, path: this.target?.path }, data);
    await platform.addRecent({ name: this.fileName, path: this.target?.path, projectId: p.id, time: Date.now(), library: !this.target?.path });
    this.updateTitle();
    this.toast('Saved ' + this.fileName, 'ok', 2000);
  }

  async downloadBackup() {
    if (!this.project) return;
    const data = await this.packCurrent();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    await platform.exportFile(`${this.fileName.replace(/\.katha$/, '')}-backup-${stamp}.katha`, data, 'application/x-katha-studio');
  }

  async openData(name: string, data: Uint8Array, target: SaveTarget | null) {
    const { importAny } = await import('../core/import');
    const res = await importAny(name, data);
    if (res.kind === 'katha') {
      this.loadProject(res.project, target, name);
      await platform.addRecent({ name, path: target?.path, projectId: res.project.id, time: Date.now(), library: !target?.path });
    } else {
      // imported formats open as a new untitled project
      this.loadProject(res.project, null, name.replace(/\.[^.]+$/, '') + '.katha');
      this.dirty = true;
      this.updateTitle();
      this.toast(`Imported ${name}`, 'ok');
    }
  }

  async recoverProject(projectId: string) {
    const data = await platform.readRecovery(projectId);
    if (!data) return;
    const p = await unpackProject(data);
    const list = await platform.listRecovery();
    const e = list.find((x) => x.projectId === projectId);
    this.loadProject(p, e?.path ? { name: e.name, path: e.path } : null, e?.name || 'Recovered.katha');
    this.dirty = true;
    this.updateTitle();
  }

  savePrefs() {
    savePrefs();
    this.pushDecorations();
    this.emit();
  }
}

function countWords(els: ScriptElement[]) {
  let n = 0;
  for (const e of els) n += (e.text.match(/\S+/g) || []).length;
  return n;
}

export const store = new Store();
(globalThis as any).__katha = store;
