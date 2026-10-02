import { groupIntoHunks } from './hunks';

export type VisibleEntry<T> =
  | { type: 'row'; row: T; index: number }
  /** A hidden run of unchanged rows [start, end). `start` identifies it for expansion. */
  | { type: 'collapsed'; start: number; end: number };

/**
 * Hides long unchanged runs, keeping `context` rows around each change.
 * `context === null` shows everything. Gaps whose start index is in
 * `expanded` are shown in full. Inputs with no changes are never collapsed.
 */
export function collapseRows<T>(
  rows: readonly T[],
  isChange: (row: T) => boolean,
  context: number | null,
  expanded: ReadonlySet<number> = new Set(),
): VisibleEntry<T>[] {
  const all = (from: number, to: number, out: VisibleEntry<T>[]) => {
    for (let i = from; i < to; i++) out.push({ type: 'row', row: rows[i], index: i });
  };
  const out: VisibleEntry<T>[] = [];
  if (context === null) {
    all(0, rows.length, out);
    return out;
  }
  const ranges = groupIntoHunks(rows, isChange, context);
  if (ranges.length === 0) {
    all(0, rows.length, out);
    return out;
  }
  let cursor = 0;
  const gap = (start: number, end: number) => {
    if (end <= start) return;
    if (expanded.has(start)) all(start, end, out);
    else out.push({ type: 'collapsed', start, end });
  };
  for (const range of ranges) {
    gap(cursor, range.start);
    all(range.start, range.end, out);
    cursor = range.end;
  }
  gap(cursor, rows.length);
  return out;
}
