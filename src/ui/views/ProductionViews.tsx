import { useState } from 'preact/hooks';
import { store } from '../../app/store';
import { useStore } from '../hooks';
import { viewRegistry } from './registry';
import { computePulse, PULSE_KINDS } from '../../core/pulse';
import { formatMinutes, formatEighths } from '../../core/paginate';
import { goTo } from '../../app/scriptops';
import { REPORTS, Table, tableHTML } from '../../core/reports';
import { tablesToXLSX } from '../../core/xlsx';
import { platform } from '../../platform';
import { fontBase } from '../../app/exporter';
import { sceneStats, SceneStat } from '../../core/stats';
import { isNightTime } from '../../core/elements';
import { uid } from '../../core/project';
import { insertElementAtCursor } from '../../app/commands';
import type { Punch } from '../../core/types';
import { detectLang, hasIndic } from '../../core/elements';
import { lazyDialogs } from '../dialogs/lazy';
import { Dialog } from '../dialogs/Dialog';
import { breakdownSheets } from '../../core/reports';

// ------------------------------------------------------------------ export helpers
export async function exportTables(tables: Table[], kind: 'pdf' | 'xlsx', name: string, landscape = true) {
  if (kind === 'xlsx') {
    await platform.exportFile(name + '.xlsx', await tablesToXLSX(tables), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return;
  }
  const html = tableHTML(tables, fontBase(), landscape, store.project!);
  if (platform.printToPDF) {
    const pdf = await platform.printToPDF(html, landscape ? { pageWidthIn: 11.69, pageHeightIn: 8.27 } : { pageWidthIn: 8.27, pageHeightIn: 11.69 });
    if (pdf) await platform.exportFile(name + '.pdf', pdf, 'application/pdf');
  } else {
    store.toast('Choose "Save as PDF" in the print dialog.', 'info', 5000);
    await platform.print(html);
  }
}

export function TableView({ t }: { t: Table }) {
  return (
    <div style="overflow:auto;max-height:65vh">
      <table class="grid">
        <thead>
          <tr>
            {t.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style="white-space:pre-wrap">
                  {String(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {t.footer && <div class="small muted" style="margin-top:6px">{t.footer}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ pulse chart
function PulseChart() {
  const s = useStore();
  const p = s.project!;
  const r = computePulse(p, s.elements(), s.layout);
  const W = 1000;
  const H = 300;
  const pad = 36;
  const x = (m: number) => pad + (m / Math.max(1, r.total)) * (W - pad * 2);
  const y = (e: number) => H - pad - (e / 10) * (H - pad * 2);
  const path = r.points.map((pt, i) => `${i ? 'L' : 'M'}${x((pt.start + pt.end) / 2).toFixed(1)},${y(pt.energy).toFixed(1)}`).join(' ');
  const [hover, setHover] = useState<string | null>(null);
  const ticks: number[] = [];
  for (let m = 0; m <= r.total; m += 10) ticks.push(m);
  return (
    <div class="pulse-wrap">
      <div class="row" style="margin-bottom:8px">
        <h2 style="margin:0">Pulse chart</h2>
        <span class="muted small">
          Energy across the film (x = estimated minutes). Tag scenes in the Scene panel; songs and fights are detected automatically. Gap warning: {p.settings.pulseGapMinutes} min without a high point.
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {r.gaps.map((g, i) => (
          <rect key={i} x={x(g.from)} y={pad - 10} width={Math.max(2, x(g.to) - x(g.from))} height={H - pad * 2 + 10} fill="#ff5252" opacity="0.12">
            <title>
              No high point for {formatMinutes(g.to - g.from)} ({formatMinutes(g.from)}–{formatMinutes(g.to)})
            </title>
          </rect>
        ))}
        {[0, 2, 4, 6, 8, 10].map((e) => (
          <g key={e}>
            <line x1={pad} x2={W - pad} y1={y(e)} y2={y(e)} stroke="var(--border)" />
            <text x={6} y={y(e) + 4} font-size="10" fill="var(--muted)">
              {e}
            </text>
          </g>
        ))}
        {ticks.map((m) => (
          <text key={m} x={x(m)} y={H - 10} font-size="10" fill="var(--muted)" text-anchor="middle">
            {m}′
          </text>
        ))}
        {r.interval !== null && (
          <g>
            <line x1={x(r.interval)} x2={x(r.interval)} y1={pad - 14} y2={H - pad} stroke="#d6336c" stroke-width="2" stroke-dasharray="6 4" />
            <text x={x(r.interval)} y={pad - 18} font-size="11" font-weight="700" fill="#d6336c" text-anchor="middle">
              INTERVAL
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="#ff7a2f" stroke-width="3" stroke-linejoin="round" />
        {r.points.map((pt) => {
          const kind = PULSE_KINDS.find((k) => pt.kinds.includes(k.id));
          return (
            <g key={pt.sceneId} style="cursor:pointer" onClick={() => goTo(pt.sceneId)} onMouseEnter={() => setHover(pt.sceneId)} onMouseLeave={() => setHover(null)}>
              <circle cx={x((pt.start + pt.end) / 2)} cy={y(pt.energy)} r={hover === pt.sceneId ? 9 : 6} fill={kind?.color || '#9e9e9e'} stroke="#fff" stroke-width="2" />
              <title>
                {pt.number}. {pt.heading} — energy {pt.energy} — {pt.kinds.map((k) => PULSE_KINDS.find((x) => x.id === k)?.name || k).join(', ') || 'no tags'}
              </title>
            </g>
          );
        })}
      </svg>
      <div class="row" style="margin:8px 0">
        {PULSE_KINDS.map((k) => (
          <span class="chip" key={k.id}>
            <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: k.color, marginRight: '4px' }} />
            {k.name}
          </span>
        ))}
      </div>
      {r.gaps.length > 0 && (
        <div style="background:#ffebee;color:#b71c1c;border-radius:8px;padding:8px 12px;margin-bottom:10px">
          ⚠ {r.gaps.length} stretch(es) longer than {p.settings.pulseGapMinutes} minutes without a high point:{' '}
          {r.gaps.map((g) => `${formatMinutes(g.from)}–${formatMinutes(g.to)}`).join(', ')}. Consider a mass moment, twist, song or fight.
        </div>
      )}
      <h3>Commercial scorecard</h3>
      <table class="grid" style="max-width:700px">
        <thead>
          <tr>
            <th>Element</th>
            <th>First half</th>
            <th>Second half</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {PULSE_KINDS.map((k) => {
            const a = r.counts[0].counts[k.id] || 0;
            const b = r.counts[1].counts[k.id] || 0;
            return (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td>{a}</td>
                <td>{b}</td>
                <td>
                  <b>{a + b}</b>
                </td>
              </tr>
            );
          })}
          <tr>
            <td>Runtime (est.)</td>
            <td>{r.interval !== null ? formatMinutes(r.interval) : '—'}</td>
            <td>{r.interval !== null ? formatMinutes(r.total - r.interval) : '—'}</td>
            <td>
              <b>{formatMinutes(r.total)}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ punch library
function PunchLibrary() {
  const s = useStore();
  const p = s.project!;
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Punch>({ id: '', text: '', character: '', tags: [] });
  const list = p.punches.filter((x) => !q || (x.text + ' ' + (x.character || '') + ' ' + (x.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase()));
  const save = () => {
    if (!draft.text.trim()) return;
    p.punches.unshift({ ...draft, id: uid('pu'), lang: hasIndic(draft.text) ? detectLang(draft.text) : 'en' });
    setDraft({ id: '', text: '', character: '', tags: [] });
    store.touch();
  };
  const insert = (pu: Punch) => {
    store.setMain('script');
    setTimeout(() => {
      if (pu.character) insertElementAtCursor('character', pu.character);
      insertElementAtCursor('dialogue', pu.text);
    }, 50);
  };
  // also offer to capture the current selection
  const fromSelection = () => {
    const v = store.view;
    if (!v) return;
    const { from, to } = v.state.selection;
    const t = v.state.doc.textBetween(from, to, ' ');
    if (t) setDraft({ ...draft, text: t });
  };
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Punch dialogue library</h2>
        <span class="muted small">Save your favourite lines and insert them anywhere (inserted after the cursor's element).</span>
      </div>
      <div class="col" style="background:var(--panel);padding:10px;border-radius:10px;margin-bottom:12px;max-width:800px">
        <textarea rows={2} placeholder="Punch line (any language — phonetic typing works in the script; paste here)" value={draft.text} onInput={(e) => setDraft({ ...draft, text: (e.target as HTMLTextAreaElement).value })} />
        <div class="row">
          <input placeholder="Character" value={draft.character} onInput={(e) => setDraft({ ...draft, character: (e.target as HTMLInputElement).value.toUpperCase() })} />
          <input placeholder="Tags (comma separated: mass, hero, interval…)" style="flex:1" value={(draft.tags || []).join(', ')} onInput={(e) => setDraft({ ...draft, tags: (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          <button onClick={fromSelection}>Use script selection</button>
          <button class="primary" onClick={save}>
            Save line
          </button>
        </div>
      </div>
      <input placeholder="Search lines, characters, tags…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} style="width:320px;margin-bottom:10px" />
      <div class="cards">
        {list.map((pu) => (
          <div class="card" key={pu.id} style="cursor:default;border-top-color:#ff7a2f">
            <div class="card-h">
              <span>{pu.character || '—'}</span>
              <span style="flex:1" />
              <span class="muted">{pu.lang?.toUpperCase()}</span>
            </div>
            <div style="padding:8px 10px;flex:1;font-family:'Courier Prime','Katha Tamil','Katha Telugu',monospace;font-size:14px">{pu.text}</div>
            <div class="row" style="padding:6px 8px">
              {(pu.tags || []).map((t) => (
                <span class="chip" key={t}>
                  {t}
                </span>
              ))}
              <span style="flex:1" />
              <button class="small" onClick={() => insert(pu)}>
                Insert
              </button>
              <button class="ghost small" onClick={() => navigator.clipboard?.writeText(pu.text)}>
                Copy
              </button>
              <button
                class="ghost small"
                onClick={() => {
                  p.punches = p.punches.filter((x) => x !== pu);
                  store.touch();
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ reports view
function ReportsView() {
  const s = useStore();
  const p = s.project!;
  const [id, setId] = useState('oneliner');
  const r = REPORTS.find((x) => x.id === id)!;
  const t = r.build(p, s.elements(), s.layout);
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Reports</h2>
        <select value={id} onChange={(e) => setId((e.target as HTMLSelectElement).value)}>
          {REPORTS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button onClick={() => exportTables([t], 'pdf', `${p.titlePage.title} - ${r.name}`)}>⬇ PDF</button>
        <button onClick={() => exportTables([t], 'xlsx', `${p.titlePage.title} - ${r.name}`)}>⬇ Excel (.xlsx)</button>
        <button onClick={() => exportTables(REPORTS.map((x) => x.build(p, s.elements(), s.layout)), 'xlsx', `${p.titlePage.title} - all reports`)}>⬇ All reports (.xlsx)</button>
        <button onClick={() => store.openDialog('report', { kind: 'breakdown' })}>Breakdown sheets…</button>
      </div>
      <TableView t={t} />
    </div>
  );
}

function ReportDialog({ kind, sceneId }: { kind: string; sceneId?: string }) {
  const s = store;
  const p = s.project!;
  const els = s.elements();
  if (kind === 'breakdown') {
    const sheets = breakdownSheets(p, els, s.layout, sceneId);
    return (
      <Dialog
        title={sceneId ? 'Breakdown sheet' : `Breakdown sheets (${sheets.length})`}
        size="wide"
        footer={
          <>
            <button onClick={() => exportTables(sheets, 'xlsx', `${p.titlePage.title} - breakdown`)}>⬇ Excel</button>
            <button class="primary" onClick={() => exportTables(sheets, 'pdf', `${p.titlePage.title} - breakdown`, false)}>
              🖨 PDF / Print
            </button>
          </>
        }
      >
        {sheets.map((t) => (
          <div key={t.title} style="margin-bottom:16px">
            <h3>{t.title}</h3>
            <TableView t={t} />
          </div>
        ))}
      </Dialog>
    );
  }
  const r = REPORTS.find((x) => x.id === kind) || REPORTS[0];
  const t = r.build(p, els, s.layout);
  return (
    <Dialog
      title={r.name}
      size="wide"
      footer={
        <>
          <button onClick={() => exportTables([t], 'xlsx', `${p.titlePage.title} - ${r.name}`)}>⬇ Excel (.xlsx)</button>
          <button class="primary" onClick={() => exportTables([t], 'pdf', `${p.titlePage.title} - ${r.name}`)}>
            ⬇ PDF
          </button>
        </>
      }
    >
      <TableView t={t} />
    </Dialog>
  );
}

// ------------------------------------------------------------------ stripboard
export function stripColor(sc: SceneStat): string {
  const night = isNightTime(sc.parsed.time);
  const ext = sc.parsed.ie === 'EXT' || sc.parsed.ie === 'INT/EXT';
  if (!ext && !night) return '#ffffff';
  if (ext && !night) return '#fff59d';
  if (!ext && night) return '#90caf9';
  return '#a5d6a7';
}

function Stripboard() {
  const s = useStore();
  const p = s.project!;
  const stats = sceneStats(s.elements(), s.layout, p.settings);
  const byId = new Map(stats.map((x) => [x.id, x]));
  const scheduled = new Set(p.schedule.flatMap((d) => d.sceneIds));
  const unscheduled = stats.filter((x) => !scheduled.has(x.id));
  const [drag, setDrag] = useState<string | null>(null);
  const drop = (dayId: string | null, beforeId?: string) => {
    if (!drag) return;
    for (const d of p.schedule) d.sceneIds = d.sceneIds.filter((x) => x !== drag);
    if (dayId) {
      const d = p.schedule.find((x) => x.id === dayId)!;
      const i = beforeId ? d.sceneIds.indexOf(beforeId) : -1;
      if (i >= 0) d.sceneIds.splice(i, 0, drag);
      else d.sceneIds.push(drag);
    }
    setDrag(null);
    store.touch();
  };
  const strip = (sc: SceneStat) => (
    <div
      key={sc.id}
      class="strip"
      style={{ background: stripColor(sc) }}
      draggable
      onDragStart={() => setDrag(sc.id)}
      onDragOver={(e) => e.preventDefault()}
      title={sc.heading}
    >
      <b>{sc.number}</b> {sc.parsed.ie} {sc.parsed.location} — {sc.parsed.time} · {formatEighths(sc.eighths)}
      <div style="opacity:.7">{sc.characters.join(', ')}</div>
    </div>
  );
  const scheduleTable = (): Table => ({
    title: 'Shooting schedule',
    columns: ['Day', 'Date', 'Sc.', 'INT/EXT', 'Location', 'Time', 'Cast', 'Pages'],
    rows: p.schedule.flatMap((d) =>
      d.sceneIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((sc) => [d.label, d.date || '', sc!.number, sc!.parsed.ie, sc!.parsed.location, sc!.parsed.time, sc!.characters.join(', '), formatEighths(sc!.eighths)]),
    ),
  });
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Stripboard</h2>
        <span class="muted small">Drag strips into shooting days. White = INT/DAY · Yellow = EXT/DAY · Blue = INT/NIGHT · Green = EXT/NIGHT.</span>
        <span style="flex:1" />
        <button
          onClick={() => {
            p.schedule.push({ id: uid('d'), label: `Day ${p.schedule.length + 1}`, sceneIds: [] });
            store.touch();
          }}
        >
          + Shooting day
        </button>
        <button onClick={() => exportTables([scheduleTable()], 'pdf', `${p.titlePage.title} - schedule`)}>⬇ Schedule PDF</button>
        <button onClick={() => exportTables([scheduleTable()], 'xlsx', `${p.titlePage.title} - schedule`)}>⬇ Schedule Excel</button>
      </div>
      <div class="strip-days">
        <div class="strip-col" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null)}>
          <b>Unscheduled ({unscheduled.length})</b>
          {unscheduled.map(strip)}
        </div>
        {p.schedule.map((d) => {
          const scs = d.sceneIds.map((id) => byId.get(id)).filter(Boolean) as SceneStat[];
          return (
            <div key={d.id} class="strip-col" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(d.id)}>
              <div class="row">
                <input value={d.label} style="width:90px;font-weight:700" onChange={(e) => ((d.label = (e.target as HTMLInputElement).value), store.touch())} />
                <input type="date" value={d.date || ''} onChange={(e) => ((d.date = (e.target as HTMLInputElement).value), store.touch())} />
                <button
                  class="ghost"
                  onClick={() => {
                    p.schedule = p.schedule.filter((x) => x !== d);
                    store.touch();
                  }}
                >
                  ×
                </button>
              </div>
              <div class="small muted">
                {scs.length} scenes · {formatEighths(scs.reduce((a, x) => a + x.eighths, 0))} pages
              </div>
              {scs.map((sc) => (
                <div key={sc.id} onDrop={(e) => (e.stopPropagation(), drop(d.id, sc.id))}>
                  {strip(sc)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

viewRegistry.pulse = PulseChart;
viewRegistry.punches = PunchLibrary;
viewRegistry.reports = ReportsView;
viewRegistry.stripboard = Stripboard;
lazyDialogs.report = ReportDialog;
