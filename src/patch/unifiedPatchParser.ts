import type { FilePatch, Hunk, ParseResult } from './patchTypes';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/** Parses a C-style quoted string as used by git for unusual file names. */
function unquote(raw: string): { value: string; rest: string } | null {
  if (!raw.startsWith('"')) return null;
  let value = '';
  for (let i = 1; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') return { value, rest: raw.slice(i + 1) };
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[++i];
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', a: '\x07', b: '\b', f: '\f', v: '\v' };
      if (next in map) {
        value += map[next];
      } else if (/[0-7]/.test(next)) {
        // Octal escapes encode UTF-8 bytes; collect a run and decode together.
        const bytes: number[] = [];
        let j = i;
        for (;;) {
          const oct = /^[0-7]{1,3}/.exec(raw.slice(j))![0];
          bytes.push(parseInt(oct, 8));
          j += oct.length;
          if (raw[j] === '\\' && /[0-7]/.test(raw[j + 1] ?? '')) {
            j++;
            continue;
          }
          break;
        }
        value += new TextDecoder().decode(new Uint8Array(bytes));
        i = j - 1;
      } else {
        value += next;
      }
    } else {
      value += ch;
    }
  }
  return null;
}

/**
 * Extracts the file name from a "--- " / "+++ " header value. A tab separates
 * an optional timestamp (GNU diff); git quotes names with special characters.
 */
export function parseHeaderFileName(raw: string): string {
  const quoted = unquote(raw);
  if (quoted) return quoted.value;
  const tab = raw.indexOf('\t');
  const name = tab >= 0 ? raw.slice(0, tab) : raw;
  return name.trimEnd();
}

