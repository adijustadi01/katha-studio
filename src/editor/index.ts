import { EditorState, Plugin, TextSelection, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap, toggleMark, chainCommands } from 'prosemirror-commands';
import { schema, docFromElements } from './schema';
import {
  smartEnter,
  smartTab,
  smartBackspace,
  setElementType,
  uniqueIdsPlugin,
  handleParenInput,
  makeDual,
} from './commands';
import { smartTypePlugin } from './smarttype';
import { decorationsPlugin } from './decorations';
import { phoneticPlugin } from './phonetic';
import { revisionPlugin } from './revision';
import { DIGIT_SHORTCUTS } from '../core/elements';
import type { ScriptElement } from '../core/types';

export interface EditorHooks {
  onChange: (state: EditorState, tr: Transaction) => void;
  onSelection: (state: EditorState) => void;
  extraKeys?: Record<string, (s: EditorState, d?: (tr: Transaction) => void, v?: EditorView) => boolean>;
}

export function createState(els: ScriptElement[], hooks: EditorHooks): EditorState {
  const keys: Record<string, any> = {
    Enter: smartEnter,
    Tab: smartTab(false),
    'Shift-Tab': smartTab(true),
    Backspace: smartBackspace,
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
    'Mod-b': toggleMark(schema.marks.bold),
    'Mod-i': toggleMark(schema.marks.italic),
    'Mod-u': toggleMark(schema.marks.underline),
    'Shift-Enter': (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      dispatch?.(state.tr.insertText('\n').scrollIntoView());
      return true;
    },
    'Mod-d': makeDual,
    'Mod-Shift-i': setElementType('interval'),
    'Mod-Shift-f': setElementType('fight'),
    'Mod-Shift-m': setElementType('montage'),
    'Mod-Shift-e': setElementType('centered'),
    'Mod-Shift-a': setElementType('act'),
  };
  DIGIT_SHORTCUTS.forEach((t, i) => {
    keys['Mod-' + (i + 1)] = setElementType(t);
    keys['Alt-' + (i + 1)] = setElementType(t);
  });
  Object.assign(keys, hooks.extraKeys || {});
  const plugins: Plugin[] = [
    phoneticPlugin(),
    smartTypePlugin(),
    keymap(keys),
    keymap({ ...baseKeymap, Backspace: chainCommands(smartBackspace, baseKeymap.Backspace) }),
    history({ depth: 100000, newGroupDelay: 700 }),
    uniqueIdsPlugin,
    revisionPlugin(),
    decorationsPlugin(),
  ];
  return EditorState.create({ schema, doc: docFromElements(els), plugins });
}

export function createView(mount: HTMLElement, state: EditorState, hooks: EditorHooks): EditorView {
  const view: EditorView = new EditorView(mount, {
    state,
    dispatchTransaction(tr) {
      const ns = view.state.apply(tr);
      view.updateState(ns);
      if (tr.docChanged) hooks.onChange(ns, tr);
      if (tr.docChanged || tr.selectionSet) hooks.onSelection(ns);
    },
    handleTextInput(v, from, to, text) {
      return handleParenInput(v.state, from, to, text, v.dispatch);
    },
    attributes: { class: 'script', spellcheck: 'true' },
    clipboardTextSerializer(slice) {
      const parts: string[] = [];
      slice.content.forEach((n) => parts.push(n.textContent));
      return parts.join('\n\n');
    },
  });
  return view;
}

export function replaceDoc(view: EditorView, els: ScriptElement[], keepHistory = false) {
  const doc = docFromElements(els);
  if (keepHistory) {
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
    view.dispatch(tr);
  } else {
    const st = EditorState.create({ schema, doc, plugins: view.state.plugins });
    view.updateState(st);
  }
}

export function scrollToElement(view: EditorView, id: string, select = true) {
  let target = -1;
  view.state.doc.forEach((n, pos) => {
    if (n.attrs.id === id) target = pos;
  });
  if (target < 0) return;
  if (select) {
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, target + 1));
    view.dispatch(tr);
  }
  const dom = view.nodeDOM(target) as HTMLElement | null;
  dom?.scrollIntoView({ block: 'center' });
  view.focus();
}

export { schema };
