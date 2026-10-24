import { hasIndic } from './elements';

/** Measures rendered text width in points. */
export interface Measurer {
  width(text: string, fontSizePt: number): number;
}

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/**
 * Deterministic measurer used in tests and before fonts load: Courier is
 * exactly 0.6em per character; Indic grapheme clusters are estimated.
 */
export const estimateMeasurer: Measurer = {
  width(text, size) {
    if (!hasIndic(text)) return text.length * size * 0.6;
    let w = 0;
    for (const g of graphemes(text)) {
      if (hasIndic(g)) w += size * 0.82;
      else w += size * 0.6;
    }
    return w;
  },
};

/** Browser measurer using canvas, which shapes complex scripts like the page does. */
export function canvasMeasurer(fontFamily: string): Measurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const cache = new Map<string, number>();
  let lastSize = 0;
  return {
    width(text, size) {
      if (!hasIndic(text)) return graphemes(text).length * size * 0.6; // Courier Prime is monospaced
      const key = size + '|' + text;
      const c = cache.get(key);
      if (c !== undefined) return c;
      if (size !== lastSize) {
        ctx.font = `${size}pt ${fontFamily}`;
        lastSize = size;
      }
      // canvas reports CSS px at 96dpi; convert to points
      const w = (ctx.measureText(text).width * 72) / 96;
      if (cache.size > 50000) cache.clear();
      cache.set(key, w);
      return w;
    },
  };
}

export interface WrappedLine {
  text: string;
  start: number; // offset in source text
  end: number;
}

/** Greedy word wrap. Breaks at spaces; hard-breaks words longer than the line. */
export function wrapText(text: string, widthPt: number, size: number, m: Measurer): WrappedLine[] {
  const lines: WrappedLine[] = [];
  if (text === '') return [{ text: '', start: 0, end: 0 }];
  // explicit newlines inside an element (shift-enter)
  let base = 0;
  for (const para of text.split('\n')) {
    wrapPara(para, base, widthPt, size, m, lines);
    base += para.length + 1;
  }
  return lines;
}

function wrapPara(text: string, base: number, widthPt: number, size: number, m: Measurer, out: WrappedLine[]) {
  if (text === '') {
    out.push({ text: '', start: base, end: base });
    return;
  }
  if (!hasIndic(text) && m.width('MMMMMMMMMM', size) === 10 * size * 0.6) return wrapMono(text, base, Math.floor((widthPt + 0.01) / (size * 0.6)), out);
  const tokens = text.match(/\S+\s*|\s+/g) || [text];
  let line = '';
  let lineStart = 0;
  let pos = 0;
  const fits = (s: string) => m.width(s.replace(/\s+$/, ''), size) <= widthPt + 0.01;
  for (const tok of tokens) {
    if (fits(line + tok)) {
      line += tok;
    } else if (line === '') {
      // word longer than a full line: break by grapheme
      let chunk = '';
      let cStart = pos;
      for (const g of graphemes(tok)) {
        if (chunk && !fits(chunk + g)) {
          out.push({ text: chunk, start: base + cStart, end: base + cStart + chunk.length });
          cStart += chunk.length;
          chunk = '';
        }
        chunk += g;
      }
      line = chunk;
      lineStart = cStart;
    } else {
      out.push({ text: line.replace(/\s+$/, ''), start: base + lineStart, end: base + lineStart + line.length });
      lineStart = pos;
      line = '';
      if (fits(tok)) line = tok;
      else {
        let chunk = '';
        let cStart = pos;
        for (const g of graphemes(tok)) {
          if (chunk && !fits(chunk + g)) {
            out.push({ text: chunk, start: base + cStart, end: base + cStart + chunk.length });
            cStart += chunk.length;
            chunk = '';
          }
          chunk += g;
        }
        line = chunk;
        lineStart = cStart;
      }
    }
    pos += tok.length;
  }
  out.push({ text: line.replace(/\s+$/, ''), start: base + lineStart, end: base + lineStart + line.length });
}

/** Fast path for monospaced Latin text: fixed characters per line. */
function wrapMono(text: string, base: number, cpl: number, out: WrappedLine[]) {
  cpl = Math.max(1, cpl);
  let start = 0;
  const n = text.length;
  while (start < n) {
    if (n - start <= cpl) {
      out.push({ text: text.slice(start).replace(/\s+$/, ''), start: base + start, end: base + n });
      return;
    }
    // find last space within cpl (+1 so a space exactly at the limit counts)
    let brk = -1;
    for (let i = start + cpl; i > start; i--) {
      if (text[i] === ' ') {
        brk = i;
        break;
      }
    }
    if (brk < 0) {
      out.push({ text: text.slice(start, start + cpl), start: base + start, end: base + start + cpl });
      start += cpl;
      continue;
    }
    let next = brk;
    while (next < n && text[next] === ' ') next++;
    out.push({ text: text.slice(start, brk).replace(/\s+$/, ''), start: base + start, end: base + next });
    start = next;
  }
}
