import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AlertCircle, FileText, Info, X } from 'lucide-react';
import { FileUploader } from './FileUploader';
import { readTextFile } from '../utils/fileReader';

const LINE_HEIGHT = 20;
const PADDING_TOP = 8;

export interface LoadedFile {
  text: string;
  name: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  fileName?: string | null;
  onFileLoaded?: (file: LoadedFile) => void;
  onClear?: () => void;
  uploadLabel?: string;
  placeholder?: string;
  readOnly?: boolean;
  /** Extra buttons rendered in the toolbar. */
  actions?: ReactNode;
  /** Tailwind height class for the editing area. */
  heightClass?: string;
  description?: string;
  /** Tailwind background class for the dot beside the title. */
  accentClass?: string;
}

function countLines(text: string): number {
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) n++;
    else if (c === 13 && text.charCodeAt(i + 1) !== 10) n++;
  }
  return n;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Monospace editor with a virtualized line-number gutter, file upload and
 * drag-and-drop. Long lines scroll horizontally instead of wrapping.
 */
export const TextEditor = memo(function TextEditor({
  id,
  label,
  value,
  onChange,
  fileName,
  onFileLoaded,
  onClear,
  uploadLabel,
  placeholder,
  readOnly,
  actions,
  heightClass = 'h-72 sm:h-80 lg:h-96',
  description,
  accentClass = 'bg-indigo-500',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(400);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const lineCount = useMemo(() => countLines(value), [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (el && el.scrollTop !== scrollTop) setScrollTop(el.scrollTop);
    // Re-sync after programmatic value changes (presets, uploads, swaps).
  }, [value, scrollTop]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!onFileLoaded) return;
      setLoading(true);
      const result = await readTextFile(file);
      setLoading(false);
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      setNotice(result.warning ? { kind: 'warning', text: result.warning } : null);
      onFileLoaded({ text: result.text, name: result.name });
      if (textareaRef.current) textareaRef.current.scrollTop = 0;
      setScrollTop(0);
    },
    [onFileLoaded],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (readOnly || !onFileLoaded) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
    else setNotice({ kind: 'error', text: 'Drop a text or code file to load it.' });
  };

  const first = Math.max(0, Math.floor((scrollTop - PADDING_TOP) / LINE_HEIGHT));
  const visible = Math.ceil(viewport / LINE_HEIGHT) + 2;
  const last = Math.min(lineCount, first + visible);
  const gutterChars = Math.max(3, String(lineCount).length + 1);
  const numbers: number[] = [];
  for (let n = first + 1; n <= last; n++) numbers.push(n);

  const labelId = `${id}-label`;
  const descId = `${id}-desc`;

  return (
    <section className="card card-accent flex min-w-0 flex-col" aria-labelledby={labelId}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${accentClass}`} aria-hidden="true" />
          <h2 id={labelId} className="text-sm font-semibold text-slate-800">
            <label htmlFor={id}>{label}</label>
          </h2>
          {fileName && (
            <span className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600" title={fileName}>
              <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{fileName}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {onFileLoaded && !readOnly && <FileUploader label={loading ? 'Reading…' : (uploadLabel ?? 'Upload')} onFile={(f) => void handleFile(f)} disabled={loading} />}
          {onClear && !readOnly && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setNotice(null);
                onClear();
              }}
              disabled={value.length === 0 && !fileName}
              aria-label={`Clear ${label}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className={`relative flex min-h-0 ${heightClass} ${dragging ? 'ring-2 ring-sky-500 ring-inset' : ''}`}
        onDragOver={(e) => {
          if (readOnly || !onFileLoaded) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <div
          className="code-text pointer-events-none relative shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50 text-right text-slate-400 select-none"
          style={{ width: `calc(${gutterChars}ch + 12px)` }}
          aria-hidden="true"
        >
          <div style={{ transform: `translateY(${PADDING_TOP + first * LINE_HEIGHT - scrollTop}px)` }}>
            {numbers.map((n) => (
              <div key={n} className="pr-2" style={{ height: LINE_HEIGHT }}>
                {n}
              </div>
            ))}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          readOnly={readOnly}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-describedby={description ? descId : undefined}
          className={`code-text block h-full min-w-0 flex-1 resize-none overflow-auto bg-white px-3 py-2 whitespace-pre text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 ${
            readOnly ? 'bg-slate-50/60' : ''
          }`}
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-sky-50/80 text-sm font-medium text-sky-800">
            Drop file to load it locally
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500">
        <span>
          {formatCount(value.length === 0 ? 0 : lineCount)} lines · {formatCount(value.length)} chars
        </span>
        {description && (
          <span id={descId} className="hidden sm:inline">
            {description}
          </span>
        )}
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 border-t px-3 py-2 text-xs ${
            notice.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {notice.kind === 'error' ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span className="flex-1">{notice.text}</span>
          <button type="button" className="btn-ghost -my-1 px-1" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
});
