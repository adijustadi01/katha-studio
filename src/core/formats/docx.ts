// Word (.docx) export and best-effort import. Every paragraph carries a named
// paragraph style ("Scene Heading", "Dialogue"…) so Katha → Word → Katha keeps
// element types; other Word files are classified by indentation and casing.
import JSZip from 'jszip';
import type { ScriptElement, TitlePage, ElementType } from '../types';
import type { Template } from '../templates';
import { el, emptyTitlePage } from '../project';
import { hasIndic, detectLang, isUpper } from '../elements';
import { songLines, fightLines } from '../paginate';
import { fromFountain, ParsedScript } from './fountain';
import { romanize } from '../translit';

const STYLE: Record<ElementType, string> = {
  scene: 'SceneHeading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  centered: 'Centered',
  act: 'ActBreak',
  song: 'Song',
  interval: 'Interval',
  fight: 'FightBlock',
  montage: 'Montage',
};
const STYLE_IN: Record<string, ElementType> = Object.fromEntries(Object.entries(STYLE).map(([k, v]) => [v.toLowerCase(), k as ElementType]));

const CS_FONT: Record<string, string> = {
  ta: 'Noto Sans Tamil',
  te: 'Noto Sans Telugu',
  hi: 'Noto Sans Devanagari',
  ml: 'Noto Sans Malayalam',
  kn: 'Noto Sans Kannada',
  en: 'Courier Prime',
};

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const tw = (inches: number) => Math.round(inches * 1440);

