// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { toFountain, fromFountain } from '../src/core/formats/fountain';
import { toFDX, fromFDX } from '../src/core/formats/fdx';
import { toDOCX, fromDOCX, fromPlainText } from '../src/core/formats/docx';
import { packProject, unpackProject } from '../src/core/katha-file';
import { sampleProject } from '../src/core/sample';
import { getTemplate } from '../src/core/templates';
import type { ScriptElement } from '../src/core/types';

/** Comparable view of an element (ids are regenerated on import). */
function norm(e: ScriptElement) {
  const o: Record<string, unknown> = { type: e.type, text: e.text };
  for (const k of ['dual', 'song', 'fight', 'meaning', 'sceneNo', 'omitted', 'pageBreak', 'rev', 'lang'] as const) if ((e as any)[k]) o[k] = (e as any)[k];
  const spans = (e.spans || []).map((s) => `${s.kind}:${s.from}-${s.to}:${s.kind === 'tag' || s.kind === 'note' ? s.ref : ''}`).sort();
  if (spans.length) o.spans = spans;
  return o;
}

function edgeCases(): ScriptElement[] {
  let i = 0;
  const E = (type: any, text: string, extra: Partial<ScriptElement> = {}): ScriptElement => ({ id: 'z' + i++, type, text, ...extra });
  return [
    E('scene', 'INT. HOUSE - DAY', { sceneNo: '12A' }),
    E('action', 'He enters. *Silently*.', { spans: [{ from: 0, to: 2, kind: 'bold' }, { from: 11, to: 19, kind: 'italic' }] }),
    E('action', 'ALL CAPS ACTION LINE'),
    E('character', 'ரவி'),
    E('dialogue', 'வணக்கம் அண்ணா.', { meaning: 'Hello brother.' }),
    E('character', 'MEERA (V.O.)'),
    E('parenthetical', '(whispering)'),
    E('dialogue', 'Two lines\nof dialogue.'),
    E('transition', 'SMASH CUT TO:'),
    E('transition', 'Slowly we fade'),
    E('scene', 'Somewhere strange'),
    E('shot', 'ANGLE ON THE DOOR'),
    E('general', 'A general line.'),
    E('centered', 'THE END?'),
    E('act', 'ACT TWO', { pageBreak: true }),
    E('montage', 'BEGIN FLASHBACK'),
    E('interval', 'INTERVAL'),
    E('song', 'Lyrics sketch', { song: { number: 2, title: 'Mazhai', mood: 'Joy', duration: '3:40' } }),
    E('fight', '', { fight: { number: 1, setting: 'Rooftop', beats: ['Jump', 'Punch'], massMoment: 'Slow-mo kick' } }),
    E('scene', 'EXT. ROAD - NIGHT', { omitted: true }),
    E('action', ''),
    E('dialogue', ''),
  ];
}

describe('Fountain', () => {
  it('round-trips the sample script exactly (export → import → export)', () => {
    const p = sampleProject();
    const f1 = toFountain(p.elements, p.titlePage);
    const back = fromFountain(f1);
    expect(back.elements.map(norm)).toEqual(p.elements.map(norm));
    const f2 = toFountain(back.elements, back.titlePage);
    expect(f2).toBe(f1);
    expect(back.titlePage.title).toBe(p.titlePage.title);
  });
  it('round-trips edge cases', () => {
    const els = edgeCases();
    const back = fromFountain(toFountain(els));
    expect(back.elements.map(norm)).toEqual(els.map(norm));
  });
  it('parses a standard Fountain file', () => {
    const src = `Title: Test
Author: Someone

INT. KITCHEN - NIGHT

Ravi opens the fridge.

RAVI
(to himself)
Empty again.

MEERA ^
Told you.

CUT TO:

> THE END <
`;
    const r = fromFountain(src);
    expect(r.titlePage.title).toBe('Test');
    expect(r.elements.map((e) => e.type)).toEqual(['scene', 'action', 'character', 'parenthetical', 'dialogue', 'character', 'dialogue', 'transition', 'centered']);
    expect(r.elements[5].dual).toBe('right');
    expect(r.elements[2].dual).toBe('left');
  });
});

