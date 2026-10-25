import { useState } from 'preact/hooks';
import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { useStore, useSelection } from './hooks';
import { sceneStats } from '../core/stats';
import { formatEighths, formatMinutes } from '../core/paginate';
import { allCharacters, allLocations, dialogueCounts, getScenes } from '../core/scenes';
import { moveScene, goTo, updateSceneMeta, renameCharacter } from '../app/scriptops';
import { SCENE_TAGS } from '../core/types';
import { currentElement } from '../editor/commands';
import { t } from '../i18n';
import { uid } from '../core/project';

type Tab = NonNullable<typeof prefs.sidebar>;

export function Sidebar() {
  useStore();
  const tab = prefs.sidebar;
  const tabs: [Tab, string][] = [
    ['navigator', t('Navigator')],
    ['cards', t('Cards')],
    ['characters', t('Characters')],
    ['locations', t('Locations')],
    ['notes', t('Notes')],
  ];
  return (
    <aside class={'sidebar' + (tab ? '' : ' collapsed')} data-tour="sidebar">
      <div class="tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            class={tab === id ? 'on' : ''}
            onClick={() => {
              if (id === 'cards') {
                store.setMain('cards');
                return;
              }
              prefs.sidebar = id;
              store.savePrefs();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="panel-body">
        {tab === 'navigator' && <Navigator />}
        {tab === 'characters' && <Characters />}
        {tab === 'locations' && <Locations />}
        {tab === 'notes' && <NotesPanel />}
      </div>
    </aside>
  );
}

export function Navigator() {
  const s = useStore();
  useSelection();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const p = s.project!;
  const els = s.elements();
  const stats = sceneStats(els, s.layout, p.settings);
  const st = s.view?.state;
  let curScene = '';
  if (st) {
    const cur = currentElement(st);
    if (cur) st.doc.forEach((n, _p, i) => i <= cur.index && n.attrs.type === 'scene' && (curScene = n.attrs.id));
  }
  const bookmarks: string[] = (p as any).bookmarks || [];
  let shownInterval = false;
  const f = filter.toLowerCase();
  return (
    <div>
      <input placeholder="Filter scenes…" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} style="width:100%;margin-bottom:6px" />
      {bookmarks.length > 0 && (
        <div style="margin-bottom:8px">
          {bookmarks.map((id) => {
            const e = els.find((x) => x.id === id);
            return e ? (
              <div class="small" style="cursor:pointer;padding:2px 4px" onClick={() => goTo(id)} key={id}>
                ★ {e.text.slice(0, 40) || '(empty)'}
              </div>
            ) : null;
          })}
        </div>
      )}
      <ul class="scene-list">
        {stats.map((sc) => {
          const meta = p.scenes[sc.id] || {};
          if (f && !(sc.heading.toLowerCase().includes(f) || (meta.synopsis || '').toLowerCase().includes(f))) return null;
          const showIv = sc.half === 2 && !shownInterval;
          if (showIv) shownInterval = true;
          return (
            <>
              {showIv && <div class="half-marker">— INTERVAL —</div>}
              <li
                key={sc.id}
                class={'scene-item' + (sc.id === curScene ? ' current' : '') + (over === sc.id ? ' drag-over' : '')}
                style={{ borderLeftColor: meta.color || 'transparent' }}
                draggable
                onDragStart={(e) => {
                  setDrag(sc.id);
                  e.dataTransfer!.effectAllowed = 'move';
                }}
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
                onClick={() => {
                  goTo(sc.id);
                  // phones: close the drawer to show the scene
                  if (matchMedia('(max-width: 700px)').matches) (prefs.sidebar = null), store.savePrefs();
                }}
                title={sc.heading}
              >
                <span class="no">{sc.number}</span>
                <span class="hd">{sc.omitted ? 'OMITTED' : sc.heading.toUpperCase() || '(untitled scene)'}</span>
                <span class="meta">
                  p{sc.pageLabel} · {formatEighths(sc.eighths)}
                </span>
                {meta.synopsis && <span class="syn">{meta.synopsis}</span>}
                {meta.tags && meta.tags.length > 0 && (
                  <span class="tagchips">
                    {meta.tags.map((tg) => {
                      const d = SCENE_TAGS.find((x) => x.id === tg);
                      return (
                        <span key={tg} class="chip sel" style={{ background: d?.color }}>
                          {d?.name || tg}
                        </span>
                      );
                    })}
                  </span>
                )}
              </li>
            </>
          );
        })}
      </ul>
      <div
        style="height:30px"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (drag) moveScene(drag, null);
          setDrag(null);
        }}
      />
      {!stats.length && <div class="muted small">No scenes yet. Press Ctrl+1 for a Scene Heading.</div>}
    </div>
  );
}

