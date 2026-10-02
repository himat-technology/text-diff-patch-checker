import { describe, expect, it } from 'vitest';
import { compareTexts } from './compareTexts';
import { codeRevision } from '../presets/codeRevision';

const stats = (a: string, b: string) => compareTexts(a, b).stats;

describe('statistics', () => {
  it('29. counts pure additions', () => {
    const s = stats('a\nb\n', 'a\nb\nc\nd\n');
    expect(s).toMatchObject({ additions: 2, deletions: 0, modifications: 0, unchanged: 2, totalOutputLines: 4 });
  });

  it('30. counts pure deletions', () => {
    const s = stats('a\nb\nc\n', 'a\n');
    expect(s).toMatchObject({ additions: 0, deletions: 2, modifications: 0, unchanged: 1 });
  });

  it('31. counts modifications for similar replaced lines', () => {
    const s = stats('const timeout = 5000;\nconst debug = false;\nend\n', 'const timeout = 10000;\nconst debug = true;\nend\n');
    expect(s).toMatchObject({ additions: 0, deletions: 0, modifications: 2, unchanged: 1, totalOutputLines: 3 });
  });

  it('dissimilar replacements count as deletion + addition, not modification', () => {
    const s = stats('alpha beta gamma\n', '12345 67890\n');
    expect(s).toMatchObject({ additions: 1, deletions: 1, modifications: 0 });
  });

  it('32. counts unchanged lines', () => {
    const s = stats('x\ny\nz\n', 'x\nY\nz\n');
    expect(s.unchanged).toBe(2);
    expect(s.originalLineCount).toBe(3);
    expect(s.modifiedLineCount).toBe(3);
  });

  it('respects ignore rules in counts', () => {
    const s = compareTexts('A\nB\n', 'a\nb\n', { options: { ignoreCase: true } }).stats;
    expect(s).toMatchObject({ unchanged: 2, additions: 0, deletions: 0, modifications: 0, similarity: 100 });
  });

  it('computes stats for the Code Revision preset from the real diff', () => {
    const s = stats(codeRevision.original, codeRevision.modified);
    expect(s.additions + s.modifications + s.unchanged).toBe(s.modifiedLineCount);
    expect(s.deletions + s.modifications + s.unchanged).toBe(s.originalLineCount);
    expect(s.similarity).toBeGreaterThan(0);
    expect(s.similarity).toBeLessThan(60);
  });
});

describe('33. similarity score', () => {
  it('is 100 for identical inputs and for two empty inputs', () => {
    expect(stats('same\ntext\n', 'same\ntext\n').similarity).toBe(100);
    expect(stats('', '').similarity).toBe(100);
  });

  it('is 0 when one side is empty', () => {
    expect(stats('', 'something\n').similarity).toBe(0);
    expect(stats('something\n', '').similarity).toBe(0);
  });

  it('is near 0 for unrelated inputs', () => {
    expect(stats('aaaa\nbbbb\ncccc\n', '1111\n2222\n3333\n').similarity).toBeLessThan(5);
  });

  it('is intermediate for partial changes and never 100 when different', () => {
    const partial = stats('one\ntwo\nthree\nfour\n', 'one\ntwo\nTHREE!\nfour\n').similarity;
    expect(partial).toBeGreaterThan(40);
    expect(partial).toBeLessThan(100);
    const tiny = stats('x'.repeat(5000) + '\n', 'x'.repeat(5000) + 'y\n').similarity;
    expect(tiny).toBeLessThan(100);
  });

  it('is deterministic and order-insensitive', () => {
    const a = 'The quick brown fox\njumps over\n';
    const b = 'The slow brown fox\njumps over the dog\n';
    expect(stats(a, b).similarity).toBe(stats(a, b).similarity);
    expect(stats(a, b).similarity).toBe(stats(b, a).similarity);
  });
});
