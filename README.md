<div align="center">

# 🔍 Text Diff & Patch Checker

### Compare text, inspect code changes, generate unified patches, and apply patches locally.

**A free developer tool by [HiMat Technology](https://himat.co.in)**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-himat.tech-7c3aed?style=for-the-badge)](https://himat.tech/free-tools/text-diff-patch-checker)
[![100% Browser-Local](https://img.shields.io/badge/🔒_100%25-Browser--Local-10b981?style=for-the-badge)](#-privacy-architecture)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-85_passing-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)

[🌐 Website](https://himat.co.in) ·
[📧 Email](mailto:info@himat.co.in) ·
[📞 +91 94452 34023](tel:+919445234023) ·
[Facebook](https://www.facebook.com/people/Himat-technology/61593829197445/) ·
[LinkedIn](https://www.linkedin.com/company/himat-technology) ·
[Instagram](https://www.instagram.com/himat_technology)

</div>

> **🔒 100% Browser-Local** — your text, code, files, and generated patches never leave your browser.

A fully client-side developer utility (React + TypeScript + Vite) with a real Myers diff engine, a
standards-compatible unified patch generator, and a unified patch parser/applier with strict and
fuzzy modes. There is no backend.

**👉 Try it online:** <https://himat.tech/free-tools/text-diff-patch-checker>

---

## 📑 Contents

- [Features](#-features) · [Supported file types](#-supported-file-types) · [Diff algorithm](#-diff-algorithm)
- [Unified patch format](#-unified-patch-format) · [Patch application](#-patch-application-behavior)
- [Privacy architecture](#-privacy-architecture) · [Project structure](#-project-structure)
- [Getting started](#-installation) · [Testing](#-testing) · [Production build](#-production-build)
- [Limitations](#-limitations) · [Future improvements](#-future-improvements) · [Contact](#-about-himat-technology)

---

## ✨ Features

### 🔀 Text / Code Diff mode

- Two large monospace editors with line numbers, horizontal scrolling, Clear buttons, file upload and drag-and-drop
- Live comparison (debounced, in a Web Worker) with a "Comparing…" state for large inputs
- **Side-by-Side** view with vertically synchronized panes, or **Unified Diff** view with `@@` hunk headers
- **Line**, **Word** or **Character** granularity — inline `<del>`/`<ins>` highlights for modified lines
- Ignore rules: **Ignore Whitespace**, **Ignore Case**, **Strip Empty Lines**
- Unchanged-context control (All / 3 / 10 lines) with click-to-expand collapsed regions
- **Swap Panels**
- Statistics: Additions, Deletions, Modifications, Unchanged, Total Output Lines, Similarity Score
- Generated unified patch with **Copy Unified Patch** (Clipboard API, "Copied!" feedback),
  **Download .patch** (Blob download) and **Test in Apply Mode**
- Presets: **Code Revision**, **JSON Config**, **Editorial Text**, **Git Patch**

### 🧩 Apply Unified Patch mode

- Base text + unified patch editors (paste, upload or drop `.patch` / `.diff` files)
- Live patch validation (files, hunk count, or a precise parse error)
- **Strict Apply** (default) and **Fuzzy Apply**
- Per-hunk report ("Hunk #2 applied at line 45 (offset +3 lines)") and a clear
  **Patch Applied Successfully** / **Patch Could Not Be Applied** status
- **Copy Result**, **Download Result** (keeps the uploaded extension, e.g. `config.patched.yaml`),
  and **Compare** (opens base vs. result in diff mode)
- Multi-file patches: choose which file section to apply

## 📂 Supported file types

`.txt .js .ts .json .md .py .html .css .sql .yaml .yml` — plus `.jsx .tsx .mjs .cjs .markdown .htm .scss
.xml .csv .log .ini .toml .sh .diff .patch`.

Files are read with `File.arrayBuffer()` and decoded locally:

- UTF-8 (with or without BOM), UTF-16 LE/BE (BOM-detected)
- Invalid UTF-8 falls back to Windows-1252 with a visible warning
- Binary files (NUL bytes) and unsupported extensions are rejected with a friendly message
- Files up to 50 MB are accepted; there is no artificial limit below that

## 🧠 Diff algorithm

`src/diff/myersDiff.ts` implements **Myers' O(ND) algorithm** with the linear-space
"middle snake" bisection (Myers 1986, §4b):

1. Lines (or tokens) are interned to integers so comparisons are cheap.
2. Common prefixes/suffixes are trimmed, then the edit graph is bisected recursively.
3. Each change run is normalized to *deletions first, then insertions*.
4. A time budget (default 5 s) protects the UI: if exceeded on pathological input, the
   remaining region becomes delete-all/insert-all — **still a correct script**, just not minimal,
   and the UI says so.

On top of the line diff:

- **Ignore rules** change the comparison key only (`diff -w`-style whitespace removal, lower-casing,
  blank-line filtering). Displayed content always keeps the original characters and line numbers.
- **Modification pairing** (`src/diff/alignment.ts`): inside each change block, deleted and inserted
  lines are paired by an order-preserving weighted LCS over Sørensen–Dice bigram similarity.
  Pairs with similarity ≥ 0.4 are *modifications*; the rest are pure additions/deletions.
- **Word diff** tokenizes into Unicode word runs (`\p{L}\p{M}\p{N}_`), whitespace runs and single
  symbols. **Character diff** uses grapheme clusters (`Intl.Segmenter`) so emoji and combining
  marks are never split. Both run Myers on tokens, then absorb whitespace-only (or 1-character, in
  character mode) islands between changes for readable highlights.

Internal representation (`src/diff/diffTypes.ts`):

```ts
type DiffOperation =
  | { type: 'equal'; oldLine: number; newLine: number; content: string; oldContent: string; noEol?: boolean }
  | { type: 'insert'; newLine: number; content: string; noEol?: boolean }
  | { type: 'delete'; oldLine: number; content: string; noEol?: boolean };

interface DiffSegment { type: 'equal' | 'insert' | 'delete'; text: string }
```

### 📊 Statistics

| Stat | Definition |
| --- | --- |
| Additions | inserted lines not paired as a modification |
| Deletions | deleted lines not paired as a modification |
| Modifications | deleted/inserted pairs similar enough to be the same line edited |
| Unchanged | lines equal under the active ignore rules |
| Total Output Lines | additions + deletions + modifications + unchanged |

### 🎯 Similarity score

Implemented in `src/diff/similarity.ts` — a character-weighted Sørensen–Dice ratio:

```
similarity = 2·M / (T_original + T_modified) × 100

T_x = Σ (code points + 1) over every compared line of side x   (+1 = the line break)
M   = matched characters:
      unchanged line → (len_old + 1 + len_new + 1) / 2
      modified pair  → code points in the shared (unchanged) word-level runs + 1
      unpaired added/deleted lines → 0
```

Identical inputs (and two empty inputs) score exactly **100%**; unrelated inputs approach **0%**.
The value is rounded to one decimal and a non-identical comparison never rounds up to 100%.

## 🩹 Unified patch format

`src/patch/unifiedPatchGenerator.ts` emits GNU/git-compatible unified diffs:

```diff
--- Original
+++ Modified
@@ -1,3 +1,4 @@
 function hello() {
-  return "Hello";
+  const message = "Hello";
+  return message;
 }
```

- 3 lines of context; changes within 6 lines share a hunk (same as `diff -u`)
- Range counts of 1 are omitted (`@@ -5 +5 @@`); empty ranges name the preceding line (`@@ -0,0 +1 @@`)
- `\ No newline at end of file` markers are emitted when needed
- File names containing quotes, backslashes, tabs or newlines are C-quoted like git
- The patch is always computed from the **exact** text (ignore rules only affect the visual diff),
  so it always reproduces the modified text byte-for-byte

## 🛠️ Patch application behavior

`src/patch/unifiedPatchParser.ts` parses:

- `---`/`+++` headers (optional tab-separated timestamps, git `a/` `b/` prefixes, quoted names
  with escape and octal-UTF-8 sequences)
- Preamble lines (`diff --git`, `index …`, commit messages) and `-- ` email signatures are skipped
- Multiple files and multiple hunks; LF, CRLF and CR line endings
- Blank lines inside hunks are treated as empty context lines (editors often strip the space)
- Validation errors with patch line numbers: invalid hunk headers, `0`-start non-empty ranges,
  overlapping/out-of-order hunks, hunks shorter or longer than their header declares

`src/patch/patchApplier.ts` applies hunks in order against the original base text:

- **Strict Apply**: each hunk's context and deleted lines must match exactly (including the
  final-newline state) at the line stated in the header.
- **Fuzzy Apply**, tried in this order for each hunk:
  1. exact match at the nearest offset (searching outward from the expected line)
  2. whitespace-insensitive match
  3. GNU-style fuzz: ignore up to 2 leading/trailing **context** lines, then repeat 1–2

  Deleted lines must always match. Context lines are copied from the base text, never from the
  patch, so unrelated lines are never altered. Every hunk that needed an offset, fuzz or
  whitespace-insensitive match is reported, and the result is flagged "Fuzzy matching was used".
- If any hunk fails, **no output is produced**. Errors explain why, e.g.
  `Hunk #1 failed: patch context does not match base text near line 42. Line 43: expected "foo" but found "bar".`
  Already-applied hunks are detected and reported as such.
- The result keeps the base text's line ending style (LF/CRLF/CR).

## 🔒 Privacy architecture

```
Input  ──► Diff engine (Web Worker) ──► Rows / stats / patch      (all in this tab)
Base text + Patch ──► Parser ──► Applier ──► Result               (all in this tab)
```

- No backend, API, database, analytics or cloud storage. The app is static files.
- Uploads use the File API; downloads use in-memory `Blob` URLs.
- `npm run build` injects a Content-Security-Policy with **`connect-src 'none'`**, so the browser
  blocks every `fetch`/XHR/WebSocket/beacon from the production app. (Dev mode omits it because
  Vite's hot-reload client needs a WebSocket.)

## 🗂️ Project structure

```
src/
  App.tsx                      app state & layout
  main.tsx, index.css
  components/
    Header.tsx  ModeSwitcher.tsx  PresetSelector.tsx  DiffControls.tsx  SegmentedControl.tsx
    TextEditor.tsx  FileUploader.tsx  DiffStats.tsx  DiffOutput.tsx
    SideBySideDiff.tsx  UnifiedDiff.tsx  PatchPanel.tsx
    PatchApplier.tsx  PatchResult.tsx  PrivacyNotice.tsx
    diffView/LineContent.tsx  diffView/virtualWindow.ts
  diff/                        pure diff engine (no React)
    myersDiff.ts  lineDiff.ts  tokenDiff.ts  wordDiff.ts  charDiff.ts
    alignment.ts  stats.ts  similarity.ts  hunks.ts  collapse.ts
    compareTexts.ts  diffTypes.ts
  patch/                       pure patch engine (no React)
    unifiedPatchGenerator.ts  unifiedPatchParser.ts  patchApplier.ts  patchTypes.ts
  presets/
    codeRevision.ts  jsonConfig.ts  editorialText.ts  gitPatch.ts  presetTypes.ts  index.ts
  utils/
    clipboard.ts  fileReader.ts  fileDownload.ts  textNormalization.ts
  hooks/
    useComparison.ts  useCopyFeedback.ts  useDelayedFlag.ts
  workers/
    diff.worker.ts
```

Tests live next to the code they cover (`*.test.ts`).

## 📦 Installation

Requires Node.js 20+.

```bash
npm install
```

## 💻 Development

```bash
npm run dev
```

Open <http://localhost:5173>.

## 🧪 Testing

```bash
npm run test        # single run
npm run test:watch  # watch mode
npm run typecheck   # TypeScript project check
```

The Vitest suite covers the Myers core, line/word/character diffs, ignore rules, statistics and
similarity, patch generation, parsing (valid, invalid, malformed, bad ranges, quoted names, git
preambles), strict and fuzzy application, CRLF/no-newline/Unicode/long-line edge cases, file
reading and validation, and seeded randomized tests that check
`apply(original, generate(original, modified)) === modified` across 300 random edit scripts, plus
2,000 random comparisons across every ignore-rule × granularity combination verifying that split
and unified rows cover every line in order, inline segments reassemble each line, statistics add
up, and fuzzy apply matches strict apply on an exact base.

## 🚀 Production build

```bash
npm run build     # type-checks, then builds to dist/
npm run preview   # serves dist/ on http://localhost:4173
```

`dist/` is a static site and can be hosted anywhere (or opened from any static file server).

## ⚠️ Limitations

- Patches apply to a single base text; for multi-file patches you pick one file section.
  Binary patches, renames-only and mode-only changes are skipped.
- The textarea normalizes line endings to LF once you edit it; uploaded CRLF files keep CRLF
  until edited (patch application preserves the base text's line endings).
- Fuzzy mode does not attempt reverse-patch detection beyond reporting "already applied".
- Very large, highly dissimilar inputs may hit the diff time budget and produce a correct but
  non-minimal diff (flagged in the UI).
- No syntax highlighting — formatting is preserved exactly, but tokens are not colored.

## 🔮 Future improvements

- Dark theme
- Optional lightweight syntax highlighting for common languages
- Directory/multi-file comparison and applying multi-file patches to a set of uploaded files
- Reverse-apply (`patch -R`) and creating patches with configurable context
- Persisting inputs in `localStorage` (opt-in)
- Computing inline word/character diffs lazily for extremely large change blocks

---

## 🏢 About HiMat Technology

Text Diff & Patch Checker is one of the free, privacy-first developer tools built by
**HiMat Technology**.

| | |
| --- | --- |
| 🚀 **Live demo** | [himat.tech/free-tools/text-diff-patch-checker](https://himat.tech/free-tools/text-diff-patch-checker) |
| 🌐 **Website** | [himat.co.in](https://himat.co.in) |
| 📧 **Email** | [info@himat.co.in](mailto:info@himat.co.in) |
| 📞 **Phone** | [+91 94452 34023](tel:+919445234023) |

### 🤝 Follow us

[![Facebook](https://img.shields.io/badge/Facebook-HiMat_Technology-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/people/Himat-technology/61593829197445/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-HiMat_Technology-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/himat-technology)
[![Instagram](https://img.shields.io/badge/Instagram-@himat__technology-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/himat_technology)

---

<div align="center">

Made with 💜 by [HiMat Technology](https://himat.co.in) · Released under the [MIT License](LICENSE)

</div>
