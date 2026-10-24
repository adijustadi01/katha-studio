import type { ScriptElement } from './types';
import { characterName, parseHeading, ParsedHeading } from './elements';

export interface SceneInfo {
  id: string; // heading element id
  index: number; // 0-based scene index
  number: string; // display number e.g. "12" or "12A"
  heading: string;
  parsed: ParsedHeading;
  start: number; // element index of heading
  end: number; // exclusive element index
  characters: string[];
  omitted: boolean;
  /** characters of text (rough length measure) */
  chars: number;
}

/** Scene boundaries are scene-heading elements. Content before the first heading is ignored. */
export function getScenes(els: ScriptElement[]): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  let cur: SceneInfo | null = null;
  const numbers = sceneNumbers(els);
  els.forEach((e, i) => {
    if (e.type === 'scene') {
      if (cur) cur.end = i;
      cur = {
        id: e.id,
        index: scenes.length,
        number: numbers.get(e.id) || String(scenes.length + 1),
        heading: e.text,
        parsed: parseHeading(e.text),
        start: i,
        end: els.length,
        characters: [],
        omitted: !!e.omitted,
        chars: 0,
      };
      scenes.push(cur);
    } else if (cur) {
      cur.chars += e.text.length;
      if (e.type === 'character') {
        const n = characterName(e.text);
        if (n && !cur.characters.includes(n)) cur.characters.push(n);
      }
    }
  });
  return scenes;
}

/**
 * Scene numbering. Unlocked headings are numbered sequentially. Locked
 * numbers (sceneNo) are kept; new scenes inserted after a locked scene get
 * letter suffixes (12A, 12B ...), as is standard for production drafts.
 */
export function sceneNumbers(els: ScriptElement[]): Map<string, string> {
  const map = new Map<string, string>();
  const anyLocked = els.some((e) => e.type === 'scene' && e.sceneNo);
  let n = 0;
  if (!anyLocked) {
    for (const e of els) if (e.type === 'scene') map.set(e.id, String(++n));
    return map;
  }
  let lastLocked = '0';
  let suffix = 0;
  for (const e of els) {
    if (e.type !== 'scene') continue;
    if (e.sceneNo) {
      lastLocked = e.sceneNo;
      suffix = 0;
      map.set(e.id, e.sceneNo);
    } else {
      suffix++;
      const base = lastLocked === '0' ? 'A' : lastLocked;
      map.set(e.id, lastLocked === '0' ? `${String.fromCharCode(64 + suffix)}1` : base + String.fromCharCode(64 + suffix));
    }
  }
  return map;
}

/** Lock current scene numbers (writes sceneNo on every heading). */
export function lockSceneNumbers(els: ScriptElement[]) {
  const nums = sceneNumbers(els);
  for (const e of els) if (e.type === 'scene') e.sceneNo = nums.get(e.id);
}

export function unlockSceneNumbers(els: ScriptElement[]) {
  for (const e of els) delete e.sceneNo;
}

/**
 * Characters that get an automatic (CONT'D): the same character speaks again
 * in the same scene with only action in between.
 */
export function contdSet(els: ScriptElement[]): Set<string> {
  const out = new Set<string>();
  let last = '';
  for (const e of els) {
    if (e.type === 'scene' || e.type === 'transition' || e.type === 'act' || e.type === 'interval' || e.type === 'song') {
      last = '';
    } else if (e.type === 'character') {
      const n = characterName(e.text);
      if (n && n === last && !/CONT'?D/i.test(e.text) && !e.dual) out.add(e.id);
      last = n;
    } else if (e.type === 'action' || e.type === 'dialogue' || e.type === 'parenthetical' || e.type === 'shot') {
      // keep last
    }
  }
  return out;
}

export function allCharacters(els: ScriptElement[]): string[] {
  const set = new Map<string, number>();
  for (const e of els)
    if (e.type === 'character') {
      const n = characterName(e.text);
      if (n) set.set(n, (set.get(n) || 0) + 1);
    }
  return [...set.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

export function allLocations(els: ScriptElement[]): string[] {
  const set = new Set<string>();
  for (const e of els)
    if (e.type === 'scene') {
      const l = parseHeading(e.text).location;
      if (l) set.add(l);
    }
  return [...set];
}

/** Dialogue count per character. */
export function dialogueCounts(els: ScriptElement[]): Map<string, number> {
  const m = new Map<string, number>();
  let cur = '';
  for (const e of els) {
    if (e.type === 'character') cur = characterName(e.text);
    else if (e.type === 'dialogue' && cur) m.set(cur, (m.get(cur) || 0) + 1);
    else if (e.type !== 'parenthetical') cur = '';
  }
  return m;
}

export function wordCount(els: ScriptElement[]): number {
  let n = 0;
  for (const e of els) n += (e.text.match(/\S+/g) || []).length;
  return n;
}

/** Index of the interval element, or -1 */
export function intervalIndex(els: ScriptElement[]): number {
  return els.findIndex((e) => e.type === 'interval');
}
