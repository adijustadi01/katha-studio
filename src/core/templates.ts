import type { ElementType } from './types';

/** Element layout. All distances in inches, measured from the left page edge. */
export interface ElementStyle {
  left: number;
  width: number;
  align: 'left' | 'right' | 'center';
  /** blank lines before the element */
  spaceBefore: number;
  uppercase: boolean;
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
}

export interface Template {
  id: string;
  name: string;
  builtin?: boolean;
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  /** font size in points; the line grid is one line = lineHeight points */
  fontSize: number;
  lineHeight: number;
  /** line height (pt) used for lines that contain Indic script */
  indicLineHeight: number;
  /** font size (pt) used for Indic script runs */
  indicFontSize: number;
  headerTop: number; // page-number baseline from top, inches
  elements: Record<ElementType, ElementStyle>;
}

const s = (
  left: number,
  width: number,
  spaceBefore: number,
  uppercase = false,
  align: ElementStyle['align'] = 'left',
  extra: Partial<ElementStyle> = {},
): ElementStyle => ({ left, width, align, spaceBefore, uppercase, ...extra });

/**
 * Industry layout (Courier 12pt, 10 characters per inch, 6 lines per inch):
 * Action/Scene 1.5" (60 chars), Character 3.7", Parenthetical 3.1" (24 chars,
 * ends at 5.5"), Dialogue 2.5" (35 chars, ends at 6.0"), Transition flush
 * right at 7.5". These match the widely used Hollywood Standard numbers.
 */
function screenplayElements(): Record<ElementType, ElementStyle> {
  return {
    scene: s(1.5, 6, 1, true, 'left', { bold: false }),
    action: s(1.5, 6, 1),
    character: s(3.7, 3.3, 1, true),
    parenthetical: s(3.1, 2.4, 0),
    dialogue: s(2.5, 3.5, 0),
    transition: s(4.5, 3.0, 1, true, 'right'),
    shot: s(1.5, 6, 1, true),
    general: s(1.5, 6, 0),
    centered: s(1.5, 6, 1, false, 'center'),
    act: s(1.5, 6, 2, true, 'center', { underline: true }),
    song: s(1.5, 6, 1),
    interval: s(1.5, 6, 2, true, 'center', { bold: true }),
    fight: s(1.5, 6, 1),
    montage: s(1.5, 6, 1, true),
  };
}

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'indian-a4',
    name: 'Indian Standard (A4)',
    builtin: true,
    pageWidth: 8.27,
    pageHeight: 11.69,
    marginTop: 1,
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 12,
    indicLineHeight: 18,
    indicFontSize: 11,
    headerTop: 0.5,
    elements: screenplayElements(),
  },
  {
    id: 'hollywood-letter',
    name: 'Hollywood Standard (US Letter)',
    builtin: true,
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 1,
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 12,
    indicLineHeight: 18,
    indicFontSize: 11,
    headerTop: 0.5,
    elements: screenplayElements(),
  },
  {
    id: 'tv-one-hour',
    name: 'TV One-Hour',
    builtin: true,
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 1,
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 12,
    indicLineHeight: 18,
    indicFontSize: 11,
    headerTop: 0.5,
    elements: { ...screenplayElements(), act: s(1.5, 6, 2, true, 'center', { underline: true }) },
  },
  {
    id: 'tv-half-hour',
    name: 'TV Half-Hour Multicam',
    builtin: true,
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 1,
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 12,
    indicLineHeight: 18,
    indicFontSize: 11,
    headerTop: 0.5,
    elements: {
      ...screenplayElements(),
      // multicam: scene headings underlined, action in caps, dialogue double spaced feel
      scene: s(1.5, 6, 1, true, 'left', { underline: true }),
      action: s(1.5, 6, 1, true),
      dialogue: s(2.5, 3.5, 0),
      act: s(1.5, 6, 2, true, 'center', { underline: true }),
    },
  },
  {
    id: 'stage-play',
    name: 'Stage Play',
    builtin: true,
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 1,
    marginBottom: 1,
    fontSize: 12,
    lineHeight: 12,
    indicLineHeight: 18,
    indicFontSize: 11,
    headerTop: 0.5,
    elements: {
      ...screenplayElements(),
      scene: s(1.5, 6, 2, true, 'center', { underline: true }),
      action: s(3.5, 4, 1, false, 'left', { italic: true }),
      character: s(4.0, 3.5, 1, true),
      parenthetical: s(2.5, 4.5, 0, false, 'left', { italic: true }),
      dialogue: s(1.5, 6, 0),
      transition: s(4.5, 3, 1, true, 'right'),
    },
  },
];

let custom: Template[] = [];

export function setCustomTemplates(t: Template[]) {
  custom = t;
}
export function allTemplates(): Template[] {
  return [...BUILTIN_TEMPLATES, ...custom];
}
export function getTemplate(id: string): Template {
  return allTemplates().find((t) => t.id === id) || BUILTIN_TEMPLATES[0];
}

/** Lines per page on the grid (Courier lines). */
export function linesPerPage(t: Template): number {
  return Math.floor(((t.pageHeight - t.marginTop - t.marginBottom) * 72) / t.lineHeight);
}
