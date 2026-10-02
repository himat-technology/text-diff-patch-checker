import { describe, expect, it } from 'vitest';
import { createUnifiedPatch, formatPatchFileName } from './unifiedPatchGenerator';
import { displayFileName, parseUnifiedPatch } from './unifiedPatchParser';
import { applyPatch } from './patchApplier';
import { PRESETS } from '../presets';
import { gitPatch } from '../presets/gitPatch';

const numbered = (n: number, prefix = 'line') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n') + '\n';

describe('patch generation', () => {
  it('15. simple addition patch', () => {
    const patch = createUnifiedPatch('a\nb\n', 'a\nb\nc\n');
    expect(patch).toBe('--- Original\n+++ Modified\n@@ -1,2 +1,3 @@\n a\n b\n+c\n');
  });

  it('16. simple deletion patch', () => {
    const patch = createUnifiedPatch('a\nb\nc\n', 'a\nc\n');
    expect(patch).toBe('--- Original\n+++ Modified\n@@ -1,3 +1,2 @@\n a\n-b\n c\n');
  });

  it('17. replacement patch', () => {
    const patch = createUnifiedPatch('function hello() {\n  return "Hello";\n}\n', 'function hello() {\n  const message = "Hello";\n  return message;\n}\n');
    expect(patch).toBe(
      [
        '--- Original',
        '+++ Modified',
        '@@ -1,3 +1,4 @@',
        ' function hello() {',
        '-  return "Hello";',
        '+  const message = "Hello";',
        '+  return message;',
        ' }',
        '',
      ].join('\n'),
    );
  });

  it('18. multiple hunks for distant changes', () => {
    const oldText = numbered(30);
    const newText = oldText.replace('line 3\n', 'line three\n').replace('line 27\n', 'line twenty-seven\n');
    const patch = createUnifiedPatch(oldText, newText);
    const headers = patch.split('\n').filter((l) => l.startsWith('@@'));
    expect(headers).toEqual(['@@ -1,6 +1,6 @@', '@@ -24,7 +24,7 @@']);
  });

  it('19. patch with custom context and file names', () => {
    const oldText = numbered(20);
    const newText = oldText.replace('line 10\n', 'line ten\n');
    const patch = createUnifiedPatch(oldText, newText, { context: 1, oldName: 'a/my file.txt', newName: 'b/my file.txt' });
    expect(patch).toBe('--- a/my file.txt\n+++ b/my file.txt\n@@ -9,3 +9,3 @@\n line 9\n-line 10\n+line ten\n line 11\n');
  });

  it('marks missing trailing newlines', () => {
    const patch = createUnifiedPatch('a\nb', 'a\nb\n');
    expect(patch).toBe('--- Original\n+++ Modified\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n');
  });

  it('uses empty-range notation for insertions into an empty file', () => {
    expect(createUnifiedPatch('', 'new\n')).toBe('--- Original\n+++ Modified\n@@ -0,0 +1 @@\n+new\n');
  });

  it('returns an empty string for identical input', () => {
    expect(createUnifiedPatch('same\n', 'same\n')).toBe('');
  });

  it('quotes file names containing special characters', () => {
    expect(formatPatchFileName('my file.txt')).toBe('my file.txt');
    expect(formatPatchFileName('we"ird\tname')).toBe('"we\\"ird\\tname"');
  });
});

