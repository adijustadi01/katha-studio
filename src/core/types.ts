// Core document model for Katha Studio. Pure data — no DOM, no editor.

export type ElementType =
  | 'scene'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'general'
  | 'centered'
  | 'act'
  | 'song'
  | 'interval'
  | 'fight'
  | 'montage';

export type Lang = 'en' | 'ta' | 'te' | 'hi' | 'ml' | 'kn';
export const LANGS: Lang[] = ['en', 'ta', 'te', 'hi', 'ml', 'kn'];
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  ta: 'Tamil',
  te: 'Telugu',
  hi: 'Hindi',
  ml: 'Malayalam',
  kn: 'Kannada',
};

/** Inline formatting / annotation spans inside an element's text. */
export interface Span {
  from: number;
  to: number;
  kind: 'bold' | 'italic' | 'underline' | 'note' | 'tag' | 'highlight';
  /** note id, tag id or highlight color */
  ref?: string;
}

export interface SongData {
  number?: number;
  title?: string;
  situation?: string;
  mood?: string;
  singers?: string;
  lyricist?: string;
  choreography?: string;
  location?: string;
  duration?: string; // "4:30"
}

export interface FightData {
  number?: number;
  setting?: string;
  beats?: string[];
  massMoment?: string;
  duration?: string;
}

export interface ScriptElement {
  id: string;
  type: ElementType;
  text: string;
  /** explicit language; undefined = auto-detect from text */
  lang?: Lang;
  spans?: Span[];
  /** dual dialogue: elements in the right column carry dual='right', left column 'left' */
  dual?: 'left' | 'right';
  /** bilingual dialogue: user override of the auto romanisation */
  roman?: string;
  /** bilingual dialogue: English meaning */
  meaning?: string;
  /** revision color index set when changed in revision mode */
  rev?: number;
  /** scene-heading only: locked scene number e.g. "12A" */
  sceneNo?: string;
  /** scene-heading only: omitted */
  omitted?: boolean;
  /** forces a page break before this element */
  pageBreak?: boolean;
  song?: SongData;
  fight?: FightData;
  /** montage marker sub-kind */
  marker?: string;
}

export interface TitlePage {
  title: string;
  credit: string; // "Written by"
  author: string;
  basedOn: string;
  contact: string;
  draft: string;
  date: string;
  registration: string; // Writers' Association reg. no / copyright
  notes: string;
}

export interface SceneMeta {
  color?: string;
  synopsis?: string;
  tracks?: string[];
  tags?: string[]; // commercial tags: hero-intro, mass, punch, comedy...
  title?: string; // index card title
  energy?: number; // pulse chart override 0..10
}

export interface CharacterProfile {
  name: string;
  photo?: string; // asset path inside .katha
  age?: string;
  role?: string;
  arc?: string;
  relationships?: string;
  notes?: string;
  voice?: string; // TTS voice name
  actor?: string;
}

export interface LocationProfile {
  name: string;
  photo?: string;
  notes?: string;
  address?: string;
}

export interface Note {
  id: string;
  author: string;
  color: string;
  text: string;
  created: number;
  resolved?: boolean;
  elementId?: string;
}

export interface Track {
  id: string;
  name: string;
  color: string;
}

export interface Beat {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  image?: string;
  /** when placed into the outline */
  act?: number;
}

export interface Punch {
  id: string;
  text: string;
  character?: string;
  tags?: string[];
  lang?: Lang;
}

export type BreakdownCategory =
  | 'cast'
  | 'extras'
  | 'props'
  | 'wardrobe'
  | 'makeup'
  | 'vehicles'
  | 'animals'
  | 'stunts'
  | 'sfx'
  | 'vfx'
  | 'music'
  | 'setdressing'
  | 'location';

export interface BreakdownTag {
  id: string;
  category: BreakdownCategory;
  text: string;
  elementId: string;
}

export interface ShootDay {
  id: string;
  label: string;
  date?: string;
  sceneIds: string[];
}

export interface Snapshot {
  id: string;
  name: string;
  created: number;
  auto: boolean;
  elements: ScriptElement[];
  titlePage?: TitlePage;
}

export interface RevisionState {
  active: boolean;
  /** index into REVISION_COLORS */
  color: number;
  label: string;
  date: string;
  pagesLocked: boolean;
  scenesLocked: boolean;
  /** locked page layout: element id of first element on each locked page, with page labels */
  lockedPages?: { label: string; startId: string; startOffset: number }[];
}

