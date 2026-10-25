import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as PMNode } from 'prosemirror-model';
import type { Layout } from '../core/paginate';
import { songLines, fightLines } from '../core/paginate';
import { hasIndic } from '../core/elements';
import { romanize } from '../core/translit';
import { REVISION_COLORS, SCENE_TAGS } from '../core/types';
import type { Template } from '../core/templates';

export type ViewMode = 'page' | 'draft' | 'speed';

export interface DecoConfig {
  layout: Layout | null;
  mode: ViewMode;
  template: Template;
  sceneNumbers: 'none' | 'left' | 'right' | 'both';
  autoContd: boolean;
  layers: { roman: boolean; meaning: boolean };
  focusMode: boolean;
  revisionMarks: boolean;
  find: { from: number; to: number; current: boolean }[];
  sceneColors: Record<string, string | undefined>;
  sceneTags: Record<string, string[] | undefined>;
  onEditBlock?: (id: string) => void;
  onMeaning?: (id: string, meaning: string) => void;
}

export const decoKey = new PluginKey<DecorationSet>('katha-deco');

let config: DecoConfig | null = null;

export function getDecoConfig(): DecoConfig | null {
  return config;
}

function pageBreakWidget(label: string, contdName: string | undefined, more: boolean, mode: ViewMode, t: Template, inline: boolean, startType?: string) {
  return () => {
    const el = document.createElement(inline ? 'span' : 'div');
    el.className = 'pb pb-' + mode + (inline ? ' pb-inline' : '');
    el.contentEditable = 'false';
    if (mode === 'page') {
      const fill = document.createElement('div');
      fill.className = 'pb-fill';
      el.appendChild(fill);
      if (more) {
        const m = document.createElement('div');
        m.className = 'pb-more';
        m.style.marginLeft = t.elements.character.left + 'in';
        m.textContent = '(MORE)';
        el.appendChild(m);
      }
      const bottom = document.createElement('div');
      bottom.className = 'pb-bottom';
      bottom.style.height = t.marginBottom + 'in';
      el.appendChild(bottom);
      const gap = document.createElement('div');
      gap.className = 'pb-gap';
      el.appendChild(gap);
      const top = document.createElement('div');
      top.className = 'pb-top';
      top.style.height = t.marginTop + 'in';
      const num = document.createElement('span');
      num.className = 'pb-num';
      num.textContent = label + '.';
      num.style.top = t.headerTop + 'in';
      top.appendChild(num);
      el.appendChild(top);
    } else {
      const line = document.createElement('div');
      line.className = 'pb-line';
      line.textContent = `page ${label}`;
      el.appendChild(line);
      if (more) {
        const m = document.createElement('div');
        m.className = 'pb-more';
        m.style.marginLeft = t.elements.character.left + 'in';
        m.textContent = '(MORE)';
        el.insertBefore(m, line);
      }
    }
    if (contdName) {
      const c = document.createElement('div');
      c.className = 'pb-contd';
      c.style.marginLeft = t.elements.character.left + 'in';
      c.textContent = `${contdName} (CONT'D)`;
      el.appendChild(c);
    }
    if (!inline && startType) el.dataset.next = startType;
    return el;
  };
}

