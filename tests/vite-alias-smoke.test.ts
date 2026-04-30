// AO-1 smoke test: vitest must inherit Vite's `node:crypto` alias so
// civ-engine's SessionRecorder (which imports `randomUUID` from
// `node:crypto`) loads without a runtime resolution error. If this test
// fails, copy the `node:crypto` alias entry from `vite.config.ts` into
// the test config's resolve.alias.

import { describe, expect, it } from 'vitest';

describe('vite alias inheritance for node:crypto', () => {
  it('imports SessionRecorder from civ-engine without resolution failure', async () => {
    const { SessionRecorder } = await import('civ-engine');
    expect(SessionRecorder).toBeDefined();
    expect(typeof SessionRecorder).toBe('function');
  });

  it('the shim provides crypto.randomUUID', async () => {
    const { randomUUID } = await import('../src/shims/node-crypto.js');
    const id = randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
