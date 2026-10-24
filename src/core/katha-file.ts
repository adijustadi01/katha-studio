// .katha project file = zip { project.json, history/snapshots.json, assets/* }
import JSZip from 'jszip';
import type { Project } from './types';
import { normalizeProject } from './project';

export async function packProject(p: Project): Promise<Uint8Array> {
  const zip = new JSZip();
  const { assets, snapshots, ...rest } = p;
  zip.file('mimetype', 'application/x-katha-studio', { compression: 'STORE' });
  zip.file('project.json', JSON.stringify(rest, null, 1));
  zip.file('history/snapshots.json', JSON.stringify(snapshots || []));
  const index: Record<string, string> = {};
  for (const [path, dataUrl] of Object.entries(assets || {})) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) continue;
    const safe = path.replace(/[^A-Za-z0-9._-]/g, '_');
    zip.file('assets/' + safe, m[2], { base64: true });
    index[path] = 'assets/' + safe + '|' + m[1];
  }
  zip.file('assets/index.json', JSON.stringify(index));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function unpackProject(data: Uint8Array | ArrayBuffer): Promise<Project> {
  const zip = await JSZip.loadAsync(data);
  const pj = zip.file('project.json');
  if (!pj) throw new Error('Not a Katha Studio project (project.json missing)');
  const p = JSON.parse(await pj.async('string')) as Project;
  const snaps = zip.file('history/snapshots.json');
  p.snapshots = snaps ? JSON.parse(await snaps.async('string')) : [];
  p.assets = {};
  const idx = zip.file('assets/index.json');
  if (idx) {
    const index = JSON.parse(await idx.async('string')) as Record<string, string>;
    for (const [path, ref] of Object.entries(index)) {
      const [file, mime] = ref.split('|');
      const f = zip.file(file);
      if (f) p.assets[path] = `data:${mime};base64,` + (await f.async('base64'));
    }
  }
  return normalizeProject(p);
}

export function isZip(data: Uint8Array): boolean {
  return data[0] === 0x50 && data[1] === 0x4b;
}
