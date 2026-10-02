import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Loader2 } from 'lucide-react';
import type { ComparisonResult } from '../diff/diffTypes';
import type { ContextSetting, ViewMode } from './DiffControls';
import { SideBySideDiff } from './SideBySideDiff';
import { UnifiedDiff } from './UnifiedDiff';

interface Props {
  result: ComparisonResult | null;
  bothEmpty: boolean;
  computing: boolean;
  error: string | null;
  viewMode: ViewMode;
  context: ContextSetting;
  originalLabel: string;
  modifiedLabel: string;
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600" aria-label="Legend">
      <li className="flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-emerald-100 font-mono text-[10px] font-bold text-emerald-700">+</span>
        Added
      </li>
      <li className="flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-rose-100 font-mono text-[10px] font-bold text-rose-700">−</span>
        Deleted
      </li>
      <li className="flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-amber-100 font-mono text-[10px] font-bold text-amber-700">~</span>
        Modified
      </li>
    </ul>
  );
}

export function DiffOutput({ result, bothEmpty, computing, error, viewMode, context, originalLabel, modifiedLabel }: Props) {
  const contextLines = context === 'all' ? null : Number(context);

  let body: ReactNode;
  if (bothEmpty) {
    body = (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-slate-500">
        <FileSearch className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="text-sm font-medium">Paste or upload text to compare.</p>
        <p className="text-xs">Or load one of the presets above.</p>
      </div>
    );
  } else if (!result) {
    body = (
      <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Comparing…
      </div>
    );
  } else {
    body = (
      <>
        {result.identical && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">No differences found.</p>
              <p className="text-xs">
                {result.exactIdentical
                  ? 'Original and modified content are identical.'
                  : 'The inputs differ only in ways hidden by the active ignore rules (the patch below still captures the exact change).'}
              </p>
            </div>
          </div>
        )}
        {result.timedOut && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            These inputs are very large and very different, so part of the diff was simplified to stay responsive. The result is still correct but may not be minimal.
          </div>
        )}
        {viewMode === 'split' ? (
          <SideBySideDiff rows={result.splitRows} context={contextLines} originalLabel={originalLabel} modifiedLabel={modifiedLabel} />
        ) : (
          <UnifiedDiff rows={result.unifiedRows} context={contextLines} originalLabel={originalLabel} modifiedLabel={modifiedLabel} />
        )}
      </>
    );
  }

  return (
    <section className="card card-accent min-w-0" aria-labelledby="diff-output-heading" aria-busy={computing}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 id="diff-output-heading" className="text-sm font-semibold text-slate-800">
            Diff Output
          </h2>
          {computing && result && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Comparing…
            </span>
          )}
          {!computing && result && <span className="text-[11px] text-slate-400">computed in {result.elapsedMs} ms</span>}
        </div>
        <Legend />
      </div>
      {error && (
        <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <div className={`p-3 transition-opacity sm:p-4 ${computing && result ? 'opacity-70' : ''}`}>{body}</div>
    </section>
  );
}
