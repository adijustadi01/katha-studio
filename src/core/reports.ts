// Production reports as plain tables, shared by the on-screen view, PDF and XLSX export.
import type { Project, ScriptElement, ScriptSettings } from './types';
import { BREAKDOWN_CATEGORIES, SCENE_TAGS } from './types';
import type { Layout } from './paginate';
import { formatEighths, formatMinutes } from './paginate';
import { sceneStats, SceneStat } from './stats';
import { characterName, isNightTime } from './elements';
import { dialogueCounts } from './scenes';

export interface Table {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  /** optional relative column widths */
  widths?: number[];
  footer?: string;
}

function sceneDescription(els: ScriptElement[], sc: SceneStat, synopsis?: string): string {
  if (synopsis) return synopsis;
  const a = els.slice(sc.start + 1, sc.end).find((e) => e.type === 'action' && e.text.trim());
  if (!a) return '';
  const first = a.text.split(/(?<=[.!?])\s/)[0];
  return first.length > 140 ? first.slice(0, 137) + '…' : first;
}

function dayNight(time: string): string {
  if (!time) return '';
  if (isNightTime(time)) return 'NIGHT';
  return /DAY|MORNING|AFTERNOON|DAWN|NOON/.test(time) ? 'DAY' : time;
}

export function oneLiner(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  return {
    title: `One-Liner — ${p.titlePage.title}`,
    columns: ['Sc.', 'INT/EXT', 'Location', 'Day/Night', 'Characters', 'Description', 'Pages', 'Half'],
    widths: [5, 7, 18, 8, 20, 32, 6, 4],
    rows: stats.map((sc) => [
      sc.number,
      sc.parsed.ie,
      sc.omitted ? 'OMITTED' : sc.parsed.location,
      dayNight(sc.parsed.time),
      sc.characters.join(', '),
      sc.omitted ? '' : sceneDescription(els, sc, p.scenes[sc.id]?.synopsis),
      formatEighths(sc.eighths),
      sc.half === 2 ? '2nd' : '1st',
    ]),
    footer: `${stats.length} scenes · ${layout?.pages.length || 0} pages`,
  };
}

export function sceneReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  return {
    title: 'Scene report',
    columns: ['Sc.', 'Heading', 'Page', 'Length', 'Est. time', 'Characters', 'Tags', 'Tracks'],
    rows: stats.map((sc) => [
      sc.number,
      sc.heading.toUpperCase(),
      sc.pageLabel,
      formatEighths(sc.eighths),
      formatMinutes(sc.minutes),
      sc.characters.join(', '),
      (p.scenes[sc.id]?.tags || []).map((t) => SCENE_TAGS.find((x) => x.id === t)?.name || t).join(', '),
      (p.scenes[sc.id]?.tracks || []).map((t) => p.tracks.find((x) => x.id === t)?.name || t).join(', '),
    ]),
  };
}

export function characterReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const counts = dialogueCounts(els);
  const names = [...new Set(stats.flatMap((s) => s.characters))];
  const rows = names.map((n) => {
    const sc = stats.filter((s) => s.characters.includes(n));
    const pages = new Set<string>();
    sc.forEach((s) => pages.add(s.pageLabel));
    // pages on which the character speaks
    const speakPages = new Set<number>();
    if (layout) for (const pg of layout.pages) for (const l of pg.lines) if (l.elType === 'character' && characterName(l.text) === n) speakPages.add(pg.index);
    return [n, p.characters[n]?.role || '', counts.get(n) || 0, sc.length, sc.map((s) => s.number).join(', '), speakPages.size, formatEighths(sc.reduce((a, s) => a + s.eighths, 0))];
  });
  rows.sort((a, b) => (b[2] as number) - (a[2] as number));
  return { title: 'Character report', columns: ['Character', 'Role', 'Dialogues', 'Scenes', 'Scene numbers', 'Pages speaking', 'Screen pages'], rows };
}

export function castReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const names = [...new Set(stats.flatMap((s) => s.characters))];
  return {
    title: 'Cast report',
    columns: ['#', 'Character', 'Actor', 'Age', 'First scene', 'Last scene', 'Scenes', 'Day / Night scenes'],
    rows: names.map((n, i) => {
      const sc = stats.filter((s) => s.characters.includes(n));
      const night = sc.filter((s) => isNightTime(s.parsed.time)).length;
      return [i + 1, n, p.characters[n]?.actor || '', p.characters[n]?.age || '', sc[0]?.number || '', sc[sc.length - 1]?.number || '', sc.length, `${sc.length - night} / ${night}`];
    }),
  };
}

