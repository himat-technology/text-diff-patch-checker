import { ArrowLeftRight } from 'lucide-react';
import type { DiffOptions, Granularity } from '../diff/diffTypes';
import { SegmentedControl } from './SegmentedControl';

export type ViewMode = 'split' | 'unified';
export type ContextSetting = 'all' | '3' | '10';

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  context: ContextSetting;
  onContextChange: (c: ContextSetting) => void;
  options: DiffOptions;
  onOptionsChange: (o: DiffOptions) => void;
  onSwap: () => void;
  swapDisabled: boolean;
}

const VIEW_OPTIONS = [
  { value: 'split', label: 'Side-by-Side', title: 'Split view with synchronized scrolling' },
  { value: 'unified', label: 'Unified Diff', title: 'Single column with -/+ prefixes' },
] as const;

const GRANULARITY_OPTIONS = [
  { value: 'line', label: 'Line', title: 'Highlight whole changed lines' },
  { value: 'word', label: 'Word', title: 'Highlight changed words inside modified lines' },
  { value: 'char', label: 'Character', title: 'Highlight changed characters inside modified lines' },
] as const;

const CONTEXT_OPTIONS = [
  { value: 'all', label: 'All', title: 'Show every line' },
  { value: '3', label: '3', title: 'Show 3 unchanged lines around changes' },
  { value: '10', label: '10', title: 'Show 10 unchanged lines around changes' },
] as const;

const TOGGLES: Array<{ key: keyof DiffOptions; label: string; hint: string }> = [
  { key: 'ignoreWhitespace', label: 'Ignore Whitespace', hint: 'Treat lines that differ only in spaces, tabs or a final newline as equal' },
  { key: 'ignoreCase', label: 'Ignore Case', hint: 'Compare letters case-insensitively' },
  { key: 'stripEmptyLines', label: 'Strip Empty Lines', hint: 'Exclude blank lines from the comparison' },
];

export function DiffControls(props: Props) {
  const { options, onOptionsChange } = props;
  return (
    <section aria-label="Comparison controls" className="card card-accent flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
      <SegmentedControl label="View Mode" value={props.viewMode} options={VIEW_OPTIONS} onChange={props.onViewModeChange} />
      <SegmentedControl label="Diff Granularity" value={props.granularity} options={GRANULARITY_OPTIONS} onChange={props.onGranularityChange} />
      <SegmentedControl label="Unchanged Context" value={props.context} options={CONTEXT_OPTIONS} onChange={props.onContextChange} />

      <fieldset className="flex flex-col gap-1">
        <legend className="control-label mb-1">Comparison Options</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-1">
          {TOGGLES.map(({ key, label, hint }) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700" title={hint}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-400 accent-slate-900"
                checked={options[key]}
                onChange={(e) => onOptionsChange({ ...options, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ml-auto">
        <button type="button" className="btn" onClick={props.onSwap} disabled={props.swapDisabled} title="Exchange Original and Modified input">
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Swap Panels
        </button>
      </div>
    </section>
  );
}
