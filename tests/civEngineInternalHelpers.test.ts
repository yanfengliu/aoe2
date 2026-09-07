// Why this test exists.
//
// Six civ-engine helpers would save aoe2 real hand-rolled code if they were
// callable: `applyTickDiff`, `foldTickDiffs`, `emptyTickDiff`,
// `assertBundleShape`, `validateBundleMarkers`, `cloneTickDiff`. None of them
// is reachable. They are engine-internal — the engine's own header on
// `src/apply-tick-diff.ts` says so in as many words, "Internal (not exported
// from src/index.ts)" — and all six appear zero times in that barrel
// (`grep -c` over `../civ-engine/src/index.ts`, 2026-09-06: 0, exit 1).
//
// This file is a TRIPWIRE, not a rule. It goes red the day the engine promotes
// one of them, and that red is the signal aoe2 wants: a capability this repo
// has been working around became available. Every failure message says which
// workaround it retires. Do not delete the test to get green; delete the
// promoted name from INTERNAL_HELPERS in the same change that starts using it.
//
// THE TRAP IT CLOSES — and the reason it is worth a file. Those internal
// declaration files DO ship to npm: civ-engine's `package.json` puts `dist`
// first in `files` and the package has no `.npmignore`, so every emitted
// declaration ships, not just the entry points — `apply-tick-diff.d.ts`,
// `session-replayer-guards.d.ts`, `session-replayer-markers.d.ts`,
// `bundle-viewer-internal.d.ts` and `world-internal.d.ts` all sit in any
// consumer's `node_modules`, findable by a text search and unreachable by an
// import — the `exports` map publishes only `.`, `./browser` and
// `./package.json`. On 2026-09-06 one worker grepped `node_modules` and
// reported all six present; another imported and reported all six absent. Both
// looked; only one measured the thing that matters. So this file IMPORTS. If a
// later reader is tempted to answer "is this exported?" by reading a file's
// text, that is the cheap check, and it is the wrong one.
//
// THE BOUND — what a green run here does NOT prove.
//
//  - It is about the RUNTIME export surface of two barrels and nothing else.
//    The type surface is not asserted here and cannot be: a static
//    `import { applyTickDiff } from 'civ-engine'` would make `tsc --noEmit` red
//    today, so a file that must compile cannot hold that assertion. `npx tsc
//    --noEmit` refusing such an import is the proof for the type half.
//  - It says NOTHING about whether the behaviour those helpers implement is
//    reachable another way. It is: `snapshotAtTick`, `diffBundles`,
//    `SessionReplayer` and `BundleViewer` are public, they are the supported
//    route, and PUBLIC_CONTROL below asserts they are really there.
//  - Without those controls it could not tell "passed" from "did not run", and
//    that is measured, not assumed: aliased against a barrel that loads and
//    exports nothing, all six absence cases PASS vacuously and only the
//    instrument check and the four controls go red (2026-09-06: 5 failed, 6
//    passed, exit 1). The six are the tripwire; the five are what keep it alive.
//  - It is pinned to ONE installed engine version. The bound was established
//    against civ-engine 2.4.1. The version is not asserted (a bump is not a
//    promotion and should not be reported as one) but every failure message
//    carries the version actually measured.
//  - It measures a LINKED build, not an installed one. `civ-engine` is a
//    `file:../civ-engine` dependency, so `node_modules/civ-engine` is a symlink
//    to the sibling checkout, whose `dist/` is gitignored (`../civ-engine/
//    .gitignore:5`) and is therefore that checkout's own local `tsc` output.
//    The 2026-09-06 investigation reported it byte-equivalent to a fresh
//    install; that was NOT re-measured here. CI resolves through the same link
//    but fills it from the rolling `engine-dist` tarball
//    (`.github/workflows/ci.yml:76-81`), so CI and a developer machine can be
//    two different sets of bytes making the same claim. Each failure message
//    says which of the two it read.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const enginePackageJsonPath = require.resolve('civ-engine/package.json');
const engineVersion = (JSON.parse(readFileSync(enginePackageJsonPath, 'utf8')) as { version: string })
  .version;

const slashes = (path: string): string => path.replace(/\\/g, '/');

/**
 * `civ-engine 2.4.1 (linked build: C:/…/civ-engine)` or `(installed copy)`.
 *
 * Goes into every failure message so a red run says which bytes it read. A
 * linked sibling checkout and an installed tarball make the same claim about
 * the same version, and only one of them is what CI measures. Reported, never
 * asserted: a fresh install is a real directory and must not read as red.
 */
function describeInstall(): string {
  const installPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'civ-engine');
  if (!existsSync(installPath)) return `civ-engine ${engineVersion} (install path not found)`;
  const real = slashes(realpathSync(installPath));
  const linked = real !== slashes(installPath);
  return `civ-engine ${engineVersion} (${linked ? `linked build: ${real}` : 'installed copy'})`;
}

interface InternalHelper {
  /** The export name the engine has not promoted. */
  readonly name: string;
  /** Where it lives in the engine, so a reader can go check the promotion. */
  readonly engineSource: string;
  /** What promoting it would unblock HERE. This is the point of the red. */
  readonly unblocks: string;
}

