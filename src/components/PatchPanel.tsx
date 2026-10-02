import { memo, useMemo } from 'react';
import { Check, ClipboardCopy, Download, FileCode2, Wrench } from 'lucide-react';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { downloadText, patchFileName } from '../utils/fileDownload';

interface Props {
  patch: string;
  originalName?: string | null;
  modifiedName?: string | null;
  ignoreRulesActive: boolean;
  onOpenInPatchMode: () => void;
}

const MAX_COLORED_LINES = 4000;

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-slate-500 font-semibold';
  if (line.startsWith('@@')) return 'text-sky-700 bg-sky-50/70';
  if (line.startsWith('+')) return 'text-emerald-800 bg-emerald-50';
  if (line.startsWith('-')) return 'text-rose-800 bg-rose-50';
  if (line.startsWith('\\')) return 'text-slate-400 italic';
  return 'text-slate-700';
}

export const PatchPanel = memo(function PatchPanel({ patch, originalName, modifiedName, ignoreRulesActive, onOpenInPatchMode }: Props) {
  const { status, copy } = useCopyFeedback();
  const lines = useMemo(() => (patch ? patch.replace(/\n$/, '').split('\n') : []), [patch]);
  const colored = lines.length <= MAX_COLORED_LINES;
  const empty = patch.length === 0;

  return (
    <section className="card card-accent flex min-w-0 flex-col" aria-labelledby="patch-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 id="patch-heading" className="text-sm font-semibold text-slate-800">
            Unified Patch
          </h2>
          {!empty && <span className="text-[11px] text-slate-500">{lines.length.toLocaleString('en-US')} lines</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn" onClick={() => void copy(patch)} disabled={empty} aria-label="Copy Unified Patch">
            {status === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
            {status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy Unified Patch'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadText(patchFileName(originalName ?? undefined, modifiedName ?? undefined), patch, 'text/x-diff')}
            disabled={empty}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download .patch
          </button>
          <button type="button" className="btn" onClick={onOpenInPatchMode} disabled={empty} title="Load the original text and this patch into Apply Unified Patch mode">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            Test in Apply Mode
          </button>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? 'Patch copied to clipboard' : status === 'error' ? 'Copy to clipboard failed' : ''}
      </span>

      {ignoreRulesActive && !empty && (
        <p className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600">
          The patch is generated from the exact text so it applies cleanly; ignore rules only affect the visual comparison.
        </p>
      )}

      {empty ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No differences — there is nothing to patch.</p>
      ) : (
        <pre className="code-text max-h-80 overflow-auto px-0 py-2" tabIndex={0} aria-label="Generated unified patch">
          {colored ? (
            lines.map((line, i) => (
              <div key={i} className={`px-4 ${lineClass(line)}`}>
                {line || ' '}
              </div>
            ))
          ) : (
            <code className="block px-4 text-slate-700">{patch}</code>
          )}
        </pre>
      )}
    </section>
  );
});
