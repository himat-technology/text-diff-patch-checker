import { getExtension } from './fileReader';

/** Triggers a download of `content` generated in-memory (Blob + object URL). */
export function downloadText(fileName: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stripExtension(name: string): string {
  const ext = getExtension(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/** Removes characters that are invalid in file names on common platforms. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned || 'file';
}

/** `app.js` + `app.ts` → `app.patch`; defaults to `changes.patch`. */
export function patchFileName(originalName?: string, modifiedName?: string): string {
  const source = modifiedName || originalName;
  if (!source) return 'changes.patch';
  return `${sanitizeFileName(stripExtension(source.split(/[\\/]/).pop() ?? source))}.patch`;
}

/** Keeps the uploaded extension when known (`config.yaml` → `config.patched.yaml`). */
export function resultFileName(baseName?: string): string {
  if (!baseName) return 'patched.txt';
  const file = baseName.split(/[\\/]/).pop() ?? baseName;
  const ext = getExtension(file);
  if (!ext) return `${sanitizeFileName(file)}.patched.txt`;
  return `${sanitizeFileName(stripExtension(file))}.patched${ext}`;
}
