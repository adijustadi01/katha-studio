import { undo, redo } from 'prosemirror-history';
import { toggleMark } from 'prosemirror-commands';
import { TextSelection } from 'prosemirror-state';
import { store, MainView } from './store';
import { prefs } from './prefs';
import { platform } from '../platform';
import { setElementType, makeDual, clearDual, currentElement } from '../editor/commands';
import { schema } from '../editor/schema';
import { setPhoneticLang, getPhoneticLang } from '../editor/phonetic';
import { exportFormat, exportPDF, printScript } from './exporter';
import { sampleProject } from '../core/sample';
import { transliterate, romanize, IndicLang } from '../core/translit';
import { lockSceneNumbers, unlockSceneNumbers } from '../core/scenes';
import type { ElementType } from '../core/types';
import { docFromElements } from '../editor/schema';
import { t } from '../i18n';
import { setElements } from './scriptops';

export interface Command {
  id: string;
  label: string;
  keys?: string; // display + binding (Mod = Ctrl/Cmd)
  run: () => void | Promise<void>;
  checked?: () => boolean;
  needsProject?: boolean;
}

const cmds = new Map<string, Command>();
function reg(c: Command) {
  cmds.set(c.id, { needsProject: true, ...c });
}
export function command(id: string) {
  return cmds.get(id);
}
export function allCommands() {
  return [...cmds.values()];
}
export async function runCommand(id: string) {
  const c = cmds.get(id);
  if (!c) return;
  if (c.needsProject && !store.project) return;
  try {
    await c.run();
  } catch (e) {
    console.error(e);
    store.toast(`${c.label}: ${(e as Error).message}`, 'error', 7000);
  }
}

const view = () => store.view!;
const exec = (cmd: any) => {
  const v = store.view;
  if (!v) return;
  cmd(v.state, v.dispatch, v);
  v.focus();
};

export function openFileFlow() {
  return platform.open(['.katha', '.fdx', '.fountain', '.spmd', '.txt', '.docx']).then((f) => {
    if (f) return store.openData(f.name, f.data, f.path || f.handle ? { name: f.name, path: f.path, handle: f.handle } : null);
  });
}

/** Replace selected text (or the current element) with a converted version. */
function convertSelection(fn: (s: string) => string) {
  const v = store.view;
  if (!v) return;
  const { from, to, empty } = v.state.selection;
  const tr = v.state.tr;
  if (empty) {
    const cur = currentElement(v.state);
    if (!cur) return;
    const text = cur.node.textContent;
    const out = fn(text);
    if (out !== text) tr.insertText(out, cur.pos + 1, cur.pos + 1 + text.length);
  } else {
    // convert each text run separately to keep marks/element boundaries
    const ranges: { from: number; to: number; text: string }[] = [];
    v.state.doc.nodesBetween(from, to, (n, pos) => {
      if (n.isText) {
        const a = Math.max(from, pos);
        const b = Math.min(to, pos + n.nodeSize);
        ranges.push({ from: a, to: b, text: n.text!.slice(a - pos, b - pos) });
      }
      return true;
    });
    for (const r of ranges.reverse()) {
      const out = fn(r.text);
      if (out !== r.text) tr.insertText(out, r.from, r.to);
    }
  }
  if (tr.docChanged) v.dispatch(tr);
  v.focus();
}

export function setMode(m: 'page' | 'draft' | 'speed') {
  prefs.mode = m;
  store.savePrefs();
}

export function setTypeCmd(type: ElementType) {
  exec(setElementType(type));
}

export function insertElementAtCursor(type: ElementType, text: string, attrs: Record<string, unknown> = {}) {
  const v = store.view;
  if (!v) return;
  const cur = currentElement(v.state);
  const pos = cur ? cur.pos + cur.node.nodeSize : v.state.doc.content.size;
  const node = schema.nodes.element.create({ id: '', type, ...attrs }, text ? schema.text(text) : null);
  const tr = v.state.tr.insert(pos, node);
  tr.setSelection(TextSelection.create(tr.doc, pos + 1 + text.length));
  v.dispatch(tr.scrollIntoView());
  v.focus();
}

