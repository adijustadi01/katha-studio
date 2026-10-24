import { useState } from 'preact/hooks';
import { store } from '../../app/store';
import { Dialog } from './Dialog';
import { lazyDialogs } from './lazy';
import { REVISION_COLORS, ScriptElement, Snapshot } from '../../core/types';
import { setRevisionMode } from '../../editor/revision';
import { setElements } from '../../app/scriptops';
import { diffScripts, diffSummary, DiffRow } from '../../core/diff';
import { cloneElements } from '../../core/project';
import { lockSceneNumbers } from '../../core/scenes';
import { useStore } from '../hooks';

function RevisionsDialog() {
  const s = useStore();
  const p = s.project!;
  const r = p.revision;
  const [color, setColor] = useState(r.active ? r.color : Math.min(r.color + 1, REVISION_COLORS.length - 1) || 1);
  const [label, setLabel] = useState(r.active ? r.label : `${REVISION_COLORS[color]?.name} Revision`);
  const [date, setDate] = useState(r.date || new Date().toISOString().slice(0, 10));
  const marked = s.elements().filter((e) => e.rev).length;
  const start = () => {
    // production drafts lock scene numbers so new scenes become A/B scenes
    if (!r.scenesLocked) {
      const els = s.elements().map((e) => ({ ...e }));
      lockSceneNumbers(els);
      setElements(els, true);
    }
    p.revision = { ...r, active: true, color, label, date, scenesLocked: true };
    setRevisionMode(true, color);
    store.snapshot(`Before ${label}`);
    store.touch();
    store.toast(`${label} started — changed lines get * and ${REVISION_COLORS[color].name} pages`, 'ok', 5000);
    store.closeDialog();
  };
  const stop = () => {
    p.revision = { ...r, active: false };
    setRevisionMode(false, r.color);
    store.touch();
  };
  const clearMarks = () => {
    if (!confirm('Remove all revision marks (asterisks and page colours) from the script?')) return;
    setElements(s.elements().map((e) => ({ ...e, rev: undefined })), true);
    store.toast('Revision marks cleared', 'ok');
  };
  const lockPages = () => {
    const layout = store.computeLayout();
    if (!layout) return;
    p.revision.lockedPages = layout.pages.map((pg) => ({ label: pg.label, startId: pg.startId, startOffset: pg.startOffset }));
    p.revision.pagesLocked = true;
    store.touch();
    store.computeLayout();
    store.toast(`${layout.pages.length} pages locked. New material creates A-pages (e.g. 12A).`, 'ok', 5000);
  };
  const unlockPages = () => {
    p.revision.pagesLocked = false;
    p.revision.lockedPages = undefined;
    store.touch();
    store.computeLayout();
  };
  return (
    <Dialog title="Revisions & production locking" size="wide">
      <div class="col">
        <h3>Revision mode {r.active && <span class="chip sel" style={{ background: '#ff9800' }}>ON — {r.label}</span>}</h3>
        <p class="small muted">While revision mode is on, every line you change is marked with an asterisk in the right margin and its page is printed on the revision colour. Industry colour order:</p>
        <div class="row">
          {REVISION_COLORS.map((c, i) => (
            <button
              key={c.name}
              class={color === i ? 'on' : ''}
              disabled={i === 0}
              onClick={() => {
                setColor(i);
                setLabel(`${c.name} Revision`);
              }}
              style={{ background: c.css, color: '#222', borderColor: color === i ? '#d6336c' : '#ccc' }}
            >
              {i}. {c.name}
            </button>
          ))}
        </div>
        <div class="row">
          <label>Label</label>
          <input value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} style="width:260px" />
          <label>Date</label>
          <input type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        </div>
        <div class="row">
          {!r.active ? (
            <button class="primary" onClick={start}>
              Start {REVISION_COLORS[color]?.name} revision
            </button>
          ) : (
            <>
              <button onClick={stop}>Stop revision mode</button>
              <button
                onClick={() => {
                  p.revision = { ...r, color, label, date };
                  setRevisionMode(true, color);
                  store.touch();
                }}
              >
                Switch to {REVISION_COLORS[color]?.name}
              </button>
            </>
          )}
          <button onClick={clearMarks} disabled={!marked}>
            Clear revision marks ({marked} elements)
          </button>
        </div>
        <h3>Locking (shooting script)</h3>
        <div class="row">
          {!r.pagesLocked ? <button onClick={lockPages}>🔒 Lock pages</button> : <button onClick={unlockPages}>🔓 Unlock pages</button>}
          <span class="small muted">{r.pagesLocked ? `${r.lockedPages?.length || 0} pages locked — inserts become A/B pages.` : 'Pages renumber freely.'}</span>
        </div>
        <div class="row">
          {!r.scenesLocked ? (
            <button onClick={() => { store.closeDialog(); (window as any).__runCommand('script.lockScenes'); }}>🔒 Lock scene numbers</button>
          ) : (
            <button onClick={() => (window as any).__runCommand('script.unlockScenes')}>🔓 Unlock & renumber scenes</button>
          )}
          <span class="small muted">{r.scenesLocked ? 'Scene numbers locked — new scenes become 12A, 12B…; use Script → Omit Scene to keep a number as OMITTED.' : 'Scenes renumber automatically.'}</span>
        </div>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ versions & compare
function VersionsDialog() {
  const s = useStore();
  const p = s.project!;
  const snaps = [...p.snapshots].sort((a, b) => b.created - a.created);
  const [left, setLeft] = useState<string>(snaps[0]?.id || '');
  const [right, setRight] = useState<string>('current');
  const [showAuto, setShowAuto] = useState(true);
  const [compare, setCompare] = useState(false);
  const get = (id: string): ScriptElement[] => (id === 'current' ? s.elements() : p.snapshots.find((x) => x.id === id)?.elements || []);
  const nameOf = (id: string) => (id === 'current' ? 'Current script' : p.snapshots.find((x) => x.id === id)?.name || '?');
  const restore = (sn: Snapshot) => {
    if (!confirm(`Restore "${sn.name}"? The current script is saved as a snapshot first, and you can undo with Ctrl+Z.`)) return;
    store.snapshot('Before restoring ' + sn.name);
    setElements(cloneElements(sn.elements));
    store.toast('Restored ' + sn.name, 'ok');
    store.closeDialog();
  };
  if (compare) {
    const rows = diffScripts(get(left), get(right));
    return (
      <Dialog title={`Compare: ${nameOf(left)} ⟷ ${nameOf(right)}`} size="wide" footer={<button onClick={() => setCompare(false)}>← Back</button>}>
        <CompareView rows={rows} />
      </Dialog>
    );
  }
  return (
    <Dialog title="Version history" size="wide" footer={<button onClick={() => store.openDialog('snapshot')}>+ Save named draft…</button>}>
      <div class="row" style="margin-bottom:8px">
        <label>
          <input type="checkbox" checked={showAuto} onChange={() => setShowAuto(!showAuto)} /> Show automatic snapshots
        </label>
        <span style="flex:1" />
        <select value={left} onChange={(e) => setLeft((e.target as HTMLSelectElement).value)}>
          {snaps.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          <option value="current">Current script</option>
        </select>
        ⟷
        <select value={right} onChange={(e) => setRight((e.target as HTMLSelectElement).value)}>
          <option value="current">Current script</option>
          {snaps.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button class="primary" disabled={!left} onClick={() => setCompare(true)}>
          Compare side by side
        </button>
      </div>
      <table class="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Saved</th>
            <th>Type</th>
            <th>Elements</th>
            <th>Changes vs current</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {snaps
            .filter((x) => showAuto || !x.auto)
            .map((x) => {
              const sum = diffSummary(diffScripts(x.elements, s.elements()));
              return (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{new Date(x.created).toLocaleString()}</td>
                  <td>{x.auto ? 'Automatic' : 'Named draft'}</td>
                  <td>{x.elements.length}</td>
                  <td class="small">
                    ~{sum.changed} changed · +{sum.added} · −{sum.removed}
                  </td>
                  <td>
                    <div class="row">
                      <button
                        class="small"
                        onClick={() => {
                          setLeft(x.id);
                          setRight('current');
                          setCompare(true);
                        }}
                      >
                        Compare
                      </button>
                      <button class="small" onClick={() => restore(x)}>
                        Restore
                      </button>
                      <button
                        class="ghost small"
                        onClick={() => {
                          if (!confirm('Delete this snapshot?')) return;
                          p.snapshots = p.snapshots.filter((y) => y !== x);
                          store.touch();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          {!snaps.length && (
            <tr>
              <td colSpan={6} class="muted">
                No versions yet. Automatic snapshots are taken every 30 minutes while you write; save a named draft any time.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Dialog>
  );
}

export function CompareView({ rows }: { rows: DiffRow[] }) {
  const [onlyChanges, setOnly] = useState(true);
  const sum = diffSummary(rows);
  const shown = onlyChanges ? rows.filter((r, i) => r.status !== 'same' || rows[i - 1]?.status !== 'same' || rows[i + 1]?.status !== 'same') : rows;
  const cell = (e: ScriptElement | undefined, bg: string) => (
    <div class="cell" style={{ background: bg, marginLeft: e ? indent(e) : 0 }}>
      {e ? (e.type === 'scene' || e.type === 'character' || e.type === 'transition' ? e.text.toUpperCase() : e.text) : ''}
    </div>
  );
  return (
    <div>
      <div class="row" style="margin-bottom:8px">
        <span class="chip">{sum.changed} changed</span>
        <span class="chip" style="background:#c8e6c9;color:#000">{sum.added} added</span>
        <span class="chip" style="background:#ffcdd2;color:#000">{sum.removed} removed</span>
        <label>
          <input type="checkbox" checked={onlyChanges} onChange={() => setOnly(!onlyChanges)} /> Only changes (with context)
        </label>
      </div>
      <div class="compare">
        <b>Older</b>
        <b>Newer</b>
        {shown.map((r, i) => {
          if (r.status === 'same') return [cell(r.left, 'transparent'), cell(r.right, 'transparent')];
          if (r.status === 'removed') return [cell(r.left, '#ffcdd2'), cell(undefined, 'transparent')];
          if (r.status === 'added') return [cell(undefined, 'transparent'), cell(r.right, '#c8e6c9')];
          return [
            <div class="cell" key={'l' + i} style={{ marginLeft: indent(r.left!) }}>
              {r.words!.filter((w) => w.kind !== 'add').map((w, j) => (
                <span key={j} class={w.kind === 'del' ? 'diff-del' : ''}>
                  {w.text}
                </span>
              ))}
            </div>,
            <div class="cell" key={'r' + i} style={{ marginLeft: indent(r.right!) }}>
              {r.words!.filter((w) => w.kind !== 'del').map((w, j) => (
                <span key={j} class={w.kind === 'add' ? 'diff-add' : ''}>
                  {w.text}
                </span>
              ))}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

function indent(e: ScriptElement): string {
  switch (e.type) {
    case 'character':
      return '30%';
    case 'parenthetical':
      return '22%';
    case 'dialogue':
      return '14%';
    case 'transition':
      return '55%';
    default:
      return '0';
  }
}

lazyDialogs.revisions = RevisionsDialog;
lazyDialogs.versions = VersionsDialog;
