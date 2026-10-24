import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { useStore, useSelection } from './hooks';
import { currentElement } from '../editor/commands';
import { SCENE_TAGS, BREAKDOWN_CATEGORIES, BreakdownCategory } from '../core/types';
import { updateSceneMeta, goTo } from '../app/scriptops';
import { schema } from '../editor/schema';
import { uid } from '../core/project';
import { AIPanel } from './AIPanel';
import { WritingPanel } from './WritingPanel';
import { t } from '../i18n';
import { getScenes } from '../core/scenes';

const COLORS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#5e35b1', '#d81b60', '#6d4c41', '#90a4ae'];

export function RightPanel() {
  useStore();
  const tab = prefs.rightPanel;
  const tabs: [NonNullable<typeof prefs.rightPanel>, string][] = [
    ['scene', t('Scene')],
    ['breakdown', t('Breakdown')],
    ['ai', '✨ AI'],
    ['writing', t('Goals')],
  ];
  return (
    <aside class={'rightpanel' + (tab ? '' : ' collapsed')} data-tour="right">
      <div class="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} class={tab === id ? 'on' : ''} onClick={() => ((prefs.rightPanel = id), store.savePrefs())}>
            {label}
          </button>
        ))}
        <button style="margin-left:auto" onClick={() => ((prefs.rightPanel = null), store.savePrefs())} title="Hide panel">
          ×
        </button>
      </div>
      <div class="panel-body">
        {tab === 'scene' && <ScenePanel />}
        {tab === 'breakdown' && <BreakdownPanel />}
        {tab === 'ai' && <AIPanel />}
        {tab === 'writing' && <WritingPanel />}
      </div>
    </aside>
  );
}

export function currentSceneId(): string {
  const st = store.view?.state;
  if (!st) return '';
  const cur = currentElement(st);
  if (!cur) return '';
  let sid = '';
  st.doc.forEach((n, _p, i) => {
    if (i <= cur.index && n.attrs.type === 'scene') sid = n.attrs.id;
  });
  return sid;
}

function ScenePanel() {
  const s = useStore();
  useSelection();
  const p = s.project!;
  const sid = currentSceneId();
  if (!sid) return <div class="muted">Place the cursor inside a scene to edit its card, tags and story tracks.</div>;
  const meta = p.scenes[sid] || {};
  const heading = s.elements().find((e) => e.id === sid)?.text || '';
  const toggle = (arr: string[] | undefined, v: string) => (arr?.includes(v) ? arr.filter((x) => x !== v) : [...(arr || []), v]);
  return (
    <div class="col">
      <div>
        <b>
          {s.layout?.sceneNos.get(sid)}. {heading.toUpperCase()}
        </b>
      </div>
      <label class="small">Card title</label>
      <input value={meta.title || ''} placeholder="Short title for the index card" onChange={(e) => updateSceneMeta(sid, { title: (e.target as HTMLInputElement).value })} />
      <label class="small">{t('Synopsis')}</label>
      <textarea rows={4} value={meta.synopsis || ''} onChange={(e) => updateSceneMeta(sid, { synopsis: (e.target as HTMLTextAreaElement).value })} />
      <label class="small">{t('Color')}</label>
      <div class="row">
        {COLORS.map((c) => (
          <span
            key={c}
            onClick={() => updateSceneMeta(sid, { color: meta.color === c ? undefined : c })}
            style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer', outline: meta.color === c ? '2px solid var(--text)' : 'none', outlineOffset: '2px' }}
          />
        ))}
      </div>
      <label class="small">Commercial tags</label>
      <div class="row">
        {SCENE_TAGS.map((tg) => {
          const on = meta.tags?.includes(tg.id);
          return (
            <button key={tg.id} class={'chip' + (on ? ' sel' : '')} style={on ? { background: tg.color, borderColor: tg.color } : {}} onClick={() => updateSceneMeta(sid, { tags: toggle(meta.tags, tg.id) })}>
              {tg.name}
            </button>
          );
        })}
      </div>
      <label class="small">Energy (Pulse Chart override, 0–10)</label>
      <input type="range" min={0} max={10} value={meta.energy ?? ''} onInput={(e) => updateSceneMeta(sid, { energy: Number((e.target as HTMLInputElement).value) })} />
      <label class="small">{t('Story Tracks')}</label>
      <div class="row">
        {p.tracks.map((tr) => {
          const on = meta.tracks?.includes(tr.id);
          return (
            <button key={tr.id} class={'chip' + (on ? ' sel' : '')} style={on ? { background: tr.color, borderColor: tr.color } : {}} onClick={() => updateSceneMeta(sid, { tracks: toggle(meta.tracks, tr.id) })}>
              {tr.name}
            </button>
          );
        })}
      </div>
      <SceneNotes sid={sid} />
    </div>
  );
}

