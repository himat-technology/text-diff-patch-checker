export interface Preset {
  id: string;
  label: string;
  description: string;
  original: string;
  modified: string;
  originalName: string;
  modifiedName: string;
  /** Optional ready-made patch for Apply Patch mode; otherwise one is generated. */
  patch?: string;
}
