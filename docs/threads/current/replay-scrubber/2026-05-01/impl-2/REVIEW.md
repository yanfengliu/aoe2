# Phase 1B unit.move Implementation Review (impl-2)

**Date:** 2026-05-01
**Iteration:** impl-2 → addressed inline
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (Codex 2 MAJORs; Claude ACCEPT-with-2-MINORs + 1 NIT — convergent on the monkTaskOps-fallback recorder gap and validator integer rejection)

## Convergent MAJOR — monk-context-fallback bypasses recorder

The wirePostSeedOps wiring of `monkTaskOps.issueUnitMoveCommand` was set to `unitCommandOps.setUnitMoveCommandDirect` with a rationale that "monkTaskOps appliers run inside `monkBehaviorSystem.execute`, so the move-issuance must use the direct-mutation helper." Both reviewers caught that the rationale was wrong:

- The actual `monkBehaviorSystem.execute` consumers (`applyMonkHeal/Convert/Pickup/Deposit` from `monkTaskAppliers.ts`) do NOT take or use `issueUnitMoveCommand` (verified — the appliers' deps list at `monkTaskAppliers.ts:19-37` has no move dep).
- The only consumer of monkTaskOps's `issueUnitMoveCommand` dep is `issueMonkContextCommandAtEntity` (lines 330, 356), which is reached ONLY from `unitCommandOps`'s human-input routing (lines 270, 316) — NOT from any system's `execute` phase.

Effect of the original wiring: HUD-time monk-context-fallback moves (right-click monk on a monastery while not carrying a relic, on an already-carried relic, or on a fully-healthy friendly unit) bypass the `unit.move` recorder pathway. Replay-time these moves never happened. Bundle integrity violated.

**Fix in impl-2:** wirePostSeedOps wiring switched to `unitCommandOps.issueUnitMoveCommand` (the COMMANDIFIED facade). HUD-time monk-context fallback moves now route through `submitWithResult('unit.move', ...)` so the recorder captures them. Comment rewritten with the correct rationale.

## Codex MAJOR — validator should reject non-integer coordinates

DESIGN v17 §6.2 says validators reject "structurally-invalid coordinates (NaN, non-integer)." v1 of the validator only checked `Number.isFinite`, which accepts fractions like `5.5` — those would feed fractional cells into grid movement planning via the handler's `clamp()`.

**Fix in impl-2:** validator uses `Number.isInteger(target.x)` + `Number.isInteger(target.y)`. New regression test `rejects when target coordinates are non-integer` added.

## Claude MINOR — integration test under-asserts

The "issueUnitMoveCommand routes through submitWithResult" test only asserted `bridge.world.tick >= 1`, which proves the world ticked but not that the unit's move command was set.

**Fix in impl-2:** test rewritten to:
1. Assert pre-step `getSelectionState().activity` is `{verb: 'idle', target: null}` (handler hasn't run yet).
2. Step `bridge.step(100)` — handler now runs at start of next step's `processCommands`.
3. Assert post-step activity is `{verb: 'moving', target: null}` — confirms the handler mutated `unitCommands` and the activity reader picked it up.

Move target changed from `(8, 8)` to `(0, 0)` (far cell) so the unit doesn't arrive within one step and flip back to idle.

## Claude NIT — facade docstring scope

`unitCommandOps.UnitCommandOps.issueUnitMoveCommand` docstring said "used by HUD, hotkey handlers." After commandify it's also reached from internal fallthrough paths in `issueUnitContextCommand`/`AtEntity` and the monkTaskOps human-context fallback. All HUD-time, but the doc was narrow.

**Fix in impl-2:** docstring widened to "HUD-time entry points (`humanInputOps.issueMoveCommand`, internal fallthrough from `issueUnitContextCommand`/`AtEntity`, and the `monkTaskOps` human-context fallback)."

## Other findings cross-checked clean

Both reviewers verified:
- ✓ Validator/handler/dispatcher split correct.
- ✓ aiSystem (intention) and productionQueueSystem (helper) wiring matches DESIGN v17 §6.4/§6.5.
- ✓ civ-engine `submitWithResult` / `registerValidator` / `registerHandler` signatures match.
- ✓ Pre-Phase-1B `issueUnitMoveCommand` body's 5-step invariant set preserved verbatim in `setUnitMoveCommandDirect` (unit guard, clearGathererOrder, monkTasks.delete, target clamp, `setUnitCommand` for movePathCache.delete + unitCommands.set).
- ✓ `selectionActivity.test.ts` update correctly absorbs the new submit→step→handler timing.
- ✓ No mid-tick `submitWithResult` from inside `execute`.
- ✓ Determinism contract preserved.

## Test count + gates

- 14 commands tests pass (was 13 + 1 new for non-integer rejection).
- 548 tests total pass + 1 skipped (was 539 + 9 new this commit).
- All four gates green: typecheck, lint, build, full test suite.

## Phase 1B → next steps

Next command per PLAN v4 §1B: `unit.attack`. Same pattern (validator + handler + facade-vs-helper-vs-intention split). Estimated 1 commit per command for the 13 remaining.
