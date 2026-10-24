// Phonetic (Roman → native) and reverse (native → Roman) tables for Indic scripts.
// Tuned to the casual "Tanglish / Tenglish" spellings used in film dialogue.

export type IndicLang = 'ta' | 'te' | 'hi' | 'ml' | 'kn';

export interface Scheme {
  lang: IndicLang;
  virama: string;
  anusvara?: string;
  visarga?: string;
  /** [roman, independent vowel, vowel sign] — sign '' = inherent 'a' */
  vowels: [string, string, string][];
  /** [roman, consonant (may be a cluster)] */
  consonants: [string, string][];
  /** literal tokens: [roman, output] (no vowel logic) */
  specials?: [string, string][];
  /** uppercase keys that carry a distinct meaning (others are lower-cased) */
  caseKeys: string;
  /** add virama to a word-final bare consonant (false for Hindi schwa deletion) */
  finalVirama: boolean;
  /** n/m before another consonant becomes anusvara */
  nasalToAnusvara: boolean;
  /** alternatives per output consonant/sign, used for the suggestion list */
  alternatives: Record<string, string[]>;
  /** reverse romanisation of consonants (readable, not academic) */
  romanC: Record<string, string>;
  romanV: Record<string, string>; // independent vowels and signs → roman
}

const V = (r: string, i: string, s: string): [string, string, string] => [r, i, s];

export const TAMIL: Scheme = {
  lang: 'ta',
  virama: '்',
  caseKeys: 'NLRTDEOAIUS',
  finalVirama: true,
  nasalToAnusvara: false,
  vowels: [
    V('a', 'அ', ''),
    V('aa', 'ஆ', 'ா'),
    V('A', 'ஆ', 'ா'),
    V('i', 'இ', 'ி'),
    V('ii', 'ஈ', 'ீ'),
    V('ee', 'ஈ', 'ீ'),
    V('I', 'ஈ', 'ீ'),
    V('u', 'உ', 'ு'),
    V('uu', 'ஊ', 'ூ'),
    V('oo', 'ஊ', 'ூ'),
    V('U', 'ஊ', 'ூ'),
    V('e', 'எ', 'ெ'),
    V('E', 'ஏ', 'ே'),
    V('ae', 'ஏ', 'ே'),
    V('ai', 'ஐ', 'ை'),
    V('ei', 'ஐ', 'ை'),
    V('o', 'ஒ', 'ொ'),
    V('O', 'ஓ', 'ோ'),
    V('au', 'ஔ', 'ௌ'),
    V('ow', 'ஔ', 'ௌ'),
  ],
  consonants: [
    ['k', 'க'],
    ['g', 'க'],
    ['kh', 'க'],
    ['gh', 'க'],
    ['c', 'ச'],
    ['ch', 'ச'],
    ['s', 'ச'],
    ['S', 'ஸ'],
    ['sh', 'ஷ'],
    ['j', 'ஜ'],
    ['nj', 'ஞ'],
    ['gn', 'ஞ'],
    ['ng', 'ங'],
    ['t', 'ட'],
    ['T', 'ட'],
    ['d', 'ட'],
    ['D', 'ட'],
    ['th', 'த'],
    ['dh', 'த'],
    ['N', 'ண'],
    ['n', 'ன'],
    ['p', 'ப'],
    ['b', 'ப'],
    ['bh', 'ப'],
    ['ph', 'ப'],
    ['f', 'ஃப'],
    ['m', 'ம'],
    ['y', 'ய'],
    ['r', 'ர'],
    ['R', 'ற'],
    ['rr', 'ற்ற'],
    ['l', 'ல'],
    ['L', 'ள'],
    ['zh', 'ழ'],
    ['z', 'ழ'],
    ['v', 'வ'],
    ['w', 'வ'],
    ['h', 'ஹ'],
    ['x', 'க்ஸ'],
    ['ksh', 'க்ஷ'],
    ['sri', 'ஸ்ரீ'],
    ['shri', 'ஸ்ரீ'],
  ],
  specials: [['q', 'ஃ']],
  alternatives: {
    'ன': ['ந', 'ண'],
    'ந': ['ன', 'ண'],
    'ண': ['ன', 'ந'],
    'ட': ['த', 'ற'],
    'த': ['ட'],
    'ல': ['ள', 'ழ'],
    'ள': ['ல', 'ழ'],
    'ழ': ['ள', 'ல'],
    'ர': ['ற'],
    'ற': ['ர'],
    'ச': ['ஸ', 'ஷ'],
    'ஸ': ['ச'],
    'ெ': ['ே'],
    'ே': ['ெ'],
    'ொ': ['ோ'],
    'ோ': ['ொ'],
    'ி': ['ீ'],
    'ு': ['ூ'],
    '': ['ா'],
  },
  romanC: {
    'க': 'k',
    'ங': 'ng',
    'ச': 's',
    'ஜ': 'j',
    'ஞ': 'nj',
    'ட': 't',
    'ண': 'n',
    'த': 'th',
    'ந': 'n',
    'ன': 'n',
    'ப': 'p',
    'ம': 'm',
    'ய': 'y',
    'ர': 'r',
    'ற': 'r',
    'ல': 'l',
    'ள': 'l',
    'ழ': 'zh',
    'வ': 'v',
    'ஶ': 'sh',
    'ஷ': 'sh',
    'ஸ': 's',
    'ஹ': 'h',
  },
  romanV: {
    'அ': 'a',
    'ஆ': 'aa',
    'இ': 'i',
    'ஈ': 'ee',
    'உ': 'u',
    'ஊ': 'oo',
    'எ': 'e',
    'ஏ': 'ae',
    'ஐ': 'ai',
    'ஒ': 'o',
    'ஓ': 'o',
    'ஔ': 'au',
    'ா': 'aa',
    'ி': 'i',
    'ீ': 'ee',
    'ு': 'u',
    'ூ': 'oo',
    'ெ': 'e',
    'ே': 'ae',
    'ை': 'ai',
    'ொ': 'o',
    'ோ': 'o',
    'ௌ': 'au',
    'ஃ': 'h',
  },
};

