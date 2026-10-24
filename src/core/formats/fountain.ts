// Fountain (https://fountain.io) import and export.
// Katha-specific data (songs, fights, intervals, meanings, tags) travels in
// inline notes of the form [[katha:{json}]] so round trips are lossless while
// other Fountain apps still show readable text.
import type { ScriptElement, TitlePage, Span, ElementType } from '../types';
import { el } from '../project';
import { emptyTitlePage } from '../project';
import { hasIndic, isUpper } from '../elements';
import { songLines, fightLines } from '../paginate';

export interface ParsedScript {
  elements: ScriptElement[];
  titlePage: TitlePage;
  synopses: Record<string, string>; // scene id → synopsis
  colors?: Record<string, string>;
}

const TP_KEYS: Record<string, keyof TitlePage> = {
  title: 'title',
  credit: 'credit',
  author: 'author',
  authors: 'author',
  source: 'basedOn',
  'draft date': 'date',
  date: 'date',
  contact: 'contact',
  draft: 'draft',
  registration: 'registration',
  copyright: 'registration',
  notes: 'notes',
};

// ------------------------------------------------------------------ export

function emphasis(e: ScriptElement): string {
  const text = e.text;
  const fmt = (e.spans || []).filter((s) => s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline');
  const escaped = (s: string) => s.replace(/([*_\\])/g, '\\$1');
  if (!fmt.length) return escaped(text);
  const opens = new Map<number, string[]>();
  const closes = new Map<number, string[]>();
  for (const s of fmt) {
    const m = s.kind === 'bold' ? '**' : s.kind === 'italic' ? '*' : '_';
    (opens.get(s.from) || opens.set(s.from, []).get(s.from)!).push(m);
    (closes.get(s.to) || closes.set(s.to, []).get(s.to)!).unshift(m);
  }
  let out = '';
  for (let i = 0; i <= text.length; i++) {
    for (const m of closes.get(i) || []) out += m;
    for (const m of opens.get(i) || []) out += m;
    if (i < text.length) out += escaped(text[i]);
  }
  return out;
}

function kathaNote(e: ScriptElement, extra: Record<string, unknown> = {}): string {
  const d: Record<string, unknown> = { ...extra };
  if (e.song) d.song = e.song;
  if (e.fight) d.fight = e.fight;
  if (e.meaning) d.meaning = e.meaning;
  if (e.roman) d.roman = e.roman;
  if (e.lang) d.lang = e.lang;
  if (e.rev) d.rev = e.rev;
  if (e.omitted) d.omitted = true;
  if (e.marker) d.marker = e.marker;
  const other = (e.spans || []).filter((s) => !(s.kind === 'bold' || s.kind === 'italic' || s.kind === 'underline'));
  if (other.length) d.spans = other;
  if (!Object.keys(d).length) return '';
  return ' [[katha:' + JSON.stringify(d).replace(/\]\]/g, '] ]') + ']]';
}

