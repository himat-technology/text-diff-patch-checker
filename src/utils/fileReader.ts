/** Extensions accepted for upload. Everything is read locally with the File API. */
export const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.markdown',
  '.py',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sql',
  '.yaml',
  '.yml',
  '.xml',
  '.csv',
  '.log',
  '.ini',
  '.toml',
  '.sh',
  '.diff',
  '.patch',
] as const;

/** Extensions shown in the upload hint (the ones the tool is designed around). */
export const PRIMARY_EXTENSIONS = ['.txt', '.js', '.ts', '.json', '.md', '.py', '.html', '.css', '.sql', '.yaml', '.yml'];

export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.join(',');

/** Hard ceiling to protect the tab; ordinary source files are far smaller. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type FileValidation = { ok: true; extension: string } | { ok: false; error: string };

export function getExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot).toLowerCase();
}

export function isSupportedFileName(fileName: string): boolean {
  const ext = getExtension(fileName);
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateFile(file: { name: string; size: number }): FileValidation {
  const ext = getExtension(file.name);
  if (!ext) {
    return { ok: false, error: `"${file.name}" has no file extension. Supported types: ${PRIMARY_EXTENSIONS.join(', ')}.` };
  }
  if (!isSupportedFileName(file.name)) {
    return { ok: false, error: `"${file.name}" is not a supported text file (${ext}). Supported types: ${PRIMARY_EXTENSIONS.join(', ')}.` };
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `"${file.name}" is ${mb} MB, which exceeds the ${MAX_FILE_BYTES / (1024 * 1024)} MB in-browser limit.` };
  }
  return { ok: true, extension: ext };
}

export type DecodeResult = { ok: true; text: string; encoding: string; warning?: string } | { ok: false; error: string };

/**
 * Decodes raw bytes as text: honours UTF-8/UTF-16 byte-order marks, rejects
 * binary content, and falls back to Windows-1252 for legacy 8-bit files.
 */
export function decodeTextBytes(bytes: Uint8Array): DecodeResult {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { ok: true, text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16 LE' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { ok: true, text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16 BE' };
  }
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasUtf8Bom ? bytes.subarray(3) : bytes;

  const sniff = body.subarray(0, 8192);
  for (let i = 0; i < sniff.length; i++) {
    if (sniff[i] === 0) {
      return { ok: false, error: 'This file appears to be binary, so it cannot be compared as text.' };
    }
  }

  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(body), encoding: 'UTF-8' };
  } catch {
    try {
      return {
        ok: true,
        text: new TextDecoder('windows-1252').decode(body),
        encoding: 'Windows-1252',
        warning: 'The file is not valid UTF-8; it was decoded as Windows-1252. Some characters may look different.',
      };
    } catch {
      return { ok: false, error: 'The file encoding could not be decoded. Save it as UTF-8 and try again.' };
    }
  }
}

export type ReadFileResult =
  | { ok: true; text: string; name: string; extension: string; encoding: string; warning?: string }
  | { ok: false; error: string; name: string };

/** Reads a user-selected file locally. Nothing is uploaded. */
export async function readTextFile(file: File): Promise<ReadFileResult> {
  const validation = validateFile(file);
  if (!validation.ok) return { ok: false, error: validation.error, name: file.name };
  try {
    const buffer = await file.arrayBuffer();
    const decoded = decodeTextBytes(new Uint8Array(buffer));
    if (!decoded.ok) return { ok: false, error: decoded.error, name: file.name };
    return {
      ok: true,
      text: decoded.text,
      name: file.name,
      extension: validation.extension,
      encoding: decoded.encoding,
      ...(decoded.warning ? { warning: decoded.warning } : {}),
    };
  } catch {
    return { ok: false, error: `"${file.name}" could not be read. It may have been moved or is not accessible.`, name: file.name };
  }
}
