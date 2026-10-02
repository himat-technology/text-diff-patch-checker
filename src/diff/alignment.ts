import type { DiffOperation, DiffOptions, Granularity, InlineDiff, SplitRow, UnifiedRow } from './diffTypes';
import { diffWordsInline } from './wordDiff';
import { diffCharsInline } from './charDiff';
import { normalizeForCompare } from '../utils/textNormalization';

type EqualOp = Extract<DiffOperation, { type: 'equal' }>;
type DeleteOp = Extract<DiffOperation, { type: 'delete' }>;
type InsertOp = Extract<DiffOperation, { type: 'insert' }>;

export interface ModifiedPair {
  del: DeleteOp;
  ins: InsertOp;
  /** Word-level inline diff, always computed (used for similarity). */
  word: InlineDiff;
  /** Inline diff at the requested granularity, absent for line granularity. */
  inline?: InlineDiff;
}

export type AlignedItem =
  | { kind: 'equal'; op: EqualOp }
  | { kind: 'modify'; pair: ModifiedPair }
  | { kind: 'unpaired'; deletes: DeleteOp[]; inserts: InsertOp[] };

/** Minimum bigram similarity for a deleted/inserted pair to count as a modification. */
export const MODIFICATION_THRESHOLD = 0.4;
/** Blocks larger than this (deletes × inserts) use positional pairing instead of DP. */
const MAX_DP_CELLS = 10_000;
const MAX_BIGRAM_CHARS = 2_000;

