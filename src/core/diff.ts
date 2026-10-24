// Myers O(ND) diff, used to compare script versions element by element and
// word by word inside changed elements.
import type { ScriptElement } from './types';

export type Op<T> = { op: 'same' | 'del' | 'add'; a?: T; b?: T };

export function myers<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): Op<T>[] {
  const n = a.length;
  const m = b.length;
  // trim common prefix/suffix for speed
  let pre = 0;
  while (pre < n && pre < m && eq(a[pre], b[pre])) pre++;
  let suf = 0;
  while (suf < n - pre && suf < m - pre && eq(a[n - 1 - suf], b[m - 1 - suf])) suf++;
  const A = a.slice(pre, n - suf);
  const B = b.slice(pre, m - suf);
  const N = A.length;
  const M = B.length;
  const max = N + M;
  const v = new Map<number, number>();
  v.set(1, 0);
  const trace: Map<number, number>[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) x = v.get(k + 1) ?? 0;
      else x = (v.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < N && y < M && eq(A[x], B[y])) {
        x++;
        y++;
      }
      v.set(k, x);
      if (x >= N && y >= M) {
        found = true;
        break;
      }
    }
  }
  // backtrack
  const ops: Op<T>[] = [];
  let x = N;
  let y = M;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vv = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && (vv.get(k - 1) ?? -1) < (vv.get(k + 1) ?? -1))) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vv.get(prevK) ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ op: 'same', a: A[x - 1], b: B[y - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ op: 'add', b: B[y - 1] });
      else ops.push({ op: 'del', a: A[x - 1] });
    }
    x = prevX;
    y = prevY;
  }
  ops.reverse();
  const head = a.slice(0, pre).map((e, i) => ({ op: 'same' as const, a: e, b: b[i] }));
  const tail = a.slice(n - suf).map((e, i) => ({ op: 'same' as const, a: e, b: b[m - suf + i] }));
  return [...head, ...ops, ...tail];
}

export interface WordPart {
  text: string;
  kind: 'same' | 'del' | 'add';
}

export function wordDiff(a: string, b: string): WordPart[] {
  const ta = a.match(/\s+|[^\s]+/g) || [];
  const tb = b.match(/\s+|[^\s]+/g) || [];
  return myers(ta, tb).map((o) => ({ text: (o.op === 'add' ? o.b : o.a) as string, kind: o.op }));
}

export interface DiffRow {
  status: 'same' | 'changed' | 'added' | 'removed';
  left?: ScriptElement;
  right?: ScriptElement;
  words?: WordPart[];
}

const key = (e: ScriptElement) => e.type + '\u0000' + e.text;

/** Element-level diff with paired changes (a removed + added of the same type become "changed"). */
export function diffScripts(a: ScriptElement[], b: ScriptElement[]): DiffRow[] {
  const ops = myers(a, b, (x, y) => key(x) === key(y));
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const o = ops[i];
    if (o.op === 'same') {
      rows.push({ status: 'same', left: o.a, right: o.b });
      i++;
      continue;
    }
    // collect a run of dels and adds
    const dels: ScriptElement[] = [];
    const adds: ScriptElement[] = [];
    while (i < ops.length && ops[i].op !== 'same') {
      if (ops[i].op === 'del') dels.push(ops[i].a!);
      else adds.push(ops[i].b!);
      i++;
    }
    const n = Math.max(dels.length, adds.length);
    for (let j = 0; j < n; j++) {
      const l = dels[j];
      const r = adds[j];
      if (l && r && l.type === r.type) rows.push({ status: 'changed', left: l, right: r, words: wordDiff(l.text, r.text) });
      else {
        if (l) rows.push({ status: 'removed', left: l });
        if (r) rows.push({ status: 'added', right: r });
      }
    }
  }
  return rows;
}

export function diffSummary(rows: DiffRow[]) {
  return {
    changed: rows.filter((r) => r.status === 'changed').length,
    added: rows.filter((r) => r.status === 'added').length,
    removed: rows.filter((r) => r.status === 'removed').length,
  };
}
