# Replay Scrubber Design Iter-14 Review

**Date:** 2026-04-30
**Iteration:** design-14 → produces design-15 (v16 in spec; PLAN v4)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 2 MAJORs + 1 MINOR; Claude ACCEPT-with-2-MINORs + 1 NIT — convergence narrowing; design substantively sound, PLAN.md needed v15 alignment)

## Codex MAJOR — PLAN.md still partially v14

PLAN v3's Phase 1B step 2 said handlers are "pure mutation, no rejection." v15 DESIGN required handler-time re-checks for resource-dependent commands plus **`inFlightTechByOwner` guard** for `queue.research` (and other state-dependent guards beyond just resources).

**Fix in PLAN v4:** Phase 1B step 2 explicitly requires "execution-time re-checks of mutable state (resources, in-flight tech, market rates, placement occupancy)." Test list adds "Batched-same-frame regression" for `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`.

## Codex MAJOR — PLAN Phase 1C still mentions wildlife wolf-decision split

DESIGN v15 reclassified `wildlifeCombatSystem` as fully deterministic resolution (no split). PLAN v3's Phase 1C still listed "Wildlife wolf-decision logic in `wildlifeCombatSystem` — split if needed."

**Fix in PLAN v4:** wildlife line removed; explicit "wildlife auto-aggro is NOT split" callout.

## Codex MINOR — PLAN header stale + monk split naming ambiguous

PLAN v3 header said "v14 / v3 deltas vs v2." Monk split naming wasn't disambiguated.

**Fix in PLAN v4:** header bumped to v4 + "v4 deltas vs v3" callout. Monk split naming spelled out: resolution = `'prototypeMonkBehavior'` (preserves `relicGoldSystem` constraint chain), decision = `'prototypeMonkBehaviorDecision'`.

## Claude MINOR — DESIGN §6.2 validator vs handler resource-check role

v15 §6.2 said "validators do structural validation; handlers do RESOURCE-DEPENDENT validation." Ambiguous on whether the validator ALSO does best-effort resource validation for UX-correct rejection toasts (single-press overspend → toast preserved).

**Fix in v16:** §6.2 prose rewritten — "validator + handler both validate state-dependent conditions, but in different roles": validator does structural + best-effort resource for UX-correct toasts; handler does the same check as a SAFETY NET for batched-same-frame. Recorder captures `kind: 'success'` regardless of handler's silent-noop branch.

## Claude MINOR — `setXCommandDirect` helper contract under-specified

v15 sketch's `setUnitMoveCommandDirect` only set `unitCommands`; the full facade `issueUnitMoveCommand` also calls `clearGathererOrder(unitId)` and `monkTasks.delete(unitId)`. For `productionQueueSystem` rally (a freshly-spawned unit), skipping these is fine; for any future caller, it's a footgun.

**Fix in v16:** `setUnitMoveCommandDirect` mirrors the full facade behavior (clears + delete + mutate). Safe for any caller. v16 §6.4 helper-vs-facade parity test added.

## Claude NIT — B1 prose overstates scope

v15 §6.4 said "Same fix applied to every `issueX` op called by ANY deterministic-resolution system: gather, attack, context, etc." Claude's audit shows only `unit.move` is currently called by a deterministic-resolution system (productionQueueSystem rally).

**Fix in v16:** §6.4 trimmed to "audit shows only `unit.move` is currently needed; `gather`/`attack`/`context` direct helpers would be defensive-only — Plan Phase 1A's audit confirms which helpers are actually needed; do not pre-implement."

## Other findings cross-checked clean

Both reviewers verified iter-13 fixes that landed correctly:
- B1 facade-vs-helper split structurally sound. ✓
- B2 handler re-check pattern preserves determinism + live UX. ✓
- Wildlife reclassification matches ground truth. ✓
- Monk split naming preserves relicGoldSystem constraint chain. ✓
- civ-engine API parity (registerHandler, registerValidator, submitWithResult, processCommands timing). ✓
- 15-command surface complete. ✓
- No civ-engine API changes required. ✓

## v16 + PLAN v4 changes summary

1. **PLAN v4 header bump** + alignment with DESIGN v15.
2. **PLAN v4 Phase 1B step 2** spells out execution-time re-checks (resources, in-flight tech, market rates, placement occupancy).
3. **PLAN v4 Phase 1B test list** adds batched-same-frame regression + helper-vs-facade parity tests.
4. **PLAN v4 Phase 1C** removes wildlife wolf-decision; explicit "wildlife NOT split."
5. **PLAN v4 Phase 1C monk** explicit naming: `prototypeMonkBehaviorDecision` (decision) + `prototypeMonkBehavior` (resolution).
6. **DESIGN v16 §6.2** validator + handler roles clarified (validator does best-effort resource; handler does safety-net re-check).
7. **DESIGN v16 §6.4** `setXCommandDirect` mirrors full facade body.
8. **DESIGN v16 §6.4** scope claim trimmed (only `unit.move` direct helper currently needed).

## Process notes for design-15 reviewer

- v16 + PLAN v4 should converge to ACCEPT — the substantive issues from iter-13 (B1, B2) are resolved; iter-14 surfaced only spec-formalism + PLAN-alignment issues.
- Verify the validator/handler role split matches civ-engine semantics: validator runs synchronously inside `submitWithResult` BEFORE queue push; handler runs at start of next step's `processCommands`. Recorder captures the validator outcome (success/rejection); handler's silent-noop is invisible to the recorded RecordedExecution shape (it remains "success").
- Verify `setUnitMoveCommandDirect` mirroring `clearGathererOrder` + `monkTasks.delete` is the FULL invariant set the facade enforces (audit `unitCommandOps.ts:116-130`).
- Both reviewers should converge to ACCEPT this round; remaining issues should be plan-stage detail only.
