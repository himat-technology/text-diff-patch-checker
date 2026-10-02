import type { ApplyOptions, ApplyResult, FilePatch, Hunk, HunkReport, PatchLine } from './patchTypes';
import { parseUnifiedPatch } from './unifiedPatchParser';
import { splitLines } from '../utils/textNormalization';

interface TextLine {
  text: string;
  noEol: boolean;
}

interface Match {
  /** 0-based index in the base of the first non-trimmed hunk line. */
  pos: number;
  trimStart: number;
  trimEnd: number;
  whitespaceInsensitive: boolean;
}

interface Strategy {
  fuzz: number;
  whitespaceInsensitive: boolean;
  allowOffset: boolean;
}

const collapseWs = (s: string) => s.replace(/\s+/gu, ' ').trim();

function linesMatch(base: TextLine, patch: PatchLine, ws: boolean): boolean {
  if (ws) return collapseWs(base.text) === collapseWs(patch.content);
  return base.text === patch.content && base.noEol === patch.noEol;
}

function sequenceMatchesAt(base: TextLine[], seq: PatchLine[], pos: number, ws: boolean): boolean {
  if (pos < 0 || pos + seq.length > base.length) return false;
  for (let k = 0; k < seq.length; k++) if (!linesMatch(base[pos + k], seq[k], ws)) return false;
  return true;
}

function leadingContext(seq: PatchLine[]): number {
  let n = 0;
  while (n < seq.length && seq[n].type === 'context') n++;
  return n;
}

function trailingContext(seq: PatchLine[]): number {
  let n = 0;
  while (n < seq.length && seq[seq.length - 1 - n].type === 'context') n++;
  return n;
}

/** Searches outward from `expected` so the nearest match wins. */
function findNearest(base: TextLine[], seq: PatchLine[], expected: number, minPos: number, ws: boolean): number {
  const maxPos = base.length - seq.length;
  if (maxPos < minPos) return -1;
  const limit = Math.max(expected - minPos, maxPos - expected);
  for (let delta = 0; delta <= limit; delta++) {
    const before = expected - delta;
    if (before >= minPos && before <= maxPos && sequenceMatchesAt(base, seq, before, ws)) return before;
    const after = expected + delta;
    if (delta > 0 && after >= minPos && after <= maxPos && sequenceMatchesAt(base, seq, after, ws)) return after;
  }
  return -1;
}

function strategiesFor(options: ApplyOptions): Strategy[] {
  if (options.mode === 'strict') return [{ fuzz: 0, whitespaceInsensitive: false, allowOffset: false }];
  const maxFuzz = Math.max(0, Math.min(3, options.maxFuzz ?? 2));
  const list: Strategy[] = [];
  for (let fuzz = 0; fuzz <= maxFuzz; fuzz++) {
    list.push({ fuzz, whitespaceInsensitive: false, allowOffset: true });
    list.push({ fuzz, whitespaceInsensitive: true, allowOffset: true });
  }
  return list;
}

function locateHunk(base: TextLine[], oldSeq: PatchLine[], expected: number, minPos: number, options: ApplyOptions): Match | null {
  const lead = leadingContext(oldSeq);
  const trail = oldSeq.length === lead ? 0 : trailingContext(oldSeq);
  for (const s of strategiesFor(options)) {
    const trimStart = Math.min(s.fuzz, lead);
    const trimEnd = Math.min(s.fuzz, trail);
    if (s.fuzz > 0 && trimStart === 0 && trimEnd === 0) continue;
    const seq = oldSeq.slice(trimStart, oldSeq.length - trimEnd);
    const target = expected + trimStart;
    if (s.allowOffset) {
      const pos = findNearest(base, seq, target, minPos, s.whitespaceInsensitive);
      if (pos >= 0) return { pos, trimStart, trimEnd, whitespaceInsensitive: s.whitespaceInsensitive };
    } else if (target >= minPos && sequenceMatchesAt(base, seq, target, s.whitespaceInsensitive)) {
      return { pos: target, trimStart, trimEnd, whitespaceInsensitive: s.whitespaceInsensitive };
    }
  }
  return null;
}

function quote(s: string, max = 80): string {
  const t = s.length > max ? s.slice(0, max) + '…' : s;
  return JSON.stringify(t);
}

function describeFailure(base: TextLine[], hunk: Hunk, index: number, oldSeq: PatchLine[], newSeq: PatchLine[], expected: number): string {
  const near = Math.min(Math.max(expected + 1, 1), Math.max(base.length, 1));
  const prefix = `Hunk #${index} failed: patch context does not match base text near line ${near}.`;

  if (newSeq.length > 0 && findNearest(base, newSeq, expected, 0, false) >= 0 && oldSeq.length > 0) {
    return `Hunk #${index} failed near line ${near}: the change appears to be already applied.`;
  }
  if (expected + oldSeq.length > base.length && oldSeq.length > 0) {
    if (expected >= base.length) {
      return `${prefix} The hunk expects line ${hunk.oldStart}, but the base text has only ${base.length} line(s).`;
    }
  }
  for (let k = 0; k < oldSeq.length; k++) {
    const actual = base[expected + k];
    if (!actual) {
      return `${prefix} Line ${expected + k + 1} is past the end of the base text (expected ${quote(oldSeq[k].content)}).`;
    }
    if (!linesMatch(actual, oldSeq[k], false)) {
      if (actual.text === oldSeq[k].content) {
        return `${prefix} Line ${expected + k + 1} differs only in its trailing newline.`;
      }
      return `${prefix} Line ${expected + k + 1}: expected ${quote(oldSeq[k].content)} but found ${quote(actual.text)}.`;
    }
  }
  return prefix;
}

