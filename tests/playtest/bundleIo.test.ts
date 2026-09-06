import { constants } from 'node:buffer';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

  // THE CALL-SITE GATE. The module above can be correct while a CLI still
  // calls `JSON.stringify(result.bundle)` — which is exactly how the run was
  // lost, and exactly what survived the first fix: it named `playtest.mjs` by
  // hand, and `playtest-llm.mjs` (three ceilings, on the path that costs model
  // spend before it throws) sat in a file this case never opened. It now scans
  // EVERY script.
  //
  // Bound, named. This is a SOURCE check — it reads the text of the scripts,
  // never a run of them — and it only knows the FOUR shapes below: a
  // `JSON.stringify` of a bundle, a `JSON.parse(readFileSync(...))` of one, a
  // bundle read from a path through a generic helper, and chunks rejoined with
  // `.join('')` before a parse. Keep this count in step with `FORBIDDEN`: a
  // header that describes less than the gate does is how a later reader deletes
  // a check believing it redundant. A bundle funnelled through a helper this
  // cannot see (a `readAll()` two modules away, a dynamic `fs[method]`) passes
  // it. It covers `scripts/*.mjs` only: `src/` and `tests/` are outside it.
  describe('no script builds a whole bundle as one string', () => {
    const scriptsDir = fileURLToPath(new URL('../../scripts/', import.meta.url));
    const scripts = readdirSync(scriptsDir)
      .filter((name) => name.endsWith('.mjs'))
      .sort();

    const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
      {
        // `JSON.stringify(result.bundle)` — the Node write that lost the run —
        // and `JSON.stringify(bundle)` — the same wall INSIDE the browser page,
        // where a Node-side writer cannot reach it.
        pattern: /JSON\.stringify\(\s*[\w.$]*[Bb]undle\b/,
        why: 'builds the whole bundle as one string; write it with writeBundleFile(path, bundle)',
      },
      {
        // The same wall on the way back in, which is worse: a bundle that was
        // written is then unreadable.
        pattern: /JSON\.parse\(\s*readFileSync\([^)]*[Bb]undle/,
        why: 'reads the whole bundle into one string; read it with readBundleFile(path)',
      },
      {
        // `const bundle = readJson(`${prefix}.json`)` — the same read hidden
        // behind a generic helper, which neither pattern above can see. A call
        // with NO argument is the legitimate in-page/in-memory fetch
        // (`getRecorderBundle()`, `buildContentBundle()`), so it is exempt.
        pattern: /\b(?:const|let|var)\s+bundle\s*=\s*(?!readBundleFile\b)[\w.$]+\(\s*[^)\s]/,
        why: 'reads a bundle from a path through something other than readBundleFile',
      },
      {
        // `JSON.parse(parts.join(''))` — chunks pulled safely across a
        // transport and then re-joined into one document-sized string, which
        // puts the cap back exactly where it was taken away.
        pattern: /JSON\.parse\(\s*[\w.$]+\.join\(/,
        why: 'rejoins chunks into one document-sized string; parse each piece on its own',
      },
    ];

    it.each(scripts)('%s', (name) => {
      const text = readFileSync(join(scriptsDir, name), 'utf8');
      const lines = text.split('\n');
      const offenders: string[] = [];
      for (const { pattern, why } of FORBIDDEN) {
        lines.forEach((line, index) => {
          // Skip the prose: every one of these shapes is quoted in a comment
          // somewhere explaining why it is forbidden.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (pattern.test(line)) {
            offenders.push(`scripts/${name}:${index + 1}: ${line.trim()}\n    ^ ${why}`);
          }
        });
      }
      expect(offenders.join('\n'), `scripts/${name} still holds a whole bundle as one string`).toBe('');
    });

    // Control: the patterns can still match, and the scan actually opened the
    // scripts. Without this, an empty listing or a regex broken into matching
    // nothing would report "no script is over the cap" for every file — "did
    // not run" read as "passed".
    it('the forbidden patterns still match the code they were written against', () => {
      expect(scripts.length).toBeGreaterThan(25);
      expect(scripts).toContain('playtest-llm.mjs');
      expect(scripts).toContain('playtest.mjs');
      const asItWas = [
        // Every line here is verbatim from a tree that shipped it.
        "    writeFileSync(`${args.out}.json`, JSON.stringify(result.bundle));",
        '        window.__AOE2_PLAYTEST_BUNDLE_TEXT__ = JSON.stringify(bundle);',
        "        return JSON.parse(parts.join(''));",
        "  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));",
        '  const bundle = readJson(`${prefix}.json`);',
      ];
      for (const line of asItWas) {
        expect(FORBIDDEN.some(({ pattern }) => pattern.test(line)), line).toBe(true);
      }
      // And they do NOT match the shapes that are correct.
      for (const line of [
        '  const bundle = readBundleFile(bundlePath);',
        '  writeBundleFile(`${args.out}.json`, result.bundle);',
        '  const bundle = buildContentBundle();',
        '  const bundle = window.__AOE2_TEST__.agent.getRecorderBundle();',
        "  const envelope = JSON.parse(readFileSync(`${out}.envelope.json`, 'utf8'));",
      ]) {
        expect(FORBIDDEN.some(({ pattern }) => pattern.test(line)), line).toBe(false);
      }
    });

    // The positive half: the two writers actually call the streaming writer.
    // The scan above only proves the bad shape is absent — a script that wrote
    // nothing at all would satisfy it.
    it.each([
      ['playtest.mjs', /writeBundleFile\(`\$\{args\.out\}\.json`, result\.bundle\)/],
      ['playtest-llm.mjs', /writeBundleFile\(`\$\{args\.out\}\.json`, result\.bundle\)/],
    ])('%s writes its bundle through writeBundleFile', (name, expected) => {
      expect(readFileSync(join(scriptsDir, name), 'utf8')).toMatch(expected);
    });
  });
});
