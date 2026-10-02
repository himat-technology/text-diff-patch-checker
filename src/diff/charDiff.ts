import type { DiffSegment, InlineDiff } from './diffTypes';
import { diffTokens, diffTokensInline, type TokenDiffOptions } from './tokenDiff';
import { splitGraphemes } from '../utils/textNormalization';

/** Character tokens are grapheme clusters, so emoji and accents stay intact. */
export function tokenizeChars(text: string): string[] {
  return splitGraphemes(text);
}

const CHAR_DEFAULTS: TokenDiffOptions = { maxAbsorbLength: 1 };

export function diffChars(oldText: string, newText: string, options: TokenDiffOptions = {}): DiffSegment[] {
  return diffTokens(tokenizeChars(oldText), tokenizeChars(newText), { ...CHAR_DEFAULTS, ...options });
}

export function diffCharsInline(oldText: string, newText: string, options: TokenDiffOptions = {}): InlineDiff {
  return diffTokensInline(tokenizeChars(oldText), tokenizeChars(newText), { ...CHAR_DEFAULTS, ...options });
}
