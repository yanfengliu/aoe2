# Phase 1A Implementation Review (impl-1)

**Date:** 2026-05-01
**Iteration:** impl-1 → addressed inline
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (Codex MAJOR + 1 MINOR; Claude ACCEPT-with-2-MINORs + 1 NIT — convergent on "wireReplaySystems doesn't exist yet" wording fix)

## Codex MAJOR — version metadata inconsistent + violates a.b.c convention

`package.json` bumped to `0.1.5.1`, but `package-lock.json` still said `0.1.5`. Plus AGENTS.md `Versioning` rule says "Maintain a version number `a.b.c`" — `0.1.5.1` is a 4-part version that doesn't fit.

**Resolved inline:** reverted `package.json` to `0.1.5`. AGENTS.md changelog rule: "User-visible behavior changes only." Phase 1A is foundation scaffolding with NO user-visible behavior change → no bump, no changelog entry, devlog-only documentation. The next bump (`0.1.5 → 0.1.6`) lands when v0.1.6 final ships (round-trip-via-commands + scrubber UI both pass per PLAN.md success criteria). Removed the `0.1.5.1` changelog entry; updated devlog header to "Phase 1A commandify foundation scaffolding (no version bump)".

## Codex MINOR / Claude MINOR-2 (convergent) — wireReplaySystems doesn't exist yet

`registerCommandHandlers.ts` JSDoc and module comment claimed it was called by both `wireBridgeOps` (live) and `wireReplaySystems` (replay). But `wireReplaySystems` doesn't exist anywhere in `src/` yet — Phase 3A will add it.

**Resolved inline:** future-tensed both the file-header comment and the JSDoc:
> "Currently called only by `wireBridgeOps` (live). Phase 3A will add a `wireReplaySystems` helper that also calls this — replay needs the same handlers because `SessionReplayer.openAt` re-submits recorded commands and would throw `ReplayHandlerMissingError` otherwise."

## Claude MINOR-1 — pureHelpers.ts re-export pattern awkward

```ts
export type { GameCommands } from '../commands';
import type { GameCommands as GameCommandsImported } from '../commands';
```

The rename to `GameCommandsImported` only existed because `export type {...} from` doesn't bind a local name. Cleaner pattern:
```ts
import type { GameCommands } from '../commands';
export type { GameCommands };
```

**Resolved inline:** simplified to the cleaner pattern; replaced `GameCommandsImported` → `GameCommands` references in `pureHelpers.ts` (lines 55, 102, 108).

## Claude NIT — `void _world; void _deps;` redundant (deferred)

Underscore-prefixed params already satisfy `@typescript-eslint/no-unused-vars` IF the rule's `argsIgnorePattern` is set. The current project config does NOT exempt underscore prefix, so the `void` calls ARE needed. Will be removed when the first Phase 1B handler lands and the params are actually used.

## Claude NIT — no end-to-end test of loop wiring (deferred to Phase 1B)

Neither test verifies that `drainPendingCommands` is actually invoked from `createSimulationBridge`'s tick loop. The first Phase 1B commit (real handler) will add a test that:
1. Pushes an intention to `bridge.pendingCommands` directly.
2. Calls `bridge.step(deltaMs)` past one tick boundary.
3. Asserts the queue drained AND the handler ran (state mutated).

This closes the "trust by inspection" gap once a real handler exists.

## Other findings cross-checked clean

Both reviewers verified:
- ✓ 15-command type surface matches DESIGN §6.1 exactly.
- ✓ `dispatcher.drainPendingCommands` calls `world.submitWithResult(type, data)` per `world.ts:792`.
- ✓ Drain happens AFTER `world.step()` returns — correctly avoids the determinism-contract clause-2 violation.
- ✓ Drain gated on `tryTick` success (poisoned/halted world doesn't get stale submissions).
- ✓ `pendingCommands` threaded through `bridgeState → assembleBridgeApi → CreateWorldResult → createSimulationBridge`, with `Omit` lists in `WireBridgeOpsResult` + `AssembleBridgeApiDeps` consistently excluding it.
- ✓ `saveGameOps.ts` doesn't include `pendingCommands` (queue always empty between ticks; correct).
- ✓ Permissive `World<any, any, any>` typing on `RecordingService.world` / `AnnotationController.worldRef` / `MarkerListPanel.worldRef` is justified (read-only consumers, no command submission); `eslint-disable-next-line` annotations scoped per-line.
- ✓ Tests verify the dispatcher contract: empty no-op, populated submits-and-clears, FIFO order via handler `seen.push` after `world.step()`.
- ✓ Doc accuracy after fixes: changelog entry removed, devlog updated, summary line updated.
- ✓ All four gates green: `npm test` 539 passed + 1 skipped, `npm run typecheck` clean, `npm run lint` clean, `npm run build` clean.

## v0.1.5.x → next steps

Phase 1B starts the per-command commits — one validator + handler pair per command from the §6.1 surface, in the order specified by PLAN v4 §1B. First command: `unit.move`. Each Phase 1B commit triggers its own multi-CLI review.
