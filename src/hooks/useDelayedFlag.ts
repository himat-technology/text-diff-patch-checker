import { useEffect, useState } from 'react';

/** Turns true only after `value` has stayed true for `delayMs`, avoiding spinner flicker. */
export function useDelayedFlag(value: boolean, delayMs = 150): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    if (!value) {
      setFlag(false);
      return;
    }
    const t = window.setTimeout(() => setFlag(true), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return flag;
}
