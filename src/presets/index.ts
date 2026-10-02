import { codeRevision } from './codeRevision';
import { jsonConfig } from './jsonConfig';
import { editorialText } from './editorialText';
import { gitPatch } from './gitPatch';
import type { Preset } from './presetTypes';

export type { Preset } from './presetTypes';

export const PRESETS: readonly Preset[] = [codeRevision, jsonConfig, editorialText, gitPatch];