function buildDecorations(doc: PMNode, cfg: DecoConfig, sel: EditorState['selection']): DecorationSet {
  const decos: Decoration[] = [];
  const posById = new Map<string, number>();
  const t = cfg.template;
  let sceneIdx = 0;
  const curPos = sel.$from.depth >= 1 ? sel.$from.before(1) : -1;
  doc.forEach((node, pos) => {
    const id = node.attrs.id;
    posById.set(id, pos);
    const type = node.attrs.type;
    // scene numbers + scene color strip
    if (type === 'scene') {
      sceneIdx++;
      const no = cfg.layout?.sceneNos.get(id) || String(sceneIdx);
      if (cfg.sceneNumbers !== 'none') {
        decos.push(
          Decoration.widget(pos + 1, () => {
            const f = document.createDocumentFragment();
            if (cfg.sceneNumbers === 'left' || cfg.sceneNumbers === 'both') {
              const s = document.createElement('span');
              s.className = 'scene-no left';
              s.textContent = no;
              f.appendChild(s);
            }
            if (cfg.sceneNumbers === 'right' || cfg.sceneNumbers === 'both') {
              const s = document.createElement('span');
              s.className = 'scene-no right';
              s.textContent = no;
              f.appendChild(s);
            }
            return f as unknown as HTMLElement;
          }, { side: -1, key: 'sn' + id + no + cfg.sceneNumbers, ignoreSelection: true }),
        );
      }
      const color = cfg.sceneColors[id];
      const tags = cfg.sceneTags[id];
      if (color || (tags && tags.length)) {
        decos.push(
          Decoration.widget(pos + 1, () => {
            const s = document.createElement('span');
            s.className = 'scene-strip';
            if (color) s.style.background = color;
            if (tags && tags.length) {
              s.title = tags.map((x) => SCENE_TAGS.find((y) => y.id === x)?.name || x).join(', ');
              for (const tg of tags) {
                const d = document.createElement('i');
                d.style.background = SCENE_TAGS.find((y) => y.id === tg)?.color || '#888';
                s.appendChild(d);
              }
            }
            return s;
          }, { side: -1, key: 'sc' + id + color + (tags || []).join(), ignoreSelection: true }),
        );
      }
    }
    if (type === 'character' && cfg.autoContd && cfg.layout?.contd.has(id)) {
      decos.push(
        Decoration.widget(pos + node.nodeSize - 1, () => {
          const s = document.createElement('span');
          s.className = 'auto-contd';
          s.textContent = " (CONT'D)";
          return s;
        }, { side: 1, key: 'cd' + id, ignoreSelection: true }),
      );
    }
    if ((type === 'song' || type === 'fight') ) {
      const lines = type === 'song' ? songLines({ id, type, text: '', song: node.attrs.song || {} }) : fightLines({ id, type, text: '', fight: node.attrs.fight || {} });
      const key = 'blk' + id + JSON.stringify(node.attrs.song || node.attrs.fight || {});
      decos.push(
        Decoration.widget(pos + 1, () => {
          const d = document.createElement('span');
          d.className = 'block-meta block-' + type;
          d.contentEditable = 'false';
          lines.forEach((l, i) => {
            const ln = document.createElement('span');
            ln.className = 'bm-line' + (i === 0 ? ' bm-head' : '');
            ln.textContent = l;
            d.appendChild(ln);
          });
          const btn = document.createElement('button');
          btn.className = 'bm-edit';
          btn.textContent = '✎ Edit';
          btn.onmousedown = (e) => e.preventDefault();
          btn.onclick = (e) => {
            e.preventDefault();
            config?.onEditBlock?.(id);
          };
          d.appendChild(btn);
          return d;
        }, { side: -1, key, ignoreSelection: true, stopEvent: () => true }),
      );
    }
    if (type === 'dialogue' && (cfg.layers.roman || cfg.layers.meaning) && hasIndic(node.textContent)) {
      const roman = node.attrs.roman || romanize(node.textContent);
      const meaning = node.attrs.meaning || '';
      decos.push(
        Decoration.widget(pos + node.nodeSize - 1, () => {
          const d = document.createElement('span');
          d.className = 'bi-layers';
          d.contentEditable = 'false';
          if (cfg.layers.roman) {
            const r = document.createElement('span');
            r.className = 'bi-roman';
            r.textContent = roman;
            d.appendChild(r);
          }
          if (cfg.layers.meaning) {
            const m = document.createElement('input');
            m.className = 'bi-meaning';
            m.placeholder = 'English meaning…';
            m.value = meaning;
            m.onchange = () => config?.onMeaning?.(id, m.value);
            m.onkeydown = (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                m.blur();
              }
              e.stopPropagation();
            };
            d.appendChild(m);
          }
          return d;
        }, { side: 1, key: 'bi' + id + roman + '|' + meaning + cfg.layers.roman + cfg.layers.meaning, ignoreSelection: true, stopEvent: () => true }),
      );
    }
    if (cfg.revisionMarks && node.attrs.rev) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rev-mark', 'data-rev': REVISION_COLORS[node.attrs.rev]?.name || '' }));
    }
    if (cfg.focusMode && pos === curPos) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'focus-current' }));
  });
  // page breaks
  if (cfg.layout && cfg.mode !== 'speed') {
    const pages = cfg.layout.pages;
    for (let i = 1; i < pages.length; i++) {
      const p = pages[i];
      const prev = pages[i - 1];
      const base = posById.get(p.startId);
      if (base === undefined) continue;
      const more = prev.lines.some((l) => l.kind === 'more');
      const node = doc.nodeAt(base);
      if (p.startOffset > 0 && node && p.startOffset < node.content.size) {
        decos.push(
          Decoration.widget(base + 1 + p.startOffset, pageBreakWidget(p.label, p.contdName, more, cfg.mode, cfg.template, true), {
            side: -1,
            key: `pbi${i}|${p.label}|${p.contdName}|${more}|${cfg.mode}|${t.id}`,
            ignoreSelection: true,
          }),
        );
      } else {
        decos.push(
          Decoration.widget(base, pageBreakWidget(p.label, p.contdName, more, cfg.mode, cfg.template, false, node?.attrs.type), {
            side: -1,
            key: `pb${i}|${p.label}|${p.contdName}|${more}|${cfg.mode}|${t.id}|${node?.attrs.type}`,
            ignoreSelection: true,
          }),
        );
      }
    }
  }
  for (const f of cfg.find) decos.push(Decoration.inline(f.from, f.to, { class: f.current ? 'find-hit current' : 'find-hit' }));
  return DecorationSet.create(doc, decos);
}

