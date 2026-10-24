import { describe, it, expect } from 'vitest';
import { paginate, displayText } from '../src/core/paginate';
import { getTemplate, linesPerPage } from '../src/core/templates';
import { contdSet, sceneNumbers, lockSceneNumbers } from '../src/core/scenes';
import type { ScriptElement, ElementType } from '../src/core/types';
import { sampleProject } from '../src/core/sample';

let n = 0;
const E = (type: ElementType, text: string, extra: Partial<ScriptElement> = {}): ScriptElement => ({ id: 'x' + n++, type, text, ...extra });
const A4 = getTemplate('indian-a4');
const LETTER = getTemplate('hollywood-letter');

describe('templates', () => {
  it('uses industry positions', () => {
    for (const t of [A4, LETTER]) {
      expect(t.elements.action.left).toBe(1.5);
      expect(t.elements.action.width).toBe(6);
      expect(t.elements.character.left).toBe(3.7);
      expect(t.elements.parenthetical.left).toBe(3.1);
      expect(t.elements.dialogue.left).toBe(2.5);
      expect(t.elements.dialogue.width).toBe(3.5);
      expect(t.elements.transition.align).toBe('right');
      expect(t.marginTop).toBe(1);
      expect(t.marginBottom).toBe(1);
      expect(t.fontSize).toBe(12);
    }
  });
  it('lines per page', () => {
    expect(linesPerPage(LETTER)).toBe(54);
    expect(linesPerPage(A4)).toBe(58);
  });
  it('Indian Standard is the A4 default', () => {
    expect(A4.pageWidth).toBeCloseTo(8.27);
    expect(A4.pageHeight).toBeCloseTo(11.69);
  });
});

describe('formatting', () => {
  it('upper-cases scene headings, characters and transitions', () => {
    const c = new Set<string>();
    expect(displayText(E('scene', 'int. house - day'), c)).toBe('INT. HOUSE - DAY');
    expect(displayText(E('character', 'ravi'), c)).toBe('RAVI');
    expect(displayText(E('transition', 'cut to:'), c)).toBe('CUT TO:');
    expect(displayText(E('action', 'Ravi runs.'), c)).toBe('Ravi runs.');
  });
  it('wraps action at 60 characters (Courier 10 cpi × 6")', () => {
    const text = 'word '.repeat(30).trim(); // 149 chars
    const L = paginate([E('action', text)], LETTER);
    const lines = L.pages[0].lines;
    expect(lines.every((l) => l.text.length <= 60)).toBe(true);
    expect(lines.length).toBe(3);
  });
  it('wraps dialogue at 35 characters', () => {
    const els = [E('character', 'RAVI'), E('dialogue', 'abcd '.repeat(20).trim())];
    const L = paginate(els, LETTER);
    const d = L.pages[0].lines.filter((l) => l.elType === 'dialogue');
    expect(d.every((l) => l.text.length <= 35)).toBe(true);
    expect(d[0].x).toBe(2.5);
  });
});

describe('automatic CONT\'D', () => {
  it('adds CONT\'D when the same character speaks again after action', () => {
    const els = [E('scene', 'INT. A - DAY'), E('character', 'RAVI'), E('dialogue', 'Hi.'), E('action', 'He sits.'), E('character', 'RAVI'), E('dialogue', 'Again.')];
    const c = contdSet(els);
    expect(c.has(els[4].id)).toBe(true);
    expect(c.has(els[1].id)).toBe(false);
  });
  it('resets on a new scene', () => {
    const els = [E('character', 'RAVI'), E('dialogue', 'Hi.'), E('scene', 'INT. B - DAY'), E('character', 'RAVI'), E('dialogue', 'Hi.')];
    expect(contdSet(els).size).toBe(0);
  });
});

function filler(lines: number): ScriptElement[] {
  // each single-line action = 1 line + 1 blank before
  const out: ScriptElement[] = [];
  for (let i = 0; i < lines; i++) out.push(E('action', 'Line ' + i + '.'));
  return out;
}

