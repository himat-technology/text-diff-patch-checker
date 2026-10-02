/**
 * Linear-space Myers O(ND) difference algorithm.
 *
 * E. W. Myers, "An O(ND) Difference Algorithm and Its Variations" (1986).
 * The "middle snake" bisection (section 4b) splits the problem recursively so
 * memory stays O(N + M) even for large inputs. Sequences are compared as
 * integer arrays; callers intern their lines/tokens first (see `internSequences`).
 */

export type EditType = 'equal' | 'insert' | 'delete';

export interface Edit {
  type: EditType;
  /** Index into the old sequence (equal/delete), or the old position at which an insert occurs. */
  oldIndex: number;
  /** Index into the new sequence (equal/insert), or the new position at which a delete occurs. */
  newIndex: number;
}

export interface MyersOptions {
  /**
   * Time budget in milliseconds. When exceeded, unresolved regions fall back
   * to delete-all/insert-all, which is still a valid (non-minimal) script.
   */
  timeoutMs?: number;
}

export interface MyersResult {
  edits: Edit[];
  timedOut: boolean;
}

type Seq = ArrayLike<number>;

interface Context {
  a: Seq;
  b: Seq;
  out: Edit[];
  deadline: number;
  timedOut: boolean;
}

export function myersDiff(a: Seq, b: Seq, options: MyersOptions = {}): MyersResult {
  const timeout = options.timeoutMs ?? Number.POSITIVE_INFINITY;
  const ctx: Context = {
    a,
    b,
    out: [],
    deadline: timeout === Number.POSITIVE_INFINITY ? timeout : Date.now() + timeout,
    timedOut: false,
  };
  diffRange(ctx, 0, a.length, 0, b.length);
  return { edits: ctx.out, timedOut: ctx.timedOut };
}

function diffRange(ctx: Context, aLo: number, aHi: number, bLo: number, bHi: number): void {
  const { a, b, out } = ctx;

  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
    out.push({ type: 'equal', oldIndex: aLo, newIndex: bLo });
    aLo++;
    bLo++;
  }

  let suffix = 0;
  while (aHi > aLo && bHi > bLo && a[aHi - 1] === b[bHi - 1]) {
    aHi--;
    bHi--;
    suffix++;
  }

  if (aLo === aHi) {
    for (let j = bLo; j < bHi; j++) out.push({ type: 'insert', oldIndex: aLo, newIndex: j });
  } else if (bLo === bHi) {
    for (let i = aLo; i < aHi; i++) out.push({ type: 'delete', oldIndex: i, newIndex: bLo });
  } else {
    const split = bisect(ctx, aLo, aHi, bLo, bHi);
    if (split) {
      diffRange(ctx, aLo, aLo + split[0], bLo, bLo + split[1]);
      diffRange(ctx, aLo + split[0], aHi, bLo + split[1], bHi);
    } else {
      for (let i = aLo; i < aHi; i++) out.push({ type: 'delete', oldIndex: i, newIndex: bLo });
      for (let j = bLo; j < bHi; j++) out.push({ type: 'insert', oldIndex: aHi, newIndex: j });
    }
  }

  for (let s = 0; s < suffix; s++) {
    out.push({ type: 'equal', oldIndex: aHi + s, newIndex: bHi + s });
  }
}

/**
 * Finds the middle snake of the edit graph for a[aLo..aHi) vs b[bLo..bHi).
 * Returns the split point relative to (aLo, bLo), or null when the regions
 * share nothing or the time budget is exhausted.
 */
function bisect(ctx: Context, aLo: number, aHi: number, bLo: number, bHi: number): [number, number] | null {
  const { a, b } = ctx;
  const n = aHi - aLo;
  const m = bHi - bLo;
  const maxD = Math.ceil((n + m) / 2);
  const vOffset = maxD;
  const vLength = 2 * maxD + 2;
  const v1 = new Int32Array(vLength).fill(-1);
  const v2 = new Int32Array(vLength).fill(-1);
  v1[vOffset + 1] = 0;
  v2[vOffset + 1] = 0;
  const delta = n - m;
  // When delta is odd the forward path detects the overlap, otherwise the reverse path does.
  const front = delta % 2 !== 0;
  let k1start = 0;
  let k1end = 0;
  let k2start = 0;
  let k2end = 0;

  for (let d = 0; d < maxD; d++) {
    if (ctx.deadline !== Number.POSITIVE_INFINITY && Date.now() > ctx.deadline) {
      ctx.timedOut = true;
      return null;
    }

    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const k1Offset = vOffset + k1;
      let x1: number;
      if (k1 === -d || (k1 !== d && v1[k1Offset - 1] < v1[k1Offset + 1])) {
        x1 = v1[k1Offset + 1];
      } else {
        x1 = v1[k1Offset - 1] + 1;
      }
      let y1 = x1 - k1;
      while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
        x1++;
        y1++;
      }
      v1[k1Offset] = x1;
      if (x1 > n) {
        k1end += 2;
      } else if (y1 > m) {
        k1start += 2;
      } else if (front) {
        const k2Offset = vOffset + delta - k1;
        if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset] !== -1) {
          const x2 = n - v2[k2Offset];
          if (x1 >= x2) return [x1, y1];
        }
      }
    }

    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const k2Offset = vOffset + k2;
      let x2: number;
      if (k2 === -d || (k2 !== d && v2[k2Offset - 1] < v2[k2Offset + 1])) {
        x2 = v2[k2Offset + 1];
      } else {
        x2 = v2[k2Offset - 1] + 1;
      }
      let y2 = x2 - k2;
      while (x2 < n && y2 < m && a[aHi - 1 - x2] === b[bHi - 1 - y2]) {
        x2++;
        y2++;
      }
      v2[k2Offset] = x2;
      if (x2 > n) {
        k2end += 2;
      } else if (y2 > m) {
        k2start += 2;
      } else if (!front) {
        const k1Offset = vOffset + delta - k2;
        if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset] !== -1) {
          const x1 = v1[k1Offset];
          const y1 = vOffset + x1 - k1Offset;
          if (x1 >= n - x2) return [x1, y1];
        }
      }
    }
  }
  return null;
}

/** Maps arbitrary string keys to dense integers so Myers compares numbers. */
export function internSequences(a: readonly string[], b: readonly string[]): [Int32Array, Int32Array] {
  const ids = new Map<string, number>();
  const toIds = (seq: readonly string[]): Int32Array => {
    const out = new Int32Array(seq.length);
    for (let i = 0; i < seq.length; i++) {
      let id = ids.get(seq[i]);
      if (id === undefined) {
        id = ids.size;
        ids.set(seq[i], id);
      }
      out[i] = id;
    }
    return out;
  };
  return [toIds(a), toIds(b)];
}

/**
 * Reorders each run of consecutive non-equal edits so deletions precede
 * insertions, which is the conventional presentation for unified diffs.
 */
export function normalizeEditOrder(edits: Edit[]): Edit[] {
  const out: Edit[] = [];
  let i = 0;
  while (i < edits.length) {
    if (edits[i].type === 'equal') {
      out.push(edits[i]);
      i++;
      continue;
    }
    const deletes: Edit[] = [];
    const inserts: Edit[] = [];
    while (i < edits.length && edits[i].type !== 'equal') {
      (edits[i].type === 'delete' ? deletes : inserts).push(edits[i]);
      i++;
    }
    for (const e of deletes) out.push(e);
    for (const e of inserts) out.push(e);
  }
  return out;
}
