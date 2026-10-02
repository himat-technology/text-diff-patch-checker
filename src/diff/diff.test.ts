import { describe, expect, it } from 'vitest';
import { diffLines } from './lineDiff';
import { diffWords, diffWordsInline } from './wordDiff';
import { diffChars, diffCharsInline } from './charDiff';
import { myersDiff, internSequences } from './myersDiff';
import { compareTexts } from './compareTexts';
import type { DiffOperation, DiffSegment } from './diffTypes';

const types = (ops: DiffOperation[]) => ops.map((o) => o.type[0]).join('');
const textOf = (segments: DiffSegment[], type: DiffSegment['type']) =>
  segments.filter((s) => s.type === type).map((s) => s.text);

/** Rebuilds both sides from ops to prove the edit script is complete. */
function reconstruct(ops: DiffOperation[]) {
  const oldSide: string[] = [];
  const newSide: string[] = [];
  for (const op of ops) {
    if (op.type === 'equal') {
      oldSide.push(op.oldContent);
      newSide.push(op.content);
    } else if (op.type === 'delete') oldSide.push(op.content);
    else newSide.push(op.content);
  }
  return { oldSide, newSide };
}

describe('Myers core', () => {
  it('produces a minimal edit script (classic ABCABBA / CBABAC example, D = 5)', () => {
    const [a, b] = internSequences('ABCABBA'.split(''), 'CBABAC'.split(''));
    const { edits } = myersDiff(a, b);
    const changes = edits.filter((e) => e.type !== 'equal').length;
    expect(changes).toBe(5);
    expect(edits.filter((e) => e.type === 'equal')).toHaveLength(4);
  });

  it('falls back to a valid script when the time budget is exhausted', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 3000 }, (_, i) => (i % 2 ? `a${i}` : `b${i}`));
    const [ia, ib] = internSequences(a, b);
    const { edits } = myersDiff(ia, ib, { timeoutMs: 0 });
    expect(edits.filter((e) => e.type !== 'insert')).toHaveLength(3000);
    expect(edits.filter((e) => e.type !== 'delete')).toHaveLength(3000);
  });
});