/** Removes git's a/ and b/ prefixes when both names carry them. */
export function displayFileName(file: FilePatch): string | undefined {
  const pick = file.newName && file.newName !== '/dev/null' ? file.newName : file.oldName;
  if (!pick) return undefined;
  const bothPrefixed = /^a\//.test(file.oldName ?? '') && /^b\//.test(file.newName ?? '');
  if (bothPrefixed || /^[ab]\//.test(pick)) return pick.replace(/^[ab]\//, '');
  return pick;
}

function fail(error: string, line?: number): ParseResult {
  return { ok: false, error, line };
}

/**
 * Parses unified diff text (GNU diff -u or git diff output) into files and
 * hunks. Line endings may be LF, CRLF or CR. Preamble lines such as
 * "diff --git", "index …" or commit messages are skipped.
 */
export function parseUnifiedPatch(text: string): ParseResult {
  if (text.trim().length === 0) {
    return fail('The patch is empty. Paste or upload a unified patch.');
  }
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === '') lines.pop();

  const files: FilePatch[] = [];
  const warnings: string[] = [];
  let current: FilePatch | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === '-- ' && files.length > 0) break; // git format-patch signature

    if (line.startsWith('--- ') && i + 1 < lines.length && lines[i + 1].startsWith('+++ ')) {
      current = {
        oldName: parseHeaderFileName(line.slice(4)),
        newName: parseHeaderFileName(lines[i + 1].slice(4)),
        hunks: [],
        headerLine: i + 1,
      };
      files.push(current);
      i += 2;
      continue;
    }

    if (line.startsWith('@@')) {
      const m = HUNK_HEADER.exec(line);
      if (!m) {
        return fail(`Invalid hunk header at patch line ${i + 1}: "${truncate(line)}". Expected a format like "@@ -1,4 +1,5 @@".`, i + 1);
      }
      const oldStart = Number(m[1]);
      const oldCount = m[2] === undefined ? 1 : Number(m[2]);
      const newStart = Number(m[3]);
      const newCount = m[4] === undefined ? 1 : Number(m[4]);
      const nums = [oldStart, oldCount, newStart, newCount];
      if (nums.some((n) => !Number.isSafeInteger(n))) {
        return fail(`Invalid line range at patch line ${i + 1}: numbers are too large.`, i + 1);
      }
      if ((oldStart === 0 && oldCount > 0) || (newStart === 0 && newCount > 0)) {
        return fail(`Invalid line range at patch line ${i + 1}: line numbers start at 1 unless the range is empty.`, i + 1);
      }
      if (!current) {
        current = { hunks: [], headerLine: i + 1 };
        files.push(current);
        warnings.push('The patch has no "---"/"+++" file headers; hunks were parsed without file names.');
      }

      const hunk: Hunk = {
        oldStart,
        oldCount,
        newStart,
        newCount,
        section: m[5].trim(),
        lines: [],
        headerLine: i + 1,
      };

      const prev = current.hunks[current.hunks.length - 1];
      if (prev) {
        const prevEnd = prev.oldCount === 0 ? prev.oldStart : prev.oldStart + prev.oldCount - 1;
        if (oldStart < prevEnd || (oldStart === prevEnd && prev.oldCount > 0 && oldCount > 0)) {
          return fail(`Hunks overlap or are out of order at patch line ${i + 1} (hunk starts at line ${oldStart}, previous hunk ends at line ${prevEnd}).`, i + 1);
        }
      }

      let oldRemaining = oldCount;
      let newRemaining = newCount;
      i++;
      while (oldRemaining > 0 || newRemaining > 0) {
        if (i >= lines.length) {
          return fail(
            `Unexpected end of patch: the hunk at line ${hunk.headerLine} expects ${oldRemaining} more original and ${newRemaining} more modified line(s).`,
            hunk.headerLine,
          );
        }
        const body = lines[i];
        const tag = body[0];
        if (tag === '\\') {
          markNoEol(hunk);
          i++;
          continue;
        }
        if (tag === ' ' || body === '') {
          // Editors often strip the single space from blank context lines.
          if (oldRemaining === 0 || newRemaining === 0) {
            return malformed(hunk, i, oldRemaining, newRemaining);
          }
          hunk.lines.push({ type: 'context', content: body.slice(1), noEol: false });
          oldRemaining--;
          newRemaining--;
        } else if (tag === '-') {
          if (oldRemaining === 0) return malformed(hunk, i, oldRemaining, newRemaining);
          hunk.lines.push({ type: 'delete', content: body.slice(1), noEol: false });
          oldRemaining--;
        } else if (tag === '+') {
          if (newRemaining === 0) return malformed(hunk, i, oldRemaining, newRemaining);
          hunk.lines.push({ type: 'add', content: body.slice(1), noEol: false });
          newRemaining--;
        } else {
          return malformed(hunk, i, oldRemaining, newRemaining);
        }
        i++;
      }
      while (i < lines.length && lines[i].startsWith('\\')) {
        markNoEol(hunk);
        i++;
      }
      if (i < lines.length) {
        const next = lines[i];
        const isNextHeader = next.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ');
        if (!isNextHeader && next !== '-- ' && (next.startsWith('+') || next.startsWith('-') || next.startsWith(' '))) {
          return fail(
            `Malformed hunk at patch line ${i + 1}: the hunk at line ${hunk.headerLine} contains more lines than its header declares (-${oldCount} +${newCount}).`,
            i + 1,
          );
        }
      }
      current.hunks.push(hunk);
      continue;
    }

    i++;
  }

  const withHunks = files.filter((f) => f.hunks.length > 0);
  if (withHunks.length === 0) {
    return fail('Unable to parse unified patch: no hunks were found. A unified patch contains lines like "@@ -1,3 +1,4 @@".');
  }
  if (withHunks.length < files.length) {
    warnings.push(`${files.length - withHunks.length} file section(s) without hunks were skipped (e.g. binary or mode-only changes).`);
  }
  return { ok: true, patch: { files: withHunks }, warnings };
}

function markNoEol(hunk: Hunk): void {
  const last = hunk.lines[hunk.lines.length - 1];
  if (last) last.noEol = true;
}

function malformed(hunk: Hunk, index: number, oldRemaining: number, newRemaining: number): ParseResult {
  return fail(
    `Malformed hunk at patch line ${index + 1}: the hunk at line ${hunk.headerLine} still expects ${oldRemaining} original and ${newRemaining} modified line(s), but found an unexpected line.`,
    index + 1,
  );
}

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
