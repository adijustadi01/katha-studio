import { EditorState, Transaction, TextSelection, Plugin, PluginKey } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import type { ElementType } from '../core/types';
import { nextOnEnter, tabTarget, enterOnEmpty } from '../core/elements';
import { uid } from '../core/project';
import { schema } from './schema';

type Cmd = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

export function currentElement(state: EditorState): { node: PMNode; pos: number; index: number } | null {
  const $from = state.selection.$from;
  if ($from.depth < 1) {
    const n = state.doc.nodeAt($from.pos);
    if (n) return { node: n, pos: $from.pos, index: $from.index(0) };
    return null;
  }
  return { node: $from.node(1), pos: $from.before(1), index: $from.index(0) };
}

function defaultAttrs(type: ElementType): Record<string, unknown> {
  return { id: uid(), type };
}

/** Change the type of the element(s) in the selection. */
export function setElementType(type: ElementType): Cmd {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    const tr = state.tr;
    let changed = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type !== schema.nodes.element) return false;
      if (node.attrs.type !== type) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, type, dual: type === 'character' || type === 'dialogue' || type === 'parenthetical' ? node.attrs.dual : null });
        changed = true;
        if (type === 'parenthetical' && node.textContent === '') {
          tr.insertText('()', tr.mapping.map(pos) + 1);
          tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(pos) + 2));
        } else if (type === 'parenthetical' && !node.textContent.startsWith('(')) {
          const p = tr.mapping.map(pos) + 1;
          tr.insertText('(', p);
          tr.insertText(')', p + 1 + node.textContent.length);
        } else if (node.attrs.type === 'parenthetical' && /^\(.*\)$/.test(node.textContent)) {
          const p = tr.mapping.map(pos) + 1;
          tr.delete(p + node.textContent.length - 1, p + node.textContent.length);
          tr.delete(p, p + 1);
        }
        if (type === 'interval' && node.textContent === '') {
          tr.insertText('INTERVAL', tr.mapping.map(pos) + 1);
        }
      }
      return false;
    });
    if (!changed) return false;
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

