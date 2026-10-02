export type PatchLineType = 'context' | 'add' | 'delete';

export interface PatchLine {
  type: PatchLineType;
  content: string;
  /** Followed by a "\ No newline at end of file" marker. */
  noEol: boolean;
}

export interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  /** Optional text after the closing "@@" (e.g. a function name). */
  section: string;
  lines: PatchLine[];
  /** 1-based line number of the "@@" header inside the patch text. */
  headerLine: number;
}

export interface FilePatch {
  oldName?: string;
  newName?: string;
  hunks: Hunk[];
  /** 1-based line of the "---" header (or first hunk for header-less patches). */
  headerLine: number;
}

export interface ParsedPatch {
  files: FilePatch[];
}

export type ParseResult =
  | { ok: true; patch: ParsedPatch; warnings: string[] }
  | { ok: false; error: string; line?: number };

export type ApplyMode = 'strict' | 'fuzzy';

export interface ApplyOptions {
  mode: ApplyMode;
  /** Maximum number of leading/trailing context lines that may be ignored in fuzzy mode. */
  maxFuzz?: number;
}

export interface HunkReport {
  /** 1-based hunk number. */
  index: number;
  status: 'applied' | 'failed';
  /** 1-based line in the base text where the hunk was expected. */
  expectedLine: number;
  /** 1-based line in the base text where the hunk matched. */
  appliedLine?: number;
  /** Lines between expected and actual position. */
  offset: number;
  /** Context lines ignored at the hunk edges. */
  fuzz: number;
  whitespaceInsensitive: boolean;
  message: string;
}

export interface ApplyResult {
  ok: boolean;
  /** Present only when every hunk applied. Partial results are never returned. */
  text?: string;
  hunks: HunkReport[];
  /** At least one hunk needed an offset, fuzz, or whitespace-insensitive match. */
  usedFuzzy: boolean;
  error?: string;
  warnings: string[];
}