function run(text: string, props = ''): string {
  const lang = hasIndic(text) ? detectLang(text) : 'en';
  const rf = lang !== 'en' ? `<w:rFonts w:ascii="Courier Prime" w:hAnsi="Courier Prime" w:cs="${CS_FONT[lang]}"/><w:cs/>` : '';
  const parts = text.split('\n');
  return parts
    .map((p, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:rPr>${rf}${props}</w:rPr><w:t xml:space="preserve">${x(p)}</w:t></w:r>`)
    .join('');
}

function runsFor(e: ScriptElement, upper: boolean): string {
  const text = upper ? e.text.toUpperCase() : e.text;
  const fmt = (e.spans || []).filter((s) => s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline');
  if (!fmt.length) return run(text);
  const cuts = new Set([0, text.length, ...fmt.flatMap((s) => [s.from, s.to])]);
  const pts = [...cuts].filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b);
  let out = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const on = fmt.filter((s) => s.from <= a && s.to >= b);
    const props = on.map((s) => (s.kind === 'bold' ? '<w:b/>' : s.kind === 'italic' ? '<w:i/>' : '<w:u w:val="single"/>')).join('');
    out += run(text.slice(a, b), props);
  }
  return out;
}

export async function toDOCX(els: ScriptElement[], t: Template, tp?: TitlePage, opts: { roman?: boolean; meaning?: boolean } = {}): Promise<Uint8Array> {
  const textLeft = 1.5;
  const textRight = 7.5;
  const W = t.pageWidth;
  const H = t.pageHeight;
  let body = '';
  if (tp) {
    const c = (s: string, extra = '') => `<w:p><w:pPr><w:jc w:val="center"/>${extra}</w:pPr>${run(s)}</w:p>`;
    body += '<w:p/>'.repeat(14);
    body += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(tp.title.toUpperCase(), '<w:u w:val="single"/>')}</w:p>`;
    body += c('') + c(tp.credit) + c(tp.author);
    if (tp.basedOn) body += c('') + c(tp.basedOn);
    body += '<w:p/>'.repeat(10);
    for (const l of [tp.contact, tp.draft, tp.date, tp.registration].filter(Boolean)) body += `<w:p>${run(l)}</w:p>`;
    body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  for (const e of els) {
    const st = t.elements[e.type] || t.elements.action;
    const ind = `<w:ind w:left="${tw(st.left - textLeft)}" w:right="${tw(Math.max(0, textRight - (st.left + st.width)))}"/>`;
    const jc = st.align === 'right' ? '<w:jc w:val="right"/>' : st.align === 'center' ? '<w:jc w:val="center"/>' : '';
    const keep = e.type === 'scene' || e.type === 'character' || e.type === 'parenthetical' ? '<w:keepNext/>' : '';
    const pb = e.pageBreak ? '<w:pageBreakBefore/>' : '';
    const spacing = `<w:spacing w:before="${st.spaceBefore * 240}" w:after="0" w:line="240" w:lineRule="auto"/>`;
    const pPr = `<w:pPr><w:pStyle w:val="${STYLE[e.type]}"/>${keep}${pb}${spacing}${ind}${jc}</w:pPr>`;
    let runs = '';
    if (e.type === 'song' || e.type === 'fight') {
      // details go in their own paragraph (style BlockInfo) so the element text stays separate
      const meta = e.type === 'song' ? songLines(e) : fightLines(e);
      const infoPPr = `<w:pPr><w:pStyle w:val="BlockInfo"/><w:keepNext/>${spacing}${ind}</w:pPr>`;
      body += `<w:p>${infoPPr}${meta.map((m, i) => (i ? '<w:r><w:br/></w:r>' : '') + run(m, i === 0 ? '<w:b/><w:u w:val="single"/>' : '')).join('')}</w:p>`;
      runs = runsFor(e, false);
      body += `<w:p><w:pPr><w:pStyle w:val="${STYLE[e.type]}"/><w:spacing w:before="0" w:after="0"/>${ind}</w:pPr>${runs}</w:p>`;
      continue;
    } else runs = runsFor(e, isUpper(e.type));
    body += `<w:p>${pPr}${runs}</w:p>`;
    if (e.type === 'dialogue' && hasIndic(e.text)) {
      const lpPr = `<w:pPr><w:pStyle w:val="DialogueLayer"/><w:spacing w:before="0" w:after="0"/>${ind}</w:pPr>`;
      if (opts.roman) body += `<w:p>${lpPr}${run(e.roman || romanize(e.text), '<w:i/>')}</w:p>`;
      if (opts.meaning && e.meaning) body += `<w:p>${lpPr}${run('[' + e.meaning + ']')}</w:p>`;
    }
  }
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:pgSz w:w="${tw(W)}" w:h="${tw(H)}"/><w:pgMar w:top="${tw(t.marginTop)}" w:right="${tw(W - textRight)}" w:bottom="${tw(t.marginBottom)}" w:left="${tw(textLeft)}" w:header="${tw(t.headerTop)}" w:footer="720" w:gutter="0"/><w:titlePg/></w:sectPr>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sect}</w:body></w:document>`;
  const styleDefs = Object.entries(STYLE)
    .map(([k, v]) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${v}"><w:name w:val="${v}"/><w:basedOn w:val="Normal"/><w:qFormat/>${isUpper(k as ElementType) ? '<w:rPr><w:caps/></w:rPr>' : ''}</w:style>`)
    .join('');
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Courier Prime" w:hAnsi="Courier Prime" w:eastAsia="Courier Prime" w:cs="Courier Prime"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${styleDefs}<w:style w:type="paragraph" w:customStyle="1" w:styleId="DialogueLayer"><w:name w:val="DialogueLayer"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:customStyle="1" w:styleId="BlockInfo"><w:name w:val="BlockInfo"/><w:basedOn w:val="Normal"/></w:style></w:styles>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>.</w:t></w:r></w:p></w:hdr>`;
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`,
  );
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`,
  );
  zip.file('word/document.xml', docXml);
  zip.file('word/styles.xml', styles);
  zip.file('word/header1.xml', header);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function fromDOCX(data: Uint8Array | ArrayBuffer): Promise<ParsedScript> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('Not a Word document');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paras = Array.from(doc.getElementsByTagNameNS(W, 'p'));
  const styled: ScriptElement[] = [];
  const plain: string[] = [];
  let anyStyle = false;
  for (const p of paras) {
    const st = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttribute('w:val') || '';
    let text = '';
    const walk = (n: Element) => {
      for (const c of Array.from(n.children)) {
        if (c.localName === 't') text += c.textContent || '';
        else if (c.localName === 'tab') text += '\t';
        else if (c.localName === 'br') text += '\n';
        else if (c.localName !== 'pPr' && c.localName !== 'rPr') walk(c);
      }
    };
    walk(p);
    const type = STYLE_IN[st.toLowerCase()];
    if (st === 'DialogueLayer' || st === 'BlockInfo') continue;
    if (type) {
      anyStyle = true;
      styled.push(el(type, text));
    }
    plain.push(text);
  }
  if (anyStyle) {
    // song/fight metadata lines were flattened; keep element text only
    return { elements: styled.filter((e, i) => !(i === 0 && !e.text && e.type === 'action')), titlePage: emptyTitlePage(), synopses: {} };
  }
  // best effort: treat paragraphs as plain screenplay text
  return fromPlainText(plain.join('\n\n'));
}

