import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';

export type CopyStatus = 'idle' | 'copied' | 'error';

/** Copies text and exposes a temporary "Copied!" / error status. */
export function useCopyFeedback(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      setStatus(ok ? 'copied' : 'error');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStatus('idle'), resetMs);
    },
    [resetMs],
  );

  return { status, copy };
}
