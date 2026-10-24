import type { ScriptElement, ScriptSettings } from './types';
import type { Layout } from './paginate';
import { runtimeMinutes } from './paginate';
import { getScenes, SceneInfo } from './scenes';

export interface HalfStats {
  pages: number; // fractional
  minutes: number;
}

/** Position of the interval as a fractional page number. */
export function intervalPosition(els: ScriptElement[], layout: Layout): number | null {
  const iv = els.find((e) => e.type === 'interval');
  if (!iv) return null;
  for (const p of layout.pages) {
    const ln = p.lines.find((l) => l.elId === iv.id);
    if (ln) return p.index + ln.y / layout.contentHeight;
  }
  return null;
}

export function halves(els: ScriptElement[], layout: Layout, settings: ScriptSettings): { hasInterval: boolean; first: HalfStats; second: HalfStats } {
  const pos = intervalPosition(els, layout);
  const total = layout.pages.length ? layout.pages.length - 1 + layout.pages[layout.pages.length - 1].used / layout.contentHeight : 0;
  const totalMin = runtimeMinutes(layout, settings);
  if (pos === null) return { hasInterval: false, first: { pages: round1(total), minutes: totalMin }, second: { pages: 0, minutes: 0 } };
  const ratio = total ? pos / total : 0;
  return {
    hasInterval: true,
    first: { pages: round1(pos), minutes: totalMin * ratio },
    second: { pages: round1(total - pos), minutes: totalMin * (1 - ratio) },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface SceneStat extends SceneInfo {
  page: number; // 1-based start page
  pageLabel: string;
  eighths: number;
  minutes: number;
  half: 1 | 2;
}

/** Scene list with page numbers and lengths (in eighths of a page). */
export function sceneStats(els: ScriptElement[], layout: Layout | null, settings: ScriptSettings): SceneStat[] {
  const scenes = getScenes(els);
  const ivIdx = els.findIndex((e) => e.type === 'interval');
  const heights = new Map<string, number>();
  if (layout) {
    // accumulate rendered height per element id
    const hByEl = new Map<string, number>();
    for (const p of layout.pages) for (const l of p.lines) if (l.elId) hByEl.set(l.elId, (hByEl.get(l.elId) || 0) + l.h);
    for (const s of scenes) {
      let h = 0;
      for (let i = s.start; i < s.end; i++) h += (hByEl.get(els[i].id) || 0) + 12;
      heights.set(s.id, h);
    }
  }
  return scenes.map((s) => {
    const page = layout ? (layout.elementPage.get(s.id) ?? 0) : 0;
    const h = heights.get(s.id) || s.chars / 4;
    const eighths = layout ? Math.max(1, Math.round((h / layout.contentHeight) * 8)) : 1;
    return {
      ...s,
      page: page + 1,
      pageLabel: layout?.pages[page]?.label || String(page + 1),
      eighths,
      minutes: (eighths / 8) * settings.screenTimePerPage,
      half: ivIdx >= 0 && s.start > ivIdx ? 2 : 1,
    };
  });
}
