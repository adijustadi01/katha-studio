import type { ElementType, Lang } from './types';

export interface ElementDef {
  type: ElementType;
  name: string;
  short: string;
  uppercase: boolean;
  /** element created when pressing Enter at the end of this element */
  next: ElementType;
}

export const ELEMENTS: ElementDef[] = [
  { type: 'scene', name: 'Scene Heading', short: 'Scene', uppercase: true, next: 'action' },
  { type: 'action', name: 'Action', short: 'Action', uppercase: false, next: 'action' },
  { type: 'character', name: 'Character', short: 'Char', uppercase: true, next: 'dialogue' },
  { type: 'parenthetical', name: 'Parenthetical', short: 'Paren', uppercase: false, next: 'dialogue' },
  { type: 'dialogue', name: 'Dialogue', short: 'Dial', uppercase: false, next: 'action' },
  { type: 'transition', name: 'Transition', short: 'Trans', uppercase: true, next: 'scene' },
  { type: 'shot', name: 'Shot', short: 'Shot', uppercase: true, next: 'action' },
  { type: 'general', name: 'General', short: 'Gen', uppercase: false, next: 'general' },
  { type: 'centered', name: 'Centered', short: 'Center', uppercase: false, next: 'action' },
  { type: 'act', name: 'Act Break', short: 'Act', uppercase: true, next: 'scene' },
  { type: 'song', name: 'Song', short: 'Song', uppercase: false, next: 'action' },
  { type: 'interval', name: 'Interval', short: 'Interval', uppercase: true, next: 'scene' },
  { type: 'fight', name: 'Fight Block', short: 'Fight', uppercase: false, next: 'action' },
  { type: 'montage', name: 'Montage / Flashback marker', short: 'Marker', uppercase: true, next: 'action' },
];

export const ELEMENT_BY_TYPE: Record<ElementType, ElementDef> = Object.fromEntries(
  ELEMENTS.map((e) => [e.type, e]),
) as Record<ElementType, ElementDef>;

/** Ctrl/Alt + digit shortcuts */
export const DIGIT_SHORTCUTS: ElementType[] = [
  'scene',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'song',
  'general',
];

/** What Enter creates after an element (smart flow). */
export function nextOnEnter(type: ElementType): ElementType {
  return ELEMENT_BY_TYPE[type]?.next ?? 'action';
}

/**
 * Smart Tab: returns the element type a Tab press should switch the current
 * element to, given whether it is empty.
 */
export function tabTarget(type: ElementType, empty: boolean, shift = false): ElementType | null {
  if (shift) {
    switch (type) {
      case 'character':
        return 'action';
      case 'parenthetical':
        return 'dialogue';
      case 'dialogue':
        return 'character';
      case 'transition':
        return 'character';
      default:
        return null;
    }
  }
  switch (type) {
    case 'action':
      return empty ? 'character' : 'character';
    case 'character':
      return empty ? 'transition' : 'parenthetical';
    case 'dialogue':
      return 'parenthetical';
    case 'parenthetical':
      return 'dialogue';
    case 'transition':
      return empty ? 'scene' : null;
    case 'scene':
      return empty ? 'action' : null;
    default:
      return null;
  }
}

/** After Enter on an empty element: cycle like industry tools (empty dialogue → action, etc.) */
export function enterOnEmpty(type: ElementType): ElementType | null {
  switch (type) {
    case 'dialogue':
      return 'action';
    case 'character':
      return 'action';
    case 'parenthetical':
      return 'dialogue';
    case 'action':
      return 'scene';
    default:
      return null;
  }
}

export function isUpper(type: ElementType): boolean {
  return ELEMENT_BY_TYPE[type]?.uppercase ?? false;
}

// ---------------------------------------------------------------- language

const RANGES: [Lang, number, number][] = [
  ['hi', 0x0900, 0x097f],
  ['ta', 0x0b80, 0x0bff],
  ['te', 0x0c00, 0x0c7f],
  ['kn', 0x0c80, 0x0cff],
  ['ml', 0x0d00, 0x0d7f],
];

export function charLang(cp: number): Lang | null {
  for (const [l, a, b] of RANGES) if (cp >= a && cp <= b) return l;
  return null;
}

/** Detect the dominant Indic script in text; 'en' if none. */
export function detectLang(text: string): Lang {
  const counts: Partial<Record<Lang, number>> = {};
  let best: Lang = 'en';
  let max = 0;
  for (const ch of text) {
    const l = charLang(ch.codePointAt(0)!);
    if (!l) continue;
    const c = (counts[l] = (counts[l] || 0) + 1);
    if (c > max) {
      max = c;
      best = l;
    }
  }
  return best;
}

export function hasIndic(text: string): boolean {
  for (const ch of text) if (charLang(ch.codePointAt(0)!)) return true;
  return false;
}

// ---------------------------------------------------------------- scene headings

export const SCENE_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'EXT./INT. ', 'I/E. ', 'EST. '];
export const TIMES = [
  'DAY',
  'NIGHT',
  'CONTINUOUS',
  'LATER',
  'MOMENTS LATER',
  'DAWN',
  'DUSK',
  'MORNING',
  'EVENING',
  'AFTERNOON',
  'EARLY MORNING',
  'LATE NIGHT',
  'MIDNIGHT',
  'SAME TIME',
];
export const EXTENSIONS = ['(V.O.)', '(O.S.)', '(O.C.)', "(CONT'D)", '(PRE-LAP)', '(ON PHONE)', '(FILTERED)'];
export const TRANSITIONS = [
  'CUT TO:',
  'DISSOLVE TO:',
  'MATCH CUT TO:',
  'SMASH CUT TO:',
  'JUMP CUT TO:',
  'FADE IN:',
  'FADE OUT.',
  'FADE TO BLACK.',
  'CUT TO BLACK.',
  'INTERCUT WITH:',
  'BACK TO:',
];

export interface ParsedHeading {
  prefix: string; // INT. / EXT. ...
  location: string;
  time: string;
  ie: 'INT' | 'EXT' | 'INT/EXT' | '';
}

export function parseHeading(text: string): ParsedHeading {
  const t = text.trim().toUpperCase();
  const m = t.match(/^((?:INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\/E|INT|EXT|EST)\.?)\s*(.*)$/);
  let prefix = '';
  let rest = t;
  if (m) {
    prefix = m[1];
    rest = m[2];
  }
  let location = rest;
  let time = '';
  const dash = rest.lastIndexOf(' - ');
  if (dash >= 0) {
    location = rest.slice(0, dash).trim();
    time = rest.slice(dash + 3).trim();
  } else {
    const d2 = rest.lastIndexOf('-');
    if (d2 > 0) {
      location = rest.slice(0, d2).trim();
      time = rest.slice(d2 + 1).trim();
    }
  }
  let ie: ParsedHeading['ie'] = '';
  const p = prefix.replace(/\s/g, '');
  if (/^(INT\.?\/EXT|EXT\.?\/INT|I\/E)/.test(p)) ie = 'INT/EXT';
  else if (p.startsWith('INT')) ie = 'INT';
  else if (p.startsWith('EXT') || p.startsWith('EST')) ie = 'EXT';
  return { prefix, location, time, ie };
}

export function isNightTime(time: string): boolean {
  return /NIGHT|DUSK|EVENING|MIDNIGHT/.test(time.toUpperCase());
}

/** Strip extensions like (V.O.) and (CONT'D) from a character cue. */
export function characterName(cue: string): string {
  return cue
    .replace(/\(.*?\)/g, '')
    .replace(/\^$/, '')
    .trim()
    .toUpperCase();
}
