import { useEffect, useRef, useState } from 'preact/hooks';
import { TextSelection } from 'prosemirror-state';
import { store } from '../../app/store';
import { ELEMENTS } from '../../core/elements';
import { Dialog } from './Dialog';

export function findHits(query: string, matchCase: boolean, types: string[]): { from: number; to: number }[] {
  const v = store.view;
  if (!v || !query) return [];
  const hits: { from: number; to: number }[] = [];
  const q = matchCase ? query : query.toLowerCase();
  v.state.doc.forEach((n, pos) => {
    if (types.length && !types.includes(n.attrs.type)) return;
    const text = matchCase ? n.textContent : n.textContent.toLowerCase();
    let i = text.indexOf(q);
    while (i >= 0) {
      hits.push({ from: pos + 1 + i, to: pos + 1 + i + q.length });
      i = text.indexOf(q, i + Math.max(1, q.length));
    }
  });
  return hits;
}

export function FindDialog() {
  const f = store.find;
  const [q, setQ] = useState(f.query);
  const [r, setR] = useState(f.replace);
  const [mc, setMc] = useState(f.matchCase);
  const [types, setTypes] = useState<string[]>(f.types);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const run = (index = 0) => {
    const hits = findHits(q, mc, types);
    store.find = { query: q, replace: r, matchCase: mc, types, hits, index: Math.min(index, Math.max(0, hits.length - 1)) };
    select();
  };
  const select = () => {
    const v = store.view!;
    const h = store.find.hits[store.find.index];
    store.pushDecorations();
    if (h) {
      v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, h.from, h.to)).scrollIntoView());
    }
    store.emit();
  };
  useEffect(() => run(0), [q, mc, types.join()]);
  const step = (d: number) => {
    const n = store.find.hits.length;
    if (!n) return;
    store.find.index = (store.find.index + d + n) % n;
    select();
  };
  const replaceOne = () => {
    const v = store.view!;
    const h = store.find.hits[store.find.index];
    if (!h) return;
    v.dispatch(v.state.tr.insertText(r, h.from, h.to));
    run(store.find.index);
  };
  const replaceAll = () => {
    const v = store.view!;
    const hits = findHits(q, mc, types);
    if (!hits.length) return;
    const tr = v.state.tr;
    for (const h of [...hits].reverse()) tr.insertText(r, h.from, h.to);
    v.dispatch(tr);
    store.toast(`Replaced ${hits.length} occurrence(s)`, 'ok');
    run(0);
  };
  const close = () => {
    store.find = { ...store.find, hits: [] };
    store.pushDecorations();
    store.closeDialog();
  };
  return (
    <Dialog title="Find & Replace" size="narrow" onClose={close} floating>
      <div class="col">
        <input
          ref={input}
          placeholder="Find…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
        />
        <input placeholder="Replace with…" value={r} onInput={(e) => setR((e.target as HTMLInputElement).value)} />
        <label class="small">
          <input type="checkbox" checked={mc} onChange={() => setMc(!mc)} /> Match case
        </label>
        <div class="small muted">Only in these elements (none = all):</div>
        <div class="row">
          {ELEMENTS.map((e) => (
            <label key={e.type} class="small">
              <input type="checkbox" checked={types.includes(e.type)} onChange={() => setTypes(types.includes(e.type) ? types.filter((x) => x !== e.type) : [...types, e.type])} /> {e.short}
            </label>
          ))}
        </div>
        <div class="row">
          <span class="small">{store.find.hits.length ? `${store.find.index + 1} of ${store.find.hits.length}` : 'No matches'}</span>
          <span style="flex:1" />
          <button onClick={() => step(-1)}>↑ Prev</button>
          <button onClick={() => step(1)}>↓ Next</button>
        </div>
        <div class="row">
          <button onClick={replaceOne}>Replace</button>
          <button class="primary" onClick={replaceAll}>
            Replace all
          </button>
        </div>
      </div>
    </Dialog>
  );
}