export function toFountain(els: ScriptElement[], tp?: TitlePage, synopses: Record<string, string> = {}): string {
  const out: string[] = [];
  if (tp) {
    const rows: [string, string][] = [
      ['Title', tp.title],
      ['Credit', tp.credit],
      ['Author', tp.author],
      ['Source', tp.basedOn],
      ['Draft', tp.draft],
      ['Draft date', tp.date],
      ['Registration', tp.registration],
      ['Contact', tp.contact],
      ['Notes', tp.notes],
    ];
    for (const [k, v] of rows) {
      if (!v) continue;
      if (v.includes('\n')) out.push(`${k}:\n` + v.split('\n').map((l) => '   ' + l).join('\n'));
      else out.push(`${k}: ${v}`);
    }
    out.push('');
  }
  let prev: ScriptElement | null = null;
  const blank = () => {
    if (out.length && out[out.length - 1] !== '') out.push('');
  };
  for (const e of els) {
    const t = e.type;
    const text = emphasis(e).replace(/\n/g, '\n');
    const inSpeech = (t === 'dialogue' || t === 'parenthetical') && !!prev && ['character', 'dialogue', 'parenthetical'].includes(prev.type);
    if (e.pageBreak) {
      blank();
      out.push('===');
    }
    if (!inSpeech) blank();
    if (e.text === '' && t !== 'interval' && t !== 'song' && t !== 'fight') {
      const note = kathaNote(e, { t, empty: 1 }).trim();
      if (t === 'dialogue') out.push(note);
      else if (t === 'parenthetical') out.push('()' + ' ' + note);
      else if (t === 'scene') out.push('.' + ' ' + note);
      else if (t === 'character') out.push('@' + ' ' + note);
      else out.push('!' + ' ' + note);
      prev = e;
      continue;
    }
    switch (t) {
      case 'scene': {
        let line = e.text.trim();
        const forced = !/^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[.\s]/i.test(line);
        line = (forced ? '.' : '') + emphasis({ ...e, text: line });
        if (e.sceneNo) line += ` #${e.sceneNo}#`;
        out.push(line + kathaNote(e));
        if (synopses[e.id]) {
          out.push('');
          out.push('= ' + synopses[e.id].replace(/\n/g, ' '));
        }
        break;
      }
      case 'action':
        out.push(forceAction(text) + kathaNote(e));
        break;
      case 'character': {
        let cue = text;
        const needsForce = cue !== cue.toUpperCase() || hasIndic(cue) || !/[A-Z]/.test(cue);
        if (needsForce) cue = '@' + cue;
        if (e.dual === 'right') cue += ' ^';
        out.push(cue + kathaNote(e));
        break;
      }
      case 'parenthetical': {
        let p = text.trim();
        if (!p.startsWith('(')) p = '(' + p + ')';
        out.push(inSpeech ? p + kathaNote(e) : '!' + p + kathaNote(e, { t }));
        break;
      }
      case 'dialogue':
        out.push(inSpeech ? text + kathaNote(e) : '!' + text + kathaNote(e, { t }));
        break;
      case 'transition':
        out.push((/TO:$/.test(text.toUpperCase()) && text === text.toUpperCase() ? text : '> ' + text) + kathaNote(e));
        break;
      case 'centered':
        out.push('> ' + text + ' <' + kathaNote(e));
        break;
      case 'act':
        out.push('> ' + (text || 'ACT') + ' <' + kathaNote(e, { t: 'act' }));
        break;
      case 'interval':
        out.push('> ' + (e.text || 'INTERVAL') + ' <' + kathaNote(e, { t: 'interval', ...(e.text ? {} : { empty: 1 }) }));
        break;
      case 'song':
      case 'fight': {
        const label = e.text || (t === 'song' ? songLines(e)[0] : fightLines(e)[0]);
        out.push('!' + (e.text ? text : label) + kathaNote(e, { t, ...(e.text ? {} : { empty: 1 }) }));
        break;
      }
      case 'montage':
      case 'shot':
      case 'general':
        out.push('!' + text + kathaNote(e, { t }));
        break;
    }
    prev = e;
  }
  void prev;
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function forceAction(text: string): string {
  // a single all-caps line followed by text could be read as a character; also
  // lines that look like scene headings or transitions need the '!' prefix
  const first = text.split('\n')[0];
  if (/^(INT|EXT|EST|I\/E)[.\s]/i.test(first) || /^[.@>~=#!]/.test(first) || (first === first.toUpperCase() && /[A-Z]/.test(first)))
    return '!' + text;
  if (hasIndic(first) && text.includes('\n')) return '!' + text;
  return text;
}

// ------------------------------------------------------------------ import

interface Line {
  text: string;
  katha?: any;
}

function extractKatha(raw: string): Line {
  let katha: any;
  const text = raw.replace(/\s*\[\[katha:(.*?)\]\]/g, (_m, j) => {
    try {
      katha = JSON.parse(j);
    } catch {
      /* ignore */
    }
    return '';
  });
  return { text, katha };
}

function parseEmphasis(text: string): { text: string; spans: Span[] } {
  const spans: Span[] = [];
  let out = '';
  const open: Record<string, number> = {};
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length) {
      out += text[i + 1];
      i++;
      continue;
    }
    let m = '';
    if (c === '*' && text[i + 1] === '*') m = '**';
    else if (c === '*') m = '*';
    else if (c === '_') m = '_';
    if (m) {
      const kind: Span['kind'] = m === '**' ? 'bold' : m === '*' ? 'italic' : 'underline';
      if (open[m] !== undefined) {
        spans.push({ from: open[m], to: out.length, kind });
        delete open[m];
        i += m.length - 1;
        continue;
      }
      // only open if a matching closer exists later
      const rest = text.slice(i + m.length);
      if (rest.includes(m)) {
        open[m] = out.length;
        i += m.length - 1;
        continue;
      }
    }
    out += c;
  }
  return { text: out, spans };
}

function applyKatha(e: ScriptElement, k: any) {
  if (!k) return;
  if (k.t) e.type = k.t as ElementType;
  if (k.song) e.song = k.song;
  if (k.fight) e.fight = k.fight;
  if (k.meaning) e.meaning = k.meaning;
  if (k.roman) e.roman = k.roman;
  if (k.lang) e.lang = k.lang;
  if (k.rev) e.rev = k.rev;
  if (k.omitted) e.omitted = true;
  if (k.marker) e.marker = k.marker;
  if (k.spans) e.spans = [...(e.spans || []), ...k.spans];
  if (k.empty) e.text = '';
}

const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[.\s]/i;

function isCharacterCue(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 50) return false;
  if (l.startsWith('@')) return true;
  const name = l.replace(/\(.*?\)/g, '').replace(/\^$/, '').trim();
  if (!name) return false;
  if (!/[A-Z]/.test(name)) return false; // Latin letters required (Indic cues are exported with @)
  return name === name.toUpperCase() && !/[.!?:]$/.test(name);
}

