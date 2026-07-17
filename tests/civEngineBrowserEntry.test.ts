// Why this test exists.
//
// aoe2 used to alias `node:crypto` / `node:fs` / `node:path` to hand-written
// stubs in `src/shims/` (deleted 2026-07-15). They were needed because
// civ-engine's single barrel re-exported node-only `FileSink` / `BundleCorpus`,
// so Vite pulled `node:fs` and `node:path` into the browser graph even though
// aoe2 never called them.
//
// civ-engine 2.4.1 fixed that upstream: `package.json` exports a curated
// `browser` condition (`dist/index.browser.js`) that omits both, and its
// `randomUUID` now comes from `globalThis.crypto` rather than `node:crypto`.
// The shims became dead weight and were removed.
//
// This test pins the invariant the removal depends on. It is deliberately NOT
// the test it replaced (`vite-alias-smoke.test.ts`), which imported the shim to
// assert the shim worked — a self-justifying loop that would have passed just
// as happily with the whole aliasing scheme obsolete, and which said "vitest
// must inherit Vite's alias" while `vitest.config.ts` declares no aliases at
// all (`node:crypto` resolves natively under the node test environment, so it
// could never have failed).
//
// The real risk is silent: if a future engine version reintroduces a node
// builtin into the browser graph, `vite build` only *warns* ("externalized for
// browser compatibility") and the app throws at runtime in the user's browser.
// This test turns that into a red gate at the dependency boundary.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const enginePackageJsonPath = require.resolve('civ-engine/package.json');
const engineRoot = dirname(enginePackageJsonPath);

/** Every relative module reachable from `entry`, following static imports. */
function reachableModules(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/(?:from|import)\s+'([^']+)'/g)) {
      if (spec!.startsWith('.')) walk(resolve(dirname(file), spec!));
    }
  };
  walk(entry);
  return [...seen];
}

/** `node:*` specifiers imported by any module reachable from `entry`. */
function nodeBuiltinImports(entry: string): string[] {
  const found: string[] = [];
  for (const file of reachableModules(entry)) {
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s+'(node:[^']+)'/g)) {
      found.push(`${file.slice(engineRoot.length + 1).replace(/\\/g, '/')} -> ${spec}`);
    }
  }
  return found;
}

describe('civ-engine browser entry stays free of node builtins', () => {
  it('declares a browser export condition', () => {
    const pkg = JSON.parse(readFileSync(enginePackageJsonPath, 'utf8')) as {
      exports?: Record<string, { browser?: { default?: string } }>;
    };
    // Without this condition Vite resolves the node barrel and drags
    // FileSink/BundleCorpus (and their node builtins) into the browser bundle.
    expect(pkg.exports?.['.']?.browser?.default).toBe('./dist/index.browser.js');
  });

  it('imports no node builtin anywhere in the browser entry graph', () => {
    const entry = resolve(engineRoot, 'dist/index.browser.js');
    expect(existsSync(entry)).toBe(true);

    // A hit here means `vite build` will externalize that builtin with only a
    // warning and the app will throw in the browser. Either the engine
    // regressed, or aoe2 needs its shims + Vite aliases back.
    expect(nodeBuiltinImports(entry)).toEqual([]);
  });

  it('omits the node-only sinks from the browser surface but keeps the recorder', async () => {
    const browserEntry = (await import('civ-engine/browser')) as Record<string, unknown>;
    expect(browserEntry.FileSink).toBeUndefined();
    expect(browserEntry.BundleCorpus).toBeUndefined();
    // SessionRecorder is the reason the node:crypto alias existed; it must
    // still resolve from the browser entry without one.
    expect(typeof browserEntry.SessionRecorder).toBe('function');
  });
});
