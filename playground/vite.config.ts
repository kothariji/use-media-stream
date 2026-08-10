import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: alias straight at src/ instead of consuming the built lib —
// edits to the hook hot-reload here with no build step in between.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'use-media-stream': new URL('../src/index.ts', import.meta.url).pathname,
    },
  },
  server: { open: true },
});
