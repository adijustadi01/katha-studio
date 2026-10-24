import { SCHEMES, Scheme, IndicLang } from './schemes';
import { charLang } from '../elements';

const RANGE_START: Record<IndicLang, number> = { hi: 0x0900, ta: 0x0b80, te: 0x0c00, kn: 0x0c80, ml: 0x0d00 };

function isConsonant(ch: string, lang: IndicLang): boolean {
  const cp = ch.codePointAt(0)! - RANGE_START[lang];
  // consonant block is 0x15–0x39 in every Brahmic block (plus nukta forms 0x58–0x5F for Devanagari)
  return (cp >= 0x15 && cp <= 0x39) || (lang === 'hi' && cp >= 0x58 && cp <= 0x5f);
}
function isVowelSign(ch: string, lang: IndicLang): boolean {
  const cp = ch.codePointAt(0)! - RANGE_START[lang];
  return (cp >= 0x3e && cp <= 0x4c) || cp === 0x57 || cp === 0x62 || cp === 0x63;
}
function isIndepVowel(ch: string, lang: IndicLang): boolean {
  const cp = ch.codePointAt(0)! - RANGE_START[lang];
  return cp >= 0x05 && cp <= 0x14;
}

interface Syl {
  c?: string; // consonant char
  v?: string; // vowel sign or independent vowel ('' = inherent)
  virama?: boolean;
  other?: string; // anusvara, punctuation, latin...
}

function syllables(text: string, s: Scheme, lang: IndicLang): Syl[] {
  const out: Syl[] = [];
  const chars = Array.from(text.normalize('NFC'));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (charLang(ch.codePointAt(0)!) === lang && isConsonant(ch, lang)) {
      let c = ch;
      if (chars[i + 1] === '़') {
        c += '़';
        i++;
      }
      const n = chars[i + 1];
      if (n === s.virama) {
        out.push({ c, virama: true });
        i++;
      } else if (n && isVowelSign(n, lang)) {
        out.push({ c, v: n });
        i++;
      } else out.push({ c, v: '' });
    } else if (charLang(ch.codePointAt(0)!) === lang && isIndepVowel(ch, lang)) {
      out.push({ v: ch });
    } else out.push({ other: ch });
  }
  return out;
}

const isVowelish = (x: Syl | undefined) => !!x && x.c === undefined && x.v !== undefined;

/** Readable Roman transliteration for actors and crew (not academic ISO). */
export function romanizeLang(text: string, lang: IndicLang): string {
  const s = SCHEMES[lang];
  const syl = syllables(text, s, lang);
  let out = '';
  for (let i = 0; i < syl.length; i++) {
    const x = syl[i];
    const prev = syl[i - 1];
    const next = syl[i + 1];
    if (x.other !== undefined) {
      if (x.other === s.anusvara) {
        const nc = next?.c ? s.romanC[next.c] || '' : '';
        out += !next || next.other !== undefined || /^[pbm]/.test(nc) ? 'm' : 'n';
      } else if (s.romanV[x.other] !== undefined) out += s.romanV[x.other];
      else if (s.romanC[x.other] !== undefined) out += s.romanC[x.other];
      else if (x.other === '‌' || x.other === '‍') {
        /* joiners */
      } else out += x.other;
      continue;
    }
    if (x.c === undefined) {
      out += s.romanV[x.v!] ?? '';
      continue;
    }
    let cr = s.romanC[x.c] ?? s.romanC[x.c[0]] ?? '';
    if (lang === 'ta') cr = tamilVoicing(x, prev, next, cr);
    else if (lang === 'hi' && x.c.length > 1) cr = cr || nuktaRoman(x.c);
    if (x.virama) {
      out += cr;
      continue;
    }
    let v = x.v ? s.romanV[x.v] ?? '' : 'a';
    // Hindi schwa deletion at word end
    if (lang === 'hi' && x.v === '' && (!next || next.other !== undefined) && out.length > 0) v = '';
    out += cr + v;
  }
  return out;
}

function nuktaRoman(c: string): string {
  const m: Record<string, string> = { 'ज़': 'z', 'फ़': 'f', 'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ड़': 'r', 'ढ़': 'rh' };
  return m[c] || '';
}

/** Tamil stops are voiced between vowels and after nasals; doubled stops stay hard. */
function tamilVoicing(x: Syl, prev: Syl | undefined, next: Syl | undefined, cr: string): string {
  const c = x.c!;
  const prevVowel = prev && ((prev.c !== undefined && !prev.virama) || isVowelish(prev));
  const prevSame = prev && prev.c === c && prev.virama;
  const nextSameDouble = x.virama && next && next.c === c;
  switch (c) {
    case 'க':
      if (prev?.c === 'ங' && prev.virama) return 'g';
      if (prevVowel && !x.virama) return 'g';
      return 'k';
    case 'ச':
      if (nextSameDouble) return '';
      if (prevSame) return 'ch';
      if (prev?.c === 'ஞ' && prev.virama) return 'j';
      return 's';
    case 'ட':
      if (prev?.c === 'ண' && prev.virama) return 'd';
      if (prevVowel && !x.virama) return 'd';
      return 't';
    case 'த':
      if (nextSameDouble) return '';
      if (prev?.c === 'ந' && prev.virama) return 'dh';
      if (prevVowel && !x.virama) return 'dh';
      return 'th';
    case 'ப':
      if (prev?.c === 'ம' && prev.virama) return 'b';
      return 'p';
    case 'ற':
      if (nextSameDouble) return 't';
      if (prevSame) return 'r';
      if (prev?.c === 'ன' && prev.virama) return 'dr';
      return 'r';
    case 'ஞ':
      if (next?.c === 'ச') return 'n';
      return 'nj';
    case 'ங':
      return 'n';
  }
  return cr;
}

/** Romanise mixed text: each Indic run is romanised with its own script. */
export function romanize(text: string): string {
  let out = '';
  let run = '';
  let runLang: IndicLang | null = null;
  const flush = () => {
    if (run) out += runLang ? romanizeLang(run, runLang) : run;
    run = '';
  };
  for (const ch of text) {
    const l = charLang(ch.codePointAt(0)!) as IndicLang | null;
    const isJoin = ch === '‌' || ch === '‍';
    const eff: IndicLang | null = isJoin ? runLang : l;
    if (eff !== runLang) {
      flush();
      runLang = eff;
    }
    run += ch;
  }
  flush();
  return out;
}
