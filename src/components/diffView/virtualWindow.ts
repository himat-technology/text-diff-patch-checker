import { ROW_HEIGHT } from './LineContent';

const OVERSCAN = 12;

/** Computes the window of fixed-height rows to render for a scroll position. */
export function virtualWindow(count: number, scrollTop: number, viewportHeight: number) {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  return { start, end };
}
