import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { sampleProject } from '../src/core/sample';
import { paginate } from '../src/core/paginate';
import { getTemplate } from '../src/core/templates';
import { REPORTS, oneLiner, songsReport, fightsReport, breakdownSheets } from '../src/core/reports';
import { tablesToXLSX } from '../src/core/xlsx';
import { computePulse } from '../src/core/pulse';
import { halves } from '../src/core/stats';

const p = sampleProject();
const layout = paginate(p.elements, getTemplate('indian-a4'), { layers: p.settings.layers });

describe('reports', () => {
  it('one-liner has one row per scene with INT/EXT, location, day/night', () => {
    const t = oneLiner(p, p.elements, layout);
    expect(t.rows.length).toBe(9);
    expect(t.rows[0]).toEqual(expect.arrayContaining(['1', 'EXT', 'PULICAT LAKE']));
    expect(t.rows[2][3]).toBe('NIGHT');
    expect(t.rows[8][7]).toBe('2nd');
  });
  it('songs and fights reports pick up the blocks', () => {
    expect(songsReport(p, p.elements, layout).rows[0][1]).toBe('Rendu Karai (Two Shores)');
    expect(fightsReport(p, p.elements, layout).rows[0][2]).toBe('Salt pans, noon');
  });
  it('every report builds', () => {
    for (const r of REPORTS) expect(r.build(p, p.elements, layout).rows.length).toBeGreaterThan(0);
  });
  it('breakdown sheets include tagged items', () => {
    const sheets = breakdownSheets(p, p.elements, layout);
    const s1 = sheets[0].rows.find((r) => r[0] === 'Vehicles');
    expect(s1?.[1]).toContain('speedboat');
  });
  it('writes a valid xlsx', async () => {
    const data = await tablesToXLSX([oneLiner(p, p.elements, layout)]);
    const zip = await JSZip.loadAsync(data);
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('PULICAT LAKE');
    expect(zip.file('xl/workbook.xml')).toBeTruthy();
  });
});

describe('pulse chart & halves', () => {
  it('marks the interval and counts per half', () => {
    const r = computePulse(p, p.elements, layout);
    expect(r.interval).not.toBeNull();
    expect(r.points.length).toBe(9);
    expect(r.counts[0].counts['mass']).toBeGreaterThanOrEqual(2);
    expect(r.counts[1].counts['fight']).toBe(1);
    expect(r.points.find((x) => x.kinds.includes('hero-intro'))!.energy).toBe(10);
  });
  it('splits first and second half page counts', () => {
    const h = halves(p.elements, layout, p.settings);
    expect(h.hasInterval).toBe(true);
    expect(h.first.pages).toBeGreaterThan(h.second.pages);
  });
});