const INTERNAL_HELPERS: readonly InternalHelper[] = [
  {
    name: 'applyTickDiff',
    engineSource: '../civ-engine/src/apply-tick-diff.ts:23',
    unblocks:
      'src/game/playtest/positionReplay.ts:41-63 hand-folds ONE component out of '
      + '`tickEntry.diff.components` through two `Record<string, unknown>` casts, because the '
      + 'TickDiff shape is not on the public surface. A public applyTickDiff replaces the cast '
      + 'and the loop body with a typed call.',
  },
  {
    name: 'foldTickDiffs',
    engineSource: '../civ-engine/src/bundle-viewer-internal.ts:63',
    unblocks:
      '`reconstructPositions` in src/game/playtest/positionReplay.ts IS a single-component '
      + 'foldTickDiffs, written out by hand over `bundle.ticks`. A public fold replaces the '
      + 'whole walk and stops every future oracle re-deriving the same fold.',
  },
  {
    name: 'emptyTickDiff',
    engineSource: '../civ-engine/src/bundle-viewer-internal.ts:41',
    unblocks:
      'No aoe2 site today — this one is the constructor half of the fold above. Without it, a '
      + 'fixture or test that needs a zero diff has to hand-write the TickDiff shape, which is '
      + 'exactly the private shape positionReplay.ts already casts its way into.',
  },
  {
    name: 'assertBundleShape',
    engineSource: '../civ-engine/src/session-replayer-guards.ts:22',
    unblocks:
      'src/game/replay/replayControllerHelpers.ts:101-109 hand-rolls a bundle-shape guard and '
      + "throws the engine's own public BundleIntegrityError itself, because the engine's "
      + 'checker is unreachable. A public assertBundleShape makes that guard the engine\'s '
      + 'problem and covers the fields aoe2 never thought to check.',
  },
  {
    name: 'validateBundleMarkers',
    engineSource: '../civ-engine/src/session-replayer-markers.ts:11',
    unblocks:
      'MarkerValidationError IS a public export while its validator is not, so aoe2 can catch '
      + 'the failure and cannot run the check. `injectAgentMarkers` in '
      + 'src/game/playtest/findingsToMarkers.ts:117-126 builds a whole new marker set onto a '
      + 'bundle and has no way to validate what it just wrote.',
  },
  {
    name: 'cloneTickDiff',
    engineSource: '../civ-engine/src/world-internal.ts:149',
    unblocks:
      'No aoe2 site today. The repo reaches for bare `structuredClone` when it has to decouple '
      + 'engine state before mutating (src/game/simulation/bridge/bridgeStateAccessor.ts); a '
      + 'typed, diff-aware clone is the version that survives a TickDiff shape change.',
  },
];

/**
 * Public helpers over the same recorded-bundle behaviour.
 *
 * Two jobs. (1) They are the answer to "so how DO I do this today" — the
 * supported route the internals above are not needed for. (2) They are this
 * test's instrument check: if a barrel ever failed to load or came back empty,
 * every `toBeUndefined()` below would pass for the wrong reason and the
 * tripwire would be silently dead. These make that state red instead.
 */
const PUBLIC_CONTROL = ['snapshotAtTick', 'diffBundles', 'SessionReplayer', 'BundleViewer'] as const;

function promotionMessage(helper: InternalHelper, entry: string): string {
  return [
    '',
    `GOOD NEWS, NOT A BUG: ${describeInstall()} now exports \`${helper.name}\` from '${entry}'.`,
    '',
    'This test exists to tell you exactly this. A capability aoe2 has been working around is',
    'now available:',
    `  ${helper.unblocks}`,
    `  Engine source: ${helper.engineSource}`,
    '',
    `Next step is the engine, not this file: use \`${helper.name}\`, delete the workaround, and`,
    'remove its entry from INTERNAL_HELPERS in the same change. Deleting the test instead',
    'throws away the notice for the other five.',
    '',
  ].join('\n');
}

describe('civ-engine internal helpers stay unreachable (tripwire)', () => {
  it('loads both barrels, and they are the two distinct surfaces', async () => {
    const nodeEntry = (await import('civ-engine')) as Record<string, unknown>;
    const browserEntry = (await import('civ-engine/browser')) as Record<string, unknown>;

    // A namespace that came back empty would make every absence assertion below
    // pass vacuously. Read the counts before trusting any of them.
    expect(Object.keys(nodeEntry).length).toBeGreaterThan(100);
    expect(Object.keys(browserEntry).length).toBeGreaterThan(100);

    // And prove they are two different builds rather than the same file twice:
    // FileSink is node-only and the browser condition drops it. Without this,
    // a resolver that served the browser barrel for both specifiers would look
    // like full coverage while only one surface was ever measured.
    expect(typeof nodeEntry.FileSink).toBe('function');
    expect(browserEntry.FileSink).toBeUndefined();
  });

  it.each(PUBLIC_CONTROL)(
    'control: %s is public on both barrels, so an absence below means absence',
    async (name) => {
      const nodeEntry = (await import('civ-engine')) as Record<string, unknown>;
      const browserEntry = (await import('civ-engine/browser')) as Record<string, unknown>;

      expect(typeof nodeEntry[name]).toBe('function');
      expect(typeof browserEntry[name]).toBe('function');
    },
  );

  it.each(INTERNAL_HELPERS.map((helper) => [helper.name, helper] as const))(
    '%s is not a runtime export of either barrel',
    async (_name, helper) => {
      const nodeEntry = (await import('civ-engine')) as Record<string, unknown>;
      const browserEntry = (await import('civ-engine/browser')) as Record<string, unknown>;

      // Both halves matter. `Object.keys` on a module namespace is the
      // definitive "is this name exported"; the typeof check is what a caller
      // would actually trip over. A promotion flips both.
      expect(Object.keys(nodeEntry), promotionMessage(helper, 'civ-engine')).not.toContain(
        helper.name,
      );
      expect(nodeEntry[helper.name], promotionMessage(helper, 'civ-engine')).toBeUndefined();

      expect(
        Object.keys(browserEntry),
        promotionMessage(helper, 'civ-engine/browser'),
      ).not.toContain(helper.name);
      expect(
        browserEntry[helper.name],
        promotionMessage(helper, 'civ-engine/browser'),
      ).toBeUndefined();
    },
  );
});
