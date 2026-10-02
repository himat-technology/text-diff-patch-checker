import type { DiffSegment, InlineDiff } from './diffTypes';
import { internSequences, myersDiff, normalizeEditOrder } from './myersDiff';
import { normalizeForCompare, type CompareOptions } from '../utils/textNormalization';

export interface TokenDiffOptions extends Partial<CompareOptions> {
  /**
   * Absorb short unchanged runs sitting between two changes into the change,
   * producing more readable highlights. Whitespace-only runs are always
   * absorbed; `maxAbsorbLength` controls other short runs (in tokens).
   */
  cleanup?: boolean;
  maxAbsorbLength?: number;
  timeoutMs?: number;
}

interface Region {
  kind: 'equal' | 'change';
  /** Old-side tokens for equal regions (may differ from new side under ignore rules). */
  equalOld: string[];
  equalNew: string[];
  deleted: string[];
  inserted: string[];
}

const isWhitespace = (s: string) => s.trim().length === 0;

function computeRegions(oldTokens: string[], newTokens: string[], options: TokenDiffOptions): Region[] {
  const compare: CompareOptions = {
    ignoreCase: options.ignoreCase ?? false,
    ignoreWhitespace: options.ignoreWhitespace ?? false,
  };
  const key = (t: string) => {
    if (compare.ignoreWhitespace && isWhitespace(t)) return ' ';
    return normalizeForCompare(t, compare);
  };
  const [a, b] = internSequences(oldTokens.map(key), newTokens.map(key));
  const { edits } = myersDiff(a, b, { timeoutMs: options.timeoutMs ?? 1000 });

  let regions: Region[] = [];
  for (const edit of normalizeEditOrder(edits)) {
    let last = regions[regions.length - 1];
    if (edit.type === 'equal') {
      if (!last || last.kind !== 'equal') {
        last = { kind: 'equal', equalOld: [], equalNew: [], deleted: [], inserted: [] };
        regions.push(last);
      }
      last.equalOld.push(oldTokens[edit.oldIndex]);
      last.equalNew.push(newTokens[edit.newIndex]);
    } else {
      if (!last || last.kind !== 'change') {
        last = { kind: 'change', equalOld: [], equalNew: [], deleted: [], inserted: [] };
        regions.push(last);
      }
      if (edit.type === 'delete') last.deleted.push(oldTokens[edit.oldIndex]);
      else last.inserted.push(newTokens[edit.newIndex]);
    }
  }

  if (options.cleanup !== false) regions = absorbShortEquals(regions, options.maxAbsorbLength ?? 0);
  return regions;
}

function absorbShortEquals(regions: Region[], maxAbsorbLength: number): Region[] {
  const out: Region[] = [];
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const prev = out[out.length - 1];
    const next = regions[i + 1];
    if (
      r.kind === 'equal' &&
      prev?.kind === 'change' &&
      next?.kind === 'change' &&
      (r.equalOld.every(isWhitespace) || r.equalOld.length <= maxAbsorbLength)
    ) {
      pushAll(prev.deleted, r.equalOld, next.deleted);
      pushAll(prev.inserted, r.equalNew, next.inserted);
      i++;
      continue;
    }
    out.push({
      kind: r.kind,
      equalOld: [...r.equalOld],
      equalNew: [...r.equalNew],
      deleted: [...r.deleted],
      inserted: [...r.inserted],
    });
  }
  return out;
}

function pushAll(target: string[], ...sources: string[][]): void {
  for (const source of sources) for (const item of source) target.push(item);
}

class SegmentBuilder {
  readonly segments: DiffSegment[] = [];
  push(type: DiffSegment['type'], text: string): void {
    if (!text) return;
    const last = this.segments[this.segments.length - 1];
    if (last && last.type === type) last.text += text;
    else this.segments.push({ type, text });
  }
}

function demoteWhitespaceChanges(segments: DiffSegment[], ignoreWhitespace: boolean): DiffSegment[] {
  if (!ignoreWhitespace) return segments;
  return segments.map((s) => (s.type !== 'equal' && isWhitespace(s.text) ? { type: 'equal', text: s.text } : s));
}

/**
 * Diffs two token sequences and returns a combined segment list in which each
 * changed region lists its deletions before its insertions. Equal runs use
 * the new-side text.
 */
export function diffTokens(oldTokens: string[], newTokens: string[], options: TokenDiffOptions = {}): DiffSegment[] {
  const builder = new SegmentBuilder();
  for (const r of computeRegions(oldTokens, newTokens, options)) {
    if (r.kind === 'equal') {
      builder.push('equal', r.equalNew.join(''));
    } else {
      builder.push('delete', r.deleted.join(''));
      builder.push('insert', r.inserted.join(''));
    }
  }
  return demoteWhitespaceChanges(builder.segments, options.ignoreWhitespace ?? false);
}

/** Diffs two token sequences and returns per-side segments preserving each side's text. */
export function diffTokensInline(oldTokens: string[], newTokens: string[], options: TokenDiffOptions = {}): InlineDiff {
  const oldSide = new SegmentBuilder();
  const newSide = new SegmentBuilder();
  for (const r of computeRegions(oldTokens, newTokens, options)) {
    if (r.kind === 'equal') {
      oldSide.push('equal', r.equalOld.join(''));
      newSide.push('equal', r.equalNew.join(''));
    } else {
      oldSide.push('delete', r.deleted.join(''));
      newSide.push('insert', r.inserted.join(''));
    }
  }
  const ignoreWs = options.ignoreWhitespace ?? false;
  return {
    oldSegments: demoteWhitespaceChanges(oldSide.segments, ignoreWs),
    newSegments: demoteWhitespaceChanges(newSide.segments, ignoreWs),
  };
}

/** Total length (in code points) of the unchanged runs in a segment list. */
export function equalLength(segments: readonly DiffSegment[]): number {
  let total = 0;
  for (const s of segments) if (s.type === 'equal') total += Array.from(s.text).length;
  return total;
}