export function locationReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const locs = new Map<string, SceneStat[]>();
  for (const s of stats) {
    const k = s.parsed.location || '(none)';
    locs.set(k, [...(locs.get(k) || []), s]);
  }
  return {
    title: 'Location report',
    columns: ['Location', 'INT/EXT', 'Scenes', 'Scene numbers', 'Day', 'Night', 'Pages', 'Notes'],
    rows: [...locs.entries()].map(([l, sc]) => {
      const night = sc.filter((s) => isNightTime(s.parsed.time)).length;
      return [l, [...new Set(sc.map((s) => s.parsed.ie))].join('/'), sc.length, sc.map((s) => s.number).join(', '), sc.length - night, night, formatEighths(sc.reduce((a, s) => a + s.eighths, 0)), p.locations[l]?.notes || ''];
    }),
  };
}

export function dayNightSummary(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const groups = new Map<string, SceneStat[]>();
  for (const s of stats) {
    const k = dayNight(s.parsed.time) || 'UNSPECIFIED';
    groups.set(k, [...(groups.get(k) || []), s]);
  }
  return {
    title: 'Day / Night summary',
    columns: ['Time', 'Scenes', 'Pages', 'Est. time', 'Scene numbers'],
    rows: [...groups.entries()].map(([k, sc]) => [k, sc.length, formatEighths(sc.reduce((a, s) => a + s.eighths, 0)), formatMinutes(sc.reduce((a, s) => a + s.minutes, 0)), sc.map((s) => s.number).join(', ')]),
  };
}

export function intExtSummary(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const groups = new Map<string, SceneStat[]>();
  for (const s of stats) {
    const k = s.parsed.ie || 'UNSPECIFIED';
    groups.set(k, [...(groups.get(k) || []), s]);
  }
  return {
    title: 'Interior / Exterior summary',
    columns: ['INT/EXT', 'Scenes', 'Pages', 'Est. time', 'Scene numbers'],
    rows: [...groups.entries()].map(([k, sc]) => [k, sc.length, formatEighths(sc.reduce((a, s) => a + s.eighths, 0)), formatMinutes(sc.reduce((a, s) => a + s.minutes, 0)), sc.map((s) => s.number).join(', ')]),
  };
}

function sceneOf(stats: SceneStat[], idx: number): SceneStat | undefined {
  return stats.find((s) => idx >= s.start && idx < s.end);
}

export function songsReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const rows: (string | number)[][] = [];
  els.forEach((e, i) => {
    if (e.type !== 'song') return;
    const s = e.song || {};
    const sc = sceneOf(stats, i);
    rows.push([s.number ?? '', s.title || '', sc?.number || '—', s.situation || e.text, s.mood || '', s.singers || '', s.lyricist || '', s.choreography || '', s.location || '', s.duration || '', layout ? (layout.elementPage.get(e.id) ?? 0) + 1 : '']);
  });
  const total = els.filter((e) => e.type === 'song').reduce((a, e) => a + durSec(e.song?.duration), 0);
  return {
    title: 'Songs report',
    columns: ['#', 'Title', 'After scene', 'Situation', 'Mood', 'Singers', 'Lyricist', 'Choreography', 'Location', 'Duration', 'Page'],
    rows,
    footer: `${rows.length} songs · total ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`,
  };
}

export function fightsReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const rows: (string | number)[][] = [];
  els.forEach((e, i) => {
    if (e.type !== 'fight') return;
    const f = e.fight || {};
    const sc = sceneOf(stats, i);
    rows.push([f.number ?? '', sc?.number || '—', f.setting || '', (f.beats || []).map((b, j) => `${j + 1}. ${b}`).join('\n'), f.massMoment || '', f.duration || '', e.text]);
  });
  return { title: 'Fights report', columns: ['#', 'Scene', 'Setting', 'Stunt beats', 'Mass moment', 'Duration', 'Notes'], rows };
}