describe('patch parsing', () => {
  it('20. parses a valid git patch with preamble, headers and hunks', () => {
    const text = [
      'From 1a2b3c Mon Sep 17 00:00:00 2001',
      'Subject: [PATCH] tweak',
      '---',
      'diff --git a/src/app.js b/src/app.js',
      'index 83db48f..bf269f4 100644',
      '--- a/src/app.js\t2024-01-01 10:00:00.000000000 +0000',
      '+++ b/src/app.js\t2024-01-02 10:00:00.000000000 +0000',
      '@@ -1,3 +1,3 @@ function main() {',
      ' a',
      '-b',
      '+B',
      ' c',
      '@@ -10 +10,2 @@',
      ' j',
      '+k',
      '-- ',
      '2.43.0',
    ].join('\r\n');
    const r = parseUnifiedPatch(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const file = r.patch.files[0];
    expect(file.oldName).toBe('a/src/app.js');
    expect(file.newName).toBe('b/src/app.js');
    expect(displayFileName(file)).toBe('src/app.js');
    expect(file.hunks).toHaveLength(2);
    expect(file.hunks[0]).toMatchObject({ oldStart: 1, oldCount: 3, newStart: 1, newCount: 3, section: 'function main() {' });
    expect(file.hunks[1]).toMatchObject({ oldStart: 10, oldCount: 1, newStart: 10, newCount: 2 });
    expect(file.hunks[0].lines.map((l) => l.type)).toEqual(['context', 'delete', 'add', 'context']);
  });

  it('parses quoted file names and blank context lines', () => {
    const text = '--- "a/dir/na\\"me.txt"\n+++ "b/dir/na\\"me.txt"\n@@ -1,3 +1,3 @@\n x\n\n-y\n+z\n';
    const r = parseUnifiedPatch(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.files[0].oldName).toBe('a/dir/na"me.txt');
    expect(r.patch.files[0].hunks[0].lines[1]).toEqual({ type: 'context', content: '', noEol: false });
  });

  it('decodes octal-escaped UTF-8 file names', () => {
    const r = parseUnifiedPatch('--- "a/caf\\303\\251.txt"\n+++ "b/caf\\303\\251.txt"\n@@ -1 +1 @@\n-a\n+b\n');
    expect(r.ok && r.patch.files[0].oldName).toBe('a/café.txt');
  });

  it('21. rejects text that is not a patch', () => {
    const r = parseUnifiedPatch('hello world\nthis is not a patch\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unable to parse unified patch/);
    const empty = parseUnifiedPatch('   ');
    expect(empty.ok).toBe(false);
  });

  it('22. rejects malformed hunks', () => {
    const tooShort = parseUnifiedPatch('--- a\n+++ b\n@@ -1,3 +1,3 @@\n a\n-b\n');
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) expect(tooShort.error).toMatch(/Unexpected end of patch/);

    const badLine = parseUnifiedPatch('--- a\n+++ b\n@@ -1,2 +1,2 @@\n a\n?b\n');
    expect(badLine.ok).toBe(false);
    if (!badLine.ok) expect(badLine.error).toMatch(/Malformed hunk at patch line 5/);

    const tooLong = parseUnifiedPatch('--- a\n+++ b\n@@ -1 +1 @@\n-a\n+b\n+c\n');
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toMatch(/more lines than its header declares/);

    const badHeader = parseUnifiedPatch('--- a\n+++ b\n@@ -x,1 +1 @@\n-a\n+b\n');
    expect(badHeader.ok).toBe(false);
    if (!badHeader.ok) expect(badHeader.error).toMatch(/Invalid hunk header at patch line 3/);
  });

  it('23. rejects invalid line ranges', () => {
    const zero = parseUnifiedPatch('--- a\n+++ b\n@@ -0,2 +1,2 @@\n a\n b\n');
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error).toMatch(/Invalid line range/);

    const overlap = parseUnifiedPatch('--- a\n+++ b\n@@ -5,2 +5,2 @@\n a\n b\n@@ -3,1 +3,1 @@\n-c\n+d\n');
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) expect(overlap.error).toMatch(/overlap or are out of order/);

    const huge = parseUnifiedPatch('--- a\n+++ b\n@@ -99999999999999999999 +1 @@\n-a\n+b\n');
    expect(huge.ok).toBe(false);
  });

  it('accepts header-less patches with a warning', () => {
    const r = parseUnifiedPatch('@@ -1 +1 @@\n-a\n+b\n');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBe(1);
  });
});

