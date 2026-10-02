/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Production builds ship a strict Content-Security-Policy. `connect-src 'none'`
 * makes the browser refuse every fetch/XHR/WebSocket/beacon, so user content
 * cannot be transmitted even by accident. Dev mode is excluded because Vite's
 * HMR client needs inline scripts and a WebSocket.
 */
function browserLocalCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'browser-local-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), browserLocalCsp()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
