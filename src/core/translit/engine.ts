import { SCHEMES, Scheme, IndicLang } from './schemes';
import { LEXICON } from './lexicon';

type Tok =
  | { k: 'C'; out: string; r: string }
  | { k: 'V'; ind: string; sign: string; r: string }
  | { k: 'S'; out: string; r: string };

interface Compiled {
  scheme: Scheme;
  map: Map<string, Tok>;
  maxLen: number;
}
const compiled = new Map<IndicLang, Compiled>();

function compile(lang: IndicLang): Compiled {
  let c = compiled.get(lang);
  if (c) return c;
  const s = SCHEMES[lang];
  const map = new Map<string, Tok>();
  for (const [r, out] of s.specials || []) map.set(r, { k: 'S', out, r });
  for (const [r, out] of s.consonants) map.set(r, { k: 'C', out, r });
  for (const [r, ind, sign] of s.vowels) map.set(r, { k: 'V', ind, sign, r });
  let maxLen = 1;
  for (const k of map.keys()) maxLen = Math.max(maxLen, k.length);
  c = { scheme: s, map, maxLen };
  compiled.set(lang, c);
  return c;
}

/** Normalise letter case: only scheme case-keys keep their capitals. */
function normCase(word: string, s: Scheme): string {
  if (word.length > 1 && word === word.toUpperCase()) return word.toLowerCase();
  let w = word;
  if (/^[A-Z][a-z]/.test(w)) w = w[0].toLowerCase() + w.slice(1);
  let out = '';
  for (const ch of w) out += /[A-Z]/.test(ch) && !s.caseKeys.includes(ch) ? ch.toLowerCase() : ch;
  return out;
}

function tokenize(word: string, c: Compiled): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < word.length) {
    let found: Tok | undefined;
    let len = 0;
    for (let L = Math.min(c.maxLen, word.length - i); L >= 1; L--) {
      const sub = word.slice(i, i + L);
      const t = c.map.get(sub) || c.map.get(sub.toLowerCase());
      if (t) {
        found = t;
        len = L;
        break;
      }
    }
    if (!found) {
      toks.push({ k: 'S', out: word[i], r: word[i] });
      i++;
    } else {
      toks.push({ ...found });
      i += len;
    }
  }
  return toks;
}

const LONG_VOWELS = new Set(['aa', 'A', 'ii', 'ee', 'I', 'uu', 'oo', 'U', 'E', 'ae', 'ai', 'ei', 'O', 'oa', 'au', 'ou', 'ow', 'o', 'e']);

function contextRules(toks: Tok[], s: Scheme): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    const prev = out[out.length - 1];
    if (s.lang === 'ta' && t.k === 'C') {
      if (t.r === 'n' && next?.r === 'd' && toks[i + 2]?.r === 'r') {
        // n-d-r is written ன்ற (nandri, endru, ondru)
        out.push({ k: 'C', out: i === 0 ? 'ந' : 'ன', r: 'n' }, { k: 'C', out: 'ற', r: 'R' });
        i += 2;
        continue;
      }
      if (t.r === 'n') {
        if (i === 0) t.out = 'ந';
        else if (next && next.k === 'C' && next.out === 'த') t.out = 'ந';
        else if (next && next.k === 'C' && next.out === 'ட') t.out = 'ண';
      }
      if (t.r === 'ng' && next && next.k === 'V') {
        out.push({ k: 'C', out: 'ங', r: 'n' }, { k: 'C', out: 'க', r: 'g' });
        continue;
      }
      if (t.r === 'nj' && next && next.k === 'V') {
        out.push({ k: 'C', out: 'ஞ', r: 'n' }, { k: 'C', out: 'ச', r: 'j' });
        continue;
      }
    }
    if (s.nasalToAnusvara && s.anusvara && t.k === 'C' && (t.r === 'n' || t.r === 'm') && i > 0 && next && next.k === 'C') {
      const nr = next.r.toLowerCase();
      const isSame = next.out === t.out;
      const sonorant = /^(y|r|l|v|w|h|n|m)$/.test(nr);
      if (!isSame && !sonorant) {
        out.push({ k: 'S', out: s.anusvara, r: t.r });
        continue;
      }
    }
    if (s.lang === 'hi' && t.k === 'C' && t.r === 'n' && !next && prev && prev.k === 'V' && LONG_VOWELS.has(prev.r) && s.anusvara) {
      out.push({ k: 'S', out: s.anusvara, r: 'n' });
      continue;
    }
    if (s.lang === 'ml' && t.k === 'C' && !next && prev && prev.k === 'V') {
      const chillu: Record<string, string> = { n: 'ൻ', l: 'ൽ', r: 'ർ', L: 'ൾ', N: 'ൺ', m: 'ം' };
      if (chillu[t.r]) {
        out.push({ k: 'S', out: chillu[t.r], r: t.r });
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

function assemble(toks: Tok[], s: Scheme): string {
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === 'C') {
      out += t.out;
      const n = toks[i + 1];
      if (n && n.k === 'V') {
        out += n.sign;
        i++;
      } else if (n && n.k === 'C') out += s.virama;
      else if (!n) {
        if (s.finalVirama) out += s.virama;
      } else if (s.finalVirama) out += s.virama;
    } else if (t.k === 'V') out += t.ind;
    else out += t.out;
  }
  return out;
}

