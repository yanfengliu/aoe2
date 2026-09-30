# Phase 1B monk.contextAtEntity Implementation Review (impl-8)

**Date:** 2026-05-01
**Iteration:** impl-8 → addressed inline (review fixes folded into the same commit)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (Codex flagged 2 issues, Claude flagged 1; all 3 addressed)

## Both reviewers reachable

Codex did hit the Windows constrained-language-mode block during workspace exploration (see snippets in `tmp/review-runs/.../codex.txt`), but recovered by direct file reads and produced a clean two-finding verdict.

## Codex F1 (real, fixed inline) — `monkCarriedRelic` fallthrough precedence too high

`selectionActivity.ts:127` (in the original impl-8) returned `'carrying'` from the fallthrough BEFORE checking `unitCommands` at line 138. A carrying monk with an active move order would show `Carrying relic` instead of `Moving`. Codex correctly identified this as a precedence regression: the player's explicit move intent should win over the passive carry state.

**Fix:** moved the `monkCarriedRelic` fallthrough check to AFTER the `unitCommands` switch (now at the very end of the active-state checks, just before the final `'idle'` fallback). Active commands (move/attack/build) still win; gathering still wins; only the previous `'idle'` outcome is replaced with `'carrying'` for relic-carrying monks.

**Regression test:** new `tests/simulation/computeUnitActivityMonkCarry.test.ts` (4 cases): carrying alone → `'carrying'`; carrying + active move command → `'moving'`; carrying + active convert task → `'converting'`; nothing → `'idle'`. The unit-test approach (constructing `SelectionActivitySources` directly) avoids the integration-flow complexity of trying to get `unitCommands.move` and `monkCarriedRelic` simultaneously set on a real bridge — monks carrying relics don't respond to `issueMoveCommand` because of how `monkBehaviorSystem` is structured.

## Codex F2 (deferred) — `routeMonkContextAtEntityCommandDirect` not directly unit-tested

The new heal/convert/pickup/deposit/move-fallback dispatch is covered through the simulation integration tests in `selectionActivity.test.ts`, but not by a direct unit test exercising the routing branches in isolation. The sibling `routeUnitContextAtEntityCommandDirect` is also tested only end-to-end (same convention), so this is not a regression specific to this commit. Phase 1C may extract the routing helper for direct testability when the AI-decision systems get refactored. Logged as a known coverage gap; not blocking.

## Claude F1 (real, fixed inline) — stale comment in `issueUnitContextCommand`

`unitCommandOps.ts:380-384` carried a comment from the unit.context commit (impl-5): "Monk path stays HUD-routing (calls existing facade chain since monk.contextAtEntity isn't commandified yet — will improve in that commit)." That commit is THIS commit; the comment is now stale.

**Fix:** rewrote the comment to reflect the post-impl-8 state — monk path delegates to the commandified `issueMonkContextCommandAtEntity` facade; the move-fallback (no monk-context target at the cell) clears any existing task and submits `unit.move` via the commandified facade.

## Other findings cross-checked clean (Claude verified all 7 anti-regression items)

- ✓ `routeMonkContextAtEntityCommandDirect` body matches pre-1B `issueMonkContextCommandAtEntity` body modulo: re-fetches `monkUnit` + `targetPosition` (instead of receiving as args), uses `setUnitMoveCommandDirect` for the move-fallback (instead of `issueUnitMoveCommand`), defensively returns false when re-fetch yields null.
- ✓ Validator returns `CommandValidationResult` (5 reject codes + accept; never `null`).
- ✓ `registerCommandHandlers` wiring complete — `routeMonkContextAtEntityCommandDirect` in `CommandHandlerDeps`, validator + handler registered.
- ✓ `wireBridgeOps` wiring complete — destructured + threaded into deps.
- ✓ `wirePostSeedOps` wiring: `setMonkTask` exported from `monkOps` and threaded into `unitCommandOps`; `issueUnitMoveCommand` dep removed from `monkTaskOps` (no other call sites).
- ✓ `SelectionActivitySources` gains `monkCarriedRelic`; `selectionStateOps` wires it through.
- ✓ Test coverage: 5 validator branches (`invalid_id`, `unit_not_found`, `not_a_unit`, `not_a_monk`, `target_not_found`) + accept path + handler delegation.

## Selection-activity test changes

Four `selectionActivity.test.ts` cases needed accommodation for the new commandified flow:

- **Heal** (`'monk healing a friendly unit reports Healing Spearman'`): added `bridge.step(100)` before assertion. The heal task is gradual (`monkHealTickInterval` ticks per heal pulse), so the task remains in `monkTasks` after step → activity = `'healing'`.
- **Convert** (`'monk converting an enemy reports Converting Militia'`): same `bridge.step(100)` accommodation. Convert task is gradual (`monkConvertProgressPerTick`).
- **Pickup** (`'monk retrieving a relic reports Retrieving relic'`): pre-step setup — monk moves to `(14,14)` first via `issueMoveCommand` so distance to relic at `(15,8)` becomes 7 cells, exceeding `MONK_ACTION_RANGE=4`. After issuing the pickup command + stepping, the pickup task remains active in `monkTasks` (monk approaches the relic across multiple ticks) → activity = `'retrieving'`. Without the relocation, the pickup applies in the same step at distance 1.
- **Deposit** (`'monk depositing a relic reports Carrying relic'`): assertion runs WITHOUT `bridge.step` — the bridge facade's `submitWithResult` queues the command, monkTasks unchanged, monkCarriedRelic still set from the previous pickup → activity = `'carrying'` via the new fallthrough. Trying to relocate the carrying monk fails because `monkBehaviorSystem` only iterates `monkTasks` and `playerCommandsSystem`'s move handler does not move a carrying monk in practice (the monk's path planner returns no plan or the monk gets stuck — empirical, not yet root-caused; pre-existing behavior, not a regression of this commit).

## Test count + gates

- 591 passed + 1 skipped (was 587 + 4 new tests this commit: 6 monk-validator/handler tests + 4 new precedence unit tests + already-counted heal/convert/pickup/deposit).
- typecheck, lint, build, full test suite all green.
- Codex review: ~3 min. Claude review: ~5 min. Both run in parallel via `until [ -s ... ]` poller.

## Phase 1B → next steps

7 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`, `monk.contextAtEntity`). Next per PLAN v4: `trebuchet.pack`. Then `trebuchet.unpack`, `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`, `building.setRallyPoint`, `building.action`.