describe('line diff', () => {
  it('1. identical strings produce only equal ops', () => {
    const { ops } = diffLines('a\nb\nc\n', 'a\nb\nc\n');
    expect(types(ops)).toBe('eee');
  });

  it('2. completely different strings', () => {
    const { ops } = diffLines('one\ntwo\n', 'three\nfour\n');
    expect(types(ops)).toBe('ddii');
  });

  it('3. added lines', () => {
    const { ops } = diffLines('a\nc\n', 'a\nb\nc\nd\n');
    expect(types(ops)).toBe('eiei');
    expect(ops.filter((o) => o.type === 'insert').map((o) => o.content)).toEqual(['b', 'd']);
    expect(ops[1]).toMatchObject({ type: 'insert', newLine: 2 });
  });

  it('4. deleted lines', () => {
    const { ops } = diffLines('a\nb\nc\nd\n', 'a\nd\n');
    expect(types(ops)).toBe('edde');
    expect(ops[1]).toMatchObject({ type: 'delete', oldLine: 2, content: 'b' });
  });

  it('5. modified lines become delete + insert', () => {
    const { ops } = diffLines('a\nhello world\nc\n', 'a\nhello there\nc\n');
    expect(types(ops)).toBe('edie');
  });

  it('6. multiple separate changes keep correct line numbers', () => {
    const oldText = ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n');
    const newText = ['1', 'TWO', '3', '4', '5', '6', 'SEVEN', '8', '9'].join('\n');
    const { ops } = diffLines(oldText, newText);
    const { oldSide, newSide } = reconstruct(ops);
    expect(oldSide.join('\n')).toBe(oldText);
    expect(newSide.join('\n')).toBe(newText);
    const inserted = ops.filter((o) => o.type === 'insert');
    expect(inserted.map((o) => (o.type === 'insert' ? o.newLine : 0))).toEqual([2, 7, 8, 9]);
  });

  it('7. empty original yields only inserts', () => {
    const { ops } = diffLines('', 'x\ny\n');
    expect(types(ops)).toBe('ii');
  });

  it('8. empty modified yields only deletes', () => {
    const { ops } = diffLines('x\ny\n', '');
    expect(types(ops)).toBe('dd');
  });

  it('9. multiline code diff is complete and aligned', () => {
    const oldCode = `function hello() {\n  return "Hello";\n}\n`;
    const newCode = `function hello() {\n  const message = "Hello";\n  return message;\n}\n`;
    const { ops } = diffLines(oldCode, newCode);
    expect(types(ops)).toBe('ediie');
    const { oldSide, newSide } = reconstruct(ops);
    expect(oldSide.join('\n') + '\n').toBe(oldCode);
    expect(newSide.join('\n') + '\n').toBe(newCode);
  });

  it('treats a missing trailing newline as a change of the last line', () => {
    const { ops } = diffLines('a\nb\n', 'a\nb');
    expect(types(ops)).toBe('edi');
    expect(ops[2]).toMatchObject({ type: 'insert', noEol: true });
  });

  it('normalises CRLF and CR line endings', () => {
    const { ops } = diffLines('a\r\nb\r\n', 'a\nb\n');
    expect(types(ops)).toBe('ee');
    expect(types(diffLines('a\rb\r', 'a\nb\n').ops)).toBe('ee');
  });

  it('handles duplicate lines and repeated blocks', () => {
    const oldText = 'x\ny\nx\ny\nx\ny\n';
    const newText = 'x\ny\nx\ny\nz\nx\ny\n';
    const { ops } = diffLines(oldText, newText);
    expect(ops.filter((o) => o.type !== 'equal')).toHaveLength(1);
  });

  it('handles thousands of lines quickly', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i} ${'x'.repeat(i % 40)}`);
    const changed = [...lines];
    changed[10] = 'changed';
    changed.splice(2500, 3);
    changed.push('tail');
    const t0 = Date.now();
    const { ops } = diffLines(lines.join('\n') + '\n', changed.join('\n') + '\n');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(ops.filter((o) => o.type === 'delete')).toHaveLength(4);
    expect(ops.filter((o) => o.type === 'insert')).toHaveLength(2);
  });
});

describe('word and character diff', () => {
  it('10. word-level changes isolate changed words', () => {
    const segs = diffWords('The quick brown fox', 'The slow brown fox');
    expect(textOf(segs, 'delete')).toEqual(['quick']);
    expect(textOf(segs, 'insert')).toEqual(['slow']);
    expect(textOf(segs, 'equal').join('')).toBe('The  brown fox');
  });

  it('word inline keeps each side complete', () => {
    const { oldSegments, newSegments } = diffWordsInline('let total = 0;', 'const total = 0;');
    expect(oldSegments.map((s) => s.text).join('')).toBe('let total = 0;');
    expect(newSegments.map((s) => s.text).join('')).toBe('const total = 0;');
    expect(textOf(newSegments, 'insert')).toEqual(['const']);
  });

  it('11. character-level changes isolate changed characters', () => {
    const segs = diffChars('color', 'colour');
    expect(textOf(segs, 'insert')).toEqual(['u']);
    expect(textOf(segs, 'delete')).toEqual([]);
    const inline = diffCharsInline('timeout: 5000', 'timeout: 10000');
    expect(inline.newSegments.map((s) => s.text).join('')).toBe('timeout: 10000');
    expect(inline.oldSegments.map((s) => s.text).join('')).toBe('timeout: 5000');
  });

  it('never splits emoji sequences or combining marks in word mode', () => {
    const inline = diffWordsInline('wave 👋🏽 now', 'wave 👋🏿 now');
    expect(textOf(inline.newSegments, 'insert')).toEqual(['👋🏿']);
    expect(textOf(inline.oldSegments, 'delete')).toEqual(['👋🏽']);
    const family = diffWordsInline('👨‍👩‍👧 home', '👨‍👩‍👦 home');
    expect(textOf(family.newSegments, 'insert')).toEqual(['👨‍👩‍👦']);
    const accent = diffWordsInline('cafe\u0301 ok', 'cafe ok');
    expect(textOf(accent.oldSegments, 'delete')).toEqual(['cafe\u0301']);
  });

  it('keeps emoji and non-English text intact in character mode', () => {
    const inline = diffCharsInline('Grüße 👋🏽 世界', 'Grüße 👋🏿 世界!');
    const inserted = textOf(inline.newSegments, 'insert').join('');
    expect(inserted).toContain('👋🏿');
    expect(inline.newSegments.map((s) => s.text).join('')).toBe('Grüße 👋🏿 世界!');
  });
});

describe('ignore rules', () => {
  it('12. ignore whitespace', () => {
    const a = 'if (x) {\n  return  1;\n}\n';
    const b = 'if(x){\n\treturn 1;\n}\n';
    expect(types(diffLines(a, b).ops)).not.toBe('eee');
    expect(types(diffLines(a, b, { ignoreWhitespace: true }).ops)).toBe('eee');
  });

  it('13. ignore case', () => {
    expect(types(diffLines('Hello\nWORLD\n', 'hello\nworld\n').ops)).toBe('ddii');
    expect(types(diffLines('Hello\nWORLD\n', 'hello\nworld\n', { ignoreCase: true }).ops)).toBe('ee');
  });

  it('14. strip empty lines', () => {
    const a = 'a\n\nb\n\n\nc\n';
    const b = 'a\nb\n  \nc\n';
    expect(diffLines(a, b).ops.some((o) => o.type !== 'equal')).toBe(true);
    const { ops } = diffLines(a, b, { stripEmptyLines: true });
    expect(types(ops)).toBe('eee');
    expect(ops.map((o) => (o.type === 'equal' ? [o.oldLine, o.newLine] : null))).toEqual([
      [1, 1],
      [3, 2],
      [6, 4],
    ]);
  });

  it('displayed content keeps original characters when rules hide differences', () => {
    const { ops } = diffLines('Hello', 'HELLO', { ignoreCase: true });
    expect(ops[0]).toMatchObject({ type: 'equal', oldContent: 'Hello', content: 'HELLO' });
  });
});

describe('compareTexts', () => {
  it('reports identical inputs', () => {
    const r = compareTexts('same\n', 'same\n');
    expect(r.identical).toBe(true);
    expect(r.patch).toBe('');
    expect(r.stats.similarity).toBe(100);
  });

  it('pairs similar lines as modifications in split rows', () => {
    const r = compareTexts('const a = 1;\nkeep\n', 'const a = 2;\nkeep\n', { granularity: 'word' });
    expect(r.splitRows[0].kind).toBe('modify');
    expect(r.splitRows[0].right?.segments?.some((s) => s.type === 'insert' && s.text === '2')).toBe(true);
    expect(r.unifiedRows.map((u) => u.kind)).toEqual(['delete', 'insert', 'context']);
  });

  it('line granularity omits inline segments', () => {
    const r = compareTexts('const a = 1;\n', 'const a = 2;\n', { granularity: 'line' });
    expect(r.splitRows[0].left?.segments).toBeUndefined();
  });

  it('generates an exact patch even when ignore rules hide differences', () => {
    const r = compareTexts('A\n', 'a\n', { options: { ignoreCase: true } });
    expect(r.identical).toBe(true);
    expect(r.exactIdentical).toBe(false);
    expect(r.patch).toContain('-A');
    expect(r.patch).toContain('+a');
  });
});