const userDicts: Partial<Record<IndicLang, Map<string, string>>> = {};
let storage: { get(k: string): string | null; set(k: string, v: string): void } | null = null;

/** Wire persistent storage for the learning user dictionary. */
export function setDictStorage(st: typeof storage) {
  storage = st;
}

export function userDict(lang: IndicLang): Map<string, string> {
  let d = userDicts[lang];
  if (!d) {
    d = new Map();
    try {
      const raw = storage?.get('katha.dict.' + lang);
      if (raw) for (const [k, v] of Object.entries(JSON.parse(raw))) d.set(k, v as string);
    } catch {
      /* ignore */
    }
    userDicts[lang] = d;
  }
  return d;
}

/** Remember the user's choice for a Roman spelling. */
export function learn(lang: IndicLang, roman: string, native: string) {
  const key = roman.toLowerCase();
  const d = userDict(lang);
  const rule = ruleTransliterate(roman, lang);
  if (native === rule && !LEXICON[lang].has(key)) {
    if (d.delete(key)) persist(lang);
    return;
  }
  d.set(key, native);
  persist(lang);
}

export function forget(lang: IndicLang, roman: string) {
  userDict(lang).delete(roman.toLowerCase());
  persist(lang);
}

function persist(lang: IndicLang) {
  try {
    storage?.set('katha.dict.' + lang, JSON.stringify(Object.fromEntries(userDict(lang))));
  } catch {
    /* ignore */
  }
}

/** Pure rule-based conversion of one word. */
export function ruleTransliterate(word: string, lang: IndicLang): string {
  const c = compile(lang);
  const w = normCase(word, c.scheme);
  return assemble(contextRules(tokenize(w, c), c.scheme), c.scheme);
}

/** Best conversion of one Roman word: user dictionary → lexicon → rules. */
export function transliterateWord(word: string, lang: IndicLang): string {
  if (!word) return '';
  const key = word.toLowerCase();
  const u = userDict(lang).get(key);
  if (u) return u;
  const l = LEXICON[lang].get(key);
  if (l) return l;
  return ruleTransliterate(word, lang);
}

/** Ranked alternatives for one Roman word (first = default choice). */
export function candidates(word: string, lang: IndicLang, max = 8): string[] {
  const out: string[] = [];
  const add = (s: string | undefined) => {
    if (s && !out.includes(s)) out.push(s);
  };
  const key = word.toLowerCase();
  add(userDict(lang).get(key));
  add(LEXICON[lang].get(key));
  const c = compile(lang);
  const toks = contextRules(tokenize(normCase(word, c.scheme), c), c.scheme);
  add(assemble(toks, c.scheme));
  // single-token variations
  const alts = c.scheme.alternatives;
  for (let i = 0; i < toks.length && out.length < max; i++) {
    const t = toks[i];
    if (t.k === 'C' && alts[t.out]) {
      for (const a of alts[t.out]) {
        const copy = toks.map((x) => ({ ...x })) as Tok[];
        (copy[i] as any).out = a;
        add(assemble(copy, c.scheme));
      }
    } else if (t.k === 'V' && i > 0 && toks[i - 1].k === 'C' && alts[t.sign]) {
      for (const a of alts[t.sign]) {
        const copy = toks.map((x) => ({ ...x })) as Tok[];
        (copy[i] as any).sign = a;
        add(assemble(copy, c.scheme));
      }
    }
  }
  // a final short 'a' is often a long one in casual spelling (ela → ఎలా)
  if (toks.length && toks[toks.length - 1].k === 'V' && toks[toks.length - 1].r === 'a' && toks.length > 1) {
    const copy = toks.map((x) => ({ ...x })) as Tok[];
    const last = copy[copy.length - 1] as any;
    const long = c.scheme.vowels.find((v) => v[0] === 'aa');
    if (long) {
      last.sign = long[2];
      last.ind = long[1];
      add(assemble(copy, c.scheme));
    }
  }
  // lexicon completions
  if (key.length >= 2)
    for (const [k, v] of LEXICON[lang]) {
      if (out.length >= max) break;
      if (k.startsWith(key) && k !== key) add(v);
    }
  return out.slice(0, max);
}

/** Convert a whole Roman phrase, keeping punctuation, digits and spacing. */
export function transliterate(text: string, lang: IndicLang): string {
  return text.replace(/[A-Za-z]+/g, (w) => transliterateWord(w, lang));
}
