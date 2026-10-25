import type { ViewMode } from '../editor/decorations';
import type { Template } from '../core/templates';

export interface Prefs {
  theme: 'light' | 'dark';
  mode: ViewMode;
  zoom: number;
  focusMode: boolean;
  typewriter: boolean;
  sidebar: 'navigator' | 'cards' | 'characters' | 'locations' | 'notes' | null;
  rightPanel: 'scene' | 'breakdown' | 'ai' | 'writing' | null;
  author: string;
  noteColor: string;
  aiModel: string;
  goalType: 'pages' | 'words';
  goalAmount: number;
  customTemplates: Template[];
  shortcuts: Record<string, string>;
  tutorialDone: boolean;
  autosaveSeconds: number;
  spellWords: string[];
  /** desktop on Windows/Linux: use the operating system's menu bar instead of the built-in one */
  systemMenuBar: boolean;
  speechRate: number;
}

const DEFAULTS: Prefs = {
  theme: 'light',
  mode: 'page',
  zoom: 1,
  focusMode: false,
  typewriter: false,
  sidebar: 'navigator',
  rightPanel: 'scene',
  author: 'Writer',
  noteColor: '#ffd54f',
  aiModel: 'claude-opus-5-5',
  goalType: 'pages',
  goalAmount: 3,
  customTemplates: [],
  shortcuts: {},
  tutorialDone: false,
  autosaveSeconds: 3,
  spellWords: [],
  systemMenuBar: false,
  speechRate: 1,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem('katha.prefs');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export const prefs: Prefs = load();
// phones start with the script full screen; the side panels open as drawers
if (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 700px)').matches) {
  prefs.sidebar = null;
  prefs.rightPanel = null;
}

export function savePrefs() {
  try {
    localStorage.setItem('katha.prefs', JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