function brahmic(
  lang: IndicLang,
  table: {
    vowels: string; // 13 independent: a aa i ii u uu R e E ai o O au
    signs: string; // 12 signs for aa..au (same order minus a)
    virama: string;
    anusvara: string;
    visarga: string;
    cons: Record<string, string>; // roman → consonant
  },
  opts: Partial<Scheme>,
): Scheme {
  const iv = Array.from(table.vowels);
  const sg = ['', ...Array.from(table.signs)];
  const romans: [string[], number][] = [
    [['a'], 0],
    [['aa', 'A'], 1],
    [['i'], 2],
    [['ii', 'ee', 'I'], 3],
    [['u'], 4],
    [['uu', 'oo', 'U'], 5],
    [['Ru', 'RU'], 6],
    [['e'], 7],
    [['E', 'ae', 'ay'], 8],
    [['ai', 'ei'], 9],
    [['o'], 10],
    [['O', 'oa'], 11],
    [['au', 'ou', 'ow'], 12],
  ];
  const vowels: [string, string, string][] = [];
  for (const [rs, idx] of romans) for (const r of rs) if (iv[idx]) vowels.push([r, iv[idx], sg[idx]]);
  const consonants = Object.entries(table.cons) as [string, string][];
  return {
    lang,
    virama: table.virama,
    anusvara: table.anusvara,
    visarga: table.visarga,
    vowels,
    consonants,
    specials: [
      ['M', table.anusvara],
      ['H', table.visarga],
    ],
    caseKeys: 'AIUEOTDNLRSMH',
    finalVirama: true,
    nasalToAnusvara: true,
    alternatives: {},
    romanC: {},
    romanV: {},
    ...opts,
  };
}

export const TELUGU: Scheme = brahmic(
  'te',
  {
    vowels: 'అఆఇఈఉఊఋఎఏఐఒఓఔ',
    signs: 'ాిీుూృెేైొోౌ',
    virama: '్',
    anusvara: 'ం',
    visarga: 'ః',
    cons: {
      k: 'క',
      kh: 'ఖ',
      g: 'గ',
      gh: 'ఘ',
      c: 'చ',
      ch: 'చ',
      chh: 'ఛ',
      j: 'జ',
      jh: 'ఝ',
      z: 'జ',
      T: 'ట',
      Th: 'ఠ',
      D: 'డ',
      Dh: 'ఢ',
      N: 'ణ',
      t: 'త',
      th: 'థ',
      d: 'ద',
      dh: 'ధ',
      n: 'న',
      p: 'ప',
      ph: 'ఫ',
      f: 'ఫ',
      b: 'బ',
      bh: 'భ',
      m: 'మ',
      y: 'య',
      r: 'ర',
      l: 'ల',
      L: 'ళ',
      v: 'వ',
      w: 'వ',
      sh: 'శ',
      Sh: 'ష',
      S: 'ష',
      s: 'స',
      h: 'హ',
      x: 'క్ష',
      ksh: 'క్ష',
      R: 'ఱ',
      sri: 'శ్రీ',
      shri: 'శ్రీ',
    },
  },
  {
    alternatives: {
      'త': ['ట', 'థ'],
      'ట': ['త', 'ఠ'],
      'ద': ['డ', 'ధ'],
      'డ': ['ద', 'ఢ'],
      'న': ['ణ'],
      'ణ': ['న'],
      'ల': ['ళ'],
      'ళ': ['ల'],
      'స': ['శ', 'ష'],
      'శ': ['స', 'ష'],
      'క': ['ఖ'],
      'గ': ['ఘ'],
      'ప': ['ఫ'],
      'బ': ['భ'],
      'చ': ['ఛ'],
      'జ': ['ఝ'],
      'ె': ['ే'],
      'ే': ['ె'],
      'ొ': ['ో'],
      'ో': ['ొ'],
      'ి': ['ీ'],
      'ు': ['ూ'],
      '': ['ా'],
    },
  },
);

