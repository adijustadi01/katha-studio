// Live phonetic typing: Roman keystrokes become native script as you type.
// The Roman spelling of the word being typed is kept in a buffer; every
// keystroke re-renders the whole word, so corrections (Backspace) work on the
// Roman letters. Space, punctuation, Enter or moving the cursor commits.
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { candidates, transliterateWord, learn, IndicLang } from '../core/translit';

export const phoneticKey = new PluginKey('phonetic');

interface Comp {
  roman: string;
  from: number; // start of the composed native word
  to: number;
  choices: string[];
  index: number;
}

let lang: IndicLang | null = null;
let listeners: ((l: IndicLang | null) => void)[] = [];

export function setPhoneticLang(l: IndicLang | null) {
  lang = l;
  listeners.forEach((f) => f(l));
}
export function getPhoneticLang(): IndicLang | null {
  return lang;
}
export function onPhoneticChange(f: (l: IndicLang | null) => void) {
  listeners.push(f);
  return () => (listeners = listeners.filter((x) => x !== f));
}

export function phoneticPlugin(): Plugin {
  let comp: Comp | null = null;
  let box: HTMLDivElement | null = null;
  let internal = false;

  const render = (view: EditorView) => {
    if (!box) return;
    if (!comp || !lang) {
      box.style.display = 'none';
      return;
    }
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'ph-roman';
    head.textContent = comp.roman;
    box.appendChild(head);
    comp.choices.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'ph-item' + (i === comp!.index ? ' active' : '');
      d.innerHTML = `<b>${i + 1}</b> `;
      d.appendChild(document.createTextNode(c));
      d.onmousedown = (e) => {
        e.preventDefault();
        choose(view, i, true);
      };
      box!.appendChild(d);
    });
    const hint = document.createElement('div');
    hint.className = 'ph-hint';
    hint.textContent = '↑↓ / 1-9 choose · Space commit · Esc keep Roman';
    box.appendChild(hint);
    try {
      const c = view.coordsAtPos(comp.from);
      box.style.display = 'block';
      box.style.left = Math.min(c.left, window.innerWidth - box.offsetWidth - 8) + 'px';
      const below = c.bottom + 4;
      box.style.top = (below + box.offsetHeight > window.innerHeight - 8 ? Math.max(8, c.top - box.offsetHeight - 4) : below) + 'px';
    } catch {
      box.style.display = 'none';
    }
  };

  const replaceWord = (view: EditorView, text: string) => {
    if (!comp) return;
    internal = true;
    const tr = view.state.tr.insertText(text, comp.from, comp.to);
    tr.setMeta(phoneticKey, true);
    comp.to = comp.from + text.length;
    tr.setSelection(TextSelection.create(tr.doc, comp.to));
    view.dispatch(tr);
    internal = false;
  };

  const choose = (view: EditorView, i: number, commit: boolean) => {
    if (!comp) return;
    comp.index = i;
    replaceWord(view, comp.choices[i]);
    if (commit) finish(view, true);
    else render(view);
  };

  const finish = (view: EditorView, learnIt: boolean) => {
    if (comp && lang && learnIt && comp.index !== 0) learn(lang, comp.roman, comp.choices[comp.index]);
    comp = null;
    render(view);
  };

  const update = (view: EditorView, roman: string) => {
    if (!comp || !lang) return;
    comp.roman = roman;
    if (!roman) {
      replaceWord(view, '');
      comp = null;
      render(view);
      return;
    }
    comp.choices = candidates(roman, lang, 9);
    if (!comp.choices.length) comp.choices = [transliterateWord(roman, lang)];
    comp.index = 0;
    replaceWord(view, comp.choices[0]);
    render(view);
  };

  return new Plugin({
    key: phoneticKey,
    view() {
      box = document.createElement('div');
      box.className = 'phonetic-box';
      box.style.display = 'none';
      document.body.appendChild(box);
      return {
        update(view, prev) {
          if (internal || !comp) return;
          // cursor moved away or doc changed externally → commit
          const sel = view.state.selection;
          if (!sel.empty || sel.from !== comp.to || (prev.doc !== view.state.doc && !view.state.doc.eq(prev.doc) && false)) {
            finish(view, false);
          }
        },
        destroy() {
          box?.remove();
        },
      };
    },
    props: {
      handleTextInput(view, from, to, text) {
        if (!lang) return false;
        if (/^[A-Za-z]$/.test(text)) {
          if (!comp || comp.to !== from || from !== to) {
            comp = { roman: '', from, to, choices: [], index: 0 };
            if (from !== to) {
              internal = true;
              view.dispatch(view.state.tr.delete(from, to).setMeta(phoneticKey, true));
              internal = false;
              comp.to = from;
            }
          }
          update(view, comp.roman + text);
          return true;
        }
        if (comp) {
          // punctuation / space commits the current word
          finish(view, true);
        }
        return false;
      },
      handleKeyDown(view, ev) {
        if (ev.key === ' ' && ev.ctrlKey) {
          // Ctrl+Space toggles phonetic typing — handled by app; let it bubble
          return false;
        }
        if (!comp || !lang) return false;
        if (ev.key === 'Backspace') {
          update(view, comp.roman.slice(0, -1));
          return true;
        }
        if (ev.key === 'ArrowDown') {
          choose(view, (comp.index + 1) % comp.choices.length, false);
          return true;
        }
        if (ev.key === 'ArrowUp') {
          choose(view, (comp.index - 1 + comp.choices.length) % comp.choices.length, false);
          return true;
        }
        if (/^[1-9]$/.test(ev.key) && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
          const i = Number(ev.key) - 1;
          if (i < comp.choices.length) {
            choose(view, i, true);
            return true;
          }
        }
        if (ev.key === 'Escape') {
          // keep the Roman letters as typed
          replaceWord(view, comp.roman);
          comp = null;
          render(view);
          return true;
        }
        if (ev.key === 'Enter' || ev.key === 'Tab') {
          finish(view, true);
          return false;
        }
        if (ev.key.startsWith('Arrow') || ev.key === 'Home' || ev.key === 'End') {
          finish(view, true);
          return false;
        }
        return false;
      },
      handleDOMEvents: {
        blur(view) {
          if (comp) finish(view, true);
          return false;
        },
        compositionstart(view) {
          // OS input methods (Windows Indic keyboards, Google Input Tools) take over
          if (comp) finish(view, false);
          return false;
        },
      },
    },
  });
}
