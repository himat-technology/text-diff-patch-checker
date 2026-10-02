import type { Preset } from './presetTypes';

const original = `{
  "apiUrl": "https://api.example.com",
  "timeout": 5000,
  "debug": false,
  "features": {
    "darkMode": false,
    "betaDashboard": false
  },
  "logLevel": "warn"
}
`;

const modified = `{
  "apiUrl": "https://api.example.com/v2",
  "timeout": 10000,
  "debug": true,
  "retries": 3,
  "features": {
    "darkMode": true,
    "betaDashboard": false,
    "offlineSync": true
  },
  "logLevel": "debug"
}
`;

export const jsonConfig: Preset = {
  id: 'json-config',
  label: 'JSON Config',
  description: 'API endpoint, timeout and feature-flag changes in a configuration file.',
  original,
  modified,
  originalName: 'config.json',
  modifiedName: 'config.json',
};