export const HINDI: Scheme = brahmic(
  'hi',
  {
    // Hindi has no short e/o; e → ए, o → ओ
    vowels: 'अआइईउऊऋएएऐओओऔ',
    signs: 'ािीुूृेेैोोौ',
    virama: '्',
    anusvara: 'ं',
    visarga: 'ः',
    cons: {
      k: 'क',
      kh: 'ख',
      g: 'ग',
      gh: 'घ',
      c: 'च',
      ch: 'च',
      chh: 'छ',
      j: 'ज',
      jh: 'झ',
      z: 'ज़',
      T: 'ट',
      Th: 'ठ',
      D: 'ड',
      Dh: 'ढ',
      N: 'ण',
      t: 'त',
      th: 'थ',
      d: 'द',
      dh: 'ध',
      n: 'न',
      p: 'प',
      ph: 'फ',
      f: 'फ़',
      b: 'ब',
      bh: 'भ',
      m: 'म',
      y: 'य',
      r: 'र',
      l: 'ल',
      v: 'व',
      w: 'व',
      sh: 'श',
      Sh: 'ष',
      s: 'स',
      h: 'ह',
      q: 'क़',
      x: 'क्ष',
      ksh: 'क्ष',
      gy: 'ज्ञ',
      shri: 'श्री',
      sri: 'श्री',
    },
  },
  {
    finalVirama: false,
    alternatives: { 'त': ['ट'], 'ट': ['त'], 'द': ['ड'], 'ड': ['द'], 'न': ['ण'], 'स': ['श', 'ष'], 'ि': ['ी'], 'ु': ['ू'], '': ['ा'] },
  },
);

export const MALAYALAM: Scheme = brahmic(
  'ml',
  {
    vowels: 'അആഇഈഉഊഋഎഏഐഒഓഔ',
    signs: 'ാിീുൂൃെേൈൊോൌ',
    virama: '്',
    anusvara: 'ം',
    visarga: 'ഃ',
    cons: {
      k: 'ക',
      kh: 'ഖ',
      g: 'ഗ',
      gh: 'ഘ',
      ng: 'ങ്ങ',
      c: 'ച',
      ch: 'ച',
      chh: 'ഛ',
      j: 'ജ',
      jh: 'ഝ',
      nj: 'ഞ',
      t: 'ട',
      T: 'ട',
      Th: 'ഠ',
      d: 'ഡ',
      D: 'ഡ',
      Dh: 'ഢ',
      N: 'ണ',
      th: 'ത',
      dh: 'ദ',
      n: 'ന',
      nt: 'ന്റ',
      p: 'പ',
      ph: 'ഫ',
      f: 'ഫ',
      b: 'ബ',
      bh: 'ഭ',
      m: 'മ',
      y: 'യ',
      r: 'ര',
      R: 'റ',
      rr: 'റ്റ',
      l: 'ല',
      L: 'ള',
      zh: 'ഴ',
      v: 'വ',
      w: 'വ',
      sh: 'ശ',
      Sh: 'ഷ',
      s: 'സ',
      h: 'ഹ',
      x: 'ക്ഷ',
      ksh: 'ക്ഷ',
    },
  },
  {
    nasalToAnusvara: false,
    alternatives: { 'ട': ['ത'], 'ത': ['ട'], 'ന': ['ണ'], 'ല': ['ള', 'ഴ'], 'ര': ['റ'], 'ി': ['ീ'], 'ു': ['ൂ'], 'െ': ['േ'], 'ൊ': ['ോ'], '': ['ാ'] },
  },
);