describe('Final Draft FDX', () => {
  it('round-trips the sample script (export → import → export)', () => {
    const p = sampleProject();
    const x1 = toFDX(p.elements, p.titlePage);
    const back = fromFDX(x1);
    expect(back.elements.map(norm)).toEqual(p.elements.map(norm));
    const x2 = toFDX(back.elements, back.titlePage);
    expect(x2).toBe(x1);
  });
  it('round-trips edge cases', () => {
    const els = edgeCases();
    const back = fromFDX(toFDX(els));
    expect(back.elements.map(norm)).toEqual(els.map(norm));
  });
  it('reads a Final Draft style file with dual dialogue and title page', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><FinalDraft DocumentType="Script" Version="5"><Content>
<Paragraph Type="Scene Heading" Number="1"><SceneProperties Color="#FFFF00000000"><Summary><Paragraph><Text>Syn here</Text></Paragraph></Summary></SceneProperties><Text>INT. ROOM - DAY</Text></Paragraph>
<Paragraph Type="Action"><Text Style="Bold">BANG</Text><Text>. A shot.</Text></Paragraph>
<Paragraph><DualDialogue><Paragraph Type="Character"><Text>A</Text></Paragraph><Paragraph Type="Dialogue"><Text>One</Text></Paragraph><Paragraph Type="Character"><Text>B</Text></Paragraph><Paragraph Type="Dialogue"><Text>Two</Text></Paragraph></DualDialogue></Paragraph>
</Content><TitlePage><Content><Paragraph Alignment="Center"><Text>MY FILM</Text></Paragraph><Paragraph Alignment="Center"><Text>Written by</Text></Paragraph><Paragraph Alignment="Center"><Text>Jane</Text></Paragraph></Content></TitlePage></FinalDraft>`;
    const r = fromFDX(xml);
    expect(r.elements[0].sceneNo).toBe('1');
    expect(r.synopses[r.elements[0].id]).toBe('Syn here');
    expect(r.colors?.[r.elements[0].id]).toBe('#FF0000');
    expect(r.elements[1].spans?.[0]).toMatchObject({ kind: 'bold', from: 0, to: 4 });
    expect(r.elements.slice(2).map((e) => e.dual)).toEqual(['left', 'left', 'right', 'right']);
    expect(r.titlePage.title).toBe('MY FILM');
    expect(r.titlePage.author).toBe('Jane');
  });
});

describe('Word .docx', () => {
  it('keeps element types through export → import', async () => {
    const p = sampleProject();
    const data = await toDOCX(p.elements, getTemplate('indian-a4'), p.titlePage, { roman: true, meaning: true });
    const back = await fromDOCX(data);
    expect(back.elements.map((e) => [e.type, e.text])).toEqual(p.elements.map((e) => [e.type, e.type === 'scene' || e.type === 'character' || e.type === 'transition' || e.type === 'interval' ? e.text.toUpperCase() : e.text]));
  });
});

describe('plain text import', () => {
  it('classifies an indented screenplay', () => {
    const txt = `INT. OFFICE - DAY

Ravi types furiously.

                         RAVI
               I need this done.

                                         CUT TO:
`;
    const r = fromPlainText(txt);
    expect(r.elements.map((e) => e.type)).toEqual(['scene', 'action', 'character', 'dialogue', 'transition']);
  });
});

describe('.katha project files', () => {
  it('pack → unpack preserves everything', async () => {
    const p = sampleProject();
    p.assets['char-1.jpg'] = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
    p.snapshots.push({ id: 'v1', name: 'Draft 1', created: 1, auto: false, elements: p.elements.slice(0, 3) });
    const data = await packProject(p);
    const back = await unpackProject(data);
    expect(back.elements).toEqual(p.elements);
    expect(back.scenes).toEqual(p.scenes);
    expect(back.notes).toEqual(p.notes);
    expect(back.snapshots).toEqual(p.snapshots);
    expect(back.assets).toEqual(p.assets);
    expect(back.titlePage).toEqual(p.titlePage);
  });
});
