import { Plugin, PluginKey, EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';
import { SCENE_PREFIXES, TIMES, EXTENSIONS, TRANSITIONS, parseHeading, characterName } from '../core/elements';
import { MARKERS } from '../core/types';

export const smartTypeKey = new PluginKey('smarttype');

interface Suggest {
  items: string[];
  index: number;
  from: number; // doc positions of the text to replace
  to: number;
  suffix: (item: string) => string;
}

let docCache: { doc: PMNode | null; chars: string[]; locs: string[]; extraChars: string[] } = { doc: null, chars: [], locs: [], extraChars: [] };

/** Extra character names (from the characters database) to offer. */
export function setExtraCharacters(names: string[]) {
  docCache.extraChars = names;
  docCache.doc = null;
}

function lists(doc: PMNode) {
  if (docCache.doc === doc) return docCache;
  const freq = new Map<string, number>();
  const locs = new Set<string>();
  doc.forEach((n) => {
    if (n.attrs.type === 'character') {
      const c = characterName(n.textContent);
      if (c) freq.set(c, (freq.get(c) || 0) + 1);
    } else if (n.attrs.type === 'scene') {
      const l = parseHeading(n.textContent).location;
      if (l) locs.add(l);
    }
  });
  for (const c of docCache.extraChars) if (!freq.has(c)) freq.set(c, 0);
  docCache = {
    ...docCache,
    doc,
    chars: [...freq.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]),
    locs: [...locs].sort(),
  };
  return docCache;
}

export function computeSuggest(state: EditorState): Suggest | null {
  const sel = state.selection;
  if (!sel.empty) return null;
  const $p = sel.$from;
  if ($p.depth < 1) return null;
  const node = $p.parent;
  const type = node.attrs.type;
  const text = node.textContent;
  if ($p.parentOffset !== text.length) return null; // only at end of the element
  const start = $p.start();
  const upper = text.toUpperCase();
  const L = lists(state.doc);
  const filter = (arr: string[], q: string) => {
    const Q = q.toUpperCase();
    return arr.filter((x) => x.toUpperCase().startsWith(Q) && x.toUpperCase() !== Q).slice(0, 8);
  };
  if (type === 'scene') {
    const pm = upper.match(/^(INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|INT\.|EXT\.|EST\.)\s?/);
    if (!pm) {
      const items = SCENE_PREFIXES.filter((p) => p.startsWith(upper) && p !== upper);
      return items.length ? { items, index: 0, from: start, to: start + text.length, suffix: () => '' } : null;
    }
    const rest = text.slice(pm[0].length);
    const dash = rest.lastIndexOf(' - ');
    if (dash < 0) {
      if (/\s-\s?$/.test(rest)) {
        const items = TIMES.slice(0, 10);
        return { items, index: 0, from: start + text.length - (rest.endsWith(' ') ? 0 : 0), to: start + text.length, suffix: () => '' };
      }
      const items = filter(L.locs, rest);
      if (!items.length) return null;
      const off = pm[0].length;
      return { items, index: 0, from: start + off, to: start + text.length, suffix: () => ' - ' };
    }
    const timePart = rest.slice(dash + 3);
    const items = filter(TIMES, timePart);
    if (!items.length) return null;
    const off = pm[0].length + dash + 3;
    return { items, index: 0, from: start + off, to: start + text.length, suffix: () => '' };
  }
  if (type === 'character') {
    if (!text) return null;
    const paren = text.lastIndexOf('(');
    if (paren >= 0) {
      const q = text.slice(paren);
      const items = EXTENSIONS.filter((x) => x.startsWith(q.toUpperCase()) && x !== q.toUpperCase());
      return items.length ? { items, index: 0, from: start + paren, to: start + text.length, suffix: () => '' } : null;
    }
    const items = filter(L.chars, text);
    return items.length ? { items, index: 0, from: start, to: start + text.length, suffix: () => '' } : null;
  }
  if (type === 'transition') {
    if (!text) return null;
    const items = filter(TRANSITIONS, text);
    return items.length ? { items, index: 0, from: start, to: start + text.length, suffix: () => '' } : null;
  }
  if (type === 'montage') {
    const items = filter(MARKERS, text);
    return items.length ? { items, index: 0, from: start, to: start + text.length, suffix: () => '' } : null;
  }
  return null;
}

export function smartTypePlugin(): Plugin {
  let current: Suggest | null = null;
  let dismissedFor = '';
  let box: HTMLDivElement | null = null;
  let enabled = true;
  let armed = -1;

  const render = (view: EditorView) => {
    if (!box) return;
    if (!current || !enabled) {
      box.style.display = 'none';
      return;
    }
    box.innerHTML = '';
    current.items.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = 'st-item' + (i === current!.index ? ' active' : '');
      d.textContent = it;
      // press keeps focus in the script; the suggestion is taken on a full click on it
      d.onmousedown = (ev) => {
        ev.preventDefault();
        armed = i;
      };
      d.onclick = () => {
        if (armed !== i || !current) return;
        armed = -1;
        current.index = i;
        accept(view);
      };
      box!.appendChild(d);
    });
    const coords = view.coordsAtPos(current.from);
      box.style.display = 'block';
      box.style.left = Math.min(coords.left, window.innerWidth - box.offsetWidth - 8) + 'px';
      const below = coords.bottom + 4;
      box.style.top = (below + box.offsetHeight > window.innerHeight - 8 ? Math.max(8, coords.top - box.offsetHeight - 4) : below) + 'px';
  };

  const accept = (view: EditorView) => {
    if (!current) return false;
    const item = current.items[current.index];
    const ins = item + current.suffix(item);
    const tr = view.state.tr.insertText(ins, current.from, current.to);
    tr.setSelection(TextSelection.create(tr.doc, current.from + ins.length));
    current = null;
    view.dispatch(tr);
    view.focus();
    return true;
  };

  return new Plugin({
    key: smartTypeKey,
    view(view) {
      box = document.createElement('div');
      box.className = 'smarttype';
      box.style.display = 'none';
      document.body.appendChild(box);
      return {
        update(v, prev) {
          if (prev && prev.doc === v.state.doc && prev.selection.eq(v.state.selection)) return;
          const s = computeSuggest(v.state);
          const sig = s ? s.items.join('|') + s.from : '';
          if (s && sig === dismissedFor) current = null;
          else {
            dismissedFor = '';
            current = s;
          }
          render(v);
        },
        destroy() {
          box?.remove();
          box = null;
        },
      };
    },
    props: {
      handleKeyDown(view, ev) {
        if (!current || !enabled) return false;
        if (ev.key === 'ArrowDown') {
          current.index = (current.index + 1) % current.items.length;
          render(view);
          return true;
        }
        if (ev.key === 'ArrowUp') {
          current.index = (current.index - 1 + current.items.length) % current.items.length;
          render(view);
          return true;
        }
        if (ev.key === 'Enter' || ev.key === 'Tab') {
          if (ev.shiftKey) return false;
          return accept(view);
        }
        if (ev.key === 'Escape') {
          dismissedFor = current.items.join('|') + current.from;
          current = null;
          render(view);
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        blur(view) {
          current = null;
          render(view);
          return false;
        },
      },
    },
  });
}

export function setSmartTypeEnabled(_on: boolean) {
  // reserved for settings toggle; SmartType is on by default
}
