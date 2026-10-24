// Final Draft (.fdx) XML import / export for interoperability.
import type { ScriptElement, TitlePage, ElementType, Span, Lang } from '../types';
import { el, emptyTitlePage } from '../project';
import { detectLang, hasIndic } from '../elements';
import type { ParsedScript } from './fountain';

const TYPE_OUT: Record<ElementType, string> = {
  scene: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  centered: 'Centered',
  act: 'New Act',
  song: 'Song',
  interval: 'Interval',
  fight: 'Fight Block',
  montage: 'Montage',
};
const TYPE_IN: Record<string, ElementType> = {
  'scene heading': 'scene',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
  shot: 'shot',
  general: 'general',
  centered: 'centered',
  'new act': 'act',
  'end of act': 'act',
  'act break': 'act',
  song: 'song',
  interval: 'interval',
  'fight block': 'fight',
  montage: 'montage',
  'cast list': 'general',
  lyrics: 'general',
  outline: 'general',
};

const FONT_FOR: Record<Lang, string> = {
  en: 'Courier Prime',
  ta: 'Noto Sans Tamil',
  te: 'Noto Sans Telugu',
  hi: 'Noto Sans Devanagari',
  ml: 'Noto Sans Malayalam',
  kn: 'Noto Sans Kannada',
};

const x = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // strip characters not allowed in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function textRuns(e: ScriptElement): string {
  const text = e.text;
  const fmt = (e.spans || []).filter((s) => s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline');
  const cuts = new Set<number>([0, text.length]);
  for (const s of fmt) {
    cuts.add(s.from);
    cuts.add(s.to);
  }
  const pts = [...cuts].filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b);
  let out = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = text.slice(a, b);
    const styles = fmt.filter((s) => s.from <= a && s.to >= b).map((s) => (s.kind === 'bold' ? 'Bold' : s.kind === 'italic' ? 'Italic' : 'Underline'));
    const lang = hasIndic(seg) ? detectLang(seg) : 'en';
    const attrs = [styles.length ? `Style="${[...new Set(styles)].join('+')}"` : '', lang !== 'en' ? `Font="${FONT_FOR[lang]}"` : ''].filter(Boolean).join(' ');
    out += `<Text${attrs ? ' ' + attrs : ''}>${x(seg)}</Text>`;
  }
  if (!out) out = '<Text></Text>';
  return out;
}

