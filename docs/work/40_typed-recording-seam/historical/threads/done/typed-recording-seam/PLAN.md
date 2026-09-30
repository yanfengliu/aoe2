# Adopt engine 1.2.0 typed-recording generics — remove the toEngineWorld/fromEngineWorld seam at the recorder/replayer boundary

> **For agentic workers:** this is a TYPE-ONLY refactor. The real gate is `npm run typecheck`. No behavior change, no version bump, no changelog entry (AGENTS.md scopes bumps/changelog to user-visible behavior; this is type-safety hardening).

**Goal:** Pass `GameWorld` directly through `SessionRecorder` and the `SessionReplayer` replay path by inference, deleting `fromEngineWorld` and shrinking `toEngineWorld` to only the boundaries that genuinely still need it (`WorldDebugger` / `RenderAdapter`), restoring component-type safety on recorded/replayed worlds.

**Architecture:** civ-engine 1.2.0 threaded `TComponents`/`TState` through `SessionRecorder`, `SessionRecorderConfig`, `SessionReplayer`, and `ReplayerConfig` (verified in `../civ-engine/dist/*.d.ts`). So a component-typed world is now *inferred* through those classes with no cast, and `replayer.openAt(t)` returns a registry-typed world when the `worldFactory` returns `GameWorld`. `WorldDebugger` and `RenderAdapter` were NOT threaded (changelog "out of scope"); they still type `world` as the default-generic `World<TEventMap, TCommandMap>`, and `World`'s `TComponents` is invariant in 1.2.0, so `GameWorld` is not assignable there — `toEngineWorld` survives for exactly those four call sites.

**Tech Stack:** TypeScript (strict), civ-engine 1.2.0 (symlinked, `dist/index.d.ts`), vitest 3.2.6.

---

## Design & Findings (verified against the codebase + engine d.ts)

**What 1.2.0 actually threaded (changelog + `dist/`):** `SessionRecorder<…, TComponents, TState>`, `SessionRecorderConfig` (`world: World<TEventMap, TCommandMap, TComponents, TState>`), `SessionReplayer`, `ReplayerConfig` (`worldFactory: (s) => World<TEventMap, TCommandMap, TComponents, TState>`), `AgentDriver`/`AgentDriverContext`. **NOT threaded** (explicitly out of scope): `toBundle()` (stays `SessionBundle`), `ForkBuilder`, `BundleViewer`, **`WorldDebugger`**, **`RenderAdapter`**.

