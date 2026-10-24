import { describe, it, expect } from 'vitest';
import { transliterate, ruleTransliterate, candidates, romanize, learn, transliterateWord } from '../src/core/translit';

describe('Tamil phonetic typing', () => {
  it('converts common words', () => {
    expect(transliterate('vanakkam', 'ta')).toBe('வணக்கம்');
    expect(transliterate('thambi', 'ta')).toBe('தம்பி');
    expect(transliterate('enna da', 'ta')).toBe('என்ன டா');
  });
  it('rule engine handles consonant clusters and context', () => {
    expect(ruleTransliterate('amma', 'ta')).toBe('அம்ம');
    expect(ruleTransliterate('nandri', 'ta')).toBe('நன்றி');
    expect(ruleTransliterate('ondru', 'ta')).toBe('ஒன்று');
    expect(ruleTransliterate('vandhu', 'ta')).toBe('வந்து');
    expect(ruleTransliterate('vandi', 'ta')).toBe('வண்டி');
    expect(ruleTransliterate('thangam', 'ta')).toBe('தங்கம்');
    expect(ruleTransliterate('manjal', 'ta')).toBe('மஞ்சல்');
    expect(ruleTransliterate('maNjaL', 'ta')).toBe('மஞ்சள்');
    expect(ruleTransliterate('kaadhal', 'ta')).toBe('காதல்');
    expect(ruleTransliterate('pazham', 'ta')).toBe('பழம்');
  });
  it('offers alternatives', () => {
    const c = candidates('kalam', 'ta');
    expect(c[0]).toBe('கலம்');
    expect(c).toContain('களம்');
  });
});

describe('Telugu phonetic typing', () => {
  it('converts the spec example', () => {
    expect(transliterate('ela unnav', 'te')).toBe('ఎలా ఉన్నావ్');
  });
  it('rule engine', () => {
    expect(ruleTransliterate('manchi', 'te')).toBe('మంచి');
    expect(ruleTransliterate('nenu', 'te')).toBe('నెను');
    expect(ruleTransliterate('nEnu', 'te')).toBe('నేను');
    expect(ruleTransliterate('unnaav', 'te')).toBe('ఉన్నావ్');
    expect(ruleTransliterate('ranga', 'te')).toBe('రంగ');
    expect(ruleTransliterate('kRshNa', 'te')).toContain('క');
  });
  it('suggests long final vowel', () => {
    expect(candidates('kada', 'te')).toContain('కడా'.replace('డ', 'ద'));
  });
});

describe('Hindi / Malayalam / Kannada', () => {
  it('hindi', () => {
    expect(ruleTransliterate('namaste', 'hi')).toBe('नमस्ते');
    expect(ruleTransliterate('kam', 'hi')).toBe('कम');
    expect(ruleTransliterate('nahiin', 'hi')).toBe('नहीं');
  });
  it('malayalam chillu', () => {
    expect(ruleTransliterate('avan', 'ml')).toBe('അവൻ');
    expect(ruleTransliterate('ente', 'ml')).toBe('എന്റെ');
  });
  it('kannada', () => {
    expect(ruleTransliterate('kannada', 'kn')).toBe('ಕನ್ನದ');
  });
});

describe('user dictionary learns', () => {
  it('prefers learned choice', () => {
    learn('ta', 'kalam', 'களம்');
    expect(transliterateWord('kalam', 'ta')).toBe('களம்');
  });
});

describe('romanize (native → Roman)', () => {
  it('tamil readable', () => {
    expect(romanize('வணக்கம்')).toBe('vanakkam');
    expect(romanize('நன்றி')).toBe('nandri');
    expect(romanize('தம்பி')).toBe('thambi');
    expect(romanize('அது')).toBe('adhu');
    expect(romanize('மச்சான்')).toBe('machaan');
    expect(romanize('சாப்பாடு')).toBe('saappaadu');
  });
  it('telugu readable', () => {
    expect(romanize('ఎలా ఉన్నావ్')).toBe('elaa unnaav');
    expect(romanize('మంచి')).toBe('manchi');
  });
  it('hindi schwa deletion', () => {
    expect(romanize('कम')).toBe('kam');
    expect(romanize('नमस्ते')).toBe('namaste');
  });
  it('keeps latin text', () => {
    expect(romanize('Hello வணக்கம்!')).toBe('Hello vanakkam!');
  });
});
