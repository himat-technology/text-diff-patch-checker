import { describe, expect, it } from 'vitest';
import { decodeTextBytes, getExtension, isSupportedFileName, readTextFile, validateFile } from './fileReader';
import { patchFileName, resultFileName, sanitizeFileName } from './fileDownload';
import { splitLines, joinLines } from './textNormalization';

describe('file handling', () => {
  it('34. reads an uploaded text file locally', async () => {
    const file = new File(['const answer = 42;\nconsole.log("héllo 👋");\n'], 'example.js', { type: 'text/javascript' });
    const r = await readTextFile(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe('const answer = 42;\nconsole.log("héllo 👋");\n');
    expect(r.name).toBe('example.js');
    expect(r.extension).toBe('.js');
    expect(r.encoding).toBe('UTF-8');
  });

  it('35. accepts every required extension (case-insensitive)', () => {
    for (const name of ['a.txt', 'a.js', 'a.ts', 'a.json', 'a.md', 'a.py', 'a.html', 'a.css', 'a.sql', 'a.yaml', 'a.yml', 'A.JSON', 'my file.patch']) {
      expect(isSupportedFileName(name), name).toBe(true);
      expect(validateFile({ name, size: 10 }).ok).toBe(true);
    }
    expect(getExtension('archive.tar.gz')).toBe('.gz');
    expect(getExtension('.gitignore')).toBe('');
  });

  it('36. rejects unsupported extensions with a friendly error', async () => {
    const v = validateFile({ name: 'photo.png', size: 100 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/not a supported text file \(\.png\)/);
    const r = await readTextFile(new File([new Uint8Array([1, 2, 3])], 'program.exe'));
    expect(r.ok).toBe(false);
    expect(validateFile({ name: 'Makefile', size: 1 }).ok).toBe(false);
  });

  it('rejects binary content even with a text extension', async () => {
    const r = await readTextFile(new File([new Uint8Array([0x68, 0x00, 0x69])], 'sneaky.txt'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/binary/);
  });

  it('rejects files above the size ceiling', () => {
    const v = validateFile({ name: 'big.txt', size: 60 * 1024 * 1024 });
    expect(v.ok).toBe(false);
  });

  it('decodes BOMs and falls back for legacy encodings', () => {
    const utf8Bom = decodeTextBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]));
    expect(utf8Bom.ok && utf8Bom.text).toBe('hi');
    const utf16 = decodeTextBytes(new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]));
    expect(utf16.ok && utf16.text).toBe('hi');
    const latin = decodeTextBytes(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
    expect(latin.ok).toBe(true);
    if (latin.ok) {
      expect(latin.text).toBe('café');
      expect(latin.warning).toBeDefined();
    }
  });

  it('builds safe download names', () => {
    expect(patchFileName()).toBe('changes.patch');
    expect(patchFileName('old.js', 'new feature.ts')).toBe('new feature.patch');
    expect(resultFileName()).toBe('patched.txt');
    expect(resultFileName('config.yaml')).toBe('config.patched.yaml');
    expect(resultFileName('README')).toBe('README.patched.txt');
    expect(sanitizeFileName('a:b*c?.txt')).toBe('a_b_c_.txt');
  });
});

describe('text normalisation', () => {
  it('splits LF, CRLF and CR and tracks the trailing newline', () => {
    expect(splitLines('')).toEqual({ lines: [], eol: '\n', hasTrailingNewline: false });
    expect(splitLines('a\r\nb\r\n')).toEqual({ lines: ['a', 'b'], eol: '\r\n', hasTrailingNewline: true });
    expect(splitLines('a\rb')).toEqual({ lines: ['a', 'b'], eol: '\r', hasTrailingNewline: false });
    expect(splitLines('\n')).toEqual({ lines: [''], eol: '\n', hasTrailingNewline: true });
    expect(joinLines(['a', 'b'], '\r\n', true)).toBe('a\r\nb\r\n');
  });
});
