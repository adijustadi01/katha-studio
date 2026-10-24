import type { ScriptElement, ScriptSettings, ElementType } from './types';
import type { Template, ElementStyle } from './templates';
import { wrapText, Measurer, estimateMeasurer } from './measure';
import { hasIndic, characterName, isUpper } from './elements';
import { contdSet, sceneNumbers } from './scenes';
import { romanize } from './translit';

export interface LineStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

export interface PageLine {
  text: string;
  /** left edge (inches from page edge) and width of the text column */
  x: number;
  w: number;
  align: 'left' | 'right' | 'center';
  /** top (pt) relative to the top margin */
  y: number;
  h: number;
  kind: 'text' | 'roman' | 'meaning' | 'more' | 'contd' | 'continued' | 'meta' | 'omitted';
  style?: LineStyle;
  elId?: string;
  elType?: ElementType;
  /** offsets in the element's own text (kind 'text' only) */
  start?: number;
  end?: number;
  indic?: boolean;
  /** revision mark for asterisk in right margin */
  rev?: number;
  sceneNo?: string;
}

export interface Page {
  index: number;
  label: string;
  lines: PageLine[];
  /** first element on the page and character offset where it starts */
  startId: string;
  startOffset: number;
  /** element the page starts inside of, when a speech continues (CONT'D) */
  contdName?: string;
  /** highest revision color index on the page (0 = none) */
  rev: number;
  /** height used (pt) */
  used: number;
}

export interface PaginateOptions {
  measurer?: Measurer;
  layers?: { roman: boolean; meaning: boolean };
  settings?: Partial<ScriptSettings>;
  lockedPages?: { label: string; startId: string; startOffset: number }[];
}

export interface Layout {
  pages: Page[];
  /** element id → page index where it starts */
  elementPage: Map<string, number>;
  contd: Set<string>;
  sceneNos: Map<string, string>;
  template: Template;
  contentHeight: number;
}

interface Seg {
  kind: PageLine['kind'];
  style: ElementStyle;
  lines: { text: string; start: number; end: number }[];
  lh: number;
  fmt?: LineStyle;
  indic: boolean;
}

interface Unit {
  el: ScriptElement;
  idx: number;
  segs: Seg[];
  spaceBefore: number; // pt
  height: number; // pt without spaceBefore
}