/** Applies one file's hunks to `baseText`. Never returns partially patched text. */
export function applyFilePatch(baseText: string, file: FilePatch, options: ApplyOptions = { mode: 'strict' }): ApplyResult {
  const split = splitLines(baseText);
  const base: TextLine[] = split.lines.map((text, i) => ({
    text,
    noEol: i === split.lines.length - 1 && !split.hasTrailingNewline,
  }));

  const result: TextLine[] = [];
  const reports: HunkReport[] = [];
  const warnings: string[] = [];
  let cursor = 0;
  let offset = 0;
  let failed = 0;
  let usedFuzzy = false;

  file.hunks.forEach((hunk, h) => {
    const index = h + 1;
    const oldSeq = hunk.lines.filter((l) => l.type !== 'add');
    const newSeq = hunk.lines.filter((l) => l.type !== 'delete');
    // For an empty old range, oldStart names the line *after which* to insert.
    const nominal = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;
    const expected = nominal + offset;

    const match = locateHunk(base, oldSeq, expected, cursor, options);
    if (!match) {
      failed++;
      reports.push({
        index,
        status: 'failed',
        expectedLine: expected + 1,
        offset: 0,
        fuzz: 0,
        whitespaceInsensitive: false,
        message: describeFailure(base, hunk, index, oldSeq, newSeq, expected),
      });
      return;
    }

    const start = match.pos - match.trimStart;
    const hunkOffset = start - nominal;
    const fuzz = Math.max(match.trimStart, match.trimEnd);
    const shifted = start !== expected;
    if (shifted || fuzz > 0 || match.whitespaceInsensitive) usedFuzzy = true;

    // Copy untouched base lines up to the hunk, then walk the hunk body.
    for (let p = cursor; p < start; p++) result.push(base[p]);
    let pos = start;
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        // Fuzz-trimmed context may overlap the previous hunk or run past EOF.
        if (pos >= cursor && pos < base.length) result.push(base[pos]);
        pos++;
      } else if (line.type === 'delete') {
        pos++;
      } else {
        result.push({ text: line.content, noEol: line.noEol });
      }
    }
    cursor = Math.max(cursor, pos);
    offset = hunkOffset;

    const details: string[] = [];
    if (hunkOffset !== 0) details.push(`offset ${hunkOffset > 0 ? '+' : ''}${hunkOffset} line${Math.abs(hunkOffset) === 1 ? '' : 's'}`);
    if (fuzz > 0) details.push(`fuzz ${fuzz}`);
    if (match.whitespaceInsensitive) details.push('whitespace-insensitive match');
    reports.push({
      index,
      status: 'applied',
      expectedLine: nominal + 1,
      appliedLine: Math.max(1, start + 1),
      offset: hunkOffset,
      fuzz,
      whitespaceInsensitive: match.whitespaceInsensitive,
      message: `Hunk #${index} applied at line ${Math.max(1, start + 1)}${details.length ? ` (${details.join(', ')})` : ''}.`,
    });
  });

  if (failed > 0) {
    const first = reports.find((r) => r.status === 'failed')!;
    return {
      ok: false,
      hunks: reports,
      usedFuzzy,
      warnings,
      error:
        failed === 1 && file.hunks.length === 1
          ? first.message
          : `${failed} of ${file.hunks.length} hunks failed. ${first.message}`,
    };
  }

  for (let p = cursor; p < base.length; p++) result.push(base[p]);

  const strayNoEol = result.findIndex((l, i) => l.noEol && i !== result.length - 1);
  if (strayNoEol >= 0) {
    warnings.push(`Line ${strayNoEol + 1} was marked "No newline at end of file" but is not the last line; a newline was kept.`);
  }

  const eol = split.lines.length > 0 ? split.eol : '\n';
  let text = '';
  for (let i = 0; i < result.length; i++) {
    text += result[i].text;
    if (!(i === result.length - 1 && result[i].noEol)) text += eol;
  }

  return { ok: true, text, hunks: reports, usedFuzzy, warnings };
}

/**
 * Parses `patchText` and applies it to `baseText`. When the patch contains
 * several files, `fileIndex` selects which one to apply.
 */
export function applyPatch(baseText: string, patchText: string, options: ApplyOptions = { mode: 'strict' }, fileIndex = 0): ApplyResult {
  const parsed = parseUnifiedPatch(patchText);
  if (!parsed.ok) {
    return { ok: false, hunks: [], usedFuzzy: false, warnings: [], error: parsed.error };
  }
  const file = parsed.patch.files[fileIndex];
  if (!file) {
    return { ok: false, hunks: [], usedFuzzy: false, warnings: parsed.warnings, error: `The patch does not contain file #${fileIndex + 1}.` };
  }
  const result = applyFilePatch(baseText, file, options);
  return { ...result, warnings: [...parsed.warnings, ...result.warnings] };
}