describe('patch application', () => {
  it('24. applies a simple patch', () => {
    const patch = '--- Original\n+++ Modified\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n';
    const r = applyPatch('a\nb\nc\n', patch);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('a\nB\nc\n');
    expect(r.usedFuzzy).toBe(false);
  });

  it('25. applies multiple hunks', () => {
    const oldText = numbered(40);
    const newText = oldText.replace('line 2\n', 'line 2\nINSERTED\n').replace('line 20\n', '').replace('line 39\n', 'LINE 39\n');
    const patch = createUnifiedPatch(oldText, newText);
    expect(patch.split('\n').filter((l) => l.startsWith('@@'))).toHaveLength(3);
    const r = applyPatch(oldText, patch);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(newText);
    expect(r.hunks.map((h) => h.status)).toEqual(['applied', 'applied', 'applied']);
  });

  it('26. fails with a helpful message when context does not match', () => {
    const patch = '--- a\n+++ b\n@@ -2,3 +2,3 @@\n two\n-three\n+THREE\n four\n';
    const r = applyPatch('one\ntwo\nthird\nfour\n', patch);
    expect(r.ok).toBe(false);
    expect(r.text).toBeUndefined();
    expect(r.error).toMatch(/Hunk #1 failed: patch context does not match base text near line 2/);
    expect(r.error).toMatch(/Line 3: expected "three" but found "third"/);
  });

  it('detects an already-applied patch', () => {
    const patch = '--- a\n+++ b\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n';
    const r = applyPatch('a\nB\nc\n', patch);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/already applied/);
  });

  it('27. strict mode rejects shifted context that fuzzy mode accepts', () => {
    const oldText = numbered(10);
    const patch = createUnifiedPatch(oldText, oldText.replace('line 6\n', 'line six\n'));
    const shiftedBase = 'header 1\nheader 2\n' + oldText;

    const strict = applyPatch(shiftedBase, patch, { mode: 'strict' });
    expect(strict.ok).toBe(false);
    expect(strict.error).toMatch(/Hunk #1 failed/);

    const fuzzy = applyPatch(shiftedBase, patch, { mode: 'fuzzy' });
    expect(fuzzy.ok).toBe(true);
    expect(fuzzy.usedFuzzy).toBe(true);
    expect(fuzzy.hunks[0]).toMatchObject({ offset: 2, fuzz: 0 });
    expect(fuzzy.hunks[0].message).toMatch(/offset \+2 lines/);
    expect(fuzzy.text).toBe('header 1\nheader 2\n' + oldText.replace('line 6\n', 'line six\n'));
  });

  it('28. fuzzy mode tolerates edited context lines and whitespace, and reports it', () => {
    const base = 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\n';
    const patch = '--- a\n+++ b\n@@ -2,5 +2,5 @@\n BETA-CHANGED\n gamma\n-delta\n+DELTA\n epsilon\n zeta\n';
    expect(applyPatch(base, patch, { mode: 'strict' }).ok).toBe(false);
    const fuzzy = applyPatch(base, patch, { mode: 'fuzzy' });
    expect(fuzzy.ok).toBe(true);
    expect(fuzzy.hunks[0].fuzz).toBe(1);
    // The mismatched context line keeps the base version; unrelated lines are untouched.
    expect(fuzzy.text).toBe('alpha\nbeta\ngamma\nDELTA\nepsilon\nzeta\neta\n');

    const wsBase = 'a\n  b\nc\n';
    const wsPatch = '--- a\n+++ b\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n';
    const ws = applyPatch(wsBase, wsPatch, { mode: 'fuzzy' });
    expect(ws.ok).toBe(true);
    expect(ws.hunks[0].whitespaceInsensitive).toBe(true);
    expect(ws.text).toBe('a\nB\nc\n');
  });

  it('preserves CRLF line endings of the base text', () => {
    const patch = '--- a\n+++ b\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n';
    const r = applyPatch('a\r\nb\r\n', patch);
    expect(r.text).toBe('a\r\nc\r\n');
  });

  it('honours "No newline at end of file" markers', () => {
    const patch = createUnifiedPatch('a\nb\n', 'a\nb');
    const r = applyPatch('a\nb\n', patch);
    expect(r.text).toBe('a\nb');
    const back = applyPatch('a\nb', createUnifiedPatch('a\nb', 'a\nb\nc\n'));
    expect(back.text).toBe('a\nb\nc\n');
  });

  it('creates content in an empty base from a new-file patch', () => {
    const r = applyPatch('', '--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1,2 @@\n+hello\n+world\n');
    expect(r.ok).toBe(true);
    expect(r.text).toBe('hello\nworld\n');
  });

  it('reports hunks beyond the end of the base text', () => {
    const r = applyPatch('a\nb\n', '--- a\n+++ b\n@@ -40,2 +40,2 @@\n x\n-y\n+z\n');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/near line 2/);
    expect(r.error).toMatch(/only 2 line/);
  });

  it('never throws on malformed input', () => {
    for (const bad of ['', '@@', '@@ -1 +1 @@', '--- a\n+++ b\n', '\u0000\u0001', '@@ -1,1 +1,1 @@\n']) {
      expect(() => applyPatch('base\n', bad)).not.toThrow();
      expect(applyPatch('base\n', bad).ok).toBe(false);
    }
  });

  it('round-trips Unicode, emoji, tabs and very long lines', () => {
    const oldText = 'naïve café\n\tindented\n日本語のテキスト\n' + 'x'.repeat(20000) + '\n👋 hello\n';
    const newText = 'naïve café ☕\n    indented\n日本語のテキスト\n' + 'x'.repeat(19999) + 'y\n👋🏽 hello\n';
    const r = applyPatch(oldText, createUnifiedPatch(oldText, newText));
    expect(r.text).toBe(newText);
  });

  it('applies the Git Patch preset patch (with git preamble) to its original', () => {
    const r = applyPatch(gitPatch.original, gitPatch.patch!);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(gitPatch.modified);
    expect(r.hunks.length).toBeGreaterThanOrEqual(2);
  });

  it('every preset round-trips through generate → parse → apply', () => {
    for (const preset of PRESETS) {
      const patch = createUnifiedPatch(preset.original, preset.modified);
      expect(applyPatch(preset.original, patch).text, preset.id).toBe(preset.modified);
    }
  });
});

