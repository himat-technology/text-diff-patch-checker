import { memo } from 'react';
import { Equal, Gauge, Minus, PencilLine, Plus, Rows3 } from 'lucide-react';
import type { DiffStats as Stats } from '../diff/diffTypes';

interface Props {
  stats: Stats;
  stale?: boolean;
}

function similarityTone(value: number): string {
  if (value >= 80) return 'from-emerald-400 to-teal-500';
  if (value >= 40) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-pink-500';
}

export const DiffStats = memo(function DiffStats({ stats, stale }: Props) {
  const items = [
    { label: 'Additions', value: `+${stats.additions}`, icon: Plus, tile: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-500' },
    { label: 'Deletions', value: `−${stats.deletions}`, icon: Minus, tile: 'border-rose-200 bg-rose-50', text: 'text-rose-700', chip: 'bg-rose-500' },
    { label: 'Modifications', value: `~${stats.modifications}`, icon: PencilLine, tile: 'border-amber-200 bg-amber-50', text: 'text-amber-700', chip: 'bg-amber-500' },
    { label: 'Unchanged', value: String(stats.unchanged), icon: Equal, tile: 'border-sky-200 bg-sky-50', text: 'text-sky-700', chip: 'bg-sky-500' },
    { label: 'Total Output Lines', value: String(stats.totalOutputLines), icon: Rows3, tile: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-700', chip: 'bg-indigo-500' },
  ];
  const similarityText = `${Number.isInteger(stats.similarity) ? stats.similarity : stats.similarity.toFixed(1)}%`;

  return (
    <section aria-label="Comparison statistics" className={`card card-accent px-4 pt-4 pb-3 transition-opacity ${stale ? 'opacity-60' : ''}`}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ label, value, icon: Icon, tile, text, chip }) => (
          <div key={label} className={`min-w-0 rounded-lg border px-3 py-2 ${tile}`}>
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
              <span className={`flex h-4 w-4 items-center justify-center rounded text-white ${chip}`} aria-hidden="true">
                <Icon className="h-3 w-3" />
              </span>
              {label}
            </dt>
            <dd className={`mt-1 font-mono text-xl font-bold tabular-nums ${text}`}>{value}</dd>
          </div>
        ))}
        <div className="col-span-2 min-w-0 rounded-lg border border-violet-200 bg-linear-to-br from-violet-50 to-fuchsia-50 px-3 py-2 sm:col-span-3 lg:col-span-1">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-500 text-white" aria-hidden="true">
              <Gauge className="h-3 w-3" />
            </span>
            Similarity Score
          </dt>
          <dd className="mt-1">
            <span className="bg-linear-to-r from-violet-700 to-fuchsia-600 bg-clip-text font-mono text-xl font-bold text-transparent tabular-nums">
              {similarityText}
            </span>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-violet-100"
              role="meter"
              aria-label="Similarity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.similarity}
              aria-valuetext={similarityText}
            >
              <div className={`h-full rounded-full bg-linear-to-r ${similarityTone(stats.similarity)}`} style={{ width: `${stats.similarity}%` }} />
            </div>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-slate-500">
        Original: {stats.originalLineCount.toLocaleString('en-US')} lines · Modified: {stats.modifiedLineCount.toLocaleString('en-US')} lines
      </p>
    </section>
  );
});