export function decorationsPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: decoKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set, _old, state) {
        const meta = tr.getMeta(decoKey) as DecoConfig | undefined;
        if (meta) {
          config = meta;
          return buildDecorations(state.doc, meta, state.selection);
        }
        if (config?.focusMode && (tr.selectionSet || tr.docChanged)) return buildDecorations(state.doc, config, state.selection);
        return set.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return decoKey.getState(state);
      },
    },
    view(v) {
      // fonts loading or window resizes change rendered heights without a doc change
      const iv = setInterval(() => config?.mode === 'page' && schedulePageFill(v), 1500);
      return {
        destroy() {
          clearInterval(iv);
        },
        update(view, prev) {
          if (config?.mode === 'page' && (prev.doc !== view.state.doc || decoKey.getState(prev) !== decoKey.getState(view.state))) schedulePageFill(view);
        },
      };
    },
  });
}

let fillQueued = false;
let fillTimer: any = null;
let lastFill = 0;
/**
 * Page View: size each page-break filler from the real rendered content so
 * page sheets line up exactly with the printed page height. Reads all
 * positions first, then writes all heights (two layouts in total), because a
 * filler's height shifts later pages without changing their content height.
 */
export function schedulePageFill(view: EditorView) {
  if (fillQueued) return;
  fillQueued = true;
  // throttle while typing: at most ~4 passes a second
  const wait = Math.max(0, 250 - (Date.now() - lastFill));
  clearTimeout(fillTimer);
  fillTimer = setTimeout(() => requestAnimationFrame(() => runPageFill(view)), wait);
}

function runPageFill(view: EditorView) {
  fillQueued = false;
  lastFill = Date.now();
  if (!config || config.mode !== 'page') return;
  const t = config.template;
  const contentPx = (config.layout?.contentHeight || (t.pageHeight - t.marginTop - t.marginBottom) * 72) * (96 / 72);
  const root = view.dom as HTMLElement;
  if (!root.isConnected) return;
  const breaks = Array.from(root.querySelectorAll<HTMLElement>('.pb-page'));
  const rootRect = root.getBoundingClientRect();
  const zoom = rootRect.width / (root.offsetWidth || 1) || 1;
  // ---- read pass
  let pageTop = rootRect.top / zoom + parseFloat(getComputedStyle(root).paddingTop || '0');
  const plan: { fill: HTMLElement; h: number; el: HTMLElement; mb: string | null }[] = [];
  for (const b of breaks) {
    const fill = b.querySelector<HTMLElement>('.pb-fill');
    const topBox = b.querySelector<HTMLElement>('.pb-top');
    if (!fill || !topBox) continue;
    const more = b.querySelector<HTMLElement>('.pb-more');
    const top = b.getBoundingClientRect().top / zoom;
    const used = top - pageTop + (more ? more.offsetHeight : 0);
    plan.push({ fill, h: Math.max(0, contentPx - used), el: b, mb: null });
    // both this break and the next are measured in the same (current) coordinates,
    // so each page's content height is independent of the fillers above it
    pageTop = topBox.getBoundingClientRect().bottom / zoom;
    const next = b.dataset.next;
    if (next && !b.classList.contains('pb-inline')) {
      const sb = config.template.elements[next as keyof Template['elements']]?.spaceBefore || 0;
      plan[plan.length - 1].mb = -sb * config.template.lineHeight + 'pt';
    }
  }
  // ---- write pass
  for (const p of plan) {
    const cur = parseFloat(p.fill.style.height || '0') || 0;
    if (Math.abs(cur - p.h) > 0.5) p.fill.style.height = p.h + 'px';
    if (p.mb !== null && p.el.style.marginBottom !== p.mb) p.el.style.marginBottom = p.mb;
  }
}
