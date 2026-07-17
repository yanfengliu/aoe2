import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  resolve: {
    // Local `voxel` is linked during development. Pin every import to the
    // consumer's Three instance so constructors/materials never cross copies.
    dedupe: ['three'],
    // No `node:*` aliases here. civ-engine 2.4.1's `browser` export condition
    // resolves to a curated entry with no node builtins, so Vite never pulls
    // one into the graph; `tests/civEngineBrowserEntry.test.ts` pins that.
  },
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/civ-engine/')
            || id.includes('\\node_modules\\civ-engine\\')
          ) {
            return 'civ-engine';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    // The standalone vitest.config.ts mirrors shared resolve settings
    // explicitly. Most files use the default test environment (node); tests
    // that need DOM (form / panel / createApp / integration tests) opt in via
    // the `// @vitest-environment jsdom`
    // pragma at the top of the file. This per-file approach avoids forcing
    // jsdom on every test.
    environment: 'node',
  },
});