function kathaData(e: ScriptElement): string {
  const d: Record<string, unknown> = {};
  for (const k of ['song', 'fight', 'meaning', 'roman', 'lang', 'rev', 'omitted', 'marker'] as const) if ((e as any)[k]) d[k] = (e as any)[k];
  const other = (e.spans || []).filter((s) => !(s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline'));
  if (other.length) d.spans = other;
  if (e.type === 'interval') d.t = 'interval';
  return Object.keys(d).length ? ` KathaData="${x(JSON.stringify(d))}"` : '';
}

function para(e: ScriptElement, synopsis?: string, color?: string): string {
  const type = TYPE_OUT[e.type];
  const attrs = [`Type="${type}"`];
  if (e.sceneNo) attrs.push(`Number="${x(e.sceneNo)}"`);
  if (e.type === 'centered' || e.type === 'interval' || e.type === 'act') attrs.push('Alignment="Center"');
  if (e.pageBreak) attrs.push('StartsNewPage="Yes"');
  let inner = '';
  if (e.type === 'scene' && (synopsis || color)) {
    inner += `<SceneProperties${color ? ` Color="${x(color)}"` : ''}>${synopsis ? `<Summary><Paragraph><Text>${x(synopsis)}</Text></Paragraph></Summary>` : ''}</SceneProperties>`;
  }
  inner += textRuns(e);
  return `    <Paragraph ${attrs.join(' ')}${kathaData(e)}>${inner}</Paragraph>\n`;
}

export function toFDX(els: ScriptElement[], tp?: TitlePage, scenes: Record<string, { synopsis?: string; color?: string }> = {}): string {
  let body = '';
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    if (e.dual === 'left' && e.type === 'character') {
      // collect left + right speeches into a DualDialogue group
      let j = i;
      const group: ScriptElement[] = [];
      while (j < els.length && els[j].dual && (els[j].type === 'character' || els[j].type === 'dialogue' || els[j].type === 'parenthetical')) {
        if (j > i && els[j].type === 'character' && els[j].dual === 'left') break;
        group.push(els[j]);
        j++;
      }
      body += `    <Paragraph><DualDialogue>\n${group.map((g) => '  ' + para(g)).join('')}    </DualDialogue></Paragraph>\n`;
      i = j - 1;
      continue;
    }
    body += para(e, scenes[e.id]?.synopsis, scenes[e.id]?.color);
  }
  const custom = ['Song', 'Interval', 'Fight Block', 'Montage']
    .map(
      (n) =>
        `    <ElementSettings Type="${n}"><FontSpec Font="Courier Prime" Size="12" Style=""/><ParagraphSpec Alignment="${n === 'Interval' ? 'Center' : 'Left'}" FirstIndent="0.00" Leading="Regular" LeftIndent="1.50" RightIndent="7.50" SpaceBefore="12" Spacing="1" StartsNewPage="No"/><Behavior PaginateAs="Action" ReturnKey="Action" Shortcut=""/></ElementSettings>\n`,
    )
    .join('');
  let title = '';
  if (tp) {
    const c = (s: string, align = 'Center') =>
      s
        .split('\n')
        .map((l) => `      <Paragraph Alignment="${align}" Type="General"><Text>${x(l)}</Text></Paragraph>\n`)
        .join('');
    title =
      '  <TitlePage>\n    <Content>\n' +
      c(tp.title.toUpperCase()) +
      c('') +
      c(tp.credit) +
      c(tp.author) +
      (tp.basedOn ? c('') + c(tp.basedOn) : '') +
      c('') +
      (tp.contact ? c(tp.contact, 'Left') : '') +
      [tp.draft, tp.date, tp.registration].filter(Boolean).map((l) => c(l, 'Right')).join('') +
      '    </Content>\n  </TitlePage>\n';
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${body}  </Content>
${title}  <ElementSettings/>
${custom}  <KathaTitlePage>${tp ? x(JSON.stringify(tp)) : ''}</KathaTitlePage>
</FinalDraft>
`;
}

function readText(p: Element): { text: string; spans: Span[] } {
  let text = '';
  const spans: Span[] = [];
  for (const t of Array.from(p.children)) {
    if (t.tagName !== 'Text') continue;
    const s = t.textContent || '';
    const style = (t.getAttribute('Style') || '').toLowerCase();
    const from = text.length;
    text += s;
    for (const k of ['bold', 'italic', 'underline'] as const)
      if (style.includes(k) && s.length) {
        const last = spans.find((x) => x.kind === k && x.to === from);
        if (last) last.to = text.length;
        else spans.push({ from, to: text.length, kind: k });
      }
  }
  return { text, spans };
}

export function fromFDX(xml: string): ParsedScript {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid FDX file');
  const content = doc.querySelector('FinalDraft > Content') || doc.getElementsByTagName('Content')[0];
  const els: ScriptElement[] = [];
  const synopses: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const readPara = (p: Element, dual?: 'left' | 'right') => {
    const typeName = (p.getAttribute('Type') || 'Action').toLowerCase();
    const type = TYPE_IN[typeName] || 'action';
    const { text, spans } = readText(p);
    const e = el(type, text);
    if (spans.length) e.spans = spans;
    const num = p.getAttribute('Number');
    if (num && type === 'scene') e.sceneNo = num;
    if (p.getAttribute('StartsNewPage') === 'Yes') e.pageBreak = true;
    const kd = p.getAttribute('KathaData');
    if (kd) {
      try {
        const d = JSON.parse(kd);
        if (d.t) e.type = d.t;
        for (const k of ['song', 'fight', 'meaning', 'roman', 'lang', 'rev', 'omitted', 'marker']) if (d[k] !== undefined) (e as any)[k] = d[k];
        if (d.spans) e.spans = [...(e.spans || []), ...d.spans];
      } catch {
        /* ignore */
      }
    }
    if (dual) e.dual = dual;
    const sp = Array.from(p.children).find((c) => c.tagName === 'SceneProperties');
    if (sp && type === 'scene') {
      const sum = sp.getElementsByTagName('Text');
      const syn = Array.from(sum)
        .map((t) => t.textContent)
        .join(' ')
        .trim();
      if (syn) synopses[e.id] = syn;
      const col = sp.getAttribute('Color');
      if (col) colors[e.id] = col.length === 13 ? '#' + col.slice(1, 3) + col.slice(5, 7) + col.slice(9, 11) : col;
    }
    els.push(e);
  };
  if (content)
    for (const p of Array.from(content.children)) {
      if (p.tagName !== 'Paragraph') continue;
      const dd = Array.from(p.children).find((c) => c.tagName === 'DualDialogue');
      if (dd) {
        let side: 'left' | 'right' = 'left';
        let seenChar = 0;
        for (const q of Array.from(dd.children)) {
          if (q.tagName !== 'Paragraph') continue;
          if ((q.getAttribute('Type') || '').toLowerCase() === 'character') {
            seenChar++;
            side = seenChar === 1 ? 'left' : 'right';
          }
          readPara(q, side);
        }
        continue;
      }
      readPara(p);
    }
  let tp = emptyTitlePage();
  const ktp = doc.getElementsByTagName('KathaTitlePage')[0]?.textContent;
  if (ktp) {
    try {
      tp = { ...tp, ...JSON.parse(ktp) };
    } catch {
      /* ignore */
    }
  } else {
    const tpc = doc.querySelector('TitlePage > Content');
    if (tpc) {
      const lines = Array.from(tpc.getElementsByTagName('Paragraph'))
        .map((p) => ({ text: readText(p).text.trim(), align: p.getAttribute('Alignment') || 'Left' }))
        .filter((l) => l.text);
      if (lines[0]) tp.title = lines[0].text;
      const centered = lines.filter((l) => l.align === 'Center').slice(1);
      const by = centered.findIndex((l) => /written|screenplay|story|by/i.test(l.text));
      if (by >= 0) {
        tp.credit = centered[by].text;
        if (centered[by + 1]) tp.author = centered[by + 1].text;
        if (centered[by + 2]) tp.basedOn = centered.slice(by + 2).map((l) => l.text).join('\n');
      }
      tp.contact = lines.filter((l) => l.align === 'Left').map((l) => l.text).join('\n');
      const right = lines.filter((l) => l.align === 'Right').map((l) => l.text);
      if (right[0]) tp.draft = right[0];
      if (right[1]) tp.date = right[1];
      if (right[2]) tp.registration = right.slice(2).join('\n');
    }
  }
  return { elements: els, titlePage: tp, synopses, colors };
}
