import { useRef, type KeyboardEvent } from 'react';
import { GitCompareArrows, Wrench } from 'lucide-react';

export type AppMode = 'diff' | 'patch';

const MODES: Array<{ id: AppMode; label: string; icon: typeof GitCompareArrows }> = [
  { id: 'diff', label: 'Text / Code Diff', icon: GitCompareArrows },
  { id: 'patch', label: 'Apply Unified Patch', icon: Wrench },
];

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export const modeTabId = (mode: AppMode) => `mode-tab-${mode}`;
export const modePanelId = (mode: AppMode) => `mode-panel-${mode}`;

/** WAI-ARIA tabs with arrow-key navigation. */
export function ModeSwitcher({ mode, onChange }: Props) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % MODES.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + MODES.length) % MODES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MODES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(MODES[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Tool mode" className="flex w-full gap-1 rounded-xl border border-indigo-100 bg-white/80 p-1 shadow-sm shadow-indigo-100 sm:w-auto">
      {MODES.map(({ id, label, icon: Icon }, index) => {
        const selected = id === mode;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={modeTabId(id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={modePanelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors sm:flex-none ${
              selected
                ? 'bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-sm shadow-indigo-300'
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
