export interface HunkRange {
  /** Inclusive start index into the row/op list. */
  start: number;
  /** Exclusive end index. */
  end: number;
}

/**
 * Groups changed entries with `context` unchanged entries on each side.
 * Changes separated by at most 2 × context unchanged entries share a hunk,
 * mirroring GNU diff. Works on any list (diff ops or rendered rows).
 */
export function groupIntoHunks<T>(items: readonly T[], isChange: (item: T) => boolean, context: number): HunkRange[] {
  const ctx = Math.max(0, Math.floor(context));
  const ranges: HunkRange[] = [];
  let current: HunkRange | null = null;
  let lastChange = -1;

  for (let i = 0; i < items.length; i++) {
    if (!isChange(items[i])) continue;
    if (current && i - lastChange - 1 <= 2 * ctx) {
      lastChange = i;
      continue;
    }
    if (current) {
      current.end = Math.min(items.length, lastChange + 1 + ctx);
      ranges.push(current);
    }
    current = { start: Math.max(0, i - ctx), end: i + 1 };
    lastChange = i;
  }
  if (current) {
    current.end = Math.min(items.length, lastChange + 1 + ctx);
    ranges.push(current);
  }
  return ranges;
}
