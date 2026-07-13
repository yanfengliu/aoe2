import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Spec 2 (annotation-ui v0.1.5): Vite aliases for Node-namespace imports
// that civ-engine exposes. node:crypto is needed at runtime by
// SessionRecorder; node:fs and node:path are present only because
// civ-engine's barrel re-exports FileSink and BundleCorpus, which aoe2
// does not use at runtime but Vite includes in the module graph
// (civ-engine's package.json doesn't declare `sideEffects: false`).
const nodeCryptoShim = fileURLToPath(new URL('./src/shims/node-crypto.ts', import.meta.url));
const nodeFsShim = fileURLToPath(new URL('./src/shims/node-fs.ts', import.meta.url));
const nodePathShim = fileURLToPath(new URL('./src/shims/node-path.ts', import.meta.url));

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  resolve: {
    // Local `voxel` is linked during development. Pin every import to the
    // consumer's Three instance so constructors/materials never cross copies.
    dedupe: ['three'],
    alias: {
      'node:crypto': nodeCryptoShim,
      'node:fs': nodeFsShim,
      'node:path': nodePathShim,
    },
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
    // Vitest inherits resolve.alias from this config above. Most files use
    // the default test environment (node); tests that need DOM (form / panel /
    // createApp / integration tests) opt in via the `// @vitest-environment jsdom`
    // pragma at the top of the file. This per-file approach avoids forcing
    // jsdom on every test.
    environment: 'node',
  },
});
