import type { Project } from './types';
import { newProject } from './project';
import { unpackProject, isZip } from './katha-file';
import { fromFountain, ParsedScript } from './formats/fountain';
import { fromFDX } from './formats/fdx';
import { fromDOCX, fromPlainText } from './formats/docx';

export type ImportResult = { kind: 'katha' | 'other'; project: Project };

export function projectFromParsed(r: ParsedScript): Project {
  const p = newProject(r.elements);
  p.titlePage = { ...p.titlePage, ...r.titlePage };
  for (const [id, syn] of Object.entries(r.synopses)) p.scenes[id] = { ...(p.scenes[id] || {}), synopsis: syn };
  for (const [id, c] of Object.entries(r.colors || {})) p.scenes[id] = { ...(p.scenes[id] || {}), color: c };
  return p;
}

export async function importAny(name: string, data: Uint8Array): Promise<ImportResult> {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'katha' || (isZip(data) && ext !== 'docx')) {
    try {
      return { kind: 'katha', project: await unpackProject(data) };
    } catch (e) {
      if (ext === 'katha') throw e;
    }
  }
  if (ext === 'docx') return { kind: 'other', project: projectFromParsed(await fromDOCX(data)) };
  const text = new TextDecoder('utf-8').decode(data);
  if (ext === 'fdx' || /<FinalDraft[\s>]/.test(text.slice(0, 500))) return { kind: 'other', project: projectFromParsed(fromFDX(text)) };
  if (ext === 'fountain' || ext === 'spmd') return { kind: 'other', project: projectFromParsed(fromFountain(text)) };
  return { kind: 'other', project: projectFromParsed(fromPlainText(text)) };
}
