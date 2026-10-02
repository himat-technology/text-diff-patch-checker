import { describe, expect, it } from 'vitest';
import { collapseRows } from './collapse';
import { groupIntoHunks } from './hunks';

const rows = 'eeeeeeeeeceeeeeeeeeeeeeeeeceeee'.split('');
const isChange = (r: string) => r === 'c';

describe('hunk grouping and view collapsing', () => {
  it('groups nearby changes and separates distant ones', () => {
    expect(groupIntoHunks(rows, isChange, 3)).toEqual([
      { start: 6, end: 13 },
      { start: 23, end: 30 },
    ]);
    expect(groupIntoHunks(rows, isChange, 10)).toEqual([{ start: 0, end: 31 }]);
    expect(groupIntoHunks(['e', 'e'], isChange, 3)).toEqual([]);
  });

  it('collapses unchanged runs and honours expansion', () => {
    const view = collapseRows(rows, isChange, 3);
    expect(view.filter((v) => v.type === 'collapsed')).toEqual([
      { type: 'collapsed', start: 0, end: 6 },
      { type: 'collapsed', start: 13, end: 23 },
      { type: 'collapsed', start: 30, end: 31 },
    ]);
    const expanded = collapseRows(rows, isChange, 3, new Set([13]));
    expect(expanded.filter((v) => v.type === 'collapsed')).toHaveLength(2);
    expect(collapseRows(rows, isChange, null)).toHaveLength(rows.length);
    expect(collapseRows(['e', 'e'], isChange, 3)).toHaveLength(2);
  });
});
