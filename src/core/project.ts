import type { Project, ScriptElement, ScriptSettings, TitlePage, ElementType } from './types';

let counter = 0;
export function uid(prefix = 'e'): string {
  counter = (counter + 1) % 1679616;
  return (
    prefix +
    Date.now().toString(36).slice(-5) +
    Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0') +
    counter.toString(36)
  );
}

export function el(type: ElementType, text = '', extra: Partial<ScriptElement> = {}): ScriptElement {
  return { id: uid(), type, text, ...extra };
}

export function defaultSettings(): ScriptSettings {
  return {
    template: 'indian-a4',
    sceneNumbers: 'none',
    autoContd: true,
    showMoreContd: true,
    continuedHeaders: false,
    layers: { roman: true, meaning: true },
    exportLayers: { roman: false, meaning: false },
    screenTimePerPage: 1,
    indicScreenTimeFactor: 1,
    pulseGapMinutes: 12,
    defaultLang: 'en',
    indicFontStyle: 'sans',
  };
}

export function emptyTitlePage(): TitlePage {
  return {
    title: 'Untitled Screenplay',
    credit: 'Written by',
    author: '',
    basedOn: '',
    contact: '',
    draft: 'First Draft',
    date: new Date().toLocaleDateString('en-IN'),
    registration: '',
    notes: '',
  };
}

export function newProject(elements?: ScriptElement[]): Project {
  const now = Date.now();
  return {
    version: 1,
    id: uid('p'),
    titlePage: emptyTitlePage(),
    elements: elements && elements.length ? elements : [el('scene', ''), ],
    settings: defaultSettings(),
    scenes: {},
    characters: {},
    locations: {},
    notes: [],
    tracks: [
      { id: 'A', name: 'A Story', color: '#e53935' },
      { id: 'B', name: 'B Story', color: '#1e88e5' },
      { id: 'C', name: 'C Story', color: '#43a047' },
    ],
    beats: [],
    punches: [],
    breakdown: [],
    schedule: [],
    revision: {
      active: false,
      color: 0,
      label: 'White Draft',
      date: new Date().toISOString().slice(0, 10),
      pagesLocked: false,
      scenesLocked: false,
    },
    snapshots: [],
    assets: {},
    created: now,
    modified: now,
  };
}

/** Fill in fields that may be missing in files written by older versions. */
export function normalizeProject(p: Partial<Project>): Project {
  const base = newProject();
  const out: Project = { ...base, ...p } as Project;
  out.settings = { ...base.settings, ...(p.settings || {}) };
  out.settings.layers = { ...base.settings.layers, ...(p.settings?.layers || {}) };
  out.settings.exportLayers = { ...base.settings.exportLayers, ...(p.settings?.exportLayers || {}) };
  out.titlePage = { ...base.titlePage, ...(p.titlePage || {}) };
  out.revision = { ...base.revision, ...(p.revision || {}) };
  if (!out.elements || !out.elements.length) out.elements = [el('scene', '')];
  for (const e of out.elements) if (!e.id) e.id = uid();
  return out;
}

export function cloneElements(els: ScriptElement[]): ScriptElement[] {
  return els.map((e) => JSON.parse(JSON.stringify(e)));
}