// ------------------------------------------------------------------ File
reg({ id: 'file.new', label: t('New'), keys: 'Mod-n', needsProject: false, run: () => store.openDialog('new') });
reg({ id: 'file.open', label: t('Open…'), keys: 'Mod-o', needsProject: false, run: openFileFlow });
reg({ id: 'file.sample', label: t('Open sample screenplay'), needsProject: false, run: () => store.loadProject(sampleProject(), null, 'Theeram (sample).katha') });
reg({ id: 'file.save', label: t('Save'), keys: 'Mod-s', run: () => void store.save() });
reg({ id: 'file.saveAs', label: t('Save As…'), keys: 'Mod-Shift-s', run: () => void store.saveAs() });
reg({ id: 'file.backup', label: t('Download backup'), run: () => store.downloadBackup() });
reg({ id: 'file.backups', label: 'Backups & Recovery…', needsProject: false, run: () => store.openDialog('backups') });
reg({ id: 'file.import', label: t('Import…'), needsProject: false, run: openFileFlow });
reg({ id: 'file.titlePage', label: t('Title Page…'), run: () => store.openDialog('titlepage') });
reg({ id: 'file.exportPdf', label: t('Export PDF…'), keys: 'Mod-Shift-p', run: () => store.openDialog('pdf') });
reg({
  id: 'file.exportActorPdf',
  label: 'Export Bilingual Actor PDF',
  run: () =>
    exportPDF({ titlePage: true, layers: { roman: true, meaning: true }, watermark: '', revisionColors: false, revisionMarks: false }),
});
reg({ id: 'file.exportFdx', label: 'Export Final Draft (.fdx)', run: () => exportFormat('fdx') });
reg({ id: 'file.exportFountain', label: 'Export Fountain', run: () => exportFormat('fountain') });
reg({ id: 'file.exportDocx', label: 'Export Word (.docx)', run: () => exportFormat('docx') });
reg({ id: 'file.exportTxt', label: 'Export Plain Text', run: () => exportFormat('txt') });
reg({ id: 'file.exportHtml', label: 'Export HTML', run: () => exportFormat('html') });
reg({
  id: 'file.print',
  label: t('Print') + '…',
  keys: 'Mod-p',
  run: () => printScript({ titlePage: true, layers: store.project!.settings.exportLayers, watermark: '', revisionColors: false, revisionMarks: true }),
});
reg({
  id: 'file.close',
  label: 'Close Project',
  run: async () => {
    if (store.dirty && !confirm('You have unsaved changes. A recovery copy is kept, but save before closing?\n\nOK = close anyway, Cancel = keep working')) return;
    store.closeProject();
  },
});

// ------------------------------------------------------------------ Edit
reg({ id: 'edit.undo', label: t('Undo'), keys: 'Mod-z', run: () => exec(undo) });
reg({ id: 'edit.redo', label: t('Redo'), keys: 'Mod-y', run: () => exec(redo) });
reg({ id: 'edit.find', label: t('Find & Replace…'), keys: 'Mod-f', run: () => store.openDialog('find') });
reg({ id: 'edit.bold', label: 'Bold', keys: 'Mod-b', run: () => exec(toggleMark(schema.marks.bold)) });
reg({ id: 'edit.italic', label: 'Italic', keys: 'Mod-i', run: () => exec(toggleMark(schema.marks.italic)) });
reg({ id: 'edit.underline', label: 'Underline', keys: 'Mod-u', run: () => exec(toggleMark(schema.marks.underline)) });
reg({ id: 'edit.note', label: 'Add Script Note', keys: 'Mod-Alt-n', run: () => store.openDialog('note') });
reg({ id: 'edit.bookmark', label: 'Toggle Bookmark', keys: 'Mod-Alt-b', run: () => toggleBookmark() });
reg({
  id: 'edit.highlight',
  label: 'Highlight',
  keys: 'Mod-Alt-h',
  run: () => exec(toggleMark(schema.marks.highlight, { color: '#fff59d' })),
});
reg({ id: 'edit.spellAdd', label: 'Custom Dictionary…', run: () => store.openDialog('dictionary') });

