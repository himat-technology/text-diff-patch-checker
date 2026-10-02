import { Cpu, FileLock2, Lock, ShieldCheck, Wifi } from 'lucide-react';

const POINTS = [
  { icon: Cpu, tone: 'bg-indigo-500', text: 'Diffing runs in a Web Worker inside this tab — there is no backend, database or cloud storage.' },
  { icon: FileLock2, tone: 'bg-fuchsia-500', text: 'Uploaded files are read with the browser File API and are never transmitted.' },
  { icon: ShieldCheck, tone: 'bg-amber-500', text: 'Patches are parsed and applied locally; downloads are generated in memory with Blob URLs.' },
  { icon: Wifi, tone: 'bg-sky-500', text: "The production build ships a Content-Security-Policy with connect-src 'none', so the page cannot make network requests." },
];

export function PrivacyNotice() {
  return (
    <section
      aria-labelledby="privacy-heading"
      className="overflow-hidden rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-teal-50 to-sky-50 px-4 py-4 shadow-sm shadow-emerald-100"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-200" aria-hidden="true">
          <Lock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-sm text-slate-700">
          <h2 id="privacy-heading" className="font-bold text-emerald-900">
            100% Browser-Local
          </h2>
          <p className="text-emerald-900/80">Your code, documents, uploaded files, and generated patches never leave this device.</p>
          <ul className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, tone, text }) => (
              <li key={text} className="flex items-start gap-2 rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-white">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white ${tone}`} aria-hidden="true">
                  <Icon className="h-3 w-3" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
