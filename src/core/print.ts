// Builds a print-ready HTML document from a computed Layout. Every line is
// absolutely positioned exactly where the paginator put it, so the PDF that
// Chromium produces (Electron printToPDF or the browser's Save as PDF) has
// the same page breaks as the editor, with full complex-script shaping.
import type { Layout, PageLine } from './paginate';
import type { Project, ScriptElement } from './types';
import { REVISION_COLORS } from './types';

export interface PrintOptions {
  fontBase: string; // URL of the folder containing fonts/fonts.css
  titlePage: boolean;
  watermark?: string;
  revisionColors: boolean; // tint revised pages with their colour
  revisionMarks: boolean; // asterisks in the right margin
  sceneNumbers: 'none' | 'left' | 'right' | 'both';
  pages?: number[]; // subset of page indexes to print
  header?: string; // optional header text (e.g. revision label)
  indicFontStyle?: 'sans' | 'serif';
  elements: ScriptElement[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fontStack(style: 'sans' | 'serif' = 'sans'): string {
  const ser = style === 'serif' ? ' Serif' : '';
  return `'Courier Prime', 'Katha Tamil${ser}', 'Katha Telugu${ser}', 'Katha Devanagari', 'Katha Malayalam', 'Katha Kannada', 'Courier New', monospace`;
}

function spanFormat(el: ScriptElement | undefined, line: PageLine): string {
  // apply bold/italic/underline spans that fall within this line
  const text = line.text;
  if (!el || !el.spans || line.start === undefined || line.kind !== 'text') return esc(text);
  const fmt = el.spans.filter((s) => (s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline') && s.to > line.start! && s.from < line.end!);
  if (!fmt.length) return esc(text);
  // the line text may be upper-cased but offsets are identical
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const off = line.start! + i;
    const open = fmt.filter((s) => s.from === off || (i === 0 && s.from < off));
    for (const s of open) out += s.kind === 'bold' ? '<b>' : s.kind === 'italic' ? '<i>' : '<u>';
    out += esc(text[i]);
    const close = fmt.filter((s) => s.to === off + 1 || (i === text.length - 1 && s.to > off + 1));
    for (const s of close.reverse()) out += s.kind === 'bold' ? '</b>' : s.kind === 'italic' ? '</i>' : '</u>';
  }
  return out;
}

export function renderPrintHTML(layout: Layout, project: Project, o: PrintOptions): string {
  const t = layout.template;
  const W = t.pageWidth;
  const H = t.pageHeight;
  const byId = new Map(o.elements.map((e) => [e.id, e]));
  const pages: string[] = [];
  if (o.titlePage) pages.push(titlePageHTML(project, W, H, o));
  const sel = o.pages ? new Set(o.pages) : null;
  for (const p of layout.pages) {
    if (sel && !sel.has(p.index)) continue;
    const bg = o.revisionColors && p.rev ? REVISION_COLORS[p.rev]?.css : '#fff';
    let html = `<section class="page" style="background:${bg}">`;
    if (p.index > 0 || !o.titlePage) {
      // standard: no page number on page 1
      if (p.index > 0) html += `<div class="num" style="top:${t.headerTop}in;right:1in">${esc(p.label)}.</div>`;
    }
    if (o.header || (o.revisionColors && p.rev)) {
      const rc = REVISION_COLORS[p.rev];
      const lbl = o.header || '';
      const rl = p.rev && rc ? `${rc.name} Rev. ${esc(project.revision.date)}` : '';
      html += `<div class="hdr" style="top:${t.headerTop}in;left:1.5in">${esc(lbl)}${lbl && rl ? ' — ' : ''}${rl}</div>`;
    }
    for (const l of p.lines) {
      const top = t.marginTop * 72 + l.y;
      const cls = ['ln', 'k-' + l.kind];
      if (l.style?.bold) cls.push('b');
      if (l.style?.italic) cls.push('i');
      if (l.style?.underline) cls.push('u');
      if (l.indic) cls.push('ind');
      const style = `top:${top}pt;left:${l.x}in;width:${l.w}in;height:${l.h}pt;line-height:${l.h}pt;text-align:${l.align}`;
      html += `<div class="${cls.join(' ')}" style="${style}">${spanFormat(byId.get(l.elId || ''), l)}</div>`;
      if (l.sceneNo && o.sceneNumbers !== 'none') {
        if (o.sceneNumbers === 'left' || o.sceneNumbers === 'both')
          html += `<div class="ln sn" style="top:${top}pt;left:0.75in;width:0.6in;line-height:${l.h}pt">${esc(l.sceneNo)}</div>`;
        if (o.sceneNumbers === 'right' || o.sceneNumbers === 'both')
          html += `<div class="ln sn" style="top:${top}pt;left:${W - 0.95}in;width:0.6in;line-height:${l.h}pt">${esc(l.sceneNo)}</div>`;
      }
      if (o.revisionMarks && l.rev && l.kind !== 'more' && l.kind !== 'contd')
        html += `<div class="ln ast" style="top:${top}pt;left:${W - 0.6}in;width:0.3in;line-height:${l.h}pt">*</div>`;
    }
    if (o.watermark) html += watermarkHTML(o.watermark, W, H);
    html += '</section>';
    pages.push(html);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(project.titlePage.title)}</title>
<link rel="stylesheet" href="${o.fontBase}fonts/fonts.css">
<style>
@page { size: ${W}in ${H}in; margin: 0 }
html,body{margin:0;padding:0;background:#888}
body{font-family:${fontStack(o.indicFontStyle)};font-size:${t.fontSize}pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;background:#fff;width:${W}in;height:${H}in;overflow:hidden;margin:0 auto 12px;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
@media print{body{background:none}.page{margin:0}}
.ln{position:absolute;white-space:pre;overflow:visible}
.ln.b{font-weight:700}.ln.i{font-style:italic}.ln.u{text-decoration:underline}
.k-roman{font-style:italic;color:#333}.k-meaning{color:#444}
.num,.hdr{position:absolute;font-size:${t.fontSize}pt;line-height:${t.lineHeight}pt}
.hdr{font-size:10pt}
.sn{font-weight:400}
.wm{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-40deg);font-family:Arial,Helvetica,sans-serif;font-size:34pt;font-weight:700;color:rgba(0,0,0,0.13);white-space:nowrap;text-align:center;pointer-events:none}
.tp-title{position:absolute;left:1in;right:1in;text-align:center;text-transform:uppercase;text-decoration:underline}
.tp{position:absolute;white-space:pre-wrap}
</style></head><body>${pages.join('\n')}</body></html>`;
}

function watermarkHTML(text: string, _w: number, _h: number): string {
  return `<div class="wm">${esc(text).replace(/\n/g, '<br>')}</div>`;
}

function titlePageHTML(p: Project, W: number, H: number, o: PrintOptions): string {
  const tp = p.titlePage;
  let h = `<section class="page">`;
  h += `<div class="tp-title" style="top:3.5in">${esc(tp.title)}</div>`;
  let y = 4.0;
  if (tp.credit) {
    h += `<div class="tp" style="top:${y}in;left:1in;right:1in;text-align:center">${esc(tp.credit)}</div>`;
    y += 0.35;
  }
  if (tp.author) {
    h += `<div class="tp" style="top:${y}in;left:1in;right:1in;text-align:center">${esc(tp.author)}</div>`;
    y += 0.5;
  }
  if (tp.basedOn) h += `<div class="tp" style="top:${y}in;left:1in;right:1in;text-align:center">${esc(tp.basedOn)}</div>`;
  const left = [tp.contact].filter(Boolean).join('\n');
  if (left) h += `<div class="tp" style="bottom:1in;left:1.5in;width:3.5in">${esc(left)}</div>`;
  const right = [tp.draft, tp.date, tp.registration].filter(Boolean).join('\n');
  if (right) h += `<div class="tp" style="bottom:1in;right:1in;width:3in;text-align:right">${esc(right)}</div>`;
  if (tp.notes) h += `<div class="tp" style="top:${H - 3}in;left:1.5in;right:1in;font-size:10pt">${esc(tp.notes)}</div>`;
  if (o.watermark) h += watermarkHTML(o.watermark, W, H);
  h += '</section>';
  return h;
}
