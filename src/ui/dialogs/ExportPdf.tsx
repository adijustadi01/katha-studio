import { useState } from 'preact/hooks';
import { store } from '../../app/store';
import { exportPDF, printScript, PdfOptions } from '../../app/exporter';
import { Dialog } from './Dialog';
import { isDesktop } from '../../platform';
import { REVISION_COLORS } from '../../core/types';

export function ExportPdfDialog() {
  const p = store.project!;
  const [o, setO] = useState<PdfOptions>({
    titlePage: true,
    layers: { ...p.settings.exportLayers },
    watermark: '',
    revisionColors: p.revision.active || p.revision.color > 0,
    revisionMarks: true,
    sceneNumbers: p.settings.sceneNumbers,
    revisedOnly: false,
  });
  const [wmName, setWmName] = useState('');
  const set = (patch: Partial<PdfOptions>) => setO({ ...o, ...patch });
  const wmPreset = (name: string) => `CONFIDENTIAL – Sent to ${name || '<name>'} – ${new Date().toLocaleDateString('en-IN')}`;
  const go = async (print = false) => {
    p.settings.exportLayers = o.layers;
    store.touch();
    store.closeDialog();
    if (print) await printScript(o);
    else await exportPDF(o);
  };
  return (
    <Dialog
      title="Export PDF"
      footer={
        <>
          <button onClick={() => go(true)}>🖨 Print…</button>
          <button class="primary" onClick={() => go(false)}>
            ⬇ Export PDF
          </button>
        </>
      }
    >
      <div class="form">
        <label>Version</label>
        <div class="row">
          <button class={!o.layers.roman && !o.layers.meaning ? 'on' : ''} onClick={() => set({ layers: { roman: false, meaning: false } })}>
            Standard
          </button>
          <button class={o.layers.roman && o.layers.meaning ? 'on' : ''} onClick={() => set({ layers: { roman: true, meaning: true } })}>
            Bilingual actor version
          </button>
        </div>
        <label>Dialogue layers</label>
        <div class="row">
          <label>
            <input type="checkbox" checked={o.layers.roman} onChange={() => set({ layers: { ...o.layers, roman: !o.layers.roman } })} /> Roman transliteration
          </label>
          <label>
            <input type="checkbox" checked={o.layers.meaning} onChange={() => set({ layers: { ...o.layers, meaning: !o.layers.meaning } })} /> English meaning
          </label>
        </div>
        <label>Title page</label>
        <label>
          <input type="checkbox" checked={o.titlePage} onChange={() => set({ titlePage: !o.titlePage })} /> Include title page
        </label>
        <label>Scene numbers</label>
        <select value={o.sceneNumbers} onChange={(e) => set({ sceneNumbers: (e.target as HTMLSelectElement).value as any })}>
          <option value="none">None</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="both">Left and right</option>
        </select>
        <label>Watermark</label>
        <div class="col">
          <div class="row">
            <input placeholder="Recipient name" value={wmName} onInput={(e) => setWmName((e.target as HTMLInputElement).value)} />
            <button onClick={() => set({ watermark: wmPreset(wmName) })}>Use "CONFIDENTIAL – Sent to…"</button>
          </div>
          <input placeholder="Custom diagonal watermark text (empty = none)" value={o.watermark} onInput={(e) => set({ watermark: (e.target as HTMLInputElement).value })} />
        </div>
        <label>Revisions</label>
        <div class="col">
          <label>
            <input type="checkbox" checked={o.revisionMarks} onChange={() => set({ revisionMarks: !o.revisionMarks })} /> Asterisks (*) on changed lines
          </label>
          <label>
            <input type="checkbox" checked={o.revisionColors} onChange={() => set({ revisionColors: !o.revisionColors })} /> Print revised pages on revision colour ({REVISION_COLORS[p.revision.color]?.name})
          </label>
          <label>
            <input type="checkbox" checked={!!o.revisedOnly} onChange={() => set({ revisedOnly: !o.revisedOnly })} /> Only revised pages
          </label>
        </div>
      </div>
      <p class="small muted">
        {isDesktop
          ? 'The PDF is rendered by Chromium, so Tamil, Telugu and other Indian scripts are shaped correctly.'
          : 'Your browser (Chromium engine) renders the PDF so Indian scripts shape correctly. In the print dialog choose "Save as PDF" and set Margins to "None" if asked.'}
      </p>
    </Dialog>
  );
}
