import type { AlignedItem } from './alignment';
import { equalLength } from './tokenDiff';
import { codePointLength } from '../utils/textNormalization';

/**
 * Similarity score (0–100), a character-weighted Sørensen–Dice ratio:
 *
 *     similarity = 2 · M / (T_original + T_modified) × 100
 *
 * where
 *   T_x = Σ (code points + 1) over every compared line of side x
 *         (the +1 counts the line break so blank lines carry weight)
 *   M   = matched characters:
 *         • unchanged line  → (len_old + 1 + len_new + 1) / 2
 *         • modified pair   → code points in the unchanged word-level runs
 *                             shared by the two lines, +1 for the line break
 *         • unpaired added/deleted lines contribute nothing.
 *
 * Two empty inputs and identical inputs score exactly 100. Unrelated inputs
 * approach 0. The result is rounded to one decimal place, and a non-identical
 * comparison is never rounded up to 100.
 */
export function computeSimilarity(items: readonly AlignedItem[]): number {
  let totalOld = 0;
  let totalNew = 0;
  let matched = 0;
  let anyChange = false;

  for (const item of items) {
    if (item.kind === 'equal') {
      const lo = codePointLength(item.op.oldContent) + 1;
      const ln = codePointLength(item.op.content) + 1;
      totalOld += lo;
      totalNew += ln;
      matched += (lo + ln) / 2;
    } else if (item.kind === 'modify') {
      anyChange = true;
      totalOld += codePointLength(item.pair.del.content) + 1;
      totalNew += codePointLength(item.pair.ins.content) + 1;
      matched += equalLength(item.pair.word.newSegments) + 1;
    } else {
      anyChange = true;
      for (const d of item.deletes) totalOld += codePointLength(d.content) + 1;
      for (const n of item.inserts) totalNew += codePointLength(n.content) + 1;
    }
  }

  if (!anyChange) return 100;
  const total = totalOld + totalNew;
  if (total === 0) return 100;
  const raw = Math.min(1, (2 * matched) / total) * 100;
  const rounded = Math.round(raw * 10) / 10;
  return rounded >= 100 ? 99.9 : rounded;
}