// ------------------------------------------------------------------ View
reg({ id: 'view.page', label: t('Page View'), run: () => setMode('page'), checked: () => prefs.mode === 'page' });
reg({ id: 'view.draft', label: t('Draft View'), run: () => setMode('draft'), checked: () => prefs.mode === 'draft' });
reg({ id: 'view.speed', label: t('Speed View'), run: () => setMode('speed'), checked: () => prefs.mode === 'speed' });
reg({ id: 'view.focus', label: t('Focus Mode'), keys: 'Mod-Shift-o', run: () => ((prefs.focusMode = !prefs.focusMode), store.savePrefs()), checked: () => prefs.focusMode });
reg({ id: 'view.typewriter', label: t('Typewriter Scrolling'), run: () => ((prefs.typewriter = !prefs.typewriter), store.savePrefs()), checked: () => prefs.typewriter });
reg({ id: 'view.dark', label: t('Dark Theme'), needsProject: false, run: () => ((prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'), store.savePrefs()), checked: () => prefs.theme === 'dark' });
reg({ id: 'view.zoomIn', label: t('Zoom In'), keys: 'Mod-=', run: () => ((prefs.zoom = Math.min(2.5, +(prefs.zoom + 0.1).toFixed(2))), store.savePrefs()) });
reg({ id: 'view.zoomOut', label: t('Zoom Out'), keys: 'Mod--', run: () => ((prefs.zoom = Math.max(0.5, +(prefs.zoom - 0.1).toFixed(2))), store.savePrefs()) });
reg({ id: 'view.zoomReset', label: 'Actual Size', keys: 'Mod-0', run: () => ((prefs.zoom = 1), store.savePrefs()) });
reg({
  id: 'view.roman',
  label: 'Show Roman Transliteration',
  run: () => {
    const s = store.project!.settings;
    s.layers = { ...s.layers, roman: !s.layers.roman };
    store.touch();
    store.computeLayout();
  },
  checked: () => !!store.project?.settings.layers.roman,
});
reg({
  id: 'view.meaning',
  label: 'Show English Meaning',
  run: () => {
    const s = store.project!.settings;
    s.layers = { ...s.layers, meaning: !s.layers.meaning };
    store.touch();
    store.computeLayout();
  },
  checked: () => !!store.project?.settings.layers.meaning,
});
reg({ id: 'view.sidebar', label: 'Toggle Sidebar', keys: 'Mod-\\', run: () => ((prefs.sidebar = prefs.sidebar ? null : 'navigator'), store.savePrefs()) });
reg({ id: 'view.rightpanel', label: 'Toggle Right Panel', keys: 'Mod-Shift-\\', run: () => ((prefs.rightPanel = prefs.rightPanel ? null : 'scene'), store.savePrefs()) });
const mainViews: [MainView, string, string?][] = [
  ['script', 'Script'],
  ['cards', t('Index Cards'), 'Mod-Shift-2'],
  ['beats', t('Beat Board')],
  ['outline', t('Outline'), 'Mod-Shift-3'],
  ['tracks', t('Story Tracks')],
  ['pulse', t('Pulse Chart')],
  ['punches', t('Punch Library')],
  ['reports', t('Reports')],
  ['stripboard', t('Stripboard')],
];
for (const [m, label, keys] of mainViews)
  reg({ id: 'view.main.' + m, label, keys: m === 'script' ? 'Mod-Shift-1' : keys, run: () => store.setMain(m), checked: () => store.main === m });

// ------------------------------------------------------------------ Format
const types: [ElementType, string][] = [
  ['scene', t('Scene Heading')],
  ['action', t('Action')],
  ['character', t('Character')],
  ['parenthetical', t('Parenthetical')],
  ['dialogue', t('Dialogue')],
  ['transition', t('Transition')],
  ['shot', t('Shot')],
  ['song', t('Song')],
  ['general', t('General')],
  ['centered', t('Centered')],
  ['act', t('Act Break')],
  ['interval', t('Interval')],
  ['fight', t('Fight Block')],
  ['montage', 'Montage / Flashback / Intercut'],
];
const digitKeys: Record<string, string> = { scene: '1', action: '2', character: '3', parenthetical: '4', dialogue: '5', transition: '6', shot: '7', song: '8', general: '9' };
const extraKeys: Record<string, string> = { interval: 'Mod-Shift-i', fight: 'Mod-Shift-f', montage: 'Mod-Shift-m', centered: 'Mod-Shift-e', act: 'Mod-Shift-a' };
for (const [ty, label] of types) reg({ id: 'format.' + ty, label, keys: digitKeys[ty] ? 'Mod-' + digitKeys[ty] : extraKeys[ty], run: () => setTypeCmd(ty) });
reg({ id: 'format.dual', label: 'Dual Dialogue', keys: 'Mod-d', run: () => exec(makeDual) });
reg({ id: 'format.undual', label: 'Remove Dual Dialogue', run: () => exec(clearDual) });
reg({ id: 'format.templates', label: 'Page Format & Templates…', run: () => store.openDialog('templates') });
reg({ id: 'format.pageBreak', label: 'Force Page Break Before', run: () => togglePageBreak() });

// ------------------------------------------------------------------ Script
reg({ id: 'script.sceneNumbers', label: 'Scene Numbers…', run: () => store.openDialog('settings', { tab: 'script' }) });
reg({
  id: 'script.lockScenes',
  label: 'Lock Scene Numbers',
  run: () => {
    const els = store.elements().map((e) => ({ ...e }));
    lockSceneNumbers(els);
    applyElements(els);
    store.project!.revision.scenesLocked = true;
    store.touch();
    store.toast('Scene numbers locked. New scenes will get A/B numbers.', 'ok');
  },
  checked: () => !!store.project?.revision.scenesLocked,
});
reg({
  id: 'script.unlockScenes',
  label: 'Unlock & Renumber Scenes',
  run: () => {
    if (!confirm('Renumber all scenes from 1? Locked numbers (including A/B numbers) will be lost.')) return;
    const els = store.elements().map((e) => ({ ...e }));
    unlockSceneNumbers(els);
    applyElements(els);
    store.project!.revision.scenesLocked = false;
    store.touch();
  },
});
reg({ id: 'script.omit', label: 'Omit Scene', run: () => omitScene() });
reg({ id: 'script.revisions', label: t('Revisions') + '…', run: () => store.openDialog('revisions') });
reg({ id: 'script.versions', label: t('Version History…'), run: () => store.openDialog('versions') });
reg({ id: 'script.snapshot', label: 'Save Named Draft…', run: () => store.openDialog('snapshot') });
reg({ id: 'script.toTamil', label: 'Convert Selection: Tanglish → Tamil', run: () => convertSelection((s) => transliterate(s, 'ta')) });
reg({ id: 'script.toTelugu', label: 'Convert Selection: Tenglish → Telugu', run: () => convertSelection((s) => transliterate(s, 'te')) });
reg({ id: 'script.toHindi', label: 'Convert Selection: Roman → Hindi', run: () => convertSelection((s) => transliterate(s, 'hi')) });
reg({ id: 'script.toMalayalam', label: 'Convert Selection: Manglish → Malayalam', run: () => convertSelection((s) => transliterate(s, 'ml')) });
reg({ id: 'script.toKannada', label: 'Convert Selection: Roman → Kannada', run: () => convertSelection((s) => transliterate(s, 'kn')) });
reg({ id: 'script.toRoman', label: 'Convert Selection: Native → Roman', run: () => convertSelection((s) => romanize(s)) });
const phon: [IndicLang | null, string][] = [
  [null, 'Phonetic Typing: Off (English)'],
  ['ta', 'Phonetic Typing: Tamil'],
  ['te', 'Phonetic Typing: Telugu'],
  ['hi', 'Phonetic Typing: Hindi'],
  ['ml', 'Phonetic Typing: Malayalam'],
  ['kn', 'Phonetic Typing: Kannada'],
];
for (const [l, label] of phon)
  reg({ id: 'script.phonetic.' + (l || 'off'), label, run: () => (setPhoneticLang(l), store.emit()), checked: () => getPhoneticLang() === l });
reg({
  id: 'script.phoneticToggle',
  label: 'Toggle Phonetic Typing',
  keys: 'Ctrl-Space',
  run: () => {
    const cur = getPhoneticLang();
    if (cur) {
      (store as any).lastPhonetic = cur;
      setPhoneticLang(null);
    } else setPhoneticLang((store as any).lastPhonetic || 'ta');
    store.emit();
  },
});
for (const [l, name] of [['auto', 'Auto-detect'], ['en', 'English'], ['ta', 'Tamil'], ['te', 'Telugu'], ['hi', 'Hindi'], ['ml', 'Malayalam'], ['kn', 'Kannada']] as const)
  reg({
    id: 'script.lang.' + l,
    label: 'Element Language: ' + name,
    run: () => {
      const v = view();
      const cur = currentElement(v.state);
      if (cur) v.dispatch(v.state.tr.setNodeMarkup(cur.pos, undefined, { ...cur.node.attrs, lang: l === 'auto' ? null : l }));
    },
    checked: () => {
      const st = store.view?.state;
      const cur = st && currentElement(st);
      return !!cur && (cur.node.attrs.lang || 'auto') === l;
    },
  });
reg({ id: 'script.characters', label: t('Characters'), run: () => ((prefs.sidebar = 'characters'), store.savePrefs()) });
reg({ id: 'script.locations', label: t('Locations'), run: () => ((prefs.sidebar = 'locations'), store.savePrefs()) });
reg({ id: 'script.notes', label: t('Notes'), run: () => ((prefs.sidebar = 'notes'), store.savePrefs()) });
reg({ id: 'script.settings', label: 'Script Settings…', run: () => store.openDialog('settings', { tab: 'script' }) });

// ------------------------------------------------------------------ Production
reg({ id: 'prod.tag', label: 'Tag Selection for Breakdown', keys: 'Mod-Alt-t', run: () => ((prefs.rightPanel = 'breakdown'), store.savePrefs()) });
reg({ id: 'prod.sheets', label: 'Breakdown Sheets…', run: () => store.openDialog('report', { kind: 'breakdown' }) });
reg({ id: 'prod.oneliner', label: t('One-Liner') + '…', run: () => store.openDialog('report', { kind: 'oneliner' }) });
reg({ id: 'prod.reports', label: t('Reports'), run: () => store.setMain('reports') });
reg({ id: 'prod.stripboard', label: t('Stripboard'), run: () => store.setMain('stripboard') });
reg({ id: 'prod.pulse', label: t('Pulse Chart'), run: () => store.setMain('pulse') });
reg({ id: 'prod.songs', label: 'Songs Report', run: () => store.openDialog('report', { kind: 'songs' }) });
reg({ id: 'prod.fights', label: 'Fights Report', run: () => store.openDialog('report', { kind: 'fights' }) });
reg({ id: 'prod.punches', label: t('Punch Library'), run: () => store.setMain('punches') });

// ------------------------------------------------------------------ Tools
reg({ id: 'tools.ai', label: t('AI Assistant'), keys: 'Mod-Shift-k', run: () => ((prefs.rightPanel = 'ai'), store.savePrefs()) });
reg({ id: 'tools.writing', label: 'Goals, Sprint & Stats', run: () => ((prefs.rightPanel = 'writing'), store.savePrefs()) });
reg({ id: 'tools.readAloud', label: t('Read Aloud') + '…', run: () => store.openDialog('readaloud') });
reg({ id: 'tools.settings', label: t('Settings') + '…', keys: 'Mod-,', needsProject: false, run: () => store.openDialog('settings') });
reg({ id: 'tools.shortcuts', label: 'Keyboard Shortcuts…', needsProject: false, run: () => store.openDialog('shortcuts') });

// ------------------------------------------------------------------ Help
reg({ id: 'help.manual', label: t('User Manual'), keys: 'F1', needsProject: false, run: () => store.openDialog('help') });
reg({ id: 'help.tutorial', label: t('Tutorial'), needsProject: false, run: () => store.openDialog('tutorial') });
reg({ id: 'help.about', label: 'About Katha Studio', needsProject: false, run: () => store.openDialog('about') });
reg({ id: 'help.updates', label: 'Check for Updates', needsProject: false, run: () => (platform.checkForUpdates ? platform.checkForUpdates() : store.toast('The web app updates itself automatically.')) });

// ------------------------------------------------------------------ helpers
export function applyElements(els: import('../core/types').ScriptElement[]) {
  setElements(els, true);
}

function togglePageBreak() {
  const v = view();
  const cur = currentElement(v.state);
  if (!cur) return;
  v.dispatch(v.state.tr.setNodeMarkup(cur.pos, undefined, { ...cur.node.attrs, pageBreak: !cur.node.attrs.pageBreak }));
}

function omitScene() {
  const v = view();
  const cur = currentElement(v.state);
  if (!cur) return;
  // find the scene heading at or before the cursor
  let pos = -1;
  let node: any = null;
  v.state.doc.forEach((n, p, i) => {
    if (i <= cur.index && n.attrs.type === 'scene') {
      pos = p;
      node = n;
    }
  });
  if (pos < 0) return;
  v.dispatch(v.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, omitted: !node.attrs.omitted }));
  store.toast(node.attrs.omitted ? 'Scene restored' : 'Scene marked OMITTED (its number is kept)', 'ok');
}

function toggleBookmark() {
  const v = view();
  const cur = currentElement(v.state);
  if (!cur) return;
  const p = store.project!;
  const bm = ((p as any).bookmarks ||= []) as string[];
  const i = bm.indexOf(cur.node.attrs.id);
  if (i >= 0) bm.splice(i, 1);
  else bm.push(cur.node.attrs.id);
  store.touch();
  store.toast(i >= 0 ? 'Bookmark removed' : 'Bookmarked — see Navigator ★', 'ok', 1500);
}

/** Global keyboard shortcuts not handled inside the editor. */
export function globalKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  const combo = [mod ? 'Mod' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', e.key.length === 1 ? e.key.toLowerCase() : e.key].filter(Boolean).join('-');
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    runCommand('script.phoneticToggle');
    return;
  }
  const custom = prefs.shortcuts;
  for (const c of cmds.values()) {
    const keys = custom[c.id] || c.keys;
    if (!keys) continue;
    if (normalize(keys) === normalize(combo)) {
      // editor handles element shortcuts/undo/marks itself when focused
      const inEditor = store.view?.hasFocus();
      if (inEditor && (c.id.startsWith('format.') || c.id.startsWith('edit.undo') || c.id.startsWith('edit.redo') || ['edit.bold', 'edit.italic', 'edit.underline'].includes(c.id)) && !custom[c.id]) return;
      e.preventDefault();
      runCommand(c.id);
      return;
    }
  }
}
function normalize(k: string) {
  return k
    .toLowerCase()
    .split('-')
    .filter(Boolean)
    .sort()
    .join('-')
    .replace('shift-shift', 'shift');
}
