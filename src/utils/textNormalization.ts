export type LineEnding = '\n' | '\r\n' | '\r';

export interface SplitText {
  /** Lines without their terminators. */
  lines: string[];
  /** The first line terminator found in the text (LF when none exists). */
  eol: LineEnding;
  /** True when the final line is followed by a line terminator. */
  hasTrailingNewline: boolean;
}

const LINE_BREAK = /\r\n|\r|\n/;

/** Detects the dominant line ending by first occurrence. Defaults to LF. */
export function detectLineEnding(text: string): LineEnding {
  const match = /\r\n|\r|\n/.exec(text);
  if (!match) return '\n';
  return match[0] as LineEnding;
}

/**
 * Splits text into lines, accepting LF, CRLF and CR terminators.
 * An empty string has zero lines; `"a\n"` has one line with a trailing newline.
 */
export function splitLines(text: string): SplitText {
  if (text.length === 0) {
    return { lines: [], eol: '\n', hasTrailingNewline: false };
  }
  const lines = text.split(LINE_BREAK);
  const hasTrailingNewline = lines[lines.length - 1] === '';
  if (hasTrailingNewline) lines.pop();
  return { lines, eol: detectLineEnding(text), hasTrailingNewline };
}

/** Converts CRLF and CR line endings to LF. */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function joinLines(lines: readonly string[], eol: LineEnding, trailingNewline: boolean): string {
  if (lines.length === 0) return '';
  return lines.join(eol) + (trailingNewline ? eol : '');
}

export interface CompareOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
}

/**
 * Produces the comparison key for a line or token under the active ignore rules.
 * Ignoring whitespace removes all whitespace (like `diff -w`).
 */
export function normalizeForCompare(text: string, options: CompareOptions): string {
  let key = text;
  if (options.ignoreWhitespace) key = key.replace(/\s+/gu, '');
  if (options.ignoreCase) key = key.toLowerCase();
  return key;
}

export function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

let graphemeSegmenter: Intl.Segmenter | null | undefined;

/**
 * Splits a string into user-perceived characters so emoji sequences and
 * combining marks are never cut in half. Falls back to code points.
 */
export function splitGraphemes(text: string): string[] {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
  }
  if (graphemeSegmenter) {
    const out: string[] = [];
    for (const { segment } of graphemeSegmenter.segment(text)) out.push(segment);
    return out;
  }
  return Array.from(text);
}

/** Length in code points (not UTF-16 units), used for similarity weighting. */
export function codePointLength(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}
