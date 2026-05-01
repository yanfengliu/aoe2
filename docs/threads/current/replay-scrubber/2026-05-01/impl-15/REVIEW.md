# Phase 1B trebuchet.pack + trebuchet.unpack Implementation Review (impl-15)

**Date:** 2026-05-01
**Iteration:** impl-15 → addressed inline (1 review fix folded; symmetric coverage added)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fix. **PHASE 1B COMPLETE — 15/15 commands commandified.**

## Both reviewers converged on the same MEDIUM finding — transition precedence

Codex MEDIUM + Claude F1: validators originally checked the `packed` flag before `transitionTicksRemaining`. During an UNPACK transition the state is `{ packed: true, transitionTicksRemaining > 0 }` (the `packed` flag flips only when ticks reach zero per `advanceTrebuchetTransition` in `trebuchetState.ts:41-51`). So a `trebuchet.pack` submission against a mid-unpack trebuchet would return `already_packed` instead of `in_transition` — wrong diagnostic for any future direct submitter or recorded-rejection observer.

Mirror failure for the unpack validator: a mid-pack state `{ packed: false, ticks > 0 }` returned `already_unpacked`.

**Fix:** swapped check order in both validators — `transitionTicksRemaining > 0` is now checked BEFORE the packed/unpacked flag. Added explicit cross-direction transition tests in a new "trebuchet validators — cross-direction transition precedence" describe block. Both tests now verify `in_transition` is returned instead of the misleading source-direction flag.

## Claude F1 (also fixed) — Symmetric coverage on unpack validator

Pre-fix: pack validator had 8 test cases covering all rejection codes; unpack validator only had 2 (already_unpacked + accept). The shared structural prelude (invalid_unit_id, unit_not_found, not_a_unit, not_a_trebuchet, no_pack_state, in_transition) was untested for unpack.

**Fix:** added 5 missing unpack-validator tests (all structural-prelude codes) so both validators are independently covered. Coverage parity prevents silent drift if the validators diverge later.

## Claude F2/F3 (informational, no action)

- F2 / "Replay observability framing is aspirational": the validator file's "future submitters" comment over-promises today since `playerCommandsSystem` mutates state directly via `trebuchetStateOps`. Phase 1C+ AI or HUD-button submitters will exercise the path. Comment is accurate as-is.
- F3 (NIT): single-direction `in_transition` test was insufficient; addressed by F1 fix above (cross-direction tests now exist).

## Anti-regression checklist verified clean

- ✓ Validators return `true | { code, message }`, never `null`. 7 reject codes per validator (invalid_unit_id, unit_not_found, not_a_unit, not_a_trebuchet, no_pack_state, already_packed/already_unpacked, in_transition).
- ✓ `playerCommandsSystem` UNCHANGED — still calls `trebuchetStateOps.beginTrebuchetPack/Unpack` directly per §6.4 B1 deterministic-resolution rule.
- ✓ `wireBridgeOps` + `registerCommandHandlers` wiring complete; threads `state.trebuchetPackStates` + `trebuchetStateOps.beginTrebuchet{Pack,Unpack}` (used as `*Direct` aliases at the boundary).
- ✓ Test coverage: 19 tests post-fix (was 12 pre-fix; +7 from symmetric coverage + cross-direction precedence).
- ✓ No existing-test updates (no live submitter changed).

## Phase 1B closure

All 15 commands now have validators + handlers + per-command tests:

1. ✓ unit.move
2. ✓ unit.attack
3. ✓ unit.gather
4. ✓ unit.context
5. ✓ unit.contextAtEntity
6. ✓ sheep.move
7. ✓ monk.contextAtEntity
8. ✓ queue.train (B2 batched-frame test landed)
9. ✓ queue.research (B2 in-flight tech contract preserved)
10. ✓ market.action (B2 batched-frame test landed; constants threaded as deps)
11. ✓ building.placeConfirm (B2 same-anchor test landed)
12. ✓ building.setRallyPoint (no resource cost, simpler validator)
13. ✓ building.action (assertNever exhaustiveness guard)
14. ✓ trebuchet.pack
15. ✓ trebuchet.unpack

The recorded command stream contract is now complete. All HUD-issued state mutations (and the trebuchet system-derived ones, registered for replay observability) flow through `world.submitWithResult`. Phase 1C (AI intention refactor, monkBehaviorSystem split) and Phase 2 (bridge-state migration to `world.state.aoe2.*`) follow.

## Test count + gates

- 667 passed + 1 skipped (was 648 + 19 net new tests from this commit including the symmetric coverage).
- typecheck, lint, build, full test suite all green.
- Codex review: ~5 min. Claude review: ~5 min.

## Next steps

Phase 1B closes. Per PLAN v4:
- **Phase 1C** — AI system refactor (intention/dispatcher pattern). aiSystem + autoAggressionSystem replace direct `enqueueTraining` / `enqueueResearch` / `startConstruction` calls with intention pushes. monkBehaviorSystem splits into decision + resolution halves.
- **Phase 2** — Bridge-state migration to `world.state.aoe2.*` (35 Tier-1 + 3 Tier-3 slots).
- **Phase 3** — Replay scrubber UI + round-trip determinism test.
- Eventually — ship aoe2 v0.1.6, move thread to `docs/threads/done/`.