export function durSec(d?: string): number {
  if (!d) return 0;
  const m = d.match(/(\d+):(\d{1,2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(d);
  return isNaN(n) ? 0 : n * 60;
}

export function tagReport(p: Project, els: ScriptElement[], layout: Layout | null): Table {
  const stats = sceneStats(els, layout, p.settings);
  const rows: (string | number)[][] = [];
  for (const c of BREAKDOWN_CATEGORIES) {
    const items = p.breakdown.filter((b) => b.category === c.id);
    const byText = new Map<string, string[]>();
    for (const b of items) {
      const idx = els.findIndex((e) => e.id === b.elementId);
      const sc = sceneOf(stats, idx);
      const k = b.text.toLowerCase();
      byText.set(k, [...(byText.get(k) || []), sc?.number || '—']);
    }
    for (const [t, scenes] of byText) rows.push([c.name, t, [...new Set(scenes)].join(', '), scenes.length]);
  }
  for (const t of SCENE_TAGS) {
    const sc = stats.filter((s) => p.scenes[s.id]?.tags?.includes(t.id));
    if (sc.length) rows.push(['Scene tag', t.name, sc.map((s) => s.number).join(', '), sc.length]);
  }
  return { title: 'Tag report', columns: ['Category', 'Item', 'Scenes', 'Count'], rows };
}

/** Breakdown sheet per scene (industry layout as rows of category → items). */
export function breakdownSheets(p: Project, els: ScriptElement[], layout: Layout | null, onlyScene?: string): Table[] {
  const stats = sceneStats(els, layout, p.settings);
  return stats
    .filter((s) => !onlyScene || s.id === onlyScene)
    .map((sc) => {
      const ids = new Set(els.slice(sc.start, sc.end).map((e) => e.id));
      const rows: (string | number)[][] = [];
      rows.push(['Scene', `${sc.number}  ${sc.heading.toUpperCase()}`]);
      rows.push(['INT/EXT · Time', `${sc.parsed.ie} · ${sc.parsed.time}`]);
      rows.push(['Pages', `${formatEighths(sc.eighths)} (page ${sc.pageLabel})`]);
      rows.push(['Synopsis', p.scenes[sc.id]?.synopsis || sceneDescription(els, sc)]);
      for (const c of BREAKDOWN_CATEGORIES) {
        const items = p.breakdown.filter((b) => b.category === c.id && ids.has(b.elementId)).map((b) => b.text);
        if (c.id === 'cast') items.unshift(...sc.characters);
        if (c.id === 'location' && sc.parsed.location) items.unshift(sc.parsed.location);
        rows.push([c.name, [...new Set(items)].join(', ')]);
      }
      return { title: `Breakdown sheet — Scene ${sc.number}`, columns: ['Category', 'Elements'], rows, widths: [25, 75] };
    });
}

export const REPORTS: { id: string; name: string; build: (p: Project, els: ScriptElement[], l: Layout | null) => Table }[] = [
  { id: 'oneliner', name: 'One-Liner', build: oneLiner },
  { id: 'scenes', name: 'Scene report', build: sceneReport },
  { id: 'characters', name: 'Character report', build: characterReport },
  { id: 'cast', name: 'Cast report', build: castReport },
  { id: 'locations', name: 'Location report', build: locationReport },
  { id: 'daynight', name: 'Day / Night summary', build: dayNightSummary },
  { id: 'intext', name: 'Interior / Exterior summary', build: intExtSummary },
  { id: 'songs', name: 'Songs report', build: songsReport },
  { id: 'fights', name: 'Fights report', build: fightsReport },
  { id: 'tags', name: 'Tag report', build: tagReport },
];

export function tableHTML(tables: Table[], fontBase: string, landscape = true, project?: Project): string {
  const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const body = tables
    .map(
      (t) => `<section><h1>${esc(t.title)}</h1>${project ? `<div class="sub">${esc(project.titlePage.title)} · ${esc(project.titlePage.draft)} · ${new Date().toLocaleDateString('en-IN')}</div>` : ''}
<table><thead><tr>${t.columns.map((c, i) => `<th${t.widths ? ` style="width:${t.widths[i]}%"` : ''}>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${t.footer ? `<div class="foot">${esc(t.footer)}</div>` : ''}</section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${fontBase}fonts/fonts.css"><style>
@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm}
body{font-family:'Segoe UI',Arial,'Katha Tamil','Katha Telugu','Katha Devanagari','Katha Malayalam','Katha Kannada',sans-serif;font-size:9.5pt;color:#111}
section{page-break-after:always}section:last-child{page-break-after:auto}
h1{font-size:15pt;margin:0 0 2px}.sub{color:#666;margin-bottom:8px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}
th{background:#eee;font-weight:700}tr:nth-child(even) td{background:#fafafa}.foot{margin-top:6px;color:#444}
thead{display:table-header-group}tr{page-break-inside:avoid}
</style></head><body>${body}</body></html>`;
}

export function settingsFor(p: Project): ScriptSettings {
  return p.settings;
}
