import { describe, expect, it } from 'vitest';
import { compareTexts } from './compareTexts';
import { splitLines, isBlankLine } from '../utils/textNormalization';
import { applyPatch } from '../patch/patchApplier';
import { createUnifiedPatch } from '../patch/unifiedPatchGenerator';
import type { DiffOptions, Granularity } from './diffTypes';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VOCAB = ['', '  ', 'foo', 'Foo', 'FOO', 'foo bar', 'foo  bar', '\tfoo', 'baz qux', 'é', '👋🏽 hi', '}', 'return x;', 'return  X;', 'dup', 'dup'];

function randomText(rand: () => number): string {
  const n = Math.floor(rand() * 14);
  const lines = Array.from({ length: n }, () => VOCAB[Math.floor(rand() * VOCAB.length)]);
  const eol = rand() < 0.2 ? '\r\n' : '\n';
  return lines.join(eol) + (n && rand() < 0.75 ? eol : '');
}

const ALL_OPTIONS: DiffOptions[] = [];
for (const ignoreWhitespace of [false, true])
  for (const ignoreCase of [false, true])
    for (const stripEmptyLines of [false, true]) ALL_OPTIONS.push({ ignoreWhitespace, ignoreCase, stripEmptyLines });
const GRANULARITIES: Granularity[] = ['line', 'word', 'char'];

describe('comparison invariants (randomised)', () => {
  it('rows, stats and patches stay consistent for every option combination', () => {
    const rand = mulberry32(7);
    for (let iter = 0; iter < 250; iter++) {
      const a = randomText(rand);
      const b = randomText(rand);
      for (const options of ALL_OPTIONS) {
        const granularity = GRANULARITIES[iter % 3];
        const r = compareTexts(a, b, { options, granularity });
        const ctx = `iter ${iter} ${JSON.stringify(options)}\nA=${JSON.stringify(a)}\nB=${JSON.stringify(b)}`;

        const keep = (text: string) =>
          splitLines(text)
            .lines.map((line, i) => ({ line, n: i + 1 }))
            .filter((l) => !(options.stripEmptyLines && isBlankLine(l.line)));
        const oldLines = keep(a);
        const newLines = keep(b);

        // Split view: left column lists every compared original line exactly once, in order.
        const left = r.splitRows.filter((row) => row.left).map((row) => [row.left!.lineNumber, row.left!.text]);
        const right = r.splitRows.filter((row) => row.right).map((row) => [row.right!.lineNumber, row.right!.text]);
        expect(left, ctx).toEqual(oldLines.map((l) => [l.n, l.line]));
        expect(right, ctx).toEqual(newLines.map((l) => [l.n, l.line]));

        // Unified view covers the same lines.
        expect(r.unifiedRows.filter((u) => u.oldLine !== undefined).map((u) => u.oldLine), ctx).toEqual(oldLines.map((l) => l.n));
        expect(r.unifiedRows.filter((u) => u.newLine !== undefined).map((u) => u.newLine), ctx).toEqual(newLines.map((l) => l.n));

        // Inline segments reassemble the exact line text on each side.
        for (const row of r.splitRows) {
          if (row.left?.segments) expect(row.left.segments.map((s) => s.text).join(''), ctx).toBe(row.left.text);
          if (row.right?.segments) expect(row.right.segments.map((s) => s.text).join(''), ctx).toBe(row.right.text);
        }

        // Stats add up.
        const s = r.stats;
        expect(s.deletions + s.modifications + s.unchanged, ctx).toBe(oldLines.length);
        expect(s.additions + s.modifications + s.unchanged, ctx).toBe(newLines.length);
        expect(s.similarity, ctx).toBeGreaterThanOrEqual(0);
        expect(s.similarity, ctx).toBeLessThanOrEqual(100);
        if (r.identical) expect(s.similarity, ctx).toBe(100);
        else expect(s.similarity, ctx).toBeLessThan(100);

        // The patch always reproduces the modified text (modulo line-ending style of the base).
        if (r.exactIdentical) {
          expect(r.patch, ctx).toBe('');
        } else {
          const applied = applyPatch(a, r.patch);
          expect(applied.ok, ctx + '\n' + r.patch + (applied.error ?? '')).toBe(true);
          const norm = (t: string) => t.replace(/\r\n?/g, '\n');
          expect(norm(applied.text!), ctx).toBe(norm(b));
        }
      }
    }
  });

  it('fuzzy apply equals strict apply when the base matches exactly', () => {
    const rand = mulberry32(99);
    for (let iter = 0; iter < 200; iter++) {
      const a = randomText(rand);
      const b = randomText(rand);
      const patch = createUnifiedPatch(a, b);
      if (!patch) continue;
      const strict = applyPatch(a, patch, { mode: 'strict' });
      const fuzzy = applyPatch(a, patch, { mode: 'fuzzy' });
      expect(fuzzy.text, `iter ${iter}`).toBe(strict.text);
      expect(fuzzy.usedFuzzy, `iter ${iter}`).toBe(false);
    }
  });

  it('fuzzy apply on a shifted base reproduces the change without touching inserted lines', () => {
    const rand = mulberry32(5);
    for (let iter = 0; iter < 150; iter++) {
      const lines = Array.from({ length: 10 + Math.floor(rand() * 20) }, (_, i) => `line ${i}`);
      const a = lines.join('\n') + '\n';
      const modifiedLines = [...lines];
      const at = Math.floor(rand() * lines.length);
      modifiedLines[at] = `CHANGED ${at}`;
      const b = modifiedLines.join('\n') + '\n';
      const prefix = Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, i) => `prefix ${i}`).join('\n') + '\n';
      const r = applyPatch(prefix + a, createUnifiedPatch(a, b), { mode: 'fuzzy' });
      expect(r.ok, `iter ${iter}`).toBe(true);
      expect(r.text, `iter ${iter}`).toBe(prefix + b);
    }
  });

  it('never throws on hostile inputs', () => {
    const hostile = ['\u0000', '\r', '\r\r\n\n', '\uD800', 'a'.repeat(50_000), '@@ -1 +1 @@\n-\uD800\n+x\n', '\\ No newline at end of file\n'];
    for (const x of hostile) {
      for (const y of hostile) {
        expect(() => compareTexts(x, y, { granularity: 'char' })).not.toThrow();
        expect(() => applyPatch(x, y, { mode: 'fuzzy' })).not.toThrow();
      }
    }
  });
});
