import type { WorldSnapshot } from 'civ-engine';
import { isDeepStrictEqual } from 'node:util';

export interface SnapshotCloneCounts { requests: number; cloned: number; reused: number }

// Test instrument only. World.serialize validates every value on every call.
// Reuse only a detached clone whose entire source still equals it. Capture the
// native comparator once to avoid Vitest's imported-export lookup per clone.
// Scope the wrapper to synchronous serialization, never simulation stepping.
export function createExactSnapshotSerializer(counts?: SnapshotCloneCounts) {
  const exactEqual = isDeepStrictEqual;
  const clones = new WeakMap<object, unknown>();
  return (world: { serialize(): WorldSnapshot }): WorldSnapshot => {
    const nativeClone = globalThis.structuredClone;
    globalThis.structuredClone = (value, options) => {
      if (counts) counts.requests++;
      if (options || value === null || typeof value !== 'object') {
        if (counts) counts.cloned++;
        return nativeClone(value, options);
      }
      const previous = clones.get(value);
      if (previous !== undefined && exactEqual(value, previous)) {
        if (counts) counts.reused++;
        return previous as typeof value;
      }
      if (counts) counts.cloned++;
      const detached = nativeClone(value);
      clones.set(value, detached);
      return detached;
    };
    try { return world.serialize(); } finally { globalThis.structuredClone = nativeClone; }
  };
}