**Complete seam call-site map** (repo-wide `git grep`, NOT just the task's stated list):

| File | Line(s) | Boundary | Disposition |
|---|---|---|---|
| `src/game/simulation/bridge/pureHelpers.ts` | 63–69 | defines `EngineDefaultWorld`, `toEngineWorld`, `fromEngineWorld` | **Delete `fromEngineWorld`; keep `toEngineWorld`+`EngineDefaultWorld`; rewrite comment** |
| `src/game/playtest/runPlaytest.ts` | 3, 21 | `SessionRecorder` | drop `toEngineWorld` → `world: bridge.world` |
| `src/game/replay/ReplayController.ts` | 25, 36, 183, 408, 411, 413 | `SessionReplayer` | retype `ReplayReplayer`; drop both helpers |
| `src/game/simulation/createSimulationBridge.ts` | 9, 279, 281 | `WorldDebugger` + `RenderAdapter` | **keep `toEngineWorld`** |
| `src/game/simulation/replay/makeReplayBridge.ts` | 11, 62, 64 | `WorldDebugger` + `RenderAdapter` | **keep `toEngineWorld`** |
| `scripts/replay-inspect.mjs` | 20, 51, 70, 102 | `SessionReplayer` | drop both (mandatory: deleting `fromEngineWorld` breaks the ESM import) |
| `tests/replay/replayCommandHelpers.ts` | 15, 41/42, 71/72, 105/106 | `SessionRecorder` (explicit `<E,C>`!) | drop cast **and** explicit type args |
| `tests/replay/roundTripViaCommands.test.ts` | 6, 24, 26, 43, 45, 61, 63 | `SessionReplayer` | drop both helpers |
| `tests/replay/makeReplayBridge.fogOwner.test.ts` | 14–15, 23, 26 | `SessionReplayer` | drop both helpers |
| `tests/replay/ReplayController.test.ts` | 13, 207, 278 | `SessionReplayer` | drop `toEngineWorld` |

**Gotchas that make a naive find-replace fail:**

1. **Full inference only.** `replayCommandHelpers.ts` calls `new SessionRecorder<GameEvents, GameCommands>({ world: toEngineWorld(bridge.world) })`. Just removing the cast leaves the explicit `<GameEvents, GameCommands>`, which defaults `TComponents` back to `Record<string, unknown>`; then `GameWorld` is not assignable to the config's `world` (invariance). **Must remove the explicit type args too** → `new SessionRecorder({ world: bridge.world })`.
2. **`toBundle()` stays default-generic.** The `recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>` casts in `replayCommandHelpers.ts` (lines 65/99/132) are a SEPARATE seam (the engine deliberately left `toBundle` returning `SessionBundle`). They are orthogonal to this task — **do NOT touch them**.
3. **Bundle drives E/C; worldFactory drives TComponents.** Every replay site here uses a `bundle: SessionBundle<GameEvents, GameCommands>` (ReplayController's `ReplayBundle`, and `RecordedCommandFixture.bundle`), so E/C = GameEvents/GameCommands and the `worldFactory` returning `GameWorld` makes `openAt` return exactly `GameWorld`. No widening needed at these sites. (If a future site used a default-generic bundle, `openAt` would be `World<defaultE, defaultC, GameComponents>` — accept the inferred type then, don't cast.)
4. **`ReplayReplayer` retype needs `TComponents`, and `TDebug` (`JsonValue`) is not exported.** `openAt(): World<TEventMap, TCommandMap, TComponents, TState>` — to make it return `GameWorld`, `ReplayReplayer` must carry `GameComponents` (the 4th type arg), which forces naming the 3rd (`TDebug`). `JsonValue` is not in the civ-engine barrel, so recover it from the bundle via conditional `infer`.
5. **`WorldDebugger`/`RenderAdapter` casts are structural, not removable.** They take `World<TEventMap, TCommandMap>` (no `TComponents` param) and `World`'s `TComponents` is invariant in 1.2.0 → `GameWorld` is not assignable. `toEngineWorld` is the right, minimal tool there; keep it and update its comment.

**Verified facts:** `SimulationBridge.world: GameWorld` (createSimulationBridge.ts:66) → `bridge.world` infers cleanly. `createReplayWorldOnly(): GameWorld` (createReplayWorldOnly.ts:20). `World<E,C,TComponents=Record<string,unknown>,TState=Record<string,unknown>>` so `World<GameEvents,GameCommands,GameComponents,Record<string,unknown>>` IS `GameWorld`. tsconfig `include` covers `tests/` and `scripts/**/*.mjs`, so `tsc --noEmit` enforces the type-contract test and would surface the broken `.mjs` import.

## File structure (created / modified)

- **Modify** `src/game/simulation/bridge/pureHelpers.ts` — delete `fromEngineWorld`, rewrite the seam comment.
- **Modify** `src/game/playtest/runPlaytest.ts` — recorder world, drop import.
- **Modify** `src/game/replay/ReplayController.ts` — `ReplayReplayer` retype, worldFactory, two `openAt` sites, imports.
- **Modify** `scripts/replay-inspect.mjs` — drop helper wraps + import.
- **Modify** `tests/replay/replayCommandHelpers.ts` — recorders (cast + explicit args), drop import.
- **Modify** `tests/replay/roundTripViaCommands.test.ts` — replay sites, drop import.
- **Modify** `tests/replay/makeReplayBridge.fogOwner.test.ts` — replay sites, drop helpers from import (keep type imports).
- **Modify** `tests/replay/ReplayController.test.ts` — two replay sites, drop import.
- **Create** `tests/replay/typedRecordingSeam.test.ts` — compile-time contract test (the TDD vehicle for a type-only change).
- **Unchanged on purpose** `src/game/simulation/createSimulationBridge.ts`, `src/game/simulation/replay/makeReplayBridge.ts` — `toEngineWorld` stays (WorldDebugger/RenderAdapter).

Ordering keeps `tsc` green after each group by deleting `fromEngineWorld` LAST (every consumer stops using it first).

---

### Task 1: Type-contract test (failing-first)

**Files:**
- Create: `tests/replay/typedRecordingSeam.test.ts`

- [ ] **Step 1: Write the contract test**

```ts
// Engine 1.2.0 typed-recording adoption: the toEngineWorld/fromEngineWorld cast
// seam was removed at the SessionRecorder / SessionReplayer boundary. The two
// `_*` functions below are COMPILE-TIME contract assertions — never executed,
// but type-checked by `npm run typecheck` (tsconfig includes tests/). They fail
// if TComponents ever re-erases to Record<string, unknown> at this boundary (a
// stray explicit <E,C> type arg, a re-introduced cast, or an engine regression).
import { describe, it, expect } from 'vitest';
import { SessionRecorder } from 'civ-engine';

import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { ReplayReplayer } from '../../src/game/replay/ReplayController';

// A component-typed GameWorld flows into SessionRecorder by INFERENCE — no cast,
// no explicit type args. Explicit <GameEvents, GameCommands> would default
// TComponents to Record<string, unknown> and reject GameWorld (invariance).
function _recorderAcceptsTypedWorld(world: GameWorld) {
  return new SessionRecorder({ world });
}

// ReplayReplayer.openAt returns a component-typed GameWorld, not the erased
// default-component world. Assignability to GameWorld fails under TComponents
// invariance the moment the registry is erased.
function _openAtReturnsTypedWorld(replayer: ReplayReplayer): GameWorld {
  return replayer.openAt(0);
}

describe('engine 1.2.0 typed recording/replay seam', () => {
  it('exposes the typed-world contract (assertions are compile-time)', () => {
    expect(typeof _recorderAcceptsTypedWorld).toBe('function');
    expect(typeof _openAtReturnsTypedWorld).toBe('function');
  });
});
```

- [ ] **Step 2: Confirm it fails typecheck (red)**

Run: `npm run typecheck`
Expected: FAIL — `_openAtReturnsTypedWorld` errors because the current `ReplayReplayer = SessionReplayer<GameEvents, GameCommands>` has `TComponents = Record<string, unknown>`, so `openAt(0)` returns a `World<…, Record<string, unknown>>` that is not assignable to `GameWorld` (invariance). (`_recorderAcceptsTypedWorld` already passes — the engine accepts a typed world; it is a regression guard.)

### Task 2: ReplayController — retype ReplayReplayer + drop the seam

**Files:**
- Modify: `src/game/replay/ReplayController.ts:25` (import), `:36` (ReplayReplayer), `:183`, `:408`, `:411`, `:413`

- [ ] **Step 1: Drop the seam import; add `GameComponents`**

Replace line 25 `import { fromEngineWorld, toEngineWorld } from '../simulation/bridge/pureHelpers';` — delete it. In the type import block (lines 20–24) add `GameComponents`:

```ts
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../simulation/bridge/pureHelpers';
```

- [ ] **Step 2: Retype `ReplayReplayer` to carry `GameComponents`**

Replace line 36 `export type ReplayReplayer = SessionReplayer<GameEvents, GameCommands>;` with:

```ts
// `openAt` returns `World<TEventMap, TCommandMap, TComponents, TState>`; pinning
// TComponents = GameComponents is what makes a replayed world registry-typed
// (engine 1.2.0). TDebug (the 3rd arg) is the engine-internal JsonValue, not
// exported, so recover it from the bundle type instead of naming it.
type ReplayBundleDebug =
  ReplayBundle extends SessionBundle<GameEvents, GameCommands, infer TDebug> ? TDebug : never;
export type ReplayReplayer = SessionReplayer<GameEvents, GameCommands, ReplayBundleDebug, GameComponents>;
```

(`ReplayBundle` is declared on line 35 just above; `SessionBundle` is already imported on line 5.)

- [ ] **Step 3: Drop `fromEngineWorld` at the scrub-open site (line 183)**

```ts
    const world = current.replayer.openAt(targetTick);
```

- [ ] **Step 4: Drop the worldFactory `toEngineWorld` wrap + the `as ReplayReplayer` cast (lines 398–411)**

The `worldFactory` local (line 99, `config.worldFactory ?? createReplayWorldOnly`) already returns `GameWorld`. Pass it directly; with the bundle typed `ReplayBundle` and the factory returning `GameWorld`, `fromBundle` infers exactly `ReplayReplayer`, so the cast is redundant:

```ts
      const replayer = SessionReplayer.fromBundle(
        bundle,
        // skipRegistrationCheck (civ-engine v0.8.18 absorb): aoe2's
        // replay factory is DELIBERATELY instrumented — replay mode
        // swaps in replay-safe AI-decision systems and registers
        // aoe2ReplayPendingCommandDrain (see registerAllSystems), so
        // its registration manifest intentionally differs from the
        // live recording world. The engine's escape hatch exists for
        // exactly this case; selfCheck remains the divergence backstop.
        {
          worldFactory,
          skipRegistrationCheck: true,
        },
      );
```

- [ ] **Step 5: Drop `fromEngineWorld` at the enterReplay open site (line 413)**

```ts
      const world = replayer.openAt(targetTick);
```

- [ ] **Step 6: Verify typecheck (green for ReplayController + Task 1)**

Run: `npm run typecheck`
Expected: PASS. Task 1's `_openAtReturnsTypedWorld` now compiles (ReplayReplayer.openAt → GameWorld). `fromEngineWorld`/`toEngineWorld` still exist in pureHelpers (deleted later), so no other file breaks yet.

### Task 3: runPlaytest — recorder takes GameWorld directly

**Files:**
- Modify: `src/game/playtest/runPlaytest.ts:3` (import), `:21`

- [ ] **Step 1: Delete the import (line 3)**

Remove `import { toEngineWorld } from '../simulation/bridge/pureHelpers';`.

- [ ] **Step 2: Pass the world directly (line 21)**

```ts
  const recorder = new SessionRecorder({
    world: bridge.world,
    sink,
    sourceLabel: `aoe2-playtest-${seed}`,
    sourceKind: 'synthetic',
  });
```

`bridge.world` is `GameWorld`; inference gives `SessionRecorder<GameEvents, GameCommands, JsonValue, GameComponents>`. `recorder.toBundle()` (line 96) still returns default-generic `SessionBundle` — `RunPlaytestResult.bundle` already accepts that, so no downstream break (gotcha #2).

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck` — Expected: PASS.

### Task 4: Tests — replayCommandHelpers (full inference, gotcha #1)

**Files:**
- Modify: `tests/replay/replayCommandHelpers.ts:15` (import), `:41-42`, `:71-72`, `:105-106`

- [ ] **Step 1: Delete the `toEngineWorld` value import (line 15)**

Remove `import { toEngineWorld } from '../../src/game/simulation/bridge/pureHelpers';`. Keep the `type { GameCommands, GameEvents }` import (lines 11–14) — still used by `RecordedCommandFixture.bundle` (line 21).

- [ ] **Step 2: Remove the explicit type args AND the cast at all three recorders**

For each of the three fixtures (lines 41–42, 71–72, 105–106), change:

```ts
  const recorder = new SessionRecorder<GameEvents, GameCommands>({
    world: toEngineWorld(bridge.world),
```

to:

```ts
  const recorder = new SessionRecorder({
    world: bridge.world,
```

Leave every other recorder option and the `recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>` returns (lines 65/99/132) UNCHANGED — those are the orthogonal `toBundle` seam (gotcha #2).

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck` — Expected: PASS. (Removing the explicit `<E,C>` is what lets `world: bridge.world` infer `TComponents = GameComponents`; leaving them would error.)

### Task 5: Tests — roundTripViaCommands

**Files:**
- Modify: `tests/replay/roundTripViaCommands.test.ts:6` (import), `:24`, `:26`, `:43`, `:45`, `:61`, `:63`

- [ ] **Step 1: Delete the seam import (line 6)**

Remove `import { fromEngineWorld, toEngineWorld } from '../../src/game/simulation/bridge/pureHelpers';`.

- [ ] **Step 2: Unwrap each worldFactory + each openAt (three identical blocks)**

In each of the three `it` blocks change:

```ts
    const replayer = SessionReplayer.fromBundle(
      bundle,
      { worldFactory: (snapshot) => createReplayWorldOnly(snapshot), skipRegistrationCheck: true },
    );
    const replayWorld = replayer.openAt(bundle.metadata.endTick);
```

(i.e. drop `toEngineWorld(` … `)` around `createReplayWorldOnly(snapshot)`, and drop `fromEngineWorld(` … `)` around `replayer.openAt(...)`). `bundle` is `SessionBundle<GameEvents, GameCommands>`, so `openAt` returns `GameWorld`; `getReplayWorldContext(replayWorld)` and `replayWorld.serialize()` still typecheck.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck` — Expected: PASS.

### Task 6: Tests — makeReplayBridge.fogOwner

**Files:**
- Modify: `tests/replay/makeReplayBridge.fogOwner.test.ts:13-18` (import), `:23`, `:26`

- [ ] **Step 1: Drop the helpers from the import, keep the type imports**

```ts
import {
  type GameCommands,
  type GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
```

(`GameCommands`/`GameEvents` are still used by `openReplayWorld`'s `bundle: SessionBundle<GameEvents, GameCommands>` param on line 21.)

- [ ] **Step 2: Unwrap `openReplayWorld` (lines 22–26)**

```ts
function openReplayWorld(bundle: SessionBundle<GameEvents, GameCommands>) {
  const replayer = SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
  return replayer.openAt(bundle.metadata.endTick);
}
```

Return type infers to `GameWorld`; `makeReplayBridge(worldP1)` and `getReplayWorldContext(...)` still typecheck.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck` — Expected: PASS.

### Task 7: Tests — ReplayController.test

**Files:**
- Modify: `tests/replay/ReplayController.test.ts:13` (import), `:207`, `:278`

- [ ] **Step 1: Delete the `toEngineWorld` import (line 13)**

Remove `import { toEngineWorld } from '../../src/game/simulation/bridge/pureHelpers';`. Keep the `type { GameWorld }` import on line 12 (used elsewhere in the file).

- [ ] **Step 2: Unwrap the two worldFactory sites (lines 207, 278)**

Line 207:
```ts
    const expectedWorld = SessionReplayer.fromBundle(bundle, { worldFactory: (snapshot) => createReplayWorldOnly(snapshot), skipRegistrationCheck: true }).openAt(bundle.metadata.startTick + 1);
```

Line 278:
```ts
    const replayer = SessionReplayer.fromBundle(bundle, { worldFactory: (snapshot) => createReplayWorldOnly(snapshot), skipRegistrationCheck: true });
```

`bundle` is `SessionBundle<GameEvents, GameCommands>`; `expectedWorld.serialize()` (line 210) and `vi.spyOn(replayer, 'openAt')` (line 279) still typecheck.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck` — Expected: PASS.

### Task 8: replay-inspect.mjs — drop both helpers (mandatory)

**Files:**
- Modify: `scripts/replay-inspect.mjs:20` (import), `:51`, `:70`, `:102`

- [ ] **Step 1: Delete the import (line 20)**

Remove `import { fromEngineWorld, toEngineWorld } from '../src/game/simulation/bridge/pureHelpers.ts';`. (Deleting `fromEngineWorld` from pureHelpers makes this ESM import throw at runtime under `tsx` — this edit is required, not optional.)

- [ ] **Step 2: Unwrap the worldFactory (line 51)**

```js
const replayer = SessionReplayer.fromBundle(bundle, {
  worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
  skipRegistrationCheck: true,
});
```

- [ ] **Step 3: Unwrap both openAt sites (lines 70, 102)**

```js
    const world = replayer.openAt(tick);
```
and
```js
  const world = replayer.openAt(detailTick);
```

These were runtime no-ops (the helpers returned the same object), so replay-inspect output is byte-identical.

### Task 9: pureHelpers — delete fromEngineWorld, rewrite the seam comment

**Files:**
- Modify: `src/game/simulation/bridge/pureHelpers.ts:57-69`

- [ ] **Step 1: Replace the comment + delete `fromEngineWorld`**

Replace lines 57–69 (the old comment + both functions) with:

```ts
// `WorldDebugger` and `RenderAdapter` still type their `world` config as the
// default-generic `World<TEventMap, TCommandMap>` (no `TComponents` parameter),
// and `World`'s `TComponents` is invariant (civ-engine's layer-chain split,
// intact in 1.2.0), so a component-typed `GameWorld` is not assignable to those
// slots. This is the lone surviving cast seam, for the debug/render boundary.
// The recorder/replayer halves of the original seam are gone: engine 1.2.0
// threaded `TComponents`/`TState` through `SessionRecorder` / `SessionReplayer`,
// so a `GameWorld` now flows into recording and replay with no cast, and the
// replay `worldFactory`'s return reasserts the component registry on `openAt`.
// The runtime object is identical either way.
export type EngineDefaultWorld = World<GameEvents, GameCommands>;
export function toEngineWorld(world: GameWorld): EngineDefaultWorld {
  return world as unknown as EngineDefaultWorld;
}
```

- [ ] **Step 2: Verify typecheck (whole tree green, seam half-gone)**

Run: `npm run typecheck`
Expected: PASS. `fromEngineWorld` has zero remaining references; `toEngineWorld` is still used by `createSimulationBridge.ts` + `makeReplayBridge.ts` (WorldDebugger/RenderAdapter).

- [ ] **Step 3: Sanity grep**

Run: `git grep -n "fromEngineWorld" -- src scripts tests` → Expected: no matches.
Run: `git grep -n "toEngineWorld" -- src` → Expected: only `createSimulationBridge.ts` (2) and `makeReplayBridge.ts` (2), plus its definition in `pureHelpers.ts`.

### Task 10: Full gates

- [ ] **Step 1:** `npm run typecheck` → PASS
- [ ] **Step 2:** `npm test` → PASS (replay round-trip + fogOwner tests unchanged behavior; new contract test green)
- [ ] **Step 3:** `npm run lint` → PASS (no unused imports left behind)
- [ ] **Step 4:** `npm run build` → PASS
- [ ] **Step 5:** Runtime sanity — `npm run replay:inspect -- <a saved bundle>` if one exists under `output/`, else skip and note. Output must match prior format.

### Task 11: Multi-CLI review (mandatory per AGENTS.md)

- [ ] Upgrade Codex + Gemini CLIs; run Codex + Claude (+ Gemini) on `git diff main` with a prompt that includes: the intent (type-only seam removal), the anti-regression checklist (no behavior change; `toEngineWorld` MUST remain for WorldDebugger/RenderAdapter; `toBundle` casts in replayCommandHelpers are intentional; explicit `<E,C>` must NOT reappear), the doc-accuracy directive, and the codebase-grounding directive. Synthesize into `docs/threads/current/typed-recording-seam/<date>/1/REVIEW.md`. After Gemini, audit `git status`/`git diff` for reviewer contamination.
- [ ] Address every real finding; re-review until reviewers nitpick. Each iteration gets its own `<date>/<n>/REVIEW.md`.

### Task 12: Docs + commit

- [ ] `docs/engine-feedback/current.md` — subagent-audit first, then mark the "Follow-up aoe2 adoption" DONE and move the resolved 1.2.0 item's historical detail to `past.md`.
- [ ] `docs/devlog/detailed/2026-06-12_2026-06-14.md` — full entry (action, reviewer comments by provider/theme, result, reasoning, notes).
- [ ] `docs/devlog/summary.md` — one concise line under the 2026-06-13/14 section.
- [ ] NO changelog, NO `package.json` bump (type-safety hardening), NO spec, NO README, NO ARCHITECTURE/drift-log/decisions (no structural/boundary/data-flow change; no public surface change — `toEngineWorld`/`fromEngineWorld` are internal).
- [ ] `docs/learning/lessons.md` — add a lesson WITH the evidence-anchor table only if review proves a gotcha load-bearing (candidate: "full inference only — explicit `<E,C>` re-erases `TComponents`").
- [ ] `doc-review` skill / grep `fromEngineWorld` across `docs/` (historical devlog/engine-feedback mentions are intentional context; every live surface must be clean).
- [ ] Single commit on `main` (one coherent unit), move the thread folder `current/ → done/`, push.

## Self-review (against the task spec)

- **Seam fully mapped?** Yes — repo-wide grep, incl. 4 test files + the `.mjs` the task omitted.
- **Gotcha #1 (full inference)?** Covered — Task 4 removes explicit `<E,C>` at the three recorders.
- **Gotcha #2 (`toBundle` default-generic)?** Covered — the `as unknown as SessionBundle<…>` casts are explicitly left alone.
- **Gotcha #3 (E/C from bundle)?** Covered — every site uses a `SessionBundle<GameEvents, GameCommands>` so `openAt` → `GameWorld`; no widening/cast needed; documented for future default-generic sites.
- **Gotcha #4 (GameWorld 3-generic)?** Untouched — `GameWorld` left as-is; `World`'s `TState` default makes `openAt`'s result exactly `GameWorld`.
- **Surviving cast justified?** Yes — `toEngineWorld` kept for WorldDebugger/RenderAdapter with a rewritten comment (Task 9); `fromEngineWorld` + the recorder/replayer `toEngineWorld` uses deleted.
- **Type safety proven?** `npm run typecheck` is the gate; Task 1's contract test pins it against regression.
- **No civ-engine edits.** Confirmed — read-only against `../civ-engine/dist`.