async function pickImage(): Promise<string | null> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return res(null);
      const img = new Image();
      img.onload = () => {
        const max = 480;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    };
    inp.click();
  });
}
export { pickImage };

function Characters() {
  const s = useStore();
  const p = s.project!;
  const els = s.elements();
  const names = [...new Set([...allCharacters(els), ...Object.keys(p.characters)])];
  const counts = dialogueCounts(els);
  const scenes = getScenes(els);
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  return (
    <div class="col">
      <div class="row">
        <input placeholder="Add character…" value={newName} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} style="flex:1" />
        <button
          onClick={() => {
            const n = newName.trim().toUpperCase();
            if (!n) return;
            p.characters[n] = p.characters[n] || { name: n };
            setNewName('');
            store.touch();
          }}
        >
          {t('Add')}
        </button>
      </div>
      {names.map((n) => {
        const prof = p.characters[n] || { name: n };
        const inScenes = scenes.filter((sc) => sc.characters.includes(n));
        const photo = prof.photo ? p.assets[prof.photo] : '';
        const set = (patch: Partial<typeof prof>) => {
          p.characters[n] = { ...prof, ...patch };
          store.touch();
        };
        return (
          <div key={n} style="border:1px solid var(--border);border-radius:8px;padding:6px">
            <div class="row" style="cursor:pointer" onClick={() => setOpen(open === n ? null : n)}>
              {photo ? <img src={photo} style="width:34px;height:34px;border-radius:50%;object-fit:cover" /> : <span style="width:34px;height:34px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;font-weight:700">{n[0]}</span>}
              <div style="flex:1">
                <b>{n}</b>
                <div class="small muted">
                  {counts.get(n) || 0} lines · {inScenes.length} scenes{prof.role ? ' · ' + prof.role : ''}
                </div>
              </div>
            </div>
            {open === n && (
              <div class="col" style="margin-top:6px">
                <div class="row">
                  <button
                    onClick={async () => {
                      const img = await pickImage();
                      if (img) {
                        const key = 'char-' + uid('a') + '.jpg';
                        p.assets[key] = img;
                        set({ photo: key });
                      }
                    }}
                  >
                    📷 Photo
                  </button>
                  <button
                    onClick={() => {
                      const nn = prompt('Rename character everywhere in the script', n);
                      if (nn && nn.trim() && nn.toUpperCase() !== n) renameCharacter(n, nn.trim().toUpperCase());
                    }}
                  >
                    Rename
                  </button>
                </div>
                {(['age', 'role', 'actor', 'arc', 'relationships', 'notes'] as const).map((k) => (
                  <label key={k} class="small">
                    {k[0].toUpperCase() + k.slice(1)}
                    {k === 'arc' || k === 'relationships' || k === 'notes' ? (
                      <textarea rows={2} style="width:100%" value={(prof as any)[k] || ''} onChange={(e) => set({ [k]: (e.target as HTMLTextAreaElement).value })} />
                    ) : (
                      <input style="width:100%" value={(prof as any)[k] || ''} onChange={(e) => set({ [k]: (e.target as HTMLInputElement).value })} />
                    )}
                  </label>
                ))}
                <div class="small muted">Scenes:</div>
                <div class="row">
                  {inScenes.map((sc) => (
                    <button key={sc.id} class="ghost small" onClick={() => goTo(sc.id)} title={sc.heading}>
                      {sc.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!names.length && <div class="muted small">Characters appear here automatically as you write character cues.</div>}
    </div>
  );
}

function Locations() {
  const s = useStore();
  const p = s.project!;
  const els = s.elements();
  const locs = [...new Set([...allLocations(els), ...Object.keys(p.locations)])];
  const scenes = getScenes(els);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div class="col">
      {locs.map((l) => {
        const prof = p.locations[l] || { name: l };
        const inScenes = scenes.filter((sc) => sc.parsed.location === l);
        const photo = prof.photo ? p.assets[prof.photo] : '';
        const set = (patch: Partial<typeof prof>) => {
          p.locations[l] = { ...prof, ...patch };
          store.touch();
        };
        const ie = [...new Set(inScenes.map((x) => x.parsed.ie))].join(', ');
        const times = [...new Set(inScenes.map((x) => x.parsed.time))].join(', ');
        return (
          <div key={l} style="border:1px solid var(--border);border-radius:8px;padding:6px">
            <div style="cursor:pointer" onClick={() => setOpen(open === l ? null : l)}>
              <b>{l}</b>
              <div class="small muted">
                {inScenes.length} scenes · {ie} · {times}
              </div>
            </div>
            {open === l && (
              <div class="col" style="margin-top:6px">
                {photo && <img src={photo} style="width:100%;border-radius:6px" />}
                <button
                  onClick={async () => {
                    const img = await pickImage();
                    if (img) {
                      const key = 'loc-' + uid('a') + '.jpg';
                      p.assets[key] = img;
                      set({ photo: key });
                    }
                  }}
                >
                  📷 Photo
                </button>
                <label class="small">
                  Address / real location
                  <input style="width:100%" value={prof.address || ''} onChange={(e) => set({ address: (e.target as HTMLInputElement).value })} />
                </label>
                <label class="small">
                  Notes
                  <textarea rows={3} style="width:100%" value={prof.notes || ''} onChange={(e) => set({ notes: (e.target as HTMLTextAreaElement).value })} />
                </label>
                <div class="row">
                  {inScenes.map((sc) => (
                    <button key={sc.id} class="ghost small" onClick={() => goTo(sc.id)}>
                      {sc.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!locs.length && <div class="muted small">Locations appear here from your scene headings.</div>}
    </div>
  );
}

function NotesPanel() {
  const s = useStore();
  const p = s.project!;
  const [author, setAuthor] = useState('');
  const [color, setColor] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const authors = [...new Set(p.notes.map((n) => n.author))];
  const colors = [...new Set(p.notes.map((n) => n.color))];
  const list = p.notes.filter((n) => (!author || n.author === author) && (!color || n.color === color) && (showResolved || !n.resolved));
  const els = s.elements();
  return (
    <div class="col">
      <div class="row">
        <button class="primary" onClick={() => store.openDialog('note')}>
          + Note
        </button>
        <select value={author} onChange={(e) => setAuthor((e.target as HTMLSelectElement).value)}>
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select value={color} onChange={(e) => setColor((e.target as HTMLSelectElement).value)}>
          <option value="">All colours</option>
          {colors.map((c) => (
            <option key={c} value={c} style={{ background: c }}>
              {c}
            </option>
          ))}
        </select>
        <label class="small">
          <input type="checkbox" checked={showResolved} onChange={() => setShowResolved(!showResolved)} /> resolved
        </label>
      </div>
      {list.map((n) => {
        const host = els.find((e) => e.id === n.elementId);
        return (
          <div key={n.id} style={{ borderLeft: `5px solid ${n.color}`, background: 'var(--panel2)', borderRadius: '6px', padding: '6px 8px', opacity: n.resolved ? 0.5 : 1 }}>
            <div class="small muted">
              <b>{n.author}</b> · {new Date(n.created).toLocaleDateString()}
            </div>
            <div style="white-space:pre-wrap">{n.text}</div>
            {host && (
              <div class="small" style="cursor:pointer;color:var(--accent)" onClick={() => goTo(host.id)}>
                → {host.text.slice(0, 50)}
              </div>
            )}
            <div class="row">
              <button class="ghost small" onClick={() => ((n.resolved = !n.resolved), store.touch())}>
                {n.resolved ? 'Reopen' : 'Resolve'}
              </button>
              <button
                class="ghost small"
                onClick={() => {
                  p.notes = p.notes.filter((x) => x !== n);
                  removeNoteMark(n.id);
                  store.touch();
                }}
              >
                {t('Delete')}
              </button>
            </div>
          </div>
        );
      })}
      {!list.length && <div class="muted small">Select text in the script and press Ctrl+Alt+N to add a note.</div>}
    </div>
  );
}

function removeNoteMark(id: string) {
  const v = store.view;
  if (!v) return;
  const tr = v.state.tr;
  v.state.doc.descendants((n, pos) => {
    if (n.isText && n.marks.some((m) => m.type.name === 'note' && m.attrs.id === id)) {
      const m = n.marks.find((mm) => mm.type.name === 'note' && mm.attrs.id === id)!;
      tr.removeMark(pos, pos + n.nodeSize, m);
    }
  });
  if (tr.docChanged) v.dispatch(tr);
}

export { formatMinutes };