/** Insert a new element after the current one and put the cursor in it. */
export function insertElementAfter(type: ElementType, text = '', attrs: Record<string, unknown> = {}): Cmd {
  return (state, dispatch) => {
    const cur = currentElement(state);
    if (!cur) return false;
    const end = cur.pos + cur.node.nodeSize;
    const node = schema.nodes.element.create({ ...defaultAttrs(type), ...attrs }, text ? schema.text(text) : null);
    const tr = state.tr.insert(end, node);
    const caret = type === 'parenthetical' && text === '()' ? end + 2 : end + 1 + text.length;
    tr.setSelection(TextSelection.create(tr.doc, caret));
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

/** Smart Enter: create the natural next element; on empty elements cycle the type. */
export const smartEnter: Cmd = (state, dispatch) => {
  const cur = currentElement(state);
  if (!cur) return false;
  const { node, pos } = cur;
  const type = node.attrs.type as ElementType;
  const sel = state.selection;
  if (!sel.empty) {
    const tr = state.tr.deleteSelection();
    dispatch?.(tr);
    return true;
  }
  const offset = sel.$from.parentOffset;
  const text = node.textContent;
  if (text.trim() === '' && type !== 'general') {
    const t2 = enterOnEmpty(type);
    if (t2) {
      return setElementType(t2)(state, dispatch);
    }
  }
  // inside parenthetical before the closing ")" → still jump to dialogue
  const atEnd = offset >= text.length || (type === 'parenthetical' && text.slice(offset) === ')');
  if (atEnd) {
    let next = nextOnEnter(type);
    // dual dialogue: keep the dual flag on following dialogue
    const attrs: Record<string, unknown> = {};
    if (node.attrs.dual && (next === 'dialogue' || next === 'parenthetical')) attrs.dual = node.attrs.dual;
    if (type === 'dialogue' && node.attrs.dual === 'left') {
      next = 'character';
      attrs.dual = 'right';
    }
    const tr = state.tr;
    const end = pos + node.nodeSize;
    tr.insert(end, schema.nodes.element.create({ ...defaultAttrs(next), ...attrs }));
    tr.setSelection(TextSelection.create(tr.doc, end + 1));
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  // split in the middle: the new element keeps the type
  const tr = state.tr.split(sel.from, 1, [{ type: schema.nodes.element, attrs: { ...node.attrs, id: uid(), song: null, fight: null, sceneNo: null } }]);
  dispatch?.(tr.scrollIntoView());
  return true;
};

/** Smart Tab per the screenplay flow rules. */
export function smartTab(shift: boolean): Cmd {
  return (state, dispatch) => {
    const cur = currentElement(state);
    if (!cur) return false;
    const { node, pos } = cur;
    const type = node.attrs.type as ElementType;
    const text = node.textContent;
    const empty = text.trim() === '';
    const target = tabTarget(type, empty, shift);
    if (!target) return true; // swallow Tab
    if (!shift && type === 'dialogue' && !empty) {
      // Tab in dialogue → parenthetical (new one after the cursor)
      const offset = state.selection.$from.parentOffset;
      const tr = state.tr;
      let insertAt: number;
      if (offset >= text.length) insertAt = pos + node.nodeSize;
      else {
        tr.split(state.selection.from, 1, [{ type: schema.nodes.element, attrs: { ...node.attrs, id: uid() } }]);
        insertAt = state.selection.from + 1;
      }
      tr.insert(insertAt, schema.nodes.element.create({ ...defaultAttrs('parenthetical'), dual: node.attrs.dual }, schema.text('()')));
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 2));
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    if (!shift && type === 'character' && !empty) {
      return insertElementAfter('parenthetical', '()', { dual: node.attrs.dual })(state, dispatch);
    }
    return setElementType(target)(state, dispatch);
  };
}

/** Insert dual dialogue: marks the current speech as left and starts a right-hand character. */
export const makeDual: Cmd = (state, dispatch) => {
  const cur = currentElement(state);
  if (!cur) return false;
  // find the speech block containing the cursor
  let start = cur.index;
  const doc = state.doc;
  while (start > 0 && ['dialogue', 'parenthetical'].includes(doc.child(start).attrs.type)) start--;
  if (doc.child(start).attrs.type !== 'character') return false;
  let end = start + 1;
  while (end < doc.childCount && ['dialogue', 'parenthetical'].includes(doc.child(end).attrs.type)) end++;
  const tr = state.tr;
  let pos = 0;
  for (let i = 0; i < end; i++) {
    const n = doc.child(i);
    if (i >= start) tr.setNodeMarkup(pos, undefined, { ...n.attrs, dual: 'left' });
    pos += n.nodeSize;
  }
  // if a following speech exists, make it the right column; otherwise create one
  if (end < doc.childCount && doc.child(end).attrs.type === 'character') {
    let p2 = pos;
    let j = end;
    tr.setNodeMarkup(p2, undefined, { ...doc.child(j).attrs, dual: 'right' });
    p2 += doc.child(j).nodeSize;
    j++;
    while (j < doc.childCount && ['dialogue', 'parenthetical'].includes(doc.child(j).attrs.type)) {
      tr.setNodeMarkup(p2, undefined, { ...doc.child(j).attrs, dual: 'right' });
      p2 += doc.child(j).nodeSize;
      j++;
    }
  } else {
    tr.insert(pos, schema.nodes.element.create({ ...defaultAttrs('character'), dual: 'right' }));
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  }
  dispatch?.(tr.scrollIntoView());
  return true;
};

export const clearDual: Cmd = (state, dispatch) => {
  const cur = currentElement(state);
  if (!cur || !cur.node.attrs.dual) return false;
  const tr = state.tr;
  const doc = state.doc;
  let pos = 0;
  // clear on the contiguous dual block around the cursor
  let s = cur.index;
  while (s > 0 && doc.child(s - 1).attrs.dual) s--;
  let e = cur.index;
  while (e < doc.childCount - 1 && doc.child(e + 1).attrs.dual) e++;
  for (let i = 0; i <= e; i++) {
    const n = doc.child(i);
    if (i >= s) tr.setNodeMarkup(pos, undefined, { ...n.attrs, dual: null });
    pos += n.nodeSize;
  }
  dispatch?.(tr);
  return true;
};

/** Backspace at the start of an empty element deletes it and moves to the previous end. */
export const smartBackspace: Cmd = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty || sel.$from.parentOffset !== 0) return false;
  const cur = currentElement(state);
  if (!cur || cur.index === 0) return false;
  if (cur.node.content.size === 0) {
    const tr = state.tr.delete(cur.pos, cur.pos + cur.node.nodeSize);
    tr.setSelection(TextSelection.near(tr.doc.resolve(cur.pos - 1), -1));
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  return false;
};

/** Keeps element ids unique (split/paste duplicate attrs). */
export const uniqueIdsPlugin = new Plugin({
  key: new PluginKey('uniqueIds'),
  appendTransaction(trs, _old, state) {
    if (!trs.some((t) => t.docChanged)) return null;
    const seen = new Set<string>();
    let tr: Transaction | null = null;
    state.doc.forEach((n, pos) => {
      const id = n.attrs.id;
      if (!id || seen.has(id)) {
        tr = tr || state.tr;
        const nid = uid();
        tr.setNodeMarkup(pos, undefined, { ...n.attrs, id: nid });
        seen.add(nid);
      } else seen.add(id);
    });
    if (tr) (tr as Transaction).setMeta('addToHistory', false);
    return tr;
  },
});

/** Skip over an auto-inserted ")" when typed at the end of a parenthetical. */
export function handleParenInput(state: EditorState, from: number, to: number, text: string, dispatch: (tr: Transaction) => void): boolean {
  if (text !== ')') return false;
  const cur = currentElement(state);
  if (!cur || cur.node.attrs.type !== 'parenthetical') return false;
  const $p = state.doc.resolve(from);
  if (state.doc.textBetween(from, Math.min(to + 1, $p.end())) === ')') {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, from + 1)));
    return true;
  }
  return false;
}
