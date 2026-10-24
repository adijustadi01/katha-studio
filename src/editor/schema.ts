import { Schema, Node as PMNode, Mark } from 'prosemirror-model';
import type { ScriptElement, Span, ElementType } from '../core/types';
import { hasIndic, detectLang } from '../core/elements';
import { uid } from '../core/project';

export const schema = new Schema({
  nodes: {
    doc: { content: 'element+' },
    element: {
      content: 'text*',
      marks: '_',
      whitespace: 'pre',
      defining: true,
      attrs: {
        id: { default: '' },
        type: { default: 'action' },
        lang: { default: null },
        dual: { default: null },
        roman: { default: null },
        meaning: { default: null },
        rev: { default: null },
        sceneNo: { default: null },
        omitted: { default: false },
        pageBreak: { default: false },
        song: { default: null },
        fight: { default: null },
        marker: { default: null },
      },
      parseDOM: [
        {
          tag: 'p.el',
          getAttrs: (dom) => {
            const d = dom as HTMLElement;
            return { id: d.dataset.id || uid(), type: d.dataset.type || 'action' };
          },
        },
        { tag: 'p', getAttrs: () => ({ id: uid(), type: 'action' }) },
      ],
      toDOM: (node) => {
        const t = node.attrs.type as ElementType;
        const text = node.textContent;
        const ind = hasIndic(text);
        const lang = node.attrs.lang || (ind ? detectLang(text) : 'en');
        const cls = ['el', 'el-' + t];
        if (ind) cls.push('ind');
        if (node.attrs.dual) cls.push('dual-' + node.attrs.dual);
        if (node.attrs.omitted) cls.push('omitted');
        return [
          'p',
          {
            class: cls.join(' '),
            'data-type': t,
            'data-id': node.attrs.id,
            lang,
            spellcheck: ind ? 'false' : 'true',
          },
          0,
        ];
      },
    },
    text: {},
  },
  marks: {
    bold: { toDOM: () => ['strong', 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }] },
    italic: { toDOM: () => ['em', 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }] },
    underline: { toDOM: () => ['u', 0], parseDOM: [{ tag: 'u' }] },
    note: {
      attrs: { id: {} },
      inclusive: false,
      excludes: '',
      toDOM: (m) => ['span', { class: 'note-mark', 'data-note': m.attrs.id }, 0],
      parseDOM: [{ tag: 'span.note-mark', getAttrs: (d) => ({ id: (d as HTMLElement).dataset.note }) }],
    },
    tag: {
      attrs: { id: {}, cat: {} },
      inclusive: false,
      excludes: '',
      toDOM: (m) => ['span', { class: 'bd-tag bd-' + m.attrs.cat, 'data-tag': m.attrs.id }, 0],
      parseDOM: [
        { tag: 'span.bd-tag', getAttrs: (d) => ({ id: (d as HTMLElement).dataset.tag, cat: 'props' }) },
      ],
    },
    highlight: {
      attrs: { color: { default: '#fff59d' } },
      toDOM: (m) => ['mark', { style: `background:${m.attrs.color}` }, 0],
      parseDOM: [{ tag: 'mark' }],
    },
  },
});

const ATTR_KEYS = ['lang', 'dual', 'roman', 'meaning', 'rev', 'sceneNo', 'omitted', 'pageBreak', 'song', 'fight', 'marker'] as const;

export function elementToNode(e: ScriptElement): PMNode {
  const attrs: Record<string, unknown> = { id: e.id || uid(), type: e.type };
  for (const k of ATTR_KEYS) if ((e as any)[k] !== undefined) attrs[k] = (e as any)[k];
  if (!e.text) return schema.nodes.element.create(attrs);
  const content: PMNode[] = [];
  // build marked text runs from spans
  const spans = (e.spans || []).filter((s) => s.to > s.from);
  const cuts = new Set<number>([0, e.text.length]);
  for (const s of spans) {
    cuts.add(Math.max(0, Math.min(e.text.length, s.from)));
    cuts.add(Math.max(0, Math.min(e.text.length, s.to)));
  }
  const pts = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a === b) continue;
    const marks: Mark[] = [];
    for (const s of spans)
      if (s.from <= a && s.to >= b) {
        const m = spanToMark(s);
        if (m) marks.push(m);
      }
    content.push(schema.text(e.text.slice(a, b), Mark.setFrom(marks)));
  }
  return schema.nodes.element.create(attrs, content);
}

function spanToMark(s: Span): Mark | null {
  switch (s.kind) {
    case 'bold':
      return schema.marks.bold.create();
    case 'italic':
      return schema.marks.italic.create();
    case 'underline':
      return schema.marks.underline.create();
    case 'note':
      return schema.marks.note.create({ id: s.ref });
    case 'tag': {
      const [cat, id] = (s.ref || 'props:').split(':');
      return schema.marks.tag.create({ id, cat });
    }
    case 'highlight':
      return schema.marks.highlight.create({ color: s.ref || '#fff59d' });
  }
  return null;
}

export function nodeToElement(n: PMNode): ScriptElement {
  const e: ScriptElement = { id: n.attrs.id, type: n.attrs.type, text: n.textContent };
  for (const k of ATTR_KEYS) {
    const v = n.attrs[k];
    if (v !== null && v !== undefined && v !== false) (e as any)[k] = v;
  }
  const spans: Span[] = [];
  let pos = 0;
  n.forEach((child) => {
    const len = child.text?.length || 0;
    for (const m of child.marks) {
      let kind: Span['kind'] | null = null;
      let ref: string | undefined;
      switch (m.type.name) {
        case 'bold':
        case 'italic':
        case 'underline':
          kind = m.type.name as Span['kind'];
          break;
        case 'note':
          kind = 'note';
          ref = m.attrs.id;
          break;
        case 'tag':
          kind = 'tag';
          ref = m.attrs.cat + ':' + m.attrs.id;
          break;
        case 'highlight':
          kind = 'highlight';
          ref = m.attrs.color;
          break;
      }
      if (!kind) continue;
      const last = spans.find((s) => s.kind === kind && s.ref === ref && s.to === pos);
      if (last) last.to = pos + len;
      else spans.push({ from: pos, to: pos + len, kind, ref });
    }
    pos += len;
  });
  if (spans.length) e.spans = spans;
  return e;
}

export function docFromElements(els: ScriptElement[]): PMNode {
  const nodes = els.map(elementToNode);
  if (!nodes.length) nodes.push(schema.nodes.element.create({ id: uid(), type: 'scene' }));
  return schema.nodes.doc.create(null, nodes);
}

/** Cache: node identity → element (nodes are immutable, so this is safe). */
const cache = new WeakMap<PMNode, ScriptElement>();
export function elementsFromDoc(doc: PMNode): ScriptElement[] {
  const out: ScriptElement[] = [];
  doc.forEach((n) => {
    let e = cache.get(n);
    if (!e) {
      e = nodeToElement(n);
      cache.set(n, e);
    }
    out.push(e);
  });
  return out;
}
