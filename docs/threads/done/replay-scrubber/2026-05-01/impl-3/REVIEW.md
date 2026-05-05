# Phase 1B unit.attack Implementation Review (impl-3)

**Date:** 2026-05-01
**Iteration:** impl-3 → addressed inline
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (Codex MINOR; Claude MAJOR + 2 NIT — Claude caught a real ordering-priority gap that v1 of the diff didn't acknowledge)

## Claude MAJOR — autoAggression intention overrode aiSystem's strategic target

Pre-Phase-1B, autoAggression's `if (unitCommands.has(id)) continue` guard skipped any unit aiSystem had already commanded that tick (because aiSystem's mutation was immediately visible). Post-Phase-1B, both systems push intentions during the same tick; both handlers run at T+1's `processCommands` in FIFO order. autoAggression's intention runs SECOND (since autoAggression registers `after: ['prototypeAi']`) and overwrites aiSystem's via `setUnitAttackCommandDirect`.

Effect: when an attackGroup unit has an enemy in its personal vision radius AND aiSystem has selected a different strategic target (e.g., distant human villager / TC), the local target wins post-1B where the strategic target won pre-1B. Determinism is preserved (FIFO drain is stable across live and replay), but the AI strategic-target priority degraded.

**Fix in impl-3:** added `hasPendingUnitCommand(unitId): boolean` helper to autoAggression's deps. The helper is a closure over `state.pendingCommands` constructed in `wireBridgeOps`; linear scan over the (typically <10 entries per tick) queue checking for any `unit.move` or `unit.attack` intention against the given unit. autoAggression's loop now skips units that already have a queued intention from aiSystem this tick, restoring the pre-1B priority.

Threading: registerAllSystemsTypes adds the dep; registerAllSystems passes it; registerBridgeSystems threads through; wireBridgeOps constructs the closure.

## Codex MINOR — test missing target_kind_mismatch case

`unitAttackValidator` has 3 mismatch branches (unit/building/resource each); tests only covered 5 other rejection codes.

**Fix in impl-3:** added `rejects target_kind_mismatch when targetEntityKind disagrees with the entity shape` test. Constructs an attacker (unit component) and target (building component), then submits with `targetEntityKind: 'unit'` — expects rejection with code `'target_kind_mismatch'`. Locks the named code.

## Claude NITs — comment quality

NIT-1 in `fogMemory.test.ts:12` and NIT-2 (cross-reference in `selectionActivity.test.ts`): the "AI vision sources whose presence depends on attack-issuance timing" comment was hand-wavy. Acknowledged; the actual mechanism is "AI auto-aggro pushes attack intention → handler delays mutation by 1 tick → AI unit's attack movement starts 1 tick later → the AI unit's vision source covers a different cell on the boundary." Worth tightening if a future reader trips on the comment.

**Deferred** to a follow-up commit; the two-tick warmup-vs-three-tick warmup difference is the load-bearing fix and the comment links the concrete tests so a maintainer can trace the chain.

## Other findings cross-checked clean

Both reviewers verified:
- ✓ `setUnitAttackCommandDirect` mirrors the pre-1B 6-step invariant set verbatim.
- ✓ Validator codes match prompt; handler is clean delegation.
- ✓ AI-decision systems (aiSystem + autoAggressionSystem per §6.6) use the intention pusher.
- ✓ No deterministic-resolution system uses attack today; no helper threaded through registerAllSystems for that reason.
- ✓ No mid-tick `submitWithResult` from `execute`.
- ✓ No civ-engine API change required.
- ✓ Tests' updated step counts correctly absorb the 1-tick AI intention delay.
- ✓ All 4 gates green.

## Test count + gates

- 21 commands tests pass (was 20 + 1 new for target_kind_mismatch).
- 555 tests total pass + 1 skipped (was 548 + 7 new this commit).
- typecheck, lint, build, full test suite all green.

## Phase 1B → next steps

2 of 15 commands complete (`unit.move`, `unit.attack`). Next per PLAN v4: `unit.gather` (validator: gatherer existence + harvestable-resource check; handler: clearUnitCommand + gatherer mutation). Same facade-vs-helper-vs-intention pattern.
