import { useEffect, useRef } from 'preact/hooks';
import { store } from '../app/store';
import { prefs } from '../app/prefs';
import { createState, createView } from '../editor';
import { getTemplate, Template } from '../core/templates';
import { fontStack } from '../core/print';
import { useStore } from './hooks';
import { schedulePageFill } from '../editor/decorations';

export function templateCSS(t: Template, indicStyle: 'sans' | 'serif'): string {
  const rules: string[] = [];
  rules.push(
    `.ProseMirror{width:${t.pageWidth}in;font-family:${fontStack(indicStyle)};font-size:${t.fontSize}pt;line-height:${t.lineHeight}pt;padding:${t.marginTop}in 0 ${t.marginBottom}in 0;--page-right:${t.pageWidth - 7.5 + 0.0}in}`,
  );
  rules.push(`.ProseMirror .el.ind{line-height:${t.indicLineHeight}pt}`);
  rules.push(`.ProseMirror .el.ind .bi-layers{line-height:${t.lineHeight}pt}`);
  rules.push(`.ProseMirror .pb-num{right:${t.pageWidth - 7.5}in}`);
  for (const [type, s] of Object.entries(t.elements)) {
    rules.push(
      `.ProseMirror .el-${type}{margin-left:${s.left}in;width:${s.width}in;margin-top:${s.spaceBefore * t.lineHeight}pt;text-align:${s.align};${s.bold ? 'font-weight:700;' : ''}${s.underline ? 'text-decoration:underline;' : ''}${s.italic ? 'font-style:italic;' : ''}${s.uppercase ? 'text-transform:uppercase;' : ''}}`,
    );
  }
  // the first element on page 1 has no space before
  rules.push(`.ProseMirror > .el:first-child{margin-top:0}`);
  rules.push(`.ProseMirror .scene-no.right{left:${t.pageWidth - 0.95 - t.elements.scene.left}in}`);
  rules.push(`.ProseMirror .rev-mark::after{left:${t.pageWidth - 0.6 - (t.elements.action.left)}in;right:auto}`);
  // dual dialogue (stacked on screen, side by side in print)
  rules.push(`.ProseMirror .el.dual-left.el-dialogue,.ProseMirror .el.dual-left.el-parenthetical{margin-left:1.6in;width:2.9in}`);
  rules.push(`.ProseMirror .el.dual-left.el-character{margin-left:2.4in}`);
  rules.push(`.ProseMirror .el.dual-right.el-dialogue,.ProseMirror .el.dual-right.el-parenthetical{margin-left:4.6in;width:2.9in}`);
  rules.push(`.ProseMirror .el.dual-right.el-character{margin-left:5.4in;width:2.1in}`);
  return rules.join('\n');
}

export function EditorPane() {
  const s = useStore();
  const mount = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const styleEl = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!mount.current || !store.project) return;
    const state = createState(store.project.elements, {
      onChange: () => store.onDocChange(),
      onSelection: () => store.emitSel(),
    });
    const view = createView(mount.current, state, {
      onChange: () => store.onDocChange(),
      onSelection: (st) => {
        store.state = st;
        store.emitSel();
        if (prefs.typewriter) typewriter();
      },
    });
    store.view = view;
    store.state = view.state;
    store.computeLayout();
    view.focus();
    (window as any).__view = view;
    return () => {
      view.destroy();
      if (store.view === view) store.view = null;
    };
  }, [s.project?.id]);

  const typewriter = () => {
    const v = store.view;
    const sc = scroller.current;
    if (!v || !sc) return;
    requestAnimationFrame(() => {
      try {
        const c = v.coordsAtPos(v.state.selection.head);
        const r = sc.getBoundingClientRect();
        const target = r.top + r.height * 0.45;
        sc.scrollTop += c.top - target;
      } catch {
        /* ignore */
      }
    });
  };

  const p = s.project;
  const t = getTemplate(p?.settings.template || 'indian-a4');
  const css = templateCSS(t, p?.settings.indicFontStyle || 'sans');
  useEffect(() => {
    if (!styleEl.current) {
      styleEl.current = document.createElement('style');
      document.head.appendChild(styleEl.current);
    }
    styleEl.current.textContent = css;
    if (store.view) schedulePageFill(store.view);
  }, [css]);

  useEffect(() => {
    const v = store.view;
    if (!v) return;
    v.dom.classList.toggle('focus', prefs.focusMode);
    v.dom.classList.toggle('mode-' + prefs.mode, true);
  });

  return (
    <div class="editor-scroll" ref={scroller} onMouseDown={(e) => {
      // clicking the grey desk focuses the editor end
      if (e.target === scroller.current) {
        e.preventDefault();
        store.view?.focus();
      }
    }}>
      <div class="page-wrap" style={{ width: t.pageWidth + 'in', zoom: prefs.zoom } as any}>
        <div ref={mount} />
      </div>
    </div>
  );
}
