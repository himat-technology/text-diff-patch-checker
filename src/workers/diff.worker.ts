import { compareTexts, type CompareConfig } from '../diff/compareTexts';

export interface DiffWorkerRequest {
  id: number;
  original: string;
  modified: string;
  config: CompareConfig;
}

export type DiffWorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof compareTexts> }
  | { id: number; ok: false; error: string };

self.addEventListener('message', (event: MessageEvent<DiffWorkerRequest>) => {
  const { id, original, modified, config } = event.data;
  let response: DiffWorkerResponse;
  try {
    response = { id, ok: true, result: compareTexts(original, modified, config) };
  } catch (err) {
    response = { id, ok: false, error: err instanceof Error ? err.message : 'The comparison failed unexpectedly.' };
  }
  self.postMessage(response);
});
