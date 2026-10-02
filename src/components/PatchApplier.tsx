import { useCallback, useDeferredValue, useMemo, useState, type KeyboardEvent } from 'react';
import { AlertCircle, CheckCircle2, Play } from 'lucide-react';
import type { ApplyMode, ApplyResult } from '../patch/patchTypes';
import { applyPatch } from '../patch/patchApplier';
import { displayFileName, parseUnifiedPatch } from '../patch/unifiedPatchParser';
import { resultFileName } from '../utils/fileDownload';
import { SegmentedControl } from './SegmentedControl';
import { TextEditor, type LoadedFile } from './TextEditor';
import { PatchResult } from './PatchResult';

interface Props {
  baseText: string;
  onBaseTextChange: (text: string) => void;
  baseName: string | null;
  onBaseFile: (file: LoadedFile | null) => void;
  patchText: string;
  onPatchTextChange: (text: string) => void;
  patchName: string | null;
  onPatchFile: (file: LoadedFile | null) => void;
  applyMode: ApplyMode;
  onApplyModeChange: (mode: ApplyMode) => void;
  onCompareResult: (base: string, result: string, baseName: string | null) => void;
}

const APPLY_OPTIONS = [
  { value: 'strict', label: 'Strict Apply', title: 'Every hunk must match exactly at its stated line' },
  { value: 'fuzzy', label: 'Fuzzy Apply', title: 'Allow line offsets, whitespace differences and up to 2 lines of context fuzz' },
] as const;

interface Applied {
  result: ApplyResult;
  base: string;
  patch: string;
  mode: ApplyMode;
  fileIndex: number;
}

export function PatchApplier(props: Props) {
  const { baseText, patchText, applyMode } = props;
  const [applied, setApplied] = useState<Applied | null>(null);
  const [fileIndex, setFileIndex] = useState(0);

  const deferredPatch = useDeferredValue(patchText);
  const parsed = useMemo(() => (deferredPatch.trim() ? parseUnifiedPatch(deferredPatch) : null), [deferredPatch]);
  const files = parsed?.ok ? parsed.patch.files : [];
  const safeFileIndex = fileIndex < files.length ? fileIndex : 0;

  const apply = useCallback(() => {
    const result = applyPatch(baseText, patchText, { mode: applyMode }, safeFileIndex);
    setApplied({ result, base: baseText, patch: patchText, mode: applyMode, fileIndex: safeFileIndex });
  }, [baseText, patchText, applyMode, safeFileIndex]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && patchText.trim()) {
      e.preventDefault();
      apply();
    }
  };

  const stale =
    applied !== null &&
    (applied.base !== baseText || applied.patch !== patchText || applied.mode !== applyMode || applied.fileIndex !== safeFileIndex);

  const hunkCount = files.reduce((n, f) => n + f.hunks.length, 0);
  const targetName = files[safeFileIndex] ? displayFileName(files[safeFileIndex]) : undefined;

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <TextEditor
          id="patch-base"
          label="Base / Original Text"
          value={baseText}
          onChange={props.onBaseTextChange}
          fileName={props.baseName}
          onFileLoaded={props.onBaseFile}
          onClear={() => props.onBaseFile(null)}
          uploadLabel="Upload Base"
          accentClass="bg-sky-500"
          placeholder="Paste the original text the patch was created against, or drop a file here…"
        />
        <TextEditor
          id="patch-text"
          label="Unified Patch"
          value={patchText}
          onChange={props.onPatchTextChange}
          fileName={props.patchName}
          onFileLoaded={props.onPatchFile}
          onClear={() => props.onPatchFile(null)}
          uploadLabel="Upload Patch"
          accentClass="bg-fuchsia-500"
          placeholder={'--- Original\n+++ Modified\n@@ -1,3 +1,3 @@\n context\n-removed line\n+added line\n context'}
        />
      </div>

      <section aria-label="Patch application controls" className="card card-accent flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
        <SegmentedControl label="Application Mode" value={applyMode} options={APPLY_OPTIONS} onChange={props.onApplyModeChange} />

        {files.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="control-label">File in Patch</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={safeFileIndex}
              onChange={(e) => setFileIndex(Number(e.target.value))}
            >
              {files.map((f, i) => (
                <option key={i} value={i}>
                  {displayFileName(f) ?? `File ${i + 1}`} ({f.hunks.length} hunk{f.hunks.length === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="min-w-0 flex-1 text-xs" aria-live="polite">
          {parsed === null ? (
            <span className="text-slate-500">Paste or upload a unified patch to validate it.</span>
          ) : parsed.ok ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Valid patch: {files.length} file{files.length === 1 ? '' : 's'}, {hunkCount} hunk{hunkCount === 1 ? '' : 's'}
              {targetName ? ` · target ${targetName}` : ''}
            </span>
          ) : (
            <span className="inline-flex items-start gap-1.5 text-rose-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {parsed.error}
            </span>
          )}
        </div>

        <button type="button" className="btn-primary" onClick={apply} disabled={!patchText.trim()} title="Apply patch (Ctrl+Enter)">
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Apply Patch
        </button>
      </section>

      {applied && (
        <PatchResult
          result={applied.result}
          stale={stale}
          downloadName={resultFileName(props.baseName ?? targetName ?? undefined)}
          onCompare={(text) => props.onCompareResult(applied.base, text, props.baseName)}
        />
      )}
    </div>
  );
}
