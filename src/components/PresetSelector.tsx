import { BookOpen } from 'lucide-react';
import { PRESETS, type Preset } from '../presets';

interface Props {
  onSelect: (preset: Preset) => void;
  activeId?: string | null;
}

const PRESET_TONES: Record<string, { idle: string; active: string; dot: string }> = {
  'code-revision': {
    idle: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
    active: 'border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-200',
    dot: 'bg-sky-500',
  },
  'json-config': {
    idle: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    active: 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-200',
    dot: 'bg-amber-500',
  },
  'editorial-text': {
    idle: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100',
    active: 'border-fuchsia-600 bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
  'git-patch': {
    idle: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export function PresetSelector({ onSelect, activeId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="preset-label">
      <span id="preset-label" className="control-label flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Presets
      </span>
      {PRESETS.map((preset) => {
        const tone = PRESET_TONES[preset.id];
        const active = activeId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? tone.active : tone.idle}`}
            onClick={() => onSelect(preset)}
            title={preset.description}
            aria-pressed={active}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : tone.dot}`} aria-hidden="true" />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