function SceneNotes({ sid }: { sid: string }) {
  const s = store;
  const els = s.elements();
  const sc = getScenes(els).find((x) => x.id === sid);
  if (!sc) return null;
  const ids = new Set(els.slice(sc.start, sc.end).map((e) => e.id));
  const notes = s.project!.notes.filter((n) => n.elementId && ids.has(n.elementId) && !n.resolved);
  if (!notes.length) return null;
  return (
    <div class="col">
      <label class="small">Notes in this scene</label>
      {notes.map((n) => (
        <div key={n.id} style={{ borderLeft: `4px solid ${n.color}`, padding: '4px 6px', background: 'var(--panel2)', borderRadius: '4px' }} class="small">
          <b>{n.author}:</b> {n.text}
        </div>
      ))}
    </div>
  );
}

/** Tag the selected text as a breakdown element. */
export function tagSelection(cat: BreakdownCategory) {
  const v = store.view;
  if (!v) return;
  const { from, to, empty } = v.state.selection;
  if (empty) {
    store.toast('Select the words to tag first (e.g. "speedboat").', 'info');
    return;
  }
  const text = v.state.doc.textBetween(from, to, ' ');
  const id = uid('b');
  const cur = currentElement(v.state);
  store.project!.breakdown.push({ id, category: cat, text: text.trim(), elementId: cur?.node.attrs.id || '' });
  v.dispatch(v.state.tr.addMark(from, to, schema.marks.tag.create({ id, cat })));
  store.touch();
}

function BreakdownPanel() {
  const s = useStore();
  useSelection();
  const p = s.project!;
  const sid = currentSceneId();
  const els = s.elements();
  const sc = getScenes(els).find((x) => x.id === sid);
  const ids = sc ? new Set(els.slice(sc.start, sc.end).map((e) => e.id)) : new Set<string>();
  const tags = p.breakdown.filter((b) => ids.has(b.elementId));
  return (
    <div class="col">
      <div class="small muted">Select words in the script, then click a category to tag them.</div>
      <div class="row">
        {BREAKDOWN_CATEGORIES.map((c) => (
          <button key={c.id} class="chip" style={{ borderColor: c.color, borderLeftWidth: '6px' }} onMouseDown={(e) => e.preventDefault()} onClick={() => tagSelection(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <hr style="border:none;border-top:1px solid var(--border);width:100%" />
      {sc ? (
        <>
          <b>
            Scene {s.layout?.sceneNos.get(sid)} breakdown
          </b>
          {BREAKDOWN_CATEGORIES.map((c) => {
            const list = tags.filter((b) => b.category === c.id);
            const auto = c.id === 'cast' ? sc.characters : [];
            if (!list.length && !auto.length) return null;
            return (
              <div key={c.id}>
                <div class="small" style={{ color: c.color, fontWeight: 700 }}>
                  {c.name}
                </div>
                {auto.map((a) => (
                  <div class="small" key={a}>
                    {a} <span class="muted">(auto)</span>
                  </div>
                ))}
                {list.map((b) => (
                  <div class="small row" key={b.id} style="justify-content:space-between">
                    <span style="cursor:pointer" onClick={() => goTo(b.elementId)}>
                      {b.text}
                    </span>
                    <button
                      class="ghost small"
                      onClick={() => {
                        p.breakdown = p.breakdown.filter((x) => x !== b);
                        removeTagMark(b.id);
                        store.touch();
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          <button onClick={() => store.openDialog('report', { kind: 'breakdown', sceneId: sid })}>🖨 Breakdown sheet</button>
        </>
      ) : (
        <div class="muted">Put the cursor in a scene.</div>
      )}
    </div>
  );
}

function removeTagMark(id: string) {
  const v = store.view;
  if (!v) return;
  const tr = v.state.tr;
  v.state.doc.descendants((n, pos) => {
    if (n.isText) for (const m of n.marks) if (m.type.name === 'tag' && m.attrs.id === id) tr.removeMark(pos, pos + n.nodeSize, m);
  });
  if (tr.docChanged) v.dispatch(tr);
}
