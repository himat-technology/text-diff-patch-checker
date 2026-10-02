import { memo } from 'react';
import { AlertTriangle, Check, CheckCircle2, ClipboardCopy, Download, GitCompareArrows, XCircle } from 'lucide-react';
import type { ApplyResult } from '../patch/patchTypes';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { downloadText } from '../utils/fileDownload';
import { TextEditor } from './TextEditor';

interface Props {
  result: ApplyResult;
  stale: boolean;
  downloadName: string;
  onCompare: (resultText: string) => void;
}

export const PatchResult = memo(function PatchResult({ result, stale, downloadName, onCompare }: Props) {
  const { status, copy } = useCopyFeedback();
  const text = result.text ?? '';

  return (
    <section aria-labelledby="patch-result-heading" className="flex flex-col gap-3">
      <div
        role={result.ok ? 'status' : 'alert'}
        className={`card flex items-start gap-3 px-4 py-3 ${result.ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-rose-300 bg-rose-50/60'}`}
      >
        {result.ok ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 id="patch-result-heading" className={`text-sm font-semibold ${result.ok ? 'text-emerald-900' : 'text-rose-900'}`}>
            {result.ok ? 'Patch Applied Successfully' : 'Patch Could Not Be Applied'}
          </h2>
          {result.ok && result.usedFuzzy && (
            <p className="flex items-start gap-1.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Fuzzy matching was used for at least one hunk. Review the result before using it.
            </p>
          )}
          {!result.ok && result.error && <p className="text-sm break-words text-rose-900">{result.error}</p>}
          {stale && <p className="text-xs text-slate-600">Inputs changed since this patch was applied — apply again to refresh.</p>}
          {result.hunks.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {result.hunks.map((h) => (
                <li key={h.index} className={`flex items-start gap-1.5 ${h.status === 'applied' ? 'text-slate-700' : 'text-rose-800'}`}>
                  <span aria-hidden="true" className="font-mono">
                    {h.status === 'applied' ? (h.offset || h.fuzz || h.whitespaceInsensitive ? '≈' : '✓') : '✗'}
                  </span>
                  <span className="break-words">{h.message}</span>
                </li>
              ))}
            </ul>
          )}
          {result.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-900">
              {w}
            </p>
          ))}
        </div>
      </div>

      {result.ok && (
        <TextEditor
          id="patch-result-text"
          label="Patched / Result Text"
          value={text}
          readOnly
          accentClass="bg-emerald-500"
          heightClass="h-72 sm:h-96"
          actions={
            <>
              <button type="button" className="btn" onClick={() => void copy(text)}>
                {status === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                {status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy Result'}
              </button>
              <button type="button" className="btn" onClick={() => downloadText(downloadName, text)}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download Result
              </button>
              <button type="button" className="btn" onClick={() => onCompare(text)} title="Open base vs. result in Diff mode">
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
                Compare
              </button>
            </>
          }
        />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? 'Result copied to clipboard' : ''}
      </span>
    </section>
  );
});
