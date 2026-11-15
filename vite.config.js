import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

// Every folder in /exhibits with an index.html becomes its own page.
// To add a new exhibit: create exhibits/<id>/index.html and register it in src/content/story.js.
const root = import.meta.dirname;
const exhibitPages = Object.fromEntries(
  readdirSync(resolve(root, 'exhibits'), { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(root, 'exhibits', d.name, 'index.html')))
    .map(d => [d.name, resolve(root, 'exhibits', d.name, 'index.html')])
);

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: { input: { hub: resolve(root, 'index.html'), ...exhibitPages } },
    chunkSizeWarningLimit: 900,
  },
});