describe('randomised round-trip', () => {
  // Deterministic PRNG so failures are reproducible.
  function mulberry32(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('patch(original) === modified for 300 random edit scripts', () => {
    const rand = mulberry32(42);
    const vocab = ['', 'a', 'b', 'c', '  indented', 'dup', 'dup', '😀', 'tab\there', 'x y z'];
    const pick = () => vocab[Math.floor(rand() * vocab.length)];
    for (let iter = 0; iter < 300; iter++) {
      const original = Array.from({ length: Math.floor(rand() * 25) }, pick);
      const modified = [...original];
      const edits = Math.floor(rand() * 6);
      for (let e = 0; e < edits; e++) {
        const at = Math.floor(rand() * (modified.length + 1));
        const op = rand();
        if (op < 0.33) modified.splice(at, 0, pick());
        else if (op < 0.66) modified.splice(at, 1);
        else modified[at] = pick() + '!';
      }
      const join = (lines: string[]) => lines.join('\n') + (lines.length && rand() < 0.8 ? '\n' : '');
      const a = join(original);
      const b = join(modified.filter((l) => l !== undefined));
      const patch = createUnifiedPatch(a, b, { context: Math.floor(rand() * 4) });
      const r = applyPatch(a, patch);
      if (a === b) {
        expect(patch).toBe('');
        continue;
      }
      expect(r.ok, `iteration ${iter}\n${patch}`).toBe(true);
      expect(r.text, `iteration ${iter}\n${patch}`).toBe(b);
    }
  });
});
