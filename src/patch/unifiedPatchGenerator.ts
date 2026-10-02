import type { DiffOperation } from '../diff/diffTypes';
import { diffLines } from '../diff/lineDiff';
import { groupIntoHunks } from '../diff/hunks';

export interface PatchGeneratorOptions {
  oldName?: string;
  newName?: string;
  /** Unchanged lines around each change. Defaults to 3, like `diff -u`. */
  context?: number;
  timeoutMs?: number;
}

export const NO_NEWLINE_MARKER = '\\ No newline at end of file';

/**
 * Quotes a file name C-style (as git does) when it contains characters that
 * would make the header ambiguous. Plain spaces are left as-is.
 */
export function formatPatchFileName(name: string): string {
  if (!/["\\\t\n\r]|^\s|\s$/.test(name)) return name;
  const escaped = name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

/** GNU range notation: count is omitted when 1; an empty range names the line before it. */
function formatRange(linesBefore: number, count: number): string {
  const start = count === 0 ? linesBefore : linesBefore + 1;
  return count === 1 ? `${start}` : `${start},${count}`;
}

/**
 * Formats exact (rule-free) line ops as a unified patch. Returns an empty
 * string when there are no changes.
 */
export function formatUnifiedPatch(ops: readonly DiffOperation[], options: PatchGeneratorOptions = {}): string {
  const context = options.context ?? 3;
  const ranges = groupIntoHunks(ops, (op) => op.type !== 'equal', context);
  if (ranges.length === 0) return '';

  // Number of old/new lines that precede each op.
  const oldBefore = new Int32Array(ops.length + 1);
  const newBefore = new Int32Array(ops.length + 1);
  for (let i = 0; i < ops.length; i++) {
    const t = ops[i].type;
    oldBefore[i + 1] = oldBefore[i] + (t === 'insert' ? 0 : 1);
    newBefore[i + 1] = newBefore[i] + (t === 'delete' ? 0 : 1);
  }

  const out: string[] = [];
  out.push(`--- ${formatPatchFileName(options.oldName ?? 'Original')}`);
  out.push(`+++ ${formatPatchFileName(options.newName ?? 'Modified')}`);

  for (const { start, end } of ranges) {
    const oldCount = oldBefore[end] - oldBefore[start];
    const newCount = newBefore[end] - newBefore[start];
    out.push(`@@ -${formatRange(oldBefore[start], oldCount)} +${formatRange(newBefore[start], newCount)} @@`);
    for (let i = start; i < end; i++) {
      const op = ops[i];
      const prefix = op.type === 'equal' ? ' ' : op.type === 'delete' ? '-' : '+';
      out.push(prefix + op.content);
      if (op.noEol) out.push(NO_NEWLINE_MARKER);
    }
  }
  return out.join('\n') + '\n';
}

/** Diffs two texts exactly and returns a unified patch ('' when identical). */
export function createUnifiedPatch(oldText: string, newText: string, options: PatchGeneratorOptions = {}): string {
  const { ops } = diffLines(oldText, newText, { timeoutMs: options.timeoutMs });
  return formatUnifiedPatch(ops, options);
}
