import { describe, it, expect } from 'vitest';
import { myers, diffScripts, wordDiff } from '../src/core/diff';
import type { ScriptElement } from '../src/core/types';

const E = (type: any, text: string): ScriptElement => ({ id: Math.random().toString(36), type, text });

describe('diff', () => {
  it('myers finds minimal edits', () => {
    const ops = myers('abcabba'.split(''), 'cbabac'.split(''));
    const dist = ops.filter((o) => o.op !== 'same').length;
    expect(dist).toBe(5);
    expect(ops.filter((o) => o.op !== 'add').map((o) => o.a).join('')).toBe('abcabba');
    expect(ops.filter((o) => o.op !== 'del').map((o) => o.b).join('')).toBe('cbabac');
  });
  it('pairs changed elements and diffs words', () => {
    const a = [E('scene', 'INT. A - DAY'), E('action', 'Ravi runs fast.'), E('action', 'Gone.')];
    const b = [E('scene', 'INT. A - DAY'), E('action', 'Ravi runs very fast.'), E('character', 'MEERA')];
    const rows = diffScripts(a, b);
    expect(rows.map((r) => r.status)).toEqual(['same', 'changed', 'removed', 'added']);
    expect(rows[1].words!.filter((w) => w.kind === 'add').map((w) => w.text.trim()).join('')).toBe('very');
  });
  it('word diff of identical strings is all same', () => {
    expect(wordDiff('a b c', 'a b c').every((w) => w.kind === 'same')).toBe(true);
  });
});
