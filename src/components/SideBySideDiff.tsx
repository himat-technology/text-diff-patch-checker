import { memo, useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import type { SideCell, SplitRow } from '../diff/diffTypes';
import { collapseRows, type VisibleEntry } from '../diff/collapse';
import { LineContent, MAX_VIEW_HEIGHT, ROW_HEIGHT, visualWidth } from './diffView/LineContent';
import { virtualWindow } from './diffView/virtualWindow';

interface Props {
  rows: SplitRow[];
  context: number | null;
  originalLabel: string;
  modifiedLabel: string;
}

type Side = 'left' | 'right';

const SR_LABEL: Record<string, string> = {
  delete: 'deleted: ',
  insert: 'added: ',
  modifyLeft: 'modified, before: ',
  modifyRight: 'modified, after: ',
};

function cellStyle(row: SplitRow, side: Side): { bg: string; marker: string; markerClass: string; sr: string } {
  const cell = side === 'left' ? row.left : row.right;
  if (!cell) return { bg: 'bg-slate-100/70', marker: '', markerClass: '', sr: '' };
  switch (row.kind) {
    case 'equal':
      return { bg: '', marker: '', markerClass: '', sr: '' };
    case 'modify':
      return side === 'left'
        ? { bg: 'bg-rose-50', marker: '~', markerClass: 'text-amber-600', sr: SR_LABEL.modifyLeft }
        : { bg: 'bg-emerald-50', marker: '~', markerClass: 'text-amber-600', sr: SR_LABEL.modifyRight };
    default:
      return side === 'left'
        ? { bg: 'bg-rose-50', marker: '−', markerClass: 'text-rose-600', sr: SR_LABEL.delete }
        : { bg: 'bg-emerald-50', marker: '+', markerClass: 'text-emerald-600', sr: SR_LABEL.insert };
  }
}

const gutterClass = (row: SplitRow, cell: SideCell | undefined, side: Side) => {
  if (!cell || row.kind === 'equal') return 'bg-slate-50 text-slate-400';
  return side === 'left' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';
};

/**
 * Split diff viewer. Both panes render the same virtualized row list and
 * mirror each other's vertical scroll, so rows always stay aligned.
 */
export const SideBySideDiff = memo(function SideBySideDiff({ rows, context, originalLabel, modifiedLabel }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(new Set());
  }, [rows, context]);

  const entries = useMemo(
    () => collapseRows(rows, (r) => r.kind !== 'equal', context, expanded),
    [rows, context, expanded],
  );

  const widths = useMemo(() => {
    let left = 0;
    let right = 0;
    for (const r of rows) {
      if (r.left) left = Math.max(left, visualWidth(r.left.text));
      if (r.right) right = Math.max(right, visualWidth(r.right.text));
    }
    const maxLine = rows.reduce((m, r) => Math.max(m, r.left?.lineNumber ?? 0, r.right?.lineNumber ?? 0), 0);
    return { left, right, gutter: Math.max(3, String(maxLine).length + 1) };
  }, [rows]);

  const totalHeight = entries.length * ROW_HEIGHT;
  const viewportHeight = Math.min(MAX_VIEW_HEIGHT, totalHeight + 16);
  const { start, end } = virtualWindow(entries.length, scrollTop, viewportHeight);

  const onScroll = useCallback((side: Side) => (e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const other = side === 'left' ? rightRef.current : leftRef.current;
    if (other && Math.abs(other.scrollTop - top) > 0.5) other.scrollTop = top;
    setScrollTop(top);
  }, []);

  const expand = useCallback((startIndex: number) => {
    setExpanded((prev) => new Set(prev).add(startIndex));
  }, []);

  const renderPane = (side: Side) => {
    const contentWidth = side === 'left' ? widths.left : widths.right;
    const slice: VisibleEntry<SplitRow>[] = entries.slice(start, end);
    return (
      <div
        ref={side === 'left' ? leftRef : rightRef}
        onScroll={onScroll(side)}
        // Both panes always reserve a horizontal scrollbar so their heights match and rows stay aligned.
        className="code-text relative min-w-0 flex-1 overflow-x-scroll overflow-y-auto"
        style={{ height: viewportHeight }}
        role="region"
        aria-label={side === 'left' ? `Original: ${originalLabel}` : `Modified: ${modifiedLabel}`}
        tabIndex={0}
      >
        <div className="relative" style={{ height: totalHeight, minWidth: '100%', width: `calc(${contentWidth + widths.gutter + 4}ch + 32px)` }}>
          {slice.map((entry, k) => {
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
            const { row } = entry;
            const cell = side === 'left' ? row.left : row.right;
            const style = cellStyle(row, side);
            return (
              <div key={entry.index} className={`absolute right-0 left-0 flex whitespace-pre ${style.bg}`} style={{ top, height: ROW_HEIGHT }}>
                <span
                  className={`sticky left-0 z-10 shrink-0 pr-2 text-right select-none ${gutterClass(row, cell, side)}`}
                  style={{ width: `calc(${widths.gutter}ch + 8px)` }}
                  aria-hidden="true"
                >
                  {cell?.lineNumber ?? ''}
                </span>
                <span className={`w-5 shrink-0 text-center font-bold select-none ${style.markerClass}`} aria-hidden="true">
                  {style.marker}
                </span>
                <span className="pr-4 text-slate-800">
                  {style.sr && <span className="sr-only">{style.sr}</span>}
                  {cell ? <LineContent text={cell.text} segments={cell.segments} noEol={cell.noEol} /> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
        <div className="flex min-w-0 gap-2 border-r border-slate-200 px-2 py-1.5">
          <span aria-hidden="true">#</span>
          <span className="truncate">Original Text · {originalLabel}</span>
        </div>
        <div className="flex min-w-0 gap-2 px-2 py-1.5">
          <span aria-hidden="true">#</span>
          <span className="truncate">Modified / New Text · {modifiedLabel}</span>
        </div>
      </div>
      <div className="flex divide-x divide-slate-200">
        {renderPane('left')}
        {renderPane('right')}
      </div>
    </div>
  );
});
