import type { Preset } from './presetTypes';
import { createUnifiedPatch } from '../patch/unifiedPatchGenerator';

const FILE = 'src/http/client.ts';

const original = `import { logger } from './logger';

export interface RequestOptions {
  url: string;
  method?: string;
  body?: unknown;
}

export async function fetchJson(options: RequestOptions) {
  const response = await fetch(options.url, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    logger.error('Request failed', response.status);
    throw new Error('Request failed');
  }

  return response.json();
}

export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }

  return status >= 500 && status < 600;
}

export function buildQuery(params: Record<string, string>) {
  return Object.keys(params)
    .map((key) => key + '=' + params[key])
    .join('&');
}
`;

const modified = `import { logger } from './logger';

export interface RequestOptions {
  url: string;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function fetchJson<T>(options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  const response = await fetch(options.url, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!response.ok) {
    logger.error('Request failed', response.status);
    throw new Error(\`Request to \${options.url} failed with status \${response.status}\`);
  }

  return (await response.json()) as T;
}

export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }

  return status >= 500 && status < 600;
}

export function buildQuery(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
`;

/** A git-style patch (with `diff --git` and `index` preamble) produced by the local generator. */
const patch =
  `diff --git a/${FILE} b/${FILE}\n` +
  `index 4b1e2f9..c7d03a1 100644\n` +
  createUnifiedPatch(original, modified, { oldName: `a/${FILE}`, newName: `b/${FILE}` });

export const gitPatch: Preset = {
  id: 'git-patch',
  label: 'Git Patch',
  description: 'A source change that produces a multi-hunk, git-style unified patch.',
  original,
  modified,
  originalName: 'client.ts',
  modifiedName: 'client.ts',
  patch,
};
