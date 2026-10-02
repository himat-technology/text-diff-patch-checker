import type { DiffSegment, InlineDiff } from './diffTypes';
import { diffTokens, diffTokensInline, type TokenDiffOptions } from './tokenDiff';
import { splitGraphemes } from '../utils/textNormalization';

const WORD_CHAR = /^[\p{L}\p{M}\p{N}_]/u;
const SPACE_CHAR = /^\s/u;

type Kind = 'word' | 'space' | 'other';

const kindOf = (grapheme: string): Kind => (WORD_CHAR.test(grapheme) ? 'word' : SPACE_CHAR.test(grapheme) ? 'space' : 'other');

/**
 * Word tokens: runs of Unicode letters/digits/underscore, runs of whitespace,
 * or any other single grapheme cluster (punctuation, symbols, emoji). Working
 * on grapheme clusters keeps emoji sequences such as 👋🏽 in one token.
 */
export function tokenizeWords(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let currentKind: Kind | null = null;
  for (const g of splitGraphemes(text)) {
    const kind = kindOf(g);
    if (kind !== 'other' && kind === currentKind) {
      current += g;
      continue;
    }
    if (current) tokens.push(current);
    current = g;
    currentKind = kind;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function diffWords(oldText: string, newText: string, options: TokenDiffOptions = {}): DiffSegment[] {
  return diffTokens(tokenizeWords(oldText), tokenizeWords(newText), options);
}

export function diffWordsInline(oldText: string, newText: string, options: TokenDiffOptions = {}): InlineDiff {
  return diffTokensInline(tokenizeWords(oldText), tokenizeWords(newText), options);
}