describe('pagination rules', () => {
  it('never ends a page on a scene heading', () => {
    for (let k = 20; k < 30; k++) {
      const els = [...filler(k), E('scene', 'INT. HOUSE - NIGHT'), E('action', 'Something happens here that is long enough to span a few lines of action text in the screenplay, maybe three lines in total for sure.')];
      const L = paginate(els, LETTER);
      for (const p of L.pages) {
        const last = p.lines[p.lines.length - 1];
        expect(last.elType).not.toBe('scene');
      }
    }
  });
  it('never ends a page on a character or parenthetical', () => {
    for (let k = 20; k < 30; k++) {
      const els = [...filler(k), E('character', 'MEERA'), E('parenthetical', '(softly)'), E('dialogue', 'One sentence here. Another sentence follows. And a third one too.')];
      const L = paginate(els, LETTER);
      for (const p of L.pages) {
        const real = p.lines.filter((l) => l.kind !== 'more');
        const last = real[real.length - 1];
        expect(['character', 'parenthetical']).not.toContain(last.elType);
      }
    }
  });
  it('splits long dialogue at a sentence with (MORE) and CONT\'D, keeping 2+ lines each side', () => {
    const long = Array.from({ length: 14 }, (_, i) => `This is sentence number ${i + 1} of the speech.`).join(' ');
    let found = false;
    for (let k = 15; k < 26; k++) {
      const els = [...filler(k), E('character', 'MEERA'), E('dialogue', long)];
      const L = paginate(els, LETTER);
      if (L.pages.length < 2) continue;
      const p0 = L.pages[0];
      const more = p0.lines.find((l) => l.kind === 'more');
      if (!more) continue;
      found = true;
      const before = p0.lines.filter((l) => l.elType === 'dialogue');
      expect(before.length).toBeGreaterThanOrEqual(2);
      expect(before[before.length - 1].text.trim()).toMatch(/\.$/);
      const p1 = L.pages[1];
      expect(p1.lines[0].kind).toBe('contd');
      expect(p1.lines[0].text).toBe("MEERA (CONT'D)");
      const after = p1.lines.filter((l) => l.elType === 'dialogue');
      expect(after.length).toBeGreaterThanOrEqual(2);
      expect(p1.contdName).toBe('MEERA');
    }
    expect(found).toBe(true);
  });
  it('fills pages without exceeding the content area', () => {
    const els = filler(200);
    const L = paginate(els, A4);
    for (const p of L.pages) for (const l of p.lines) expect(l.y + l.h).toBeLessThanOrEqual(L.contentHeight + 0.01);
    expect(L.pages.length).toBeGreaterThan(5);
  });
  it('honours forced page breaks', () => {
    const els = [E('action', 'One.'), E('action', 'Two.', { pageBreak: true })];
    expect(paginate(els, A4).pages.length).toBe(2);
  });
  it('places dual dialogue side by side', () => {
    const els = [E('character', 'A', { dual: 'left' }), E('dialogue', 'Left line.', { dual: 'left' }), E('character', 'B', { dual: 'right' }), E('dialogue', 'Right line.', { dual: 'right' })];
    const L = paginate(els, A4);
    const a = L.pages[0].lines.find((l) => l.text === 'A')!;
    const b = L.pages[0].lines.find((l) => l.text === 'B')!;
    expect(a.y).toBe(b.y);
    expect(b.x).toBeGreaterThan(a.x);
  });
  it('adds CONTINUED headers when enabled', () => {
    const els = [E('scene', 'INT. A - DAY'), ...filler(60)];
    const L = paginate(els, LETTER, { settings: { continuedHeaders: true } });
    expect(L.pages[0].lines.some((l) => l.text === '(CONTINUED)')).toBe(true);
    expect(L.pages[1].lines[0].text).toMatch(/CONTINUED:/);
  });
  it('labels A-pages when pages are locked', () => {
    const els = filler(150);
    const first = paginate(els, A4);
    const locked = first.pages.map((p) => ({ label: p.label, startId: p.startId, startOffset: p.startOffset }));
    // insert lots of material on page 1
    const more = [...els.slice(0, 3), ...filler(40), ...els.slice(3)];
    const L = paginate(more, A4, { lockedPages: locked });
    const labels = L.pages.map((p) => p.label);
    expect(labels[0]).toBe('1');
    expect(labels).toContain('1A');
    expect(labels).toContain('2');
  });
  it('lays out the sample screenplay with an interval and Indic dialogue', () => {
    const p = sampleProject();
    const L = paginate(p.elements, A4, { layers: { roman: true, meaning: true } });
    expect(L.pages.length).toBeGreaterThan(3);
    const indic = L.pages.flatMap((pg) => pg.lines).filter((l) => l.indic);
    expect(indic.length).toBeGreaterThan(10);
    expect(indic[0].h).toBe(A4.indicLineHeight);
    const roman = L.pages.flatMap((pg) => pg.lines).filter((l) => l.kind === 'roman');
    expect(roman.length).toBeGreaterThan(5);
  });
  it('is fast enough for a 200-page script', () => {
    const els: ScriptElement[] = [];
    for (let i = 0; i < 1400; i++) {
      els.push(E('scene', `INT. LOCATION ${i} - DAY`), E('action', 'Ravi walks into the room and looks around. Something is wrong here.'), E('character', 'RAVI'), E('dialogue', 'Where is everyone? I told them to wait for me here. Nobody listens.'));
    }
    const t0 = performance.now();
    const L = paginate(els, A4);
    const ms = performance.now() - t0;
    expect(L.pages.length).toBeGreaterThan(150);
    expect(ms).toBeLessThan(1500);
    // second run (unchanged elements) is served from the per-element cache
    const t1 = performance.now();
    paginate(els, A4);
    expect(performance.now() - t1).toBeLessThan(800);
  });
});

describe('scene numbers', () => {
  it('numbers sequentially, then A/B after locking', () => {
    const els = [E('scene', 'INT. A - DAY'), E('scene', 'INT. B - DAY'), E('scene', 'INT. C - DAY')];
    lockSceneNumbers(els);
    const withNew = [els[0], E('scene', 'INT. NEW - DAY'), els[1], els[2]];
    const m = sceneNumbers(withNew);
    expect(m.get(els[0].id)).toBe('1');
    expect(m.get(withNew[1].id)).toBe('1A');
    expect(m.get(els[1].id)).toBe('2');
  });
});
