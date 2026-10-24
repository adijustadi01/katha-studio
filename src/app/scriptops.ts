import { store } from './store';
import { getScenes } from '../core/scenes';
import type { ScriptElement, SceneMeta } from '../core/types';
import { docFromElements } from '../editor/schema';
import { scrollToElement } from '../editor';

/**
 * Replace the script with new elements in one undoable step. Only the range
 * that actually differs is replaced, so revision marks stay accurate.
 */
export function setElements(els: ScriptElement[], noRevision = false) {
  const v = store.view;
  if (!v) return;
  const next = docFromElements(els);
  const old = v.state.doc;
  const n = old.childCount;
  const m = next.childCount;
  let pre = 0;
  while (pre < n && pre < m && old.child(pre).eq(next.child(pre))) pre++;
  let suf = 0;
  while (suf < n - pre && suf < m - pre && old.child(n - 1 - suf).eq(next.child(m - 1 - suf))) suf++;
  if (pre === n && pre === m) return;
  let from = 0;
  for (let i = 0; i < pre; i++) from += old.child(i).nodeSize;
  let to = old.content.size;
  for (let i = 0; i < suf; i++) to -= old.child(n - 1 - i).nodeSize;
  const nodes = [];
  for (let i = pre; i < m - suf; i++) nodes.push(next.child(i));
  const tr = v.state.tr.replaceWith(from, to, nodes);
  if (noRevision) tr.setMeta('noRevision', true);
  v.dispatch(tr);
}

/** Move scene `id` so it sits before scene `beforeId` (or at the end when null). */
export function moveScene(id: string, beforeId: string | null) {
  if (id === beforeId) return;
  const els = store.elements();
  const scenes = getScenes(els);
  const s = scenes.find((x) => x.id === id);
  if (!s) return;
  const block = els.slice(s.start, s.end);
  const rest = [...els.slice(0, s.start), ...els.slice(s.end)];
  let at = rest.length;
  if (beforeId) {
    const i = rest.findIndex((e) => e.id === beforeId);
    if (i >= 0) at = i;
  }
  // a trailing interval / transition stays where it was: only scene content moves
  const out = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  setElements(out);
}

/** Move a scene to a given act/position by index. */
export function reorderScenes(order: string[]) {
  const els = store.elements();
  const scenes = getScenes(els);
  if (!scenes.length) return;
  const pre = els.slice(0, scenes[0].start);
  const blocks = new Map(scenes.map((s) => [s.id, els.slice(s.start, s.end)]));
  const out = [...pre];
  for (const id of order) out.push(...(blocks.get(id) || []));
  setElements(out);
}

export function sceneMeta(id: string): SceneMeta {
  const p = store.project!;
  return (p.scenes[id] ||= {});
}

export function updateSceneMeta(id: string, patch: Partial<SceneMeta>) {
  const p = store.project!;
  p.scenes[id] = { ...(p.scenes[id] || {}), ...patch };
  store.touch();
}

export function goTo(id: string) {
  store.setMain('script');
  setTimeout(() => store.view && scrollToElement(store.view, id), 30);
}

/** Insert a new scene at the end (used by cards/outline "add scene"). */
export function addScene(heading = 'INT. NEW LOCATION - DAY', after?: string) {
  const els = store.elements();
  const scenes = getScenes(els);
  let at = els.length;
  if (after) {
    const s = scenes.find((x) => x.id === after);
    if (s) at = s.end;
  }
  const id = 'e' + Date.now().toString(36);
  const out = [...els.slice(0, at), { id, type: 'scene' as const, text: heading }, { id: id + 'a', type: 'action' as const, text: '' }, ...els.slice(at)];
  setElements(out);
  return id;
}

export function deleteScene(id: string) {
  const els = store.elements();
  const s = getScenes(els).find((x) => x.id === id);
  if (!s) return;
  setElements([...els.slice(0, s.start), ...els.slice(s.end)]);
}

export function renameCharacter(oldName: string, newName: string) {
  const els = store.elements().map((e) => {
    if (e.type === 'character' && e.text.replace(/\(.*?\)/g, '').trim().toUpperCase() === oldName) {
      return { ...e, text: e.text.replace(new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), newName) };
    }
    return e;
  });
  setElements(els);
  const p = store.project!;
  if (p.characters[oldName]) {
    p.characters[newName] = { ...p.characters[oldName], name: newName };
    delete p.characters[oldName];
  }
  store.touch();
}