export interface ScriptSettings {
  template: string;
  sceneNumbers: 'none' | 'left' | 'right' | 'both';
  autoContd: boolean;
  showMoreContd: boolean;
  continuedHeaders: boolean;
  layers: { roman: boolean; meaning: boolean };
  exportLayers: { roman: boolean; meaning: boolean };
  screenTimePerPage: number; // minutes per page, default 1
  indicScreenTimeFactor: number; // calibration factor for Indic-heavy pages
  pulseGapMinutes: number;
  defaultLang: Lang;
  indicFontStyle: 'sans' | 'serif';
}

export interface Project {
  version: 1;
  id: string;
  titlePage: TitlePage;
  elements: ScriptElement[];
  settings: ScriptSettings;
  scenes: Record<string, SceneMeta>; // keyed by scene element id
  characters: Record<string, CharacterProfile>; // keyed by upper-case name
  locations: Record<string, LocationProfile>;
  notes: Note[];
  tracks: Track[];
  beats: Beat[];
  punches: Punch[];
  breakdown: BreakdownTag[];
  schedule: ShootDay[];
  revision: RevisionState;
  snapshots: Snapshot[];
  /** inline assets (data URLs) keyed by asset path; packed into the zip as binary */
  assets: Record<string, string>;
  created: number;
  modified: number;
}

export const REVISION_COLORS = [
  { name: 'White', css: '#ffffff' },
  { name: 'Blue', css: '#cfe3ff' },
  { name: 'Pink', css: '#ffd6e5' },
  { name: 'Yellow', css: '#fff6b3' },
  { name: 'Green', css: '#d4f5c9' },
  { name: 'Goldenrod', css: '#f2d27a' },
  { name: 'Buff', css: '#f0dcb4' },
  { name: 'Salmon', css: '#ffc0a8' },
  { name: 'Cherry', css: '#f4a0a8' },
];

export const BREAKDOWN_CATEGORIES: { id: BreakdownCategory; name: string; color: string }[] = [
  { id: 'cast', name: 'Cast', color: '#ff5252' },
  { id: 'extras', name: 'Extras / Junior Artists', color: '#4caf50' },
  { id: 'props', name: 'Props', color: '#9c27b0' },
  { id: 'wardrobe', name: 'Wardrobe', color: '#03a9f4' },
  { id: 'makeup', name: 'Makeup / Hair', color: '#e91e63' },
  { id: 'vehicles', name: 'Vehicles', color: '#ff9800' },
  { id: 'animals', name: 'Animals', color: '#795548' },
  { id: 'stunts', name: 'Stunts', color: '#f44336' },
  { id: 'sfx', name: 'SFX', color: '#00bcd4' },
  { id: 'vfx', name: 'VFX', color: '#3f51b5' },
  { id: 'music', name: 'Music', color: '#cddc39' },
  { id: 'setdressing', name: 'Set Dressing', color: '#8bc34a' },
  { id: 'location', name: 'Location', color: '#607d8b' },
];

export const SCENE_TAGS: { id: string; name: string; color: string; energy: number }[] = [
  { id: 'hero-intro', name: 'Hero Intro', color: '#ff6d00', energy: 10 },
  { id: 'mass', name: 'Mass Moment', color: '#d50000', energy: 10 },
  { id: 'punch', name: 'Punch Dialogue', color: '#ff1744', energy: 8 },
  { id: 'comedy', name: 'Comedy Track', color: '#ffd600', energy: 6 },
  { id: 'emotional', name: 'Emotional Beat', color: '#2979ff', energy: 7 },
  { id: 'twist', name: 'Twist / Reveal', color: '#aa00ff', energy: 9 },
  { id: 'romance', name: 'Romance', color: '#f50057', energy: 6 },
  { id: 'villain-intro', name: 'Villain Intro', color: '#212121', energy: 9 },
];

export const MARKERS = [
  'MONTAGE',
  'END MONTAGE',
  'SERIES OF SHOTS',
  'END SERIES OF SHOTS',
  'INTERCUT WITH',
  'END INTERCUT',
  'BEGIN FLASHBACK',
  'END FLASHBACK',
  'BEGIN DREAM',
  'END DREAM',
];
