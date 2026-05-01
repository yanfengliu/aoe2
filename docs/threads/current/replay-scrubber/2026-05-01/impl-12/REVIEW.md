# Phase 1B building.placeConfirm Implementation Review (impl-12)

**Date:** 2026-05-01
**Iteration:** impl-12 → addressed inline (2 review fixes folded into the same commit)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT after inline fixes (both reviewers converged on the same headline finding)

## Both reviewers converged on the B2 same-frame regression test gap

Both Codex (MEDIUM) and Claude (real, blocker-tier) flagged the missing B2 same-frame regression test for `building.placeConfirm` — the fourth resource-spending command in Phase 1B. Sibling commands (queue.train, market.action) had this; building.placeConfirm did not.

**Fix:** new test in `tests/simulation/commandRejection.test.ts` ("B2 invariant: same-frame building.placeConfirm batch over budget"). The test exploits the same-anchor double-submit case: submits two `building.placeConfirm` commands at `(14,14)` for the same villager, re-entering placement mode between them. Both validator-accept (validator can't see prior-frame submissions; no foundation occupies the cell yet). After one `bridge.step(100)`, exactly one foundation lands and exactly one 25-wood spend is observed — the second handler hit the placement-blocked re-check and silent-no-op'd.

This locks the contract that the handler authoritatively prevents double-spends from same-frame submissions, and is now the canonical regression for the placement-occupancy race.

## Claude F2 (real, fixed inline) — Validator silent-clamped OOB position

`buildingPlaceConfirmValidator.ts:56-59` (pre-fix) clamped `data.position.x/y` to `[0, mapWidth/Height - 1]` before calling `isPlacementBlocked`. The bridge facade (placementOps) also pre-clamps. So in normal flow, OOB never reaches validator.

But the validator is now part of the public command surface — for any non-bridge submitter (replay, AI in Phase 1C, direct `submitWithResult`), an OOB position would silently pass the placement check (clamped) but then the handler would receive raw OOB and silently no-op. The validator's silent clamp masks the actual failure mode.

**Fix:** added explicit `out_of_bounds` reject code. Validator now rejects OOB positions cleanly instead of silently clamping. The `isPlacementBlocked` call uses the raw position. (The bridge facade still clamps before submission, so HUD-time UX is unchanged.)

## Claude F3 (deferred, documented) — Handler-time failure has no rejection toast

Pre-1B: `startConstruction` ran synchronously; failure routed through `enqueueRejection`. Post-1B: validator-acceptance clears `placementMode` and the bridge facade returns `true`; if the handler's authoritative re-check fails next frame, the player sees the preview clear (success-like UX) but no foundation appears and no toast fires.

This is the same B2 trade-off as queue.train / market.action (validator best-effort + handler authoritative + silent no-op on stale state). For buildings the UX delta is larger because the visible "preview cleared" cue is success-like. **Deferred** to the unified handler-rejection mechanism that will land after building.action / trebuchet.* (alongside the queue.train UX fix).

## Codex finding — same as Claude F1

Codex (MEDIUM): same B2 same-frame regression gap. Addressed by the new test (above).

## Anti-regression checklist verified clean

- ✓ Validator returns `true | { code, message }`, never `null`.
- ✓ Handler delegates to `startConstructionDirect` (= existing `startConstruction` body via `wireBridgeOps` boundary alias).
- ✓ Bridge facade preserves pre-1B `'Placement blocked.'`, `'Not enough X.'`, `'Cannot build here.'` toast strings via validator-code translation.
- ✓ `wireBridgeOps` + `registerCommandHandlers` wiring complete; passes `mapWidth/mapHeight` + `getBuildOptions` + `isPlacementBlocked` + `playerResources` to validator deps.
- ✓ `registerBridgeSystems` drops `startConstruction` from `createPlacementOps` args (placementOps no longer calls it directly).
- ✓ `placeBuildingNearTownCenter` helper now `bridge.step(100)` after each `confirmBuildingPlacement` so the foundation + spend land before callers read state. `production.test.ts` direct caller updated separately.

## Test count + gates

- 633 passed + 1 skipped (was 621 + 12 net new tests this commit: 11 in `buildingPlaceConfirm.test.ts` + 1 B2-invariant in `commandRejection.test.ts`).
- typecheck, lint, build, full test suite all green.
- Codex review: ~3 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

11 of 15 commands complete (`unit.move`, `unit.attack`, `unit.gather`, `unit.context`, `unit.contextAtEntity`, `sheep.move`, `monk.contextAtEntity`, `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`). Next per PLAN v4: `building.setRallyPoint`. Then `building.action`, `trebuchet.pack`, `trebuchet.unpack`.
