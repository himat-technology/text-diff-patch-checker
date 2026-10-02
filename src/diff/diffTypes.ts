/** A single line-level edit. Line numbers are 1-based. */
export type DiffOperation =
  | {
      type: 'equal';
      oldLine: number;
      newLine: number;
      /** Content from the modified side. */
      content: string;
      /** Content from the original side (differs only when ignore rules are active). */
      oldContent: string;
      /** The line is the last line of a file without a trailing newline. */
      noEol?: boolean;
    }
  | {
      type: 'insert';
      newLine: number;
      content: string;
      noEol?: boolean;
    }
  | {
      type: 'delete';
      oldLine: number;
      content: string;
      noEol?: boolean;
    };

export type SegmentType = 'equal' | 'insert' | 'delete';

/** A token-level run used for word/character highlighting. */
export interface DiffSegment {
  type: SegmentType;
  text: string;
}

/** Inline diff split per side: old side has equal+delete, new side equal+insert. */
export interface InlineDiff {
  oldSegments: DiffSegment[];
  newSegments: DiffSegment[];
}

export type Granularity = 'line' | 'word' | 'char';

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  stripEmptyLines: boolean;
}

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  stripEmptyLines: false,
};

export interface SideCell {
  lineNumber: number;
  text: string;
  /** Present for modified lines when granularity is word or char. */
  segments?: DiffSegment[];
  noEol?: boolean;
}

/**
 * equal   – unchanged line on both sides
 * modify  – a deleted line paired with a similar inserted line
 * delete  – line only on the left
 * insert  – line only on the right
 * change  – unrelated deleted and inserted lines that share a row
 */
export type SplitRowKind = 'equal' | 'modify' | 'delete' | 'insert' | 'change';

export interface SplitRow {
  kind: SplitRowKind;
  left?: SideCell;
  right?: SideCell;
}

export type UnifiedRowKind = 'context' | 'delete' | 'insert';

export interface UnifiedRow {
  kind: UnifiedRowKind;
  oldLine?: number;
  newLine?: number;
  text: string;
  segments?: DiffSegment[];
  /** True when this row belongs to a modified (paired) line. */
  modified?: boolean;
  noEol?: boolean;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  modifications: number;
  unchanged: number;
  totalOutputLines: number;
  /** 0–100, see `similarity.ts` for the formula. */
  similarity: number;
  originalLineCount: number;
  modifiedLineCount: number;
}

export interface ComparisonResult {
  ops: DiffOperation[];
  splitRows: SplitRow[];
  unifiedRows: UnifiedRow[];
  stats: DiffStats;
  /** Unified patch computed from the exact (rule-free) diff so it always round-trips. */
  patch: string;
  /** No differences under the active ignore rules. */
  identical: boolean;
  /** Byte-for-byte equal after line-ending normalization. */
  exactIdentical: boolean;
  /** The diff hit its time budget and fell back to a coarser (still correct) result. */
  timedOut: boolean;
  elapsedMs: number;
}