const SENTENCE_END = /[.!?।॥…]["'”’)]*\s+/g;

export function displayText(e: ScriptElement, contd: Set<string>, autoContd = true): string {
  let t = e.text;
  if (isUpper(e.type)) t = t.toUpperCase();
  if (e.type === 'character' && autoContd && contd.has(e.id)) t = t + " (CONT'D)";
  if (e.type === 'scene' && e.omitted) t = 'OMITTED';
  if (e.type === 'interval' && !t.trim()) t = 'INTERVAL';
  return t;
}

export function songLines(e: ScriptElement): string[] {
  const s = e.song || {};
  const out: string[] = [];
  out.push(`SONG${s.number ? ' ' + s.number : ''}${s.title ? ': "' + s.title.toUpperCase() + '"' : ''}`);
  if (s.situation) out.push('Situation: ' + s.situation);
  const row = [s.mood && 'Mood: ' + s.mood, s.duration && 'Duration: ' + s.duration].filter(Boolean).join('   ');
  if (row) out.push(row);
  const row2 = [s.singers && 'Singers: ' + s.singers, s.lyricist && 'Lyricist: ' + s.lyricist].filter(Boolean).join('   ');
  if (row2) out.push(row2);
  if (s.location) out.push('Location: ' + s.location);
  if (s.choreography) out.push('Choreography: ' + s.choreography);
  return out;
}

export function fightLines(e: ScriptElement): string[] {
  const f = e.fight || {};
  const out: string[] = [];
  out.push(`FIGHT${f.number ? ' ' + f.number : ''}${f.setting ? ' — ' + f.setting.toUpperCase() : ''}${f.duration ? ' (' + f.duration + ')' : ''}`);
  (f.beats || []).forEach((b, i) => b.trim() && out.push(`${i + 1}. ${b}`));
  if (f.massMoment) out.push('MASS MOMENT: ' + f.massMoment);
  return out;
}

function makeUnit(
  e: ScriptElement,
  idx: number,
  t: Template,
  m: Measurer,
  contd: Set<string>,
  layers: { roman: boolean; meaning: boolean },
  autoContd: boolean,
): Unit {
  const style = t.elements[e.type] || t.elements.action;
  const segs: Seg[] = [];
  const size = t.fontSize;
  const text = displayText(e, contd, autoContd);
  const indic = hasIndic(text);
  const lh = indic ? t.indicLineHeight : t.lineHeight;
  const wPt = style.width * 72;
  const fmt: LineStyle = { bold: style.bold, italic: style.italic, underline: style.underline };
  if (e.type === 'song' || e.type === 'fight') {
    const meta = e.type === 'song' ? songLines(e) : fightLines(e);
    const metaStyle: ElementStyle = { ...style };
    meta.forEach((ml, i) => {
      const ind = hasIndic(ml);
      segs.push({
        kind: 'meta',
        style: metaStyle,
        lines: wrapText(ml, wPt, size, m),
        lh: ind ? t.indicLineHeight : t.lineHeight,
        fmt: i === 0 ? { bold: true, underline: true } : {},
        indic: ind,
      });
    });
  }
  if (!(e.type === 'song' || e.type === 'fight') || e.text.trim()) {
    segs.push({ kind: e.omitted ? 'omitted' : 'text', style, lines: wrapText(text, wPt, size, m), lh, fmt, indic });
  }
  if (e.type === 'dialogue' && indic) {
    if (layers.roman) {
      const r = e.roman || romanize(e.text);
      if (r.trim()) segs.push({ kind: 'roman', style, lines: wrapText(r, wPt, size, m), lh: t.lineHeight, fmt: { italic: true }, indic: false });
    }
    if (layers.meaning && e.meaning && e.meaning.trim()) {
      const mt = '[' + e.meaning.trim() + ']';
      segs.push({ kind: 'meaning', style, lines: wrapText(mt, wPt, size, m), lh: t.lineHeight, fmt: { dim: true }, indic: false });
    }
  }
  const height = segs.reduce((a, s) => a + s.lines.length * s.lh, 0);
  return { el: e, idx, segs, spaceBefore: style.spaceBefore * t.lineHeight, height };
}

const unitCache = new WeakMap<ScriptElement, { key: string; m: Measurer; unit: Unit }>();

/** Page layout for a whole script. */
export function paginate(els: ScriptElement[], t: Template, opts: PaginateOptions = {}): Layout {
  const m = opts.measurer || estimateMeasurer;
  const layers = opts.layers || { roman: false, meaning: false };
  const st = opts.settings || {};
  const autoContd = st.autoContd !== false;
  const showMore = st.showMoreContd !== false;
  const continued = !!st.continuedHeaders;
  const contd = contdSet(els);
  const sceneNos = sceneNumbers(els);
  const lh = t.lineHeight;
  const contentHeight = Math.floor(((t.pageHeight - t.marginTop - t.marginBottom) * 72) / lh) * lh;
  const bottomReserve = continued ? 2 * lh : 0;
  const capacity = contentHeight - bottomReserve;
  const sig = `${t.id}|${t.fontSize}|${t.lineHeight}|${t.indicLineHeight}|${JSON.stringify(t.elements)}|${layers.roman}|${layers.meaning}|${autoContd}`;
  const units = els.map((e, i) => {
    const key = sig + '|' + contd.has(e.id);
    const c = unitCache.get(e);
    if (c && c.key === key && c.m === m) return { ...c.unit, idx: i };
    const unit = makeUnit(e, i, t, m, contd, layers, autoContd);
    unitCache.set(e, { key, m, unit });
    return unit;
  });

  const pages: Page[] = [];
  const elementPage = new Map<string, number>();
  let page: Page;
  let y = 0;
  let curScene = '';
  let curSceneNo = '';

  const lockedStarts = new Map<string, string>();
  const lockedPageIdx = new Set<number>();
  if (opts.lockedPages) for (const lp of opts.lockedPages) if (lp.startOffset === 0) lockedStarts.set(lp.startId, lp.label);

  const newPage = (startId: string, startOffset: number, contdName?: string) => {
    if (page && continued && curScene && page.lines.length) {
      page.lines.push({ text: '(CONTINUED)', x: 6.0, w: 1.5, align: 'right', y: capacity + lh, h: lh, kind: 'continued' });
    }
    page = { index: pages.length, label: String(pages.length + 1), lines: [], startId, startOffset, contdName, rev: 0, used: 0 };
    pages.push(page);
    y = 0;
    if (continued && curScene && pages.length > 1) {
      page.lines.push({ text: `${curSceneNo ? curSceneNo + ' ' : ''}CONTINUED:`, x: 1.5, w: 6, align: 'left', y: 0, h: lh, kind: 'continued' });
      y = 2 * lh;
    }
  };
  // @ts-expect-error assigned in newPage
  page = undefined;
  newPage(els[0]?.id || '', 0);

  const place = (u: Unit, seg: Seg, from: number, to: number, withSpace: boolean) => {
    if (withSpace && y > 0) y += u.spaceBefore;
    for (let i = from; i < to; i++) {
      const ln = seg.lines[i];
      page.lines.push({
        text: ln.text,
        x: seg.style.left,
        w: seg.style.width,
        align: seg.style.align,
        y,
        h: seg.lh,
        kind: seg.kind,
        style: seg.fmt,
        elId: u.el.id,
        elType: u.el.type,
        start: ln.start,
        end: ln.end,
        indic: seg.indic,
        rev: u.el.rev,
        sceneNo: u.el.type === 'scene' && i === 0 && seg.kind !== 'meta' ? sceneNos.get(u.el.id) : undefined,
      });
      if (u.el.rev && u.el.rev > page.rev) page.rev = u.el.rev;
      y += seg.lh;
    }
    page.used = y;
  };
  const placeUnit = (u: Unit) => {
    if (!elementPage.has(u.el.id)) elementPage.set(u.el.id, page.index);
    let first = true;
    for (const s of u.segs) {
      place(u, s, 0, s.lines.length, first);
      first = false;
    }
  };
  const room = () => capacity - y;
  const sb = (u: Unit) => (y > 0 ? u.spaceBefore : 0);
  const firstLines = (u: Unit | undefined, n: number) => {
    if (!u) return 0;
    let h = 0;
    let c = 0;
    for (const s of u.segs)
      for (let i = 0; i < s.lines.length && c < n; i++, c++) h += s.lh;
    return h;
  };

  /** Minimum height needed to legally start unit at index i at the current position (excl. spaceBefore). */
  const minStart = (i: number): number => {
    const u = units[i];
    if (!u) return 0;
    if (u.el.type === 'character') {
      let h = u.height;
      let j = i + 1;
      while (units[j] && units[j].el.type === 'parenthetical') {
        h += units[j].height;
        j++;
      }
      if (units[j] && units[j].el.type === 'dialogue') h += firstLines(units[j], 2);
      return h;
    }
    if (u.el.type === 'action' || u.el.type === 'general') return firstLines(u, 2);
    return u.height;
  };

  /**
   * Split a unit's text at a sentence boundary so that at least 2 lines stay
   * on this page and at least 2 lines move to the next. Returns both halves.
   */
  const sentenceSplit = (u: Unit, avail: number, reserve: number): { a: Seg; b: Seg; offset: number } | null => {
    const seg = u.segs.find((s) => s.kind === 'text');
    if (!seg || u.segs[0] !== seg) return null;
    const maxLines = Math.floor((avail - reserve) / seg.lh);
    if (maxLines < 2 || seg.lines.length < 4) return null;
    const text = displayText(u.el, contd, autoContd);
    const ends: number[] = [];
    SENTENCE_END.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = SENTENCE_END.exec(text))) ends.push(mm.index + mm[0].length);
    const wPt = seg.style.width * 72;
    for (let k = ends.length - 1; k >= 0; k--) {
      const off = ends[k];
      if (off >= text.length) continue;
      const a = wrapText(text.slice(0, off).replace(/\s+$/, ''), wPt, t.fontSize, m);
      if (a.length > maxLines) continue;
      if (a.length < 2) break;
      const b = wrapText(text.slice(off), wPt, t.fontSize, m).map((l) => ({ ...l, start: l.start + off, end: l.end + off }));
      if (b.length < 2) continue;
      return { a: { ...seg, lines: a }, b: { ...seg, lines: b }, offset: off };
    }
    return null;
  };

  /** Can unit i legally begin in `avail` points (fully, or split by the rules)? */
  const canStartAt = (i: number, avail: number): boolean => {
    const u = units[i];
    if (!u) return true;
    if (u.height <= avail) return true;
    if (u.el.type === 'action' || u.el.type === 'general') return !!sentenceSplit(u, avail, 0);
    if (u.el.type === 'character') {
      let h = u.height;
      let j = i + 1;
      while (units[j] && units[j].el.type === 'parenthetical') {
        h += units[j].height;
        j++;
      }
      let k = i + 1;
      let gh = u.height;
      while (units[k] && (units[k].el.type === 'parenthetical' || units[k].el.type === 'dialogue')) {
        gh += units[k].height;
        k++;
      }
      if (gh <= avail) return true;
      const d = units[j];
      if (!d || d.el.type !== 'dialogue') return false;
      const more = showMore ? lh : 0;
      if (h + d.height + more <= avail && k > j + 1) return true;
      return !!sentenceSplit(d, avail - h, more);
    }
    return false;
  };

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const e = u.el;
    if (e.type === 'scene') {
      curScene = e.id;
      curSceneNo = sceneNos.get(e.id) || '';
    }
    const forced = e.pageBreak || lockedStarts.has(e.id);
    if (forced && (page.lines.length > 0)) newPage(e.id, 0);
    if (lockedStarts.has(e.id)) {
      page.label = lockedStarts.get(e.id)!;
      lockedPageIdx.add(page.index);
    }

    // ---- speech group (character + parentheticals + dialogue), incl. dual dialogue
    if (e.type === 'character') {
      let j = i + 1;
      while (units[j] && (units[j].el.type === 'parenthetical' || units[j].el.type === 'dialogue') && !(units[j].el.dual && !e.dual && false)) j++;
      // dual dialogue: left group followed by right group
      let k = j;
      if (e.dual === 'left' && units[j] && units[j].el.type === 'character' && units[j].el.dual === 'right') {
        k = j + 1;
        while (units[k] && (units[k].el.type === 'parenthetical' || units[k].el.type === 'dialogue')) k++;
        const left = units.slice(i, j);
        const right = units.slice(j, k);
        const hL = left.reduce((a, x) => a + x.height, 0);
        const hR = right.reduce((a, x) => a + x.height, 0);
        const h = Math.max(hL, hR);
        if (sb(u) + h > room() && y > 0) newPage(e.id, 0);
        if (y > 0) y += u.spaceBefore;
        const top = y;
        const placeCol = (grp: Unit[], shift: number, scale: number) => {
          y = top;
          for (const g of grp) {
            if (!elementPage.has(g.el.id)) elementPage.set(g.el.id, page.index);
            for (const s of g.segs) {
              const st2: ElementStyle = { ...s.style, left: shiftLeft(s.style.left, shift, g.el.type), width: s.style.width * scale };
              const rewrapped = { ...s, style: st2 };
              place(g, rewrapped, 0, s.lines.length, false);
            }
          }
        };
        placeCol(left, 0, 0.85);
        placeCol(right, 1, 0.85);
        y = top + h;
        page.used = y;
        i = k - 1;
        continue;
      }
      const group = units.slice(i, j);
      const gh = group.reduce((a, x) => a + x.height, 0);
      if (sb(u) + gh <= room()) {
        group.forEach((g, gi) => {
          if (gi === 0) placeUnit(g);
          else {
            if (!elementPage.has(g.el.id)) elementPage.set(g.el.id, page.index);
            for (const s of g.segs) place(g, s, 0, s.lines.length, false);
          }
        });
        i = j - 1;
        continue;
      }
      // needs a split. Place as much as legal on this page.
      const name = characterName(e.text);
      const moreH = showMore ? lh : 0;
      let placed = false;
      if (y > 0 || true) {
        // simulate
        let yy = y + sb(u) + u.height;
        let splitAt = -1; // index in group of dialogue split
        let split: { a: Seg; b: Seg; offset: number } | null = null;
        let lastFull = 0; // index of last unit fully placed (0 = only char)
        for (let gi = 1; gi < group.length; gi++) {
          const g = group[gi];
          if (yy + g.height + (gi < group.length - 1 ? moreH : 0) <= capacity && g.el.type === 'dialogue') {
            yy += g.height;
            lastFull = gi;
            continue;
          }
          if (yy + g.height <= capacity - moreH && g.el.type === 'parenthetical') {
            // only keep a parenthetical if followed by something on this page — tentatively
            yy += g.height;
            continue;
          }
          if (g.el.type === 'dialogue') {
            const sp = sentenceSplit(g, capacity - yy, moreH);
            if (sp) {
              splitAt = gi;
              split = sp;
            }
          }
          break;
        }
        if (splitAt > 0 || (lastFull > 0 && lastFull < group.length - 1)) {
          // place char + units up to lastFull (+ split part)
          const upto = splitAt > 0 ? splitAt : lastFull;
          for (let gi = 0; gi < upto; gi++) {
            const g = group[gi];
            if (gi === 0) placeUnit(g);
            else {
              if (!elementPage.has(g.el.id)) elementPage.set(g.el.id, page.index);
              for (const s of g.segs) place(g, s, 0, s.lines.length, false);
            }
          }
          let contStart = upto + 1;
          let contOffset = 0;
          let contEl = group[upto + 1]?.el.id;
          if (splitAt > 0) {
            const g = group[splitAt];
            if (!elementPage.has(g.el.id)) elementPage.set(g.el.id, page.index);
            place(g, split!.a, 0, split!.a.lines.length, false);
            contOffset = split!.offset;
            contEl = g.el.id;
            contStart = splitAt;
          }
          if (showMore)
            page.lines.push({ text: '(MORE)', x: t.elements.character.left, w: 2, align: 'left', y, h: lh, kind: 'more', elId: e.id });
          newPage(contEl || e.id, contOffset, name);
          page.lines.push({
            text: `${name} (CONT'D)`,
            x: t.elements.character.left,
            w: t.elements.character.width,
            align: 'left',
            y,
            h: lh,
            kind: 'contd',
            elId: e.id,
          });
          y += lh;
          for (let gi = contStart; gi < group.length; gi++) {
            const g = group[gi];
            if (gi === splitAt) {
              place(g, split!.b, 0, split!.b.lines.length, false);
              for (const s of g.segs.slice(1)) place(g, s, 0, s.lines.length, false);
            } else {
              if (!elementPage.has(g.el.id)) elementPage.set(g.el.id, page.index);
              for (const s of g.segs) place(g, s, 0, s.lines.length, false);
            }
          }
          placed = true;
        }
      }
      if (!placed) {
        if (y > 0) newPage(e.id, 0);
        // whole group onto fresh page (if taller than a page, lines overflow onto next pages)
        for (let gi = 0; gi < group.length; gi++) {
          const g = group[gi];
          if (gi === 0) placeUnit(g);
          else placeOverflow(g);
        }
      }
      i = j - 1;
      continue;
    }

    // ---- headings must be followed by content on the same page
    if (e.type === 'scene' || e.type === 'shot' || e.type === 'montage') {
      const next = units[i + 1];
      const avail = room() - sb(u) - u.height - (next ? next.spaceBefore : 0);
      if (y > 0 && (avail < 0 || (next && !canStartAt(i + 1, avail)))) newPage(e.id, 0);
      placeUnit(u);
      continue;
    }
    if (e.type === 'parenthetical' || e.type === 'dialogue') {
      // orphan parenthetical/dialogue (no character): treat as block
      if (sb(u) + u.height + (e.type === 'parenthetical' ? firstLines(units[i + 1], 1) : 0) > room() && y > 0) newPage(e.id, 0);
      placeOverflow(u);
      continue;
    }
    if (sb(u) + u.height <= room()) {
      placeUnit(u);
      continue;
    }
    // ---- splittable action: split at a sentence boundary, ≥2 lines each side
    if ((e.type === 'action' || e.type === 'general') && y > 0) {
      const sp = sentenceSplit(u, room() - sb(u), 0);
      if (sp) {
        if (!elementPage.has(e.id)) elementPage.set(e.id, page.index);
        place(u, sp.a, 0, sp.a.lines.length, true);
        newPage(e.id, sp.offset);
        place(u, sp.b, 0, sp.b.lines.length, false);
        for (const s2 of u.segs.slice(1)) place(u, s2, 0, s2.lines.length, false);
        continue;
      }
    }
    if (y > 0) newPage(e.id, 0);
    placeOverflow(u);
  }

  function placeOverflow(u: Unit) {
    if (!elementPage.has(u.el.id)) elementPage.set(u.el.id, page.index);
    let first = true;
    for (const s of u.segs) {
      if (first && y > 0) y += u.spaceBefore;
      first = false;
      for (let li = 0; li < s.lines.length; li++) {
        if (y + s.lh > capacity && y > 0) newPage(u.el.id, s.lines[li].start);
        place(u, s, li, li + 1, false);
      }
    }
  }

  // page labels for locked pages: unlocked pages after a locked one become A-pages (12A, 12B)
  if (lockedStarts.size) {
    let last = '';
    let suffix = 0;
    for (const p of pages) {
      if (lockedPageIdx.has(p.index)) {
        last = p.label;
        suffix = 0;
      } else if (last) {
        suffix++;
        p.label = `${last}${String.fromCharCode(64 + suffix)}`;
      }
    }
  }

  return { pages, elementPage, contd, sceneNos, template: t, contentHeight };
}

