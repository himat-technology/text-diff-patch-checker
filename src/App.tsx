import { useCallback, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { ModeSwitcher, modePanelId, modeTabId, type AppMode } from './components/ModeSwitcher';
import { PresetSelector } from './components/PresetSelector';
import { DiffControls, type ContextSetting, type ViewMode } from './components/DiffControls';
import { TextEditor, type LoadedFile } from './components/TextEditor';
import { DiffStats } from './components/DiffStats';
import { DiffOutput } from './components/DiffOutput';
import { PatchPanel } from './components/PatchPanel';
import { PatchApplier } from './components/PatchApplier';
import { PrivacyNotice } from './components/PrivacyNotice';
import { Footer } from './components/Footer';
import { useComparison } from './hooks/useComparison';
import { useDelayedFlag } from './hooks/useDelayedFlag';
import { DEFAULT_DIFF_OPTIONS, type DiffOptions, type Granularity } from './diff/diffTypes';
import type { CompareConfig } from './diff/compareTexts';
import type { ApplyMode } from './patch/patchTypes';
import { createUnifiedPatch } from './patch/unifiedPatchGenerator';
import type { Preset } from './presets';
import { codeRevision } from './presets/codeRevision';

const SUPPORTED_HINT = 'Supports .txt .js .ts .json .md .py .html .css .sql .yaml .yml — drag & drop works too.';

export default function App() {
  const [mode, setMode] = useState<AppMode>('diff');

  // Diff mode state
  const [original, setOriginal] = useState(codeRevision.original);
  const [modified, setModified] = useState(codeRevision.modified);
  const [originalName, setOriginalName] = useState<string | null>(codeRevision.originalName);
  const [modifiedName, setModifiedName] = useState<string | null>(codeRevision.modifiedName);
  const [diffPreset, setDiffPreset] = useState<string | null>(codeRevision.id);
  const [options, setOptions] = useState<DiffOptions>(DEFAULT_DIFF_OPTIONS);
  const [granularity, setGranularity] = useState<Granularity>('word');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [context, setContext] = useState<ContextSetting>('all');

  // Patch mode state
  const [baseText, setBaseText] = useState('');
  const [baseName, setBaseName] = useState<string | null>(null);
  const [patchText, setPatchText] = useState('');
  const [patchName, setPatchName] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyMode>('strict');
  const [patchPreset, setPatchPreset] = useState<string | null>(null);

  const config = useMemo<CompareConfig>(
    () => ({ options, granularity, originalName: originalName ?? undefined, modifiedName: modifiedName ?? undefined }),
    [options, granularity, originalName, modifiedName],
  );
  const { result, computing, error } = useComparison(original, modified, config);
  const showComputing = useDelayedFlag(computing, 150);
  const bothEmpty = original.length === 0 && modified.length === 0;

  const originalLabel = originalName ?? 'Original';
  const modifiedLabel = modifiedName ?? 'Modified';
  const ignoreRulesActive = options.ignoreWhitespace || options.ignoreCase || options.stripEmptyLines;

  const selectPreset = useCallback(
    (preset: Preset) => {
      if (mode === 'diff') {
        setOriginal(preset.original);
        setModified(preset.modified);
        setOriginalName(preset.originalName);
        setModifiedName(preset.modifiedName);
        setDiffPreset(preset.id);
      } else {
        setBaseText(preset.original);
        setBaseName(preset.originalName);
        setPatchText(
          preset.patch ?? createUnifiedPatch(preset.original, preset.modified, { oldName: preset.originalName, newName: preset.modifiedName }),
        );
        setPatchName(null);
        setPatchPreset(preset.id);
      }
    },
    [mode],
  );

  const onOriginalChange = useCallback((text: string) => {
    setOriginal(text);
    setDiffPreset(null);
  }, []);
  const onModifiedChange = useCallback((text: string) => {
    setModified(text);
    setDiffPreset(null);
  }, []);
  const onOriginalFile = useCallback((f: LoadedFile) => {
    setOriginal(f.text);
    setOriginalName(f.name);
    setDiffPreset(null);
  }, []);
  const onModifiedFile = useCallback((f: LoadedFile) => {
    setModified(f.text);
    setModifiedName(f.name);
    setDiffPreset(null);
  }, []);
  const clearOriginal = useCallback(() => {
    setOriginal('');
    setOriginalName(null);
    setDiffPreset(null);
  }, []);
  const clearModified = useCallback(() => {
    setModified('');
    setModifiedName(null);
    setDiffPreset(null);
  }, []);

  const swap = useCallback(() => {
    setOriginal(modified);
    setModified(original);
    setOriginalName(modifiedName);
    setModifiedName(originalName);
  }, [original, modified, originalName, modifiedName]);

  const openInPatchMode = useCallback(() => {
    if (!result?.patch) return;
    setBaseText(original);
    setBaseName(originalName);
    setPatchText(result.patch);
    setPatchName(null);
    setPatchPreset(null);
    setMode('patch');
  }, [result, original, originalName]);

  const onBaseFile = useCallback((f: LoadedFile | null) => {
    setBaseText(f?.text ?? '');
    setBaseName(f?.name ?? null);
    setPatchPreset(null);
  }, []);
  const onPatchFile = useCallback((f: LoadedFile | null) => {
    setPatchText(f?.text ?? '');
    setPatchName(f?.name ?? null);
    setPatchPreset(null);
  }, []);
  const onBaseTextChange = useCallback((t: string) => {
    setBaseText(t);
    setPatchPreset(null);
  }, []);
  const onPatchTextChange = useCallback((t: string) => {
    setPatchText(t);
    setPatchPreset(null);
  }, []);

  const compareResult = useCallback((base: string, patched: string, name: string | null) => {
    setOriginal(base);
    setModified(patched);
    setOriginalName(name ?? 'Base');
    setModifiedName(name ? `${name} (patched)` : 'Patched result');
    setDiffPreset(null);
    setMode('diff');
  }, []);

  const announcement = useMemo(() => {
    if (mode !== 'diff') return '';
    if (bothEmpty) return 'Paste or upload text to compare.';
    if (!result) return '';
    if (result.identical) return 'No differences found. Similarity 100 percent.';
    const s = result.stats;
    return `Comparison updated: ${s.additions} additions, ${s.deletions} deletions, ${s.modifications} modifications, ${s.unchanged} unchanged lines, similarity ${s.similarity} percent.`;
  }, [mode, bothEmpty, result]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <Header />

      <main id="main" className="mx-auto flex max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ModeSwitcher mode={mode} onChange={setMode} />
          <PresetSelector onSelect={selectPreset} activeId={mode === 'diff' ? diffPreset : patchPreset} />
        </div>

        <div id={modePanelId('diff')} role="tabpanel" aria-labelledby={modeTabId('diff')} hidden={mode !== 'diff'} className="flex flex-col gap-4">
          <DiffControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            granularity={granularity}
            onGranularityChange={setGranularity}
            context={context}
            onContextChange={setContext}
            options={options}
            onOptionsChange={setOptions}
            onSwap={swap}
            swapDisabled={bothEmpty}
          />

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <TextEditor
              id="original-input"
              label="Original Text / File"
              value={original}
              onChange={onOriginalChange}
              fileName={originalName}
              onFileLoaded={onOriginalFile}
              onClear={clearOriginal}
              uploadLabel="Upload Original"
              accentClass="bg-rose-500"
              placeholder="Paste the original text or code here, or drop a file…"
              description={SUPPORTED_HINT}
            />
            <TextEditor
              id="modified-input"
              label="Modified / New Text"
              value={modified}
              onChange={onModifiedChange}
              fileName={modifiedName}
              onFileLoaded={onModifiedFile}
              onClear={clearModified}
              uploadLabel="Upload Modified"
              accentClass="bg-emerald-500"
              placeholder="Paste the modified text or code here, or drop a file…"
              description={SUPPORTED_HINT}
            />
          </div>

          {result && !bothEmpty && <DiffStats stats={result.stats} stale={showComputing} />}

          <DiffOutput
            result={bothEmpty ? null : result}
            bothEmpty={bothEmpty}
            computing={showComputing}
            error={error}
            viewMode={viewMode}
            context={context}
            originalLabel={originalLabel}
            modifiedLabel={modifiedLabel}
          />

          {result && !bothEmpty && (
            <PatchPanel
              patch={result.patch}
              originalName={originalName}
              modifiedName={modifiedName}
              ignoreRulesActive={ignoreRulesActive}
              onOpenInPatchMode={openInPatchMode}
            />
          )}
        </div>

        <div id={modePanelId('patch')} role="tabpanel" aria-labelledby={modeTabId('patch')} hidden={mode !== 'patch'}>
          <PatchApplier
            baseText={baseText}
            onBaseTextChange={onBaseTextChange}
            baseName={baseName}
            onBaseFile={onBaseFile}
            patchText={patchText}
            onPatchTextChange={onPatchTextChange}
            patchName={patchName}
            onPatchFile={onPatchFile}
            applyMode={applyMode}
            onApplyModeChange={setApplyMode}
            onCompareResult={compareResult}
          />
        </div>

        <PrivacyNotice />
      </main>

      <Footer />

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
