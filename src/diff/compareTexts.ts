import { DEFAULT_DIFF_OPTIONS, type ComparisonResult, type DiffOptions, type Granularity } from './diffTypes';
import { diffLines, hasChanges } from './lineDiff';
import { alignOperations, buildSplitRows, buildUnifiedRows } from './alignment';
import { computeStats } from './stats';
import { formatUnifiedPatch } from '../patch/unifiedPatchGenerator';

export interface CompareConfig {
  options?: Partial<DiffOptions>;
  granularity?: Granularity;
  originalName?: string;
  modifiedName?: string;
  /** Per-diff time budget; exceeding it degrades minimality, never correctness. */
  timeoutMs?: number;
}

const hasIgnoreRules = (o: DiffOptions) => o.ignoreWhitespace || o.ignoreCase || o.stripEmptyLines;

/**
 * Full comparison pipeline: line diff → alignment/pairing → inline token
 * diffs → rows, statistics and similarity. The patch is always generated from
 * an exact diff so it reproduces the modified text byte-for-byte.
 */
export function compareTexts(original: string, modified: string, config: CompareConfig = {}): ComparisonResult {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ...config.options };
  const granularity = config.granularity ?? 'line';
  const timeoutMs = config.timeoutMs ?? 5000;

  const display = diffLines(original, modified, { ...options, timeoutMs });
  const exact = hasIgnoreRules(options) ? diffLines(original, modified, { timeoutMs }) : display;

  const items = alignOperations(display.ops, granularity, options);
  const stats = computeStats(items, display.originalLineCount, display.modifiedLineCount);

  const patch = formatUnifiedPatch(exact.ops, {
    oldName: config.originalName || 'Original',
    newName: config.modifiedName || 'Modified',
  });

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    ops: display.ops,
    splitRows: buildSplitRows(items),
    unifiedRows: buildUnifiedRows(items),
    stats,
    patch,
    identical: !hasChanges(display.ops),
    exactIdentical: !hasChanges(exact.ops),
    timedOut: display.timedOut || exact.timedOut,
    elapsedMs: Math.round(ended - started),
  };
}