function bigrams(text: string): Map<string, number> {
  const chars = Array.from(text.trim().slice(0, MAX_BIGRAM_CHARS));
  const map = new Map<string, number>();
  for (let i = 0; i < chars.length - 1; i++) {
    const bg = chars[i] + chars[i + 1];
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

function bigramCount(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

/** Sørensen–Dice coefficient over character bigrams, in [0, 1]. */
export function lineSimilarity(a: string, b: string): number {
  const ta = a.trim();
  const tb = b.trim();
  if (ta === tb) return 1;
  if (ta.length === 0 || tb.length === 0) return 0;
  if (Array.from(ta).length < 2 || Array.from(tb).length < 2) return 0;
  return diceFromMaps(bigrams(ta), bigrams(tb));
}

function diceFromMaps(ma: Map<string, number>, mb: Map<string, number>): number {
  const na = bigramCount(ma);
  const nb = bigramCount(mb);
  if (na + nb === 0) return 0;
  let overlap = 0;
  for (const [bg, count] of ma) {
    const other = mb.get(bg);
    if (other) overlap += Math.min(count, other);
  }
  return (2 * overlap) / (na + nb);
}

/**
 * Order-preserving pairing of deleted and inserted lines that maximises the
 * total similarity of matched pairs (a weighted LCS). Pairs below the
 * threshold are never matched.
 */
export function pairLines(deleted: readonly string[], inserted: readonly string[], options: Pick<DiffOptions, 'ignoreCase' | 'ignoreWhitespace'>): Array<[number, number]> {
  const k = deleted.length;
  const m = inserted.length;
  if (k === 0 || m === 0) return [];

  const norm = (s: string) => normalizeForCompare(s, { ignoreCase: options.ignoreCase, ignoreWhitespace: false });
  const delMaps = deleted.map((s) => bigrams(norm(s)));
  const insMaps = inserted.map((s) => bigrams(norm(s)));
  const sim = (i: number, j: number): number => {
    const a = norm(deleted[i]).trim();
    const b = norm(inserted[j]).trim();
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    return diceFromMaps(delMaps[i], insMaps[j]);
  };

  if (k * m > MAX_DP_CELLS) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < Math.min(k, m); i++) if (sim(i, i) >= MODIFICATION_THRESHOLD) pairs.push([i, i]);
    return pairs;
  }

  const cols = m + 1;
  const score = new Float64Array((k + 1) * cols);
  const simCache = new Float64Array(k * m);
  for (let i = 1; i <= k; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim(i - 1, j - 1);
      simCache[(i - 1) * m + (j - 1)] = s;
      let best = Math.max(score[(i - 1) * cols + j], score[i * cols + j - 1]);
      if (s >= MODIFICATION_THRESHOLD) best = Math.max(best, score[(i - 1) * cols + j - 1] + s);
      score[i * cols + j] = best;
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = k;
  let j = m;
  while (i > 0 && j > 0) {
    const s = simCache[(i - 1) * m + (j - 1)];
    const here = score[i * cols + j];
    if (s >= MODIFICATION_THRESHOLD && Math.abs(here - (score[(i - 1) * cols + j - 1] + s)) < 1e-9) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (score[(i - 1) * cols + j] >= score[i * cols + j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

function inlineFor(a: string, b: string, granularity: Granularity, options: DiffOptions): InlineDiff | undefined {
  const tokenOptions = { ignoreCase: options.ignoreCase, ignoreWhitespace: options.ignoreWhitespace };
  if (granularity === 'word') return diffWordsInline(a, b, tokenOptions);
  if (granularity === 'char') return diffCharsInline(a, b, tokenOptions);
  return undefined;
}

/** Groups ops into equal lines and change blocks, pairing similar lines inside blocks. */
export function alignOperations(ops: readonly DiffOperation[], granularity: Granularity, options: DiffOptions): AlignedItem[] {
  const items: AlignedItem[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      items.push({ kind: 'equal', op });
      i++;
      continue;
    }
    const deletes: DeleteOp[] = [];
    const inserts: InsertOp[] = [];
    while (i < ops.length && ops[i].type !== 'equal') {
      const cur = ops[i];
      if (cur.type === 'delete') deletes.push(cur);
      else if (cur.type === 'insert') inserts.push(cur);
      i++;
    }
    const pairs = pairLines(
      deletes.map((d) => d.content),
      inserts.map((n) => n.content),
      options,
    );
    let di = 0;
    let ii = 0;
    const flush = (dEnd: number, iEnd: number) => {
      if (dEnd > di || iEnd > ii) {
        items.push({ kind: 'unpaired', deletes: deletes.slice(di, dEnd), inserts: inserts.slice(ii, iEnd) });
      }
    };
    for (const [pd, pi] of pairs) {
      flush(pd, pi);
      const del = deletes[pd];
      const ins = inserts[pi];
      const tokenOptions = { ignoreCase: options.ignoreCase, ignoreWhitespace: options.ignoreWhitespace };
      const word = diffWordsInline(del.content, ins.content, tokenOptions);
      const inline = granularity === 'word' ? word : inlineFor(del.content, ins.content, granularity, options);
      items.push({ kind: 'modify', pair: { del, ins, word, inline } });
      di = pd + 1;
      ii = pi + 1;
    }
    flush(deletes.length, inserts.length);
  }
  return items;
}

export function buildSplitRows(items: readonly AlignedItem[]): SplitRow[] {
  const rows: SplitRow[] = [];
  for (const item of items) {
    if (item.kind === 'equal') {
      const { op } = item;
      rows.push({
        kind: 'equal',
        left: { lineNumber: op.oldLine, text: op.oldContent, ...(op.noEol ? { noEol: true } : {}) },
        right: { lineNumber: op.newLine, text: op.content, ...(op.noEol ? { noEol: true } : {}) },
      });
    } else if (item.kind === 'modify') {
      const { del, ins, inline } = item.pair;
      rows.push({
        kind: 'modify',
        left: {
          lineNumber: del.oldLine,
          text: del.content,
          ...(inline ? { segments: inline.oldSegments } : {}),
          ...(del.noEol ? { noEol: true } : {}),
        },
        right: {
          lineNumber: ins.newLine,
          text: ins.content,
          ...(inline ? { segments: inline.newSegments } : {}),
          ...(ins.noEol ? { noEol: true } : {}),
        },
      });
    } else {
      const count = Math.max(item.deletes.length, item.inserts.length);
      for (let r = 0; r < count; r++) {
        const del = item.deletes[r];
        const ins = item.inserts[r];
        rows.push({
          kind: del && ins ? 'change' : del ? 'delete' : 'insert',
          ...(del ? { left: { lineNumber: del.oldLine, text: del.content, ...(del.noEol ? { noEol: true } : {}) } } : {}),
          ...(ins ? { right: { lineNumber: ins.newLine, text: ins.content, ...(ins.noEol ? { noEol: true } : {}) } } : {}),
        });
      }
    }
  }
  return rows;
}

/** Unified rows: within each change block, all deletions precede all insertions. */
export function buildUnifiedRows(items: readonly AlignedItem[]): UnifiedRow[] {
  const rows: UnifiedRow[] = [];
  let pendingDeletes: UnifiedRow[] = [];
  let pendingInserts: UnifiedRow[] = [];
  const flush = () => {
    for (const r of pendingDeletes) rows.push(r);
    for (const r of pendingInserts) rows.push(r);
    pendingDeletes = [];
    pendingInserts = [];
  };
  for (const item of items) {
    if (item.kind === 'equal') {
      flush();
      const { op } = item;
      rows.push({ kind: 'context', oldLine: op.oldLine, newLine: op.newLine, text: op.content, ...(op.noEol ? { noEol: true } : {}) });
    } else if (item.kind === 'modify') {
      const { del, ins, inline } = item.pair;
      pendingDeletes.push({
        kind: 'delete',
        oldLine: del.oldLine,
        text: del.content,
        modified: true,
        ...(inline ? { segments: inline.oldSegments } : {}),
        ...(del.noEol ? { noEol: true } : {}),
      });
      pendingInserts.push({
        kind: 'insert',
        newLine: ins.newLine,
        text: ins.content,
        modified: true,
        ...(inline ? { segments: inline.newSegments } : {}),
        ...(ins.noEol ? { noEol: true } : {}),
      });
    } else {
      for (const d of item.deletes) {
        pendingDeletes.push({ kind: 'delete', oldLine: d.oldLine, text: d.content, ...(d.noEol ? { noEol: true } : {}) });
      }
      for (const n of item.inserts) {
        pendingInserts.push({ kind: 'insert', newLine: n.newLine, text: n.content, ...(n.noEol ? { noEol: true } : {}) });
      }
    }
  }
  flush();
  return rows;
}
