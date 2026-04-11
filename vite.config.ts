import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/') || id.includes('\\node_modules\\phaser\\')) {
            return 'phaser';
          }

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
});
