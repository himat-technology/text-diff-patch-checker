import { ExternalLink, FileDiff, ShieldCheck } from 'lucide-react';
import { BRAND } from '../brand';

export function Header() {
  return (
    <header className="relative overflow-hidden bg-linear-to-r from-indigo-700 via-violet-700 to-fuchsia-700 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(600px 200px at 10% 0%, rgb(56 189 248 / 0.6), transparent 70%), radial-gradient(500px 220px at 90% 100%, rgb(251 191 36 / 0.5), transparent 70%)',
        }}
      />
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30" aria-hidden="true">
            <FileDiff className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-fuchsia-100 uppercase">{BRAND.name} · Free Developer Tool</p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Text Diff &amp; Patch Checker</h1>
            <p className="text-sm text-indigo-100">
              Compare text, inspect code changes, generate unified patches, and apply patches locally.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-300/60">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              100% Browser-Local
            </span>
            <a
              href={BRAND.demo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25"
            >
              Live demo
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          <p className="text-xs text-indigo-100">Your text, code, files, and generated patches never leave your browser.</p>
        </div>
      </div>
    </header>
  );
}