export function fromFountain(src: string): ParsedScript {
  let text = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  // boneyard
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = text.split('\n');
  const tp = emptyTitlePage();
  tp.title = '';
  tp.credit = '';
  tp.draft = '';
  tp.date = '';
  let i = 0;
  // title page: first block of key: value lines
  if (/^[A-Za-z ]+:/.test(lines[0] || '') && TP_KEYS[(lines[0].split(':')[0] || '').trim().toLowerCase()]) {
    let key: keyof TitlePage | null = null;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') {
        i++;
        break;
      }
      const m = l.match(/^([A-Za-z ]+):\s*(.*)$/);
      if (m && !/^\s{2,}|\t/.test(l)) {
        key = TP_KEYS[m[1].trim().toLowerCase()] || null;
        if (key) tp[key] = m[2].trim();
      } else if (key) {
        tp[key] = (tp[key] ? tp[key] + '\n' : '') + l.trim();
      }
    }
  }
  const els: ScriptElement[] = [];
  const synopses: Record<string, string> = {};
  let pendingBreak = false;
  let pendingSynopsis = '';
  let lastScene: ScriptElement | null = null;
  const push = (e: ScriptElement) => {
    if (pendingBreak) {
      e.pageBreak = true;
      pendingBreak = false;
    }
    els.push(e);
    return e;
  };
  const makeEl = (type: ElementType, raw: string, k?: any): ScriptElement => {
    const { text: t, spans } = parseEmphasis(raw);
    const e = el(type, t);
    if (spans.length) e.spans = spans;
    applyKatha(e, k);
    return e;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    if (rawLine.trim() === '') {
      i++;
      continue;
    }
    // gather the block (until blank line)
    const block: Line[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      block.push(extractKatha(lines[i]));
      i++;
    }
    // inline non-katha notes are dropped from text
    for (const b of block) b.text = b.text.replace(/\[\[[\s\S]*?\]\]/g, '').replace(/\s+$/, '');
    const first = block[0].text.trim();
    if (!first && block.length === 1) {
      if (block[0].katha) push(makeEl((block[0].katha.t as ElementType) || 'action', '', block[0].katha));
      continue;
    }

    if (/^===+$/.test(first)) {
      pendingBreak = true;
      continue;
    }
    if (first.startsWith('=') && !first.startsWith('===')) {
      const syn = first.replace(/^=\s*/, '');
      if (lastScene) synopses[lastScene.id] = (synopses[lastScene.id] ? synopses[lastScene.id] + ' ' : '') + syn;
      else pendingSynopsis += syn;
      continue;
    }
    if (first.startsWith('#')) {
      const e = push(makeEl('act', first.replace(/^#+\s*/, ''), block[0].katha));
      void e;
      continue;
    }
    // scene heading
    if (block.length === 1 && ((SCENE_RE.test(first) ) || (first.startsWith('.') && !first.startsWith('..')))) {
      let h = first.startsWith('.') && !SCENE_RE.test(first) ? first.slice(1) : first;
      let num: string | undefined;
      const nm = h.match(/\s*#([^#]+)#\s*$/);
      if (nm) {
        num = nm[1];
        h = h.slice(0, nm.index).trim();
      }
      const e = push(makeEl('scene', h.trim(), block[0].katha));
      if (num) e.sceneNo = num;
      lastScene = e;
      if (pendingSynopsis) {
        synopses[e.id] = pendingSynopsis;
        pendingSynopsis = '';
      }
      continue;
    }
    // centered
    if (block.length === 1 && /^>.*<$/.test(first)) {
      const e = makeEl('centered', first.slice(1, -1).trim(), block[0].katha);
      if (e.type === 'centered' && /^INTERVAL$/i.test(e.text) && !block[0].katha) e.type = 'interval';
      push(e);
      continue;
    }
    // forced transition / transition
    if (block.length === 1 && (first.startsWith('>') || (/TO:$/.test(first) && first === first.toUpperCase() && /[A-Z]/.test(first)) || /^(FADE OUT\.|FADE TO BLACK\.|CUT TO BLACK\.)$/.test(first))) {
      push(makeEl('transition', first.replace(/^>\s*/, ''), block[0].katha));
      continue;
    }
    // forced action
    if (first.startsWith('!')) {
      const raw = [block[0].text.replace(/^\s*!/, ''), ...block.slice(1).map((b) => b.text)].join('\n');
      const k = block.find((b) => b.katha)?.katha;
      push(makeEl('action', raw, k));
      continue;
    }
    // lyrics
    if (first.startsWith('~')) {
      push(makeEl('general', block.map((b) => b.text.replace(/^~\s?/, '')).join('\n'), block[0].katha));
      continue;
    }
    // dialogue block
    if (block.length >= 2 && isCharacterCue(first)) {
      let cue = first.replace(/^@/, '');
      let dual: 'right' | undefined;
      if (/\^\s*$/.test(cue)) {
        cue = cue.replace(/\s*\^\s*$/, '');
        dual = 'right';
      }
      const ce = push(makeEl('character', cue, block[0].katha));
      if (dual) {
        ce.dual = 'right';
        // previous speech becomes the left column
        for (let j = els.length - 2; j >= 0; j--) {
          const p = els[j];
          if (p.type === 'dialogue' || p.type === 'parenthetical' || p.type === 'character') {
            p.dual = 'left';
            if (p.type === 'character') break;
          } else break;
        }
      }
      let dlg: string[] = [];
      let dk: any;
      const flush = () => {
        if (!dlg.length) return;
        const d = push(makeEl('dialogue', dlg.join('\n'), dk));
        if (dual) d.dual = 'right';
        dlg = [];
        dk = undefined;
      };
      for (const b of block.slice(1)) {
        const t = b.text.trim();
        if (/^\(.*\)$/.test(t)) {
          flush();
          const p = push(makeEl('parenthetical', t, b.katha));
          if (dual) p.dual = 'right';
        } else {
          dlg.push(b.text.replace(/^\s+/, ''));
          if (b.katha) dk = b.katha;
        }
      }
      flush();
      continue;
    }
    // action (default)
    const raw = block.map((b) => b.text).join('\n');
    const k = block.find((b) => b.katha)?.katha;
    push(makeEl('action', raw, k));
  }
  // upper-case types keep their text as typed
  for (const e of els) if (isUpper(e.type) && e.type !== 'character') e.text = e.text;
  if (!tp.title) tp.title = 'Untitled Screenplay';
  if (!tp.credit) tp.credit = 'Written by';
  return { elements: els, titlePage: tp, synopses };
}
