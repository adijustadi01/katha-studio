import { useState, useRef } from 'preact/hooks';
import { store } from '../../app/store';
import { useStore } from '../hooks';
import { sceneStats, SceneStat } from '../../core/stats';
import { formatEighths, formatMinutes } from '../../core/paginate';
import { moveScene, updateSceneMeta, goTo, addScene, deleteScene, reorderScenes } from '../../app/scriptops';
import { viewRegistry } from './registry';
import { uid } from '../../core/project';
import { pickImage } from '../Sidebar';
import { SCENE_TAGS } from '../../core/types';
import type { Beat } from '../../core/types';

// ------------------------------------------------------------------ Index cards
function IndexCards() {
  const s = useStore();
  const p = s.project!;
  const stats = sceneStats(s.elements(), s.layout, p.settings);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div>
      <div class="row" style="margin-bottom:12px">
        <h2 style="margin:0">Index cards</h2>
        <span class="muted small">Drag cards to reorder scenes — the script follows. Edit titles and synopses directly.</span>
        <span style="flex:1" />
        <button class="primary" onClick={() => addScene()}>
          + Scene
        </button>
      </div>
      <div class="cards">
        {stats.map((sc) => {
          const m = p.scenes[sc.id] || {};
          return (
            <div
              key={sc.id}
              class={'card' + (over === sc.id ? ' drag-over' : '')}
              style={{ borderTopColor: m.color || '#bbb' }}
              draggable
              onDragStart={() => setDrag(sc.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(sc.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (drag) moveScene(drag, sc.id);
                setDrag(null);
              }}
            >
              <div class="card-h">
                <span>{sc.number}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={sc.heading}>
                  {sc.heading.toUpperCase()}
                </span>
                <span class="muted">{formatEighths(sc.eighths)}</span>
              </div>
              <input placeholder="Card title" value={m.title || ''} onChange={(e) => updateSceneMeta(sc.id, { title: (e.target as HTMLInputElement).value })} style="font-weight:600" />
              <textarea placeholder="What happens in this scene?" value={m.synopsis || ''} onChange={(e) => updateSceneMeta(sc.id, { synopsis: (e.target as HTMLTextAreaElement).value })} />
              <div class="row" style="padding:4px 8px">
                {(m.tags || []).map((t) => {
                  const d = SCENE_TAGS.find((x) => x.id === t);
                  return (
                    <span class="chip sel" key={t} style={{ background: d?.color }}>
                      {d?.name}
                    </span>
                  );
                })}
                <span style="flex:1" />
                <button class="ghost small" onClick={() => goTo(sc.id)} title="Open in script">
                  ↗
                </button>
                <button
                  class="ghost small"
                  title="Delete scene"
                  onClick={() => {
                    if (confirm(`Delete scene ${sc.number} and all its content? (Undo with Ctrl+Z)`)) deleteScene(sc.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
        <div
          class="card"
          style="border-top-color:transparent;align-items:center;justify-content:center;opacity:.6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (drag) moveScene(drag, null);
            setDrag(null);
          }}
          onClick={() => addScene()}
        >
          + Add scene (or drop here to move to end)
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Beat board
function BeatBoard() {
  const s = useStore();
  const p = s.project!;
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const COLORS = ['#fff59d', '#ffcc80', '#f8bbd0', '#b3e5fc', '#c8e6c9', '#d1c4e9', '#ffab91'];
  const add = (x = 60 + Math.random() * 300, y = 60 + Math.random() * 200) => {
    p.beats.push({ id: uid('bt'), text: '', x, y, color: COLORS[p.beats.length % COLORS.length] });
    store.touch();
  };
  const update = (b: Beat, patch: Partial<Beat>) => {
    Object.assign(b, patch);
    store.touch();
  };
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Beat board</h2>
        <span class="muted small">Free-form ideas before you write. Double-click the board to add a beat; drag to arrange; "→ Outline" turns a beat into a scene.</span>
        <span style="flex:1" />
        <button class="primary" onClick={() => add()}>
          + Beat
        </button>
      </div>
      <div
        class="beat-canvas"
        ref={canvas}
        onDblClick={(e) => {
          if (e.target !== canvas.current) return;
          const r = canvas.current!.getBoundingClientRect();
          add(e.clientX - r.left - 90, e.clientY - r.top - 30);
        }}
        onMouseMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const b = p.beats.find((x) => x.id === d.id);
          if (!b) return;
          const r = canvas.current!.getBoundingClientRect();
          b.x = Math.max(0, e.clientX - r.left - d.dx);
          b.y = Math.max(0, e.clientY - r.top - d.dy);
          store.emit();
        }}
        onMouseUp={() => {
          if (dragRef.current) {
            dragRef.current = null;
            store.touch();
          }
        }}
      >
        {p.beats.map((b) => (
          <div
            key={b.id}
            class="beat"
            style={{ left: b.x + 'px', top: b.y + 'px', background: b.color }}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON') return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              dragRef.current = { id: b.id, dx: e.clientX - r.left, dy: e.clientY - r.top };
            }}
          >
            {b.image && <img src={p.assets[b.image]} />}
            <textarea value={b.text} placeholder="Idea, beat, moment…" onChange={(e) => update(b, { text: (e.target as HTMLTextAreaElement).value })} />
            <div class="row" style="gap:3px">
              {COLORS.map((c) => (
                <span key={c} onClick={() => update(b, { color: c })} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: '1px solid #0003', cursor: 'pointer' }} />
              ))}
              <span style="flex:1" />
              <button
                class="ghost small"
                title="Add image"
                onClick={async () => {
                  const img = await pickImage();
                  if (img) {
                    const key = 'beat-' + uid('a') + '.jpg';
                    p.assets[key] = img;
                    update(b, { image: key });
                  }
                }}
              >
                🖼
              </button>
              <button
                class="ghost small"
                title="Turn into a scene in the outline"
                onClick={() => {
                  const id = addScene('INT. ' + (b.text.split('\n')[0] || 'NEW SCENE').toUpperCase().slice(0, 40) + ' - DAY');
                  setTimeout(() => updateSceneMeta(id, { synopsis: b.text, color: b.color }), 50);
                  store.toast('Beat added as a new scene at the end of the script', 'ok');
                }}
              >
                → Outline
              </button>
              <button
                class="ghost small"
                onClick={() => {
                  p.beats = p.beats.filter((x) => x !== b);
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

// ------------------------------------------------------------------ Outline (acts & sequences)
interface ActGroup {
  id: string;
  title: string;
  scenes: SceneStat[];
}
function groupActs(stats: SceneStat[]): ActGroup[] {
  const els = store.elements();
  const acts: ActGroup[] = [];
  let cur: ActGroup = { id: 'start', title: 'Opening', scenes: [] };
  const markers = new Map<number, { id: string; title: string }>();
  els.forEach((e, i) => {
    if (e.type === 'act') markers.set(i, { id: e.id, title: e.text || 'ACT' });
    if (e.type === 'interval') markers.set(i, { id: e.id, title: '— INTERVAL — Second Half' });
  });
  let mi = [...markers.keys()].sort((a, b) => a - b);
  for (const sc of stats) {
    while (mi.length && mi[0] < sc.start) {
      if (cur.scenes.length || cur.id !== 'start') acts.push(cur);
      const m = markers.get(mi[0])!;
      cur = { id: m.id, title: m.title, scenes: [] };
      mi = mi.slice(1);
    }
    cur.scenes.push(sc);
  }
  acts.push(cur);
  return acts.filter((a) => a.scenes.length || a.id !== 'start');
}

function Outline() {
  const s = useStore();
  const p = s.project!;
  const stats = sceneStats(s.elements(), s.layout, p.settings);
  const acts = groupActs(stats);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Outline</h2>
        <span class="muted small">Acts come from Act Break elements and the Interval. Drag scenes between acts.</span>
      </div>
      {acts.map((a) => {
        const eighths = a.scenes.reduce((n, x) => n + x.eighths, 0);
        const minutes = a.scenes.reduce((n, x) => n + x.minutes, 0);
        return (
          <div class="outline-act" key={a.id}>
            <header onClick={() => setCollapsed({ ...collapsed, [a.id]: !collapsed[a.id] })}>
              <span>
                {collapsed[a.id] ? '▸' : '▾'} {a.title.toUpperCase()}
              </span>
              <span class="muted small">
                {a.scenes.length} scenes · {formatEighths(eighths)} pages · {formatMinutes(minutes)}
              </span>
            </header>
            {!collapsed[a.id] &&
              a.scenes.map((sc) => {
                const m = p.scenes[sc.id] || {};
                return (
                  <div
                    class="outline-scene"
                    key={sc.id}
                    draggable
                    onDragStart={() => setDrag(sc.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag) moveScene(drag, sc.id);
                      setDrag(null);
                    }}
                    style={{ borderLeft: `4px solid ${m.color || 'transparent'}` }}
                  >
                    <b>{sc.number}</b>
                    <div>
                      <div style="cursor:pointer;font-weight:600" onClick={() => goTo(sc.id)}>
                        {sc.heading.toUpperCase()}
                      </div>
                      <input style="width:100%;border:none;background:transparent;padding:2px 0" placeholder="Synopsis…" value={m.synopsis || ''} onChange={(e) => updateSceneMeta(sc.id, { synopsis: (e.target as HTMLInputElement).value })} />
                    </div>
                    <span class="muted small">
                      p{sc.pageLabel} · {formatEighths(sc.eighths)}
                    </span>
                  </div>
                );
              })}
          </div>
        );
      })}
      <button
        onClick={() => {
          const order = stats.map((x) => x.id).sort((a, b) => (p.scenes[a]?.color || '').localeCompare(p.scenes[b]?.color || ''));
          if (confirm('Group scenes by colour? (Undo with Ctrl+Z)')) reorderScenes(order);
        }}
      >
        Sort scenes by colour
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Story tracks
function StoryTracks() {
  const s = useStore();
  const p = s.project!;
  const stats = sceneStats(s.elements(), s.layout, p.settings);
  const total = stats.reduce((n, x) => n + x.eighths, 0) || 1;
  let acc = 0;
  const pos = new Map<string, { left: number; width: number }>();
  for (const sc of stats) {
    pos.set(sc.id, { left: (acc / total) * 100, width: (sc.eighths / total) * 100 });
    acc += sc.eighths;
  }
  const ivIdx = stats.findIndex((x) => x.half === 2);
  const ivLeft = ivIdx >= 0 ? pos.get(stats[ivIdx].id)!.left : null;
  return (
    <div>
      <div class="row" style="margin-bottom:10px">
        <h2 style="margin:0">Story tracks</h2>
        <span class="muted small">Tag scenes with A/B/C plotlines in the Scene panel (right). Click a block to jump to the scene.</span>
      </div>
      <div class="col" style="margin-bottom:16px">
        {p.tracks.map((t, i) => (
          <div class="row" key={t.id}>
            <input type="color" value={t.color} onChange={(e) => ((t.color = (e.target as HTMLInputElement).value), store.touch())} />
            <input value={t.name} onChange={(e) => ((t.name = (e.target as HTMLInputElement).value), store.touch())} style="width:260px" />
            <button
              class="ghost"
              onClick={() => {
                p.tracks.splice(i, 1);
                store.touch();
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          style="width:max-content"
          onClick={() => {
            const id = String.fromCharCode(65 + p.tracks.length);
            p.tracks.push({ id: id + uid('t').slice(-3), name: id + ' Story', color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') });
            store.touch();
          }}
        >
          + Track
        </button>
      </div>
      <div class="timeline">
        {p.tracks.map((t) => {
          const scenes = stats.filter((sc) => p.scenes[sc.id]?.tracks?.includes(t.id));
          return (
            <div class="tl-row" key={t.id}>
              <b style={{ color: t.color }}>
                {t.name} <span class="muted small">({scenes.length})</span>
              </b>
              <div class="tl-bar">
                {ivLeft !== null && <div style={{ position: 'absolute', left: ivLeft + '%', top: 0, bottom: 0, borderLeft: '2px dashed var(--accent)' }} title="Interval" />}
                {scenes.map((sc) => {
                  const ps = pos.get(sc.id)!;
                  return <div key={sc.id} class="tl-seg" title={`${sc.number}. ${sc.heading}`} style={{ left: ps.left + '%', width: Math.max(0.6, ps.width) + '%', background: t.color }} onClick={() => goTo(sc.id)} />;
                })}
              </div>
            </div>
          );
        })}
        <div class="tl-row">
          <span class="muted small">Scenes</span>
          <div class="tl-bar" style="height:18px">
            {stats.map((sc) => {
              const ps = pos.get(sc.id)!;
              return (
                <div key={sc.id} class="tl-seg" title={`${sc.number}. ${sc.heading}`} style={{ left: ps.left + '%', width: ps.width + '%', background: p.scenes[sc.id]?.color || '#bbb', opacity: 0.6, top: '2px', bottom: '2px', borderRight: '1px solid var(--panel)' }} onClick={() => goTo(sc.id)} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

viewRegistry.cards = IndexCards;
viewRegistry.beats = BeatBoard;
viewRegistry.outline = Outline;
viewRegistry.tracks = StoryTracks;
