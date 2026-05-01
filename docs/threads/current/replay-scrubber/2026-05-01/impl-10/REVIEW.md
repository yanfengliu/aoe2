# Phase 1B queue.research Implementation Review (impl-10)

**Date:** 2026-05-01
**Iteration:** impl-10 → ACCEPT, no inline fixes needed
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (both reviewers ACCEPT, no real findings)

## Both reviewers reachable

Codex hit the Windows constrained-language-mode block briefly while attempting `npm run typecheck` (declined by sandbox policy) but recovered via direct file reads and produced a clean "No findings" verdict. Claude reviewed without sandbox issues.

## Codex verdict — No findings

> "I reviewed the queue.research validator/handler wiring, the human bridge facade, the existing `enqueueResearch` authoritative path, and the adjusted tests. The implementation matches the intended queue.train shape, and I did not find a real bug, security issue, or performance concern."

## Claude verdict — LGTM, three minor observations (non-blocking)

1. **Slightly improved toast for in-flight tech + insufficient resources combo.** Pre-1B: facade computed `resourcesMissing` after a falsy `enqueueResearch` and emitted "Not enough X." even when the tech was already in flight. Post-1B: validator short-circuits at `in_flight_tech` before the affordability check, so the facade falls into the catch-all "Cannot research that here." This is more accurate (the in-flight tech IS the blocking reason), so it's an arguable improvement. No action.

2. **Validator's `message` field is unused on human path.** The bridge facade only branches on `result.code` and reconstructs its own toast strings. Validator messages are dead-string for this caller. Consistent with queue.train; harmless. May become useful when AI-side ever submits these commands (Phase 1C). No action.

3. **Test-count description typo.** Brief description claimed 6 tests updated; actual is 7 (2 in castle, 2 in ageUp, 1 each in production / selectionActivity / technologyIdempotency). Corrected in this REVIEW.

## Anti-regression checklist verified clean

- ✓ Validator returns `true | { code, message }`, never `null`.
- ✓ Handler delegates to `enqueueResearchDirect` (= existing `enqueueResearch` body, renamed at boundary in `registerCommandHandlers`).
- ✓ Bridge facade `queueResearch` pre-validates ownership against `humanPlayerId` (validator can't see it); submits; translates `under_construction` and `insufficient_resources` codes to pre-1B toast strings; falls back to 'Cannot research that here.' for codes the human can't normally trigger.
- ✓ `wireBridgeOps` threads `queueResearchValidatorDeps` (constructionStates, playerResources, getResearchOptions, **inFlightTechSetFor**) + `enqueueResearchDirect` into `registerCommandHandlers`.
- ✓ `registerBridgeSystems` drops `enqueueResearch` from `createHumanInputOps` arg-list.
- ✓ Test coverage: 8 validator branches (`invalid_building_id`, `building_not_found`, `not_a_building`, `under_construction`, `cannot_research`, `in_flight_tech`, `no_stockpile`, `insufficient_resources`) + accept + handler delegation in `tests/commands/queueResearch.test.ts` (10 tests).

## Test-timing accommodations

7 existing tests gain `bridge.step(100)` after `queueResearch`:

- **`createSimulationBridge.ageUp.test.ts`** (×2 — Feudal Age + Castle Age tech): step before `getHudState().playerResources` resource assertion.
- **`castle.test.ts`** (×2 — both Fletching tests): step before `stepBridgeUntil` polling for queue-empty. Without the step, the polling predicate fires immediately on a still-empty queue and the test claims success without the research running. **Most subtle of the post-commandify timing fixes — locks the right anti-regression for any future research test that uses queue-empty polling.**
- **`createSimulationBridge.production.test.ts`** (Fletching apply): step before resource assertion.
- **`selectionActivity.test.ts`** (Blacksmith researching Forging): step before activity-verb assertion.
- **`technologyIdempotency.test.ts`** (double-blacksmith race): step after first `queueResearch` so the second `queueResearch` sees the in-flight tech and rejects (otherwise the validator would accept both, batched-frame B2 trade-off).

## Test count + gates

- 611 passed + 1 skipped (was 601 + 10 net new tests this commit: 10 in `queueResearch.test.ts`).
- typecheck, lint, build, full test suite all green.
- Codex review: ~5 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

9 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`, `monk.contextAtEntity`, `queue.train`, `queue.research`). Next per PLAN v4: `market.action` — third resource-spending command, exercises the same B2 trade-off but on `marketExchangeRates` instead of `productionQueues`. Then `building.placeConfirm`, `building.setRallyPoint`, `building.action`, `trebuchet.pack`, `trebuchet.unpack`.
