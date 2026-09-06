import { constants } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readBundleFile, writeBundleFile } from '../../src/game/playtest/bundleIo';

// What these bound:
//
// The payloads here are SYNTHETIC. They prove the serializer — that a bundle
// whose JSON is larger than V8's max string length survives a write and a read
// — and they prove nothing about the simulation that produces one. A recorded
// 30,000-tick run is the only thing that proves the simulation still records;
// that is `npm run playtest` + `npm run replay:inspect`, not this file.
//
// The oversized case is sized from `buffer.constants.MAX_STRING_LENGTH` at run
// time, not from a baked-in number, so it keeps crossing the cap if a future
// Node moves it. Its control assertions (the old `JSON.stringify` /
// `readFileSync(utf8)` path must throw on the same payload) are what stop this
// test from reporting "did not run" as "passed": a payload that quietly fell
// under the cap fails there instead of passing everywhere.

const MAX_STRING = constants.MAX_STRING_LENGTH;

function smallBundle(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'abc-123',
      engineVersion: '1.2.3',
      startTick: 0,
      endTick: 2,
      persistedEndTick: 2,
      durationTicks: 2,
      sourceKind: 'synthetic',
      sourceLabel: 'aoe2-playtest-"quoted"\\backslash\ttab',
    },
    initialSnapshot: { entities: [{ id: 1, components: { position: { x: 1.5, y: -2.25 } } }] },
    ticks: [
      { tick: 0, diff: { created: [], updated: [[1, 'position', { x: 0, y: 0 }]] }, events: [], metrics: null, debug: null },
      { tick: 1, diff: { created: [[2, {}]], updated: [] }, events: [{ type: 'unit-died', data: { id: 2 } }], metrics: { entities: 2 }, debug: null },
      { tick: 2, diff: {}, events: [], metrics: null, debug: { note: 'unicode: é 漢 🏹, escapes: \n \\ " \u0001' } },
    ],
    commands: [],
    executions: [{ ok: true, values: [1, -2, 3.5, 1e21, 0.1] }],
    failures: [],
    snapshots: [{ tick: 0, snapshot: { nested: { deep: [[[{ a: null }]]] } } }],
    markers: [],
    attachments: [],
  };
}

describe('bundle file IO', () => {
  it('writes exactly what JSON.stringify would write, and reads it back unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-bundleio-small-'));
    try {
      const path = join(dir, 'run.json');
      const bundle = smallBundle();
      writeBundleFile(path, bundle);

      // Byte-identical output is what keeps the format claim true: nothing
      // downstream (the engine's SessionReplayer, jq, a browser) has to learn a
      // new shape, and a bundle written before this change is the same file.
      expect(readFileSync(path, 'utf8')).toBe(JSON.stringify(bundle));
      expect(readBundleFile(path)).toEqual(bundle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads a bundle that JSON.stringify wrote (bundles recorded before the streaming writer)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-bundleio-legacy-'));
    try {
      const path = join(dir, 'legacy.json');
      const bundle = smallBundle();
      writeFileSync(path, JSON.stringify(bundle, null, 2)); // pretty-printed, as v0.2.x wrote them
      expect(readBundleFile(path)).toEqual(bundle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips the JSON shapes a scanner can get wrong', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-bundleio-shapes-'));
    try {
      const path = join(dir, 'shapes.json');
      const bundle = {
        emptyArray: [],
        emptyObject: {},
        // Braces, brackets, commas, colons and escaped quotes inside strings:
        // every one of them is a structural byte the scanner must not act on.
        stringsWithStructure: ['{"a":1}', '[,]', 'he said \\"hi\\"', 'tail\\', ''],
        'key with "quotes" and \\ backslash': 'value',
        scalars: [0, -0.5, 1e-7, 12345678901234, true, false, null],
        deepNesting: [{ a: [{ b: [{ c: [1, [2, [3]]] }] }] }],
        trailingScalar: 42,
      };
      writeBundleFile(path, bundle);
      expect(readFileSync(path, 'utf8')).toBe(JSON.stringify(bundle));
      expect(readBundleFile(path)).toEqual(bundle);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names the file and the offset when a bundle is truncated', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aoe2-bundleio-truncated-'));
    try {
      const path = join(dir, 'truncated.json');
      const text = JSON.stringify(smallBundle());
      writeFileSync(path, text.slice(0, Math.floor(text.length / 2)));
      expect(() => readBundleFile(path)).toThrow(/truncated/);
      expect(() => readBundleFile(path)).toThrow(/truncated\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // THE GATE. A bundle whose JSON crosses V8's max string length: the write
  // that lost a whole 30,000-tick run, and the read that would have lost it
  // again on the way back in.
  it(
    'writes and reads a bundle whose JSON is larger than V8 can hold in one string',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'aoe2-bundleio-oversized-'));
      try {
        const path = join(dir, 'oversized.json');
        const chunkChars = 8 * 1024 * 1024;
        // One shared string, referenced many times: the payload costs 8 MB of
        // heap, not 550 MB, and still serializes past the cap.
        const blob = 'x'.repeat(chunkChars);
        const entryCount = Math.floor(MAX_STRING / chunkChars) + 3;
        const bundle = {
          schemaVersion: 1,
          metadata: { sessionId: 'oversized', startTick: 0, endTick: entryCount },
          ticks: Array.from({ length: entryCount }, (_, tick) => ({ tick, blob })),
          markers: [],
        };

        writeBundleFile(path, bundle);
        const bytes = statSync(path).size;
        // Control: the payload really is past the cap. Without this a payload
        // that silently shrank would pass this test while checking nothing.
        expect(bytes).toBeGreaterThan(MAX_STRING);

        // Control: the code this replaced throws on this exact payload — the
        // reported defect, both directions.
        expect(() => JSON.stringify(bundle)).toThrow(/Invalid string length/);
        expect(() => readFileSync(path, 'utf8')).toThrow(/string longer than|Invalid string length/);

        // And the streaming pair round-trips it.
        const read = readBundleFile<typeof bundle>(path);
        expect(read.ticks).toHaveLength(entryCount);
        expect(read.ticks[0]?.blob.length).toBe(chunkChars);
        expect(read.ticks.at(-1)?.tick).toBe(entryCount - 1);
        expect(read.metadata).toEqual(bundle.metadata);
        expect(read.markers).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    180_000,
  );

  it('has the playtest CLI write its bundle through the streaming writer', () => {
    // The module above can be correct while the CLI still calls
    // `JSON.stringify(result.bundle)` — which is exactly how the run was lost.
    // This binds the call site, and is a source check: it sees the text of the
    // script, not a run of it.
    const script = readFileSync(fileURLToPath(new URL('../../scripts/playtest.mjs', import.meta.url)), 'utf8');
    expect(script).toMatch(/writeBundleFile\(`\$\{args\.out\}\.json`, result\.bundle\)/);
    expect(script).not.toMatch(/JSON\.stringify\(result\.bundle\)/);
  });
});