/** Plain text screenplay: classify lines by common layout conventions. */
export function fromPlainText(text: string): ParsedScript {
  // normalise heavy indentation: indented ALL CAPS lines → character cues, etc.
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out: string[] = [];
  for (const l of lines) {
    const indent = l.length - l.trimStart().length;
    const t = l.trim();
    if (!t) {
      out.push('');
      continue;
    }
    if (indent >= 30 && /TO:$|^FADE/.test(t)) out.push('> ' + t);
    else if (indent >= 15 && t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 40) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push('@' + t);
    } else out.push(t);
  }
  return fromFountain(out.join('\n'));
}

export function toPlainText(pages: { lines: { text: string; x: number; y: number; w: number; align: string }[]; label: string }[], lineHeight: number): string {
  const out: string[] = [];
  pages.forEach((p, i) => {
    if (i > 0) out.push('\f');
    out.push(' '.repeat(62) + p.label + '.', '');
    let lastRow = -1;
    for (const l of p.lines) {
      const row = Math.round(l.y / lineHeight);
      while (lastRow >= 0 && lastRow < row - 1) {
        out.push('');
        lastRow++;
      }
      let col = Math.max(0, Math.round((l.x - 1.5) * 10));
      if (l.align === 'right') col = Math.max(0, Math.round((l.x + l.w - 1.5) * 10) - l.text.length);
      if (l.align === 'center') col = Math.max(0, Math.round((l.x + l.w / 2 - 1.5) * 10 - l.text.length / 2));
      out.push(' '.repeat(col) + l.text);
      lastRow = row;
    }
  });
  return out.join('\n') + '\n';
}

export function toHTML(els: ScriptElement[], tp: TitlePage, t: Template, layers: { roman: boolean; meaning: boolean }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let body = `<header><h1>${esc(tp.title)}</h1><p>${esc(tp.credit)}<br>${esc(tp.author)}</p></header>`;
  for (const e of els) {
    const st = t.elements[e.type];
    const style = `margin-left:${(st.left - 1.5).toFixed(2)}in;width:${st.width}in;margin-top:${st.spaceBefore}em;text-align:${st.align}`;
    let inner = esc(isUpper(e.type) ? e.text.toUpperCase() : e.text).replace(/\n/g, '<br>');
    if (e.type === 'song' || e.type === 'fight') {
      const meta = e.type === 'song' ? songLines(e) : fightLines(e);
      inner = meta.map((m, i) => (i ? esc(m) : `<b><u>${esc(m)}</u></b>`)).join('<br>') + (e.text ? '<br>' + inner : '');
    }
    body += `<p class="${e.type}" style="${style}" lang="${hasIndic(e.text) ? detectLang(e.text) : 'en'}">${inner}</p>`;
    if (e.type === 'dialogue' && hasIndic(e.text)) {
      if (layers.roman) body += `<p class="roman" style="${style};margin-top:0"><i>${esc(e.roman || romanize(e.text))}</i></p>`;
      if (layers.meaning && e.meaning) body += `<p class="meaning" style="${style};margin-top:0">[${esc(e.meaning)}]</p>`;
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tp.title)}</title><style>
body{font-family:'Courier Prime','Courier New',monospace,'Noto Sans Tamil','Noto Sans Telugu','Nirmala UI';font-size:12pt;line-height:1.25;max-width:6.5in;margin:1in auto;color:#111}
p{margin:0}header{text-align:center;margin-bottom:3em}h1{text-transform:uppercase;text-decoration:underline;font-size:12pt}
.scene{font-weight:bold}.roman{color:#444}.meaning{color:#666}
</style></head><body>${body}</body></html>`;
}
