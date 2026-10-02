import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import type { UnifiedRow } from '../diff/diffTypes';
import { collapseRows } from '../diff/collapse';
import { LineContent, MAX_VIEW_HEIGHT, ROW_HEIGHT, visualWidth } from './diffView/LineContent';
import { virtualWindow } from './diffView/virtualWindow';

interface Props {
  rows: UnifiedRow[];
  context: number | null;
  originalLabel: string;
  modifiedLabel: string;
}

type Entry =
  | { type: 'row'; row: UnifiedRow; index: number }
  | { type: 'collapsed'; start: number; end: number }
  | { type: 'hunk'; header: string; key: string };

const ROW_STYLE: Record<UnifiedRow['kind'], { bg: string; marker: string; markerClass: string; sr: string }> = {
  context: { bg: '', marker: ' ', markerClass: '', sr: '' },
  delete: { bg: 'bg-rose-50', marker: '-', markerClass: 'text-rose-600', sr: 'deleted: ' },
  insert: { bg: 'bg-emerald-50', marker: '+', markerClass: 'text-emerald-600', sr: 'added: ' },
};

/** Builds an "@@ -a,b +c,d @@" header for rows [start, end). */
function hunkHeader(rows: UnifiedRow[], start: number, end: number, prevOld: number, prevNew: number): string {
  let oldCount = 0;
  let newCount = 0;
  let oldStart = 0;
  let newStart = 0;
  for (let i = start; i < end; i++) {
    const r = rows[i];
    if (r.oldLine !== undefined) {
      if (oldCount === 0) oldStart = r.oldLine;
      oldCount++;
    }
    if (r.newLine !== undefined) {
      if (newCount === 0) newStart = r.newLine;
      newCount++;
    }
  }
  const range = (s: number, c: number, prev: number) => (c === 0 ? `${prev},0` : c === 1 ? `${s}` : `${s},${c}`);
  return `@@ -${range(oldStart, oldCount, prevOld)} +${range(newStart, newCount, prevNew)} @@`;
}

export const UnifiedDiff = memo(function UnifiedDiff({ rows, context, originalLabel, modifiedLabel }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setExpanded(new Set());
  }, [rows, context]);

  const entries = useMemo<Entry[]>(() => {
    const visible = collapseRows(rows, (r) => r.kind !== 'context', context, expanded);
    if (context === null) return visible;
    const out: Entry[] = [];
    let lastOld = 0;
    let lastNew = 0;
    let i = 0;
    while (i < visible.length) {
      const e = visible[i];
      if (e.type === 'collapsed') {
        out.push(e);
        for (let k = e.start; k < e.end; k++) {
          lastOld = rows[k].oldLine ?? lastOld;
          lastNew = rows[k].newLine ?? lastNew;
        }
        i++;
        continue;
      }
      // A run of consecutive visible rows forms one hunk.
      let j = i;
      while (j < visible.length && visible[j].type === 'row') j++;
      const first = (visible[i] as { index: number }).index;
      const last = (visible[j - 1] as { index: number }).index + 1;
      out.push({ type: 'hunk', header: hunkHeader(rows, first, last, lastOld, lastNew), key: `h-${first}` });
      for (let k = i; k < j; k++) {
        out.push(visible[k]);
        const r = (visible[k] as { row: UnifiedRow }).row;
        lastOld = r.oldLine ?? lastOld;
        lastNew = r.newLine ?? lastNew;
      }
      i = j;
    }
    return out;
  }, [rows, context, expanded]);

  const layout = useMemo(() => {
    let width = 0;
    let maxLine = 0;
    for (const r of rows) {
      width = Math.max(width, visualWidth(r.text));
      maxLine = Math.max(maxLine, r.oldLine ?? 0, r.newLine ?? 0);
    }
    return { width, gutter: Math.max(3, String(maxLine).length + 1) };
  }, [rows]);

  const expand = useCallback((start: number) => setExpanded((prev) => new Set(prev).add(start)), []);

  const totalHeight = entries.length * ROW_HEIGHT;
  const viewportHeight = Math.min(MAX_VIEW_HEIGHT, totalHeight + 16);
  const { start, end } = virtualWindow(entries.length, scrollTop, viewportHeight);
  const gutterWidth = `calc(${layout.gutter}ch + 8px)`;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="code-text border-b border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
        <div className="truncate">
          <span className="text-rose-700">---</span> {originalLabel}
        </div>
        <div className="truncate">
          <span className="text-emerald-700">+++</span> {modifiedLabel}
        </div>
      </div>
      <div
        className="code-text relative overflow-auto"
        style={{ height: viewportHeight }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        role="region"
        aria-label="Unified diff"
        tabIndex={0}
      >
        <div className="relative" style={{ height: totalHeight, minWidth: '100%', width: `calc(${layout.width + layout.gutter * 2 + 4}ch + 40px)` }}>
          {entries.slice(start, end).map((entry, k) => {
            const top = (start + k) * ROW_HEIGHT;
            if (entry.type === 'collapsed') {
              const count = entry.end - entry.start;
              return (
                <button
                  key={`c-${entry.start}`}
                  type="button"
                  onClick={() => expand(entry.start)}
                  className="absolute right-0 left-0 flex items-center gap-2 border-y border-sky-100 bg-sky-50 px-3 font-sans text-[11px] text-sky-800 hover:bg-sky-100"
                  style={{ top, height: ROW_HEIGHT }}
                >
                  <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
                  Show {count} unchanged line{count === 1 ? '' : 's'}
                </button>
              );
            }
            if (entry.type === 'hunk') {
              return (
                <div key={entry.key} className="absolute right-0 left-0 bg-sky-50/70 px-3 whitespace-pre text-sky-800" style={{ top, height: ROW_HEIGHT }}>
                  {entry.header}
                </div>
              );
            }
            const { row } = entry;
            const style = ROW_STYLE[row.kind];
            const gutterTone = row.kind === 'delete' ? 'bg-rose-100 text-rose-700' : row.kind === 'insert' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-400';
            return (
              <div key={entry.index} className={`absolute right-0 left-0 flex whitespace-pre ${style.bg}`} style={{ top, height: ROW_HEIGHT }}>
                <span className={`sticky left-0 z-10 flex shrink-0 select-none ${gutterTone}`} aria-hidden="true">
                  <span className="pr-2 text-right" style={{ width: gutterWidth }}>
                    {row.oldLine ?? ''}
                  </span>
                  <span className="pr-2 text-right" style={{ width: gutterWidth }}>
                    {row.newLine ?? ''}
                  </span>
                </span>
                <span className={`w-5 shrink-0 text-center font-bold select-none ${row.modified ? 'text-amber-600' : style.markerClass}`} aria-hidden="true">
                  {style.marker}
                </span>
                <span className="pr-4 text-slate-800">
                  {style.sr && <span className="sr-only">{row.modified ? `modified, ${style.sr}` : style.sr}</span>}
                  <LineContent text={row.text} segments={row.segments} noEol={row.noEol} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
