// Pulse Chart: an "energy" curve across the script for commercial pacing.
import type { Project, ScriptElement } from './types';
import { SCENE_TAGS } from './types';
import type { Layout } from './paginate';
import { sceneStats } from './stats';
import { durSec } from './reports';

export interface PulsePoint {
  sceneId: string;
  number: string;
  heading: string;
  start: number; // minutes from start
  end: number;
  energy: number; // 0..10
  kinds: string[]; // tag ids + 'song' | 'fight'
  half: 1 | 2;
}

export interface PulseResult {
  points: PulsePoint[];
  total: number;
  interval: number | null; // minutes
  gaps: { from: number; to: number }[];
  counts: { half: 1 | 2; counts: Record<string, number> }[];
}

export const PULSE_KINDS: { id: string; name: string; color: string }[] = [
  ...SCENE_TAGS.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  { id: 'song', name: 'Song', color: '#00bfa5' },
  { id: 'fight', name: 'Fight', color: '#6d4c41' },
];

const HIGH = 8;

export function computePulse(p: Project, els: ScriptElement[], layout: Layout | null): PulseResult {
  const stats = sceneStats(els, layout, p.settings);
  const points: PulsePoint[] = [];
  let t = 0;
  let interval: number | null = null;
  const ivIdx = els.findIndex((e) => e.type === 'interval');
  for (const sc of stats) {
    if (ivIdx >= 0 && interval === null && sc.start > ivIdx) interval = t;
    const meta = p.scenes[sc.id] || {};
    const kinds = [...(meta.tags || [])];
    let extra = 0;
    for (let i = sc.start; i < sc.end; i++) {
      const e = els[i];
      if (e.type === 'song') {
        kinds.push('song');
        extra += durSec(e.song?.duration) / 60 || 4;
      }
      if (e.type === 'fight') {
        kinds.push('fight');
        extra += durSec(e.fight?.duration) / 60 || 3;
      }
    }
    // songs and fights play longer than their page count suggests
    const len = Math.max(sc.minutes, extra);
    let energy = 3;
    for (const k of kinds) {
      const tag = SCENE_TAGS.find((x) => x.id === k);
      const e = tag ? tag.energy : k === 'fight' ? 9 : k === 'song' ? 7 : 3;
      energy = Math.max(energy, e);
    }
    if (meta.energy !== undefined && meta.energy !== null && !isNaN(meta.energy)) energy = meta.energy;
    points.push({ sceneId: sc.id, number: sc.number, heading: sc.heading, start: t, end: t + len, energy, kinds, half: sc.half });
    t += len;
  }
  if (ivIdx >= 0 && interval === null) interval = t;
  // gaps without a high point
  const gaps: { from: number; to: number }[] = [];
  let last = 0;
  for (const pt of points) {
    if (pt.energy >= HIGH) {
      if (pt.start - last > p.settings.pulseGapMinutes) gaps.push({ from: last, to: pt.start });
      last = pt.end;
    }
  }
  if (t - last > p.settings.pulseGapMinutes) gaps.push({ from: last, to: t });
  const counts = ([1, 2] as const).map((half) => {
    const c: Record<string, number> = {};
    for (const pt of points.filter((x) => x.half === half)) for (const k of pt.kinds) c[k] = (c[k] || 0) + 1;
    return { half, counts: c };
  });
  return { points, total: t, interval, gaps, counts };
}
