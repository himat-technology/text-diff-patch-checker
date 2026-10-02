import { DEFAULT_DIFF_OPTIONS, type DiffOperation, type DiffOptions } from './diffTypes';
import { internSequences, myersDiff, normalizeEditOrder } from './myersDiff';
import { isBlankLine, normalizeForCompare, splitLines } from '../utils/textNormalization';

export interface LineDiffResult {
  ops: DiffOperation[];
  originalLineCount: number;
  modifiedLineCount: number;
  timedOut: boolean;
}

export interface LineDiffConfig extends Partial<DiffOptions> {
  timeoutMs?: number;
}

/** Marker appended to the key of a final line that lacks a newline terminator. */
const NO_EOL_KEY = '\u0000\\noeol';

interface IndexedLine {
  index: number;
  text: string;
  noEol: boolean;
}

function prepare(text: string, stripEmpty: boolean): { all: number; lines: IndexedLine[] } {
  const split = splitLines(text);
  const lines: IndexedLine[] = [];
  const last = split.lines.length - 1;
  for (let i = 0; i < split.lines.length; i++) {
    const line = split.lines[i];
    if (stripEmpty && isBlankLine(line)) continue;
    lines.push({ index: i, text: line, noEol: i === last && !split.hasTrailingNewline });
  }
  return { all: split.lines.length, lines };
}

/**
 * Computes a line-level diff. Ignore rules change which lines are considered
 * equal; displayed content always keeps the original characters.
 */
export function diffLines(oldText: string, newText: string, config: LineDiffConfig = {}): LineDiffResult {
  const options: DiffOptions = { ...DEFAULT_DIFF_OPTIONS, ...config };
  const oldPrepared = prepare(oldText, options.stripEmptyLines);
  const newPrepared = prepare(newText, options.stripEmptyLines);

  // A missing final newline is a real difference for patches, but it is whitespace.
  const trackEol = !options.ignoreWhitespace;
  const keyOf = (line: IndexedLine) =>
    normalizeForCompare(line.text, options) + (trackEol && line.noEol ? NO_EOL_KEY : '');

  const [a, b] = internSequences(oldPrepared.lines.map(keyOf), newPrepared.lines.map(keyOf));
  const { edits, timedOut } = myersDiff(a, b, { timeoutMs: config.timeoutMs });

  const ops: DiffOperation[] = [];
  for (const edit of normalizeEditOrder(edits)) {
    if (edit.type === 'equal') {
      const o = oldPrepared.lines[edit.oldIndex];
      const n = newPrepared.lines[edit.newIndex];
      ops.push({
        type: 'equal',
        oldLine: o.index + 1,
        newLine: n.index + 1,
        content: n.text,
        oldContent: o.text,
        ...(o.noEol && n.noEol ? { noEol: true } : {}),
      });
    } else if (edit.type === 'delete') {
      const o = oldPrepared.lines[edit.oldIndex];
      ops.push({ type: 'delete', oldLine: o.index + 1, content: o.text, ...(o.noEol ? { noEol: true } : {}) });
    } else {
      const n = newPrepared.lines[edit.newIndex];
      ops.push({ type: 'insert', newLine: n.index + 1, content: n.text, ...(n.noEol ? { noEol: true } : {}) });
    }
  }

  return {
    ops,
    originalLineCount: oldPrepared.all,
    modifiedLineCount: newPrepared.all,
    timedOut,
  };
}

export function hasChanges(ops: readonly DiffOperation[]): boolean {
  return ops.some((op) => op.type !== 'equal');
}