function shiftLeft(left: number, col: number, type: ElementType): number {
  // dual dialogue: two columns of ~3" each inside the 6" text area
  const colLeft = 1.5 + col * 3.1;
  const rel = type === 'character' ? 0.9 : type === 'parenthetical' ? 0.35 : 0;
  void left;
  return colLeft + rel;
}

/** Page count with fractional last page (eighths are used in production). */
export function pageCount(layout: Layout): number {
  return layout.pages.length;
}

/** Runtime estimate in minutes; Indic-heavy pages are scaled by the calibration factor. */
export function runtimeMinutes(layout: Layout, settings: Pick<ScriptSettings, 'screenTimePerPage' | 'indicScreenTimeFactor'>, fromPage = 0, toPage = layout.pages.length): number {
  let total = 0;
  for (let i = fromPage; i < toPage; i++) {
    const p = layout.pages[i];
    if (!p) continue;
    const frac = i === layout.pages.length - 1 ? Math.max(0.125, p.used / layout.contentHeight) : 1;
    const indicLines = p.lines.filter((l) => l.indic).length;
    const indicShare = p.lines.length ? indicLines / p.lines.length : 0;
    const factor = 1 + indicShare * (settings.indicScreenTimeFactor - 1);
    total += frac * settings.screenTimePerPage * factor;
  }
  return total;
}

/** Length of an element range in pages (eighths), measured from the layout. */
export function rangeEighths(layout: Layout, ids: Set<string>): number {
  let h = 0;
  for (const p of layout.pages) for (const l of p.lines) if (l.elId && ids.has(l.elId)) h += l.h;
  return Math.max(1, Math.round((h / layout.contentHeight) * 8));
}

export function formatEighths(e: number): string {
  const whole = Math.floor(e / 8);
  const rest = e % 8;
  if (!whole) return `${rest}/8`;
  return rest ? `${whole} ${rest}/8` : `${whole}`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}
