import type { AlignedItem } from './alignment';
import type { DiffStats } from './diffTypes';
import { computeSimilarity } from './similarity';

/**
 * Counts are derived from the aligned diff:
 *   additions      inserted lines not paired with a deleted line
 *   deletions      deleted lines not paired with an inserted line
 *   modifications  deleted/inserted line pairs that are similar enough to be
 *                  the same line edited (see MODIFICATION_THRESHOLD)
 *   unchanged      lines equal under the active ignore rules
 *   totalOutputLines = additions + deletions + modifications + unchanged
 */
export function computeStats(items: readonly AlignedItem[], originalLineCount: number, modifiedLineCount: number): DiffStats {
  let additions = 0;
  let deletions = 0;
  let modifications = 0;
  let unchanged = 0;
  for (const item of items) {
    if (item.kind === 'equal') unchanged++;
    else if (item.kind === 'modify') modifications++;
    else {
      additions += item.inserts.length;
      deletions += item.deletes.length;
    }
  }
  return {
    additions,
    deletions,
    modifications,
    unchanged,
    totalOutputLines: additions + deletions + modifications + unchanged,
    similarity: computeSimilarity(items),
    originalLineCount,
    modifiedLineCount,
  };
}
