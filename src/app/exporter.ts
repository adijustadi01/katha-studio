import { store } from './store';
import { platform } from '../platform';
import { renderPrintHTML, PrintOptions } from '../core/print';
import { toFDX } from '../core/formats/fdx';
import { toFountain } from '../core/formats/fountain';
import { toDOCX, toPlainText, toHTML } from '../core/formats/docx';
import { getTemplate } from '../core/templates';

export interface PdfOptions {
  titlePage: boolean;
  layers: { roman: boolean; meaning: boolean };
  watermark: string;
  revisionColors: boolean;
  revisionMarks: boolean;
  sceneNumbers?: 'none' | 'left' | 'right' | 'both';
  pages?: number[];
  revisedOnly?: boolean;
}

export function fontBase(): string {
  return new URL('./', location.href).href;
}

export function buildPrintHTML(o: PdfOptions): { html: string; pages: number } {
  const p = store.sync();
  const layout = store.exportLayout(o.layers);
  let pages = o.pages;
  if (o.revisedOnly) pages = layout.pages.filter((pg) => pg.rev > 0).map((pg) => pg.index);
  const opts: PrintOptions = {
    fontBase: fontBase(),
    titlePage: o.titlePage && !o.revisedOnly,
    watermark: o.watermark || undefined,
    revisionColors: o.revisionColors,
    revisionMarks: o.revisionMarks,
    sceneNumbers: o.sceneNumbers ?? p.settings.sceneNumbers,
    pages,
    indicFontStyle: p.settings.indicFontStyle,
    elements: p.elements,
  };
  return { html: renderPrintHTML(layout, p, opts), pages: layout.pages.length };
}

function baseName(): string {
  const p = store.project!;
  return (p.titlePage.title || store.fileName.replace(/\.katha$/, '') || 'Script').replace(/[\\/:*?"<>|]/g, '').trim() || 'Script';
}

export async function exportPDF(o: PdfOptions) {
  const { html } = buildPrintHTML(o);
  const t = getTemplate(store.project!.settings.template);
  if (platform.printToPDF) {
    const pdf = await platform.printToPDF(html, { pageWidthIn: t.pageWidth, pageHeightIn: t.pageHeight });
    if (pdf) await platform.exportFile(baseName() + '.pdf', pdf, 'application/pdf');
    return;
  }
  // Browser: Chromium renders the paged layout; "Save as PDF" in the print dialog writes the file.
  store.toast('Choose "Save as PDF" as the destination in the print dialog.', 'info', 6000);
  await platform.print(html);
}

export async function printScript(o: PdfOptions) {
  const { html } = buildPrintHTML(o);
  await platform.print(html);
}

export async function exportFormat(kind: 'fdx' | 'fountain' | 'docx' | 'txt' | 'html') {
  const p = store.sync();
  const name = baseName();
  const scenesMeta: Record<string, { synopsis?: string; color?: string }> = {};
  const syn: Record<string, string> = {};
  for (const [id, m] of Object.entries(p.scenes)) {
    scenesMeta[id] = { synopsis: m.synopsis, color: m.color };
    if (m.synopsis) syn[id] = m.synopsis;
  }
  switch (kind) {
    case 'fdx':
      return platform.exportFile(name + '.fdx', toFDX(p.elements, p.titlePage, scenesMeta), 'application/xml');
    case 'fountain':
      return platform.exportFile(name + '.fountain', toFountain(p.elements, p.titlePage, syn), 'text/plain');
    case 'docx':
      return platform.exportFile(
        name + '.docx',
        await toDOCX(p.elements, getTemplate(p.settings.template), p.titlePage, p.settings.exportLayers),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    case 'txt': {
      const layout = store.exportLayout();
      return platform.exportFile(name + '.txt', toPlainText(layout.pages, layout.template.lineHeight), 'text/plain');
    }
    case 'html':
      return platform.exportFile(name + '.html', toHTML(p.elements, p.titlePage, getTemplate(p.settings.template), p.settings.exportLayers), 'text/html');
  }
}
