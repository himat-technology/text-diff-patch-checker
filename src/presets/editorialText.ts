import type { Preset } from './presetTypes';

const original = `Our team released the new reporting dashboard last week. It allows managers to view weekly sales figures, compare regional performance, and export the results to a spreadsheet. Early feedback has been positive, although some users reported that the charts load slowly on older laptops.

We plan to fix the performance issues in the next update and add support for custom date ranges.
`;

const modified = `Our team launched the redesigned reporting dashboard on Monday. It lets managers view daily sales figures, compare regional and product performance, and export the results to CSV or Excel. Early feedback has been very positive, although a few users reported that the charts render slowly on older devices.

We will resolve the performance issues in the next release and add support for custom date ranges and saved filters.
`;

export const editorialText: Preset = {
  id: 'editorial-text',
  label: 'Editorial Text',
  description: 'Prose with word-level edits — best viewed with Word or Character granularity.',
  original,
  modified,
  originalName: 'announcement-draft.md',
  modifiedName: 'announcement-final.md',
};