export const KANNADA: Scheme = brahmic(
  'kn',
  {
    vowels: 'ಅಆಇಈಉಊಋಎಏಐಒಓಔ',
    signs: 'ಾಿೀುೂೃೆೇೈೊೋೌ',
    virama: '್',
    anusvara: 'ಂ',
    visarga: 'ಃ',
    cons: {
      k: 'ಕ',
      kh: 'ಖ',
      g: 'ಗ',
      gh: 'ಘ',
      c: 'ಚ',
      ch: 'ಚ',
      chh: 'ಛ',
      j: 'ಜ',
      jh: 'ಝ',
      z: 'ಜ',
      T: 'ಟ',
      Th: 'ಠ',
      D: 'ಡ',
      Dh: 'ಢ',
      N: 'ಣ',
      t: 'ತ',
      th: 'ಥ',
      d: 'ದ',
      dh: 'ಧ',
      n: 'ನ',
      p: 'ಪ',
      ph: 'ಫ',
      f: 'ಫ',
      b: 'ಬ',
      bh: 'ಭ',
      m: 'ಮ',
      y: 'ಯ',
      r: 'ರ',
      l: 'ಲ',
      L: 'ಳ',
      v: 'ವ',
      w: 'ವ',
      sh: 'ಶ',
      Sh: 'ಷ',
      s: 'ಸ',
      h: 'ಹ',
      x: 'ಕ್ಷ',
      ksh: 'ಕ್ಷ',
    },
  },
  {
    alternatives: { 'ತ': ['ಟ'], 'ಟ': ['ತ'], 'ದ': ['ಡ'], 'ಡ': ['ದ'], 'ನ': ['ಣ'], 'ಲ': ['ಳ'], 'ಸ': ['ಶ', 'ಷ'], 'ಿ': ['ೀ'], 'ು': ['ೂ'], 'ೆ': ['ೇ'], 'ೊ': ['ೋ'], '': ['ಾ'] },
  },
);

export const SCHEMES: Record<IndicLang, Scheme> = { ta: TAMIL, te: TELUGU, hi: HINDI, ml: MALAYALAM, kn: KANNADA };

/** Build readable reverse maps for the Brahmic schemes from their forward tables. */
function fillReverse(s: Scheme) {
  if (Object.keys(s.romanC).length) return;
  const prefer: Record<string, number> = {};
  for (const [r, c] of s.consonants) {
    if (Array.from(c).length > 1 && !(c in s.romanC)) {
      // clusters like క్ష — romanised through their parts
      continue;
    }
    // prefer lower-case and shortest spelling
    const score = (r === r.toLowerCase() ? 0 : 10) + r.length + (r === 'c' || r === 'w' || r === 'z' || r === 'f' || r === 'q' ? 20 : 0);
    if (!(c in prefer) || score < prefer[c]) {
      prefer[c] = score;
      s.romanC[c] = r.toLowerCase();
    }
  }
  const vprefer: Record<string, number> = {};
  for (const [r, iv, sg] of s.vowels) {
    const score = (r === r.toLowerCase() ? 0 : 10) + (r === 'ii' || r === 'uu' || r === 'ei' || r === 'ou' || r === 'ow' || r === 'oa' || r === 'ay' ? 5 : 0);
    for (const ch of [iv, sg]) {
      if (!ch) continue;
      if (!(ch in vprefer) || score < vprefer[ch]) {
        vprefer[ch] = score;
        s.romanV[ch] = r.toLowerCase() === 'e' && r === 'E' ? 'ae' : r.toLowerCase();
      }
    }
  }
  if (s.anusvara) s.romanV[s.anusvara] = 'm';
  if (s.visarga) s.romanV[s.visarga] = 'h';
}
for (const s of Object.values(SCHEMES)) fillReverse(s);
// readability tweaks: long ē/ō shown as "ae"/"o"
TELUGU.romanV['ే'] = 'ae';
TELUGU.romanV['ఏ'] = 'ae';
KANNADA.romanV['ೇ'] = 'ae';
KANNADA.romanV['ಏ'] = 'ae';
MALAYALAM.romanV['േ'] = 'ae';
MALAYALAM.romanV['ഏ'] = 'ae';
HINDI.romanV['े'] = 'e';
HINDI.romanV['ए'] = 'e';
HINDI.romanV['ो'] = 'o';
HINDI.romanV['ओ'] = 'o';
for (const s of [TELUGU, KANNADA, MALAYALAM]) {
  // retroflex consonants read the same as dentals for actors
  for (const [c, r] of Object.entries(s.romanC)) s.romanC[c] = r.toLowerCase();
}
MALAYALAM.romanC['ത'] = 'th';
MALAYALAM.romanC['ട'] = 't';
MALAYALAM.romanC['ദ'] = 'dh';
MALAYALAM.romanC['ഡ'] = 'd';
MALAYALAM.romanC['റ'] = 'r';
Object.assign(MALAYALAM.romanC, { 'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k' });
TELUGU.romanC['ఱ'] = 'r';
for (const s of [TELUGU, KANNADA, MALAYALAM]) {
  // long ō reads as plain "o" for actors
  for (const [, iv, sg] of s.vowels) if (s.romanV[iv] === 'oa') s.romanV[iv] = 'o';
  for (const [, , sg] of s.vowels) if (sg && s.romanV[sg] === 'oa') s.romanV[sg] = 'o';
}
