import { useEffect, useRef, useState } from 'react';
import { compareTexts, type CompareConfig } from '../diff/compareTexts';
import type { ComparisonResult } from '../diff/diffTypes';
import type { DiffWorkerRequest, DiffWorkerResponse } from '../workers/diff.worker';

export interface ComparisonState {
  result: ComparisonResult | null;
  computing: boolean;
  error: string | null;
}

function debounceFor(size: number): number {
  if (size < 20_000) return 120;
  if (size < 500_000) return 300;
  return 600;
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Runs the comparison in a Web Worker after a size-dependent debounce. A
 * stale in-flight job is abandoned by terminating the worker, so typing in a
 * huge file never queues up work. Falls back to the main thread if workers
 * are unavailable.
 */
export function useComparison(original: string, modified: string, config: CompareConfig): ComparisonState {
  const [state, setState] = useState<ComparisonState>({ result: null, computing: false, error: null });
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = ++requestIdRef.current;
    setState((s) => ({ ...s, computing: true }));

    const settle = (data: DiffWorkerResponse) => {
      if (data.id !== requestIdRef.current) return;
      busyRef.current = false;
      if (data.ok) setState({ result: data.result, computing: false, error: null });
      else setState((s) => ({ ...s, computing: false, error: data.error }));
    };

    const onCrash = () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      busyRef.current = false;
      setState((s) => ({
        ...s,
        computing: false,
        error: 'The comparison could not be completed. The input may be too large for this device.',
      }));
    };

    const timer = window.setTimeout(() => {
      const parsedConfig = JSON.parse(configKey) as CompareConfig;

      // Abandon an in-flight job for older input.
      if (busyRef.current && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (!workerRef.current) workerRef.current = createWorker();

      const worker = workerRef.current;
      if (worker) {
        busyRef.current = true;
        worker.onmessage = (e: MessageEvent<DiffWorkerResponse>) => settle(e.data);
        worker.onerror = onCrash;
        const request: DiffWorkerRequest = { id, original, modified, config: parsedConfig };
        worker.postMessage(request);
      } else {
        try {
          settle({ id, ok: true, result: compareTexts(original, modified, parsedConfig) });
        } catch (err) {
          settle({ id, ok: false, error: err instanceof Error ? err.message : 'The comparison failed.' });
        }
      }
    }, debounceFor(original.length + modified.length));

    return () => window.clearTimeout(timer);
  }, [original, modified, configKey]);

  return state;
}
