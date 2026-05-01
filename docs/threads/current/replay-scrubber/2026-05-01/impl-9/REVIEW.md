# Phase 1B queue.train Implementation Review (impl-9)

**Date:** 2026-05-01
**Iteration:** impl-9 → addressed inline (3 review fixes folded into the same commit)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes

## Both reviewers reachable; converged on the same headline finding

Both Codex and Claude flagged the same key gap: the diff lacked a same-frame batched B2-invariant integration test. This is the central design property of `queue.train` — the entire point of the validator/handler split per DESIGN v17 §6.4 B2. The new validator/handler unit tests cover delegation and per-branch validator output, but did not exercise the routing-layer's "validator pass + handler reject" path.

**Fix:** new test in `tests/simulation/commandRejection.test.ts` ("B2 invariant: same-frame queue.train batch over budget"). Submits 5 villager-train commands without an intervening step (starting food=200, cost=50 → affordable count=4). Asserts:

1. All 5 submissions return `true` (validator pre-spend stockpile sees food=200 every time).
2. Pre-step: production queue is empty + food unchanged at 200 (no handler has run).
3. After ONE `bridge.step(100)`: production queue has exactly 4 entries; food drained to 0 (5th handler silent-no-op'd because re-check saw food=0).

This locks the B2 contract that the rest of the resource-spending Phase 1B commits (queue.research, market.action, building.placeConfirm) will rely on.

## Claude F2 (real, fixed inline) — `false` arm in validator return type is dead

`queueTrainValidator.ts:30-32` declared `true | false | { code: string; message: string }`, but the implementation never returns plain `false` — every rejection path returns a `{ code, message }` object. Including `| false` would mislead readers about the contract and could let a future caller branch on `result === false` (dead code today, bug tomorrow).

**Fix:** tightened to `true | { code: string; message: string }`. Sibling validators (unitMove, unitAttack, etc.) carry the same `false` arm for parity with civ-engine's `CommandValidationResult`, but those will get the same tightening as a future cleanup sweep.

## Claude F3 (trivial, fixed inline) — redundant `return false`

In `humanInputOps.ts` `queueTrainUnit`, the `insufficient_resources` branch had an inner `return false` (after the missing-resource toast) shadowed by the outer `return false` at the end of the `!result.accepted` block. Removed the redundancy by collapsing the missing-resource path into a single `enqueueRejection` call with the toast string computed via a ternary. The outer `return false` covers the rejection in all branches.

## Other findings cross-checked clean (Claude verified all 6 anti-regression items)

- ✓ Validator returns `CommandValidationResult` (now tightened, never `null` either way).
- ✓ Handler delegates to `enqueueTrainingDirect` (= existing `enqueueTraining` body, renamed at the boundary in `registerCommandHandlers` — body unchanged).
- ✓ Bridge facade `queueTrainUnit` pre-validates ownership against `humanPlayerId` before submission (validator can't see `humanPlayerId`); translates the two user-meaningful codes (`under_construction`, `insufficient_resources`) to pre-1B toast strings; falls back to 'Cannot train that unit here.' for codes the human can't normally trigger.
- ✓ `wireBridgeOps` threads `queueTrainValidatorDeps` (constructionStates, playerResources, getTrainOptions) + `enqueueTrainingDirect` into `registerCommandHandlers`.
- ✓ `registerBridgeSystems` drops `enqueueTraining` from `createHumanInputOps` arg-list (no longer needed since `queueTrainUnit` submits via `submitWithResult`); keeps it in the `aiSystem` deps path (Phase 1C scope).
- ✓ Test coverage: 7 validator branches + accept + handler delegation in `tests/commands/queueTrain.test.ts` (9 tests).
- ✓ `bridge.step(100)` additions in 9 existing tests are correct: pre-1B `enqueueTraining` was synchronous; post-1B the spend lands at the next step's `processCommands`, so any assertion that reads `getHudState().playerResources` or `getSelectionState().queue/activity` after `queueTrainUnit` must step first.

## Known UX regression (deferred, documented in REVIEW)

Same-frame batches where the validator sees the pre-spend stockpile every time: all submissions return `true` (validator pass), but only the affordable subset succeeds at handler time. The `(N - M)` over-budget commands silently no-op without producing a rejection toast. Pre-1B was M successes + (N - M) toasts.

**Mitigation strategies considered + deferred:**
- HUD-side pending-cost tracking: would require the bridge facade to maintain a per-frame "pending-spend" map, deduct from the stockpile snapshot before each `submitWithResult` call. Out of scope for impl-9; revisit after queue.research, market.action, building.placeConfirm to design a unified mechanism.
- Handler-level `enqueueRejection`: handlers don't currently distinguish human-input from AI-pushed intentions, so threading rejection toasts would surface AI's failed re-checks to the user. Requires plumbing an "originator" flag through the command queue. Out of scope.

The DESIGN v17 §6.4 B2 trade-off explicitly accepts silent no-op semantics, so this is documented and not a blocker.

## Test count + gates

- 601 passed + 1 skipped (was 591 + 10 net new tests this commit: 9 in `queueTrain.test.ts` + 1 B2-invariant in `commandRejection.test.ts`).
- typecheck, lint, build, full test suite all green.
- Codex review: ~6 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

8 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`, `monk.contextAtEntity`, `queue.train`). Next per PLAN v4: `queue.research`. Then `market.action`, `building.placeConfirm`, `building.setRallyPoint`, `building.action`, `trebuchet.pack`, `trebuchet.unpack`.
