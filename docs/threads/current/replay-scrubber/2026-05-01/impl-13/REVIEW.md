# Phase 1B building.setRallyPoint Implementation Review (impl-13)

**Date:** 2026-05-01
**Iteration:** impl-13 → ACCEPT after one inline fix
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (Codex no findings; Claude noted check-order inconsistency, addressed inline; other Claude observations deferred as project-level decisions)

## Codex verdict — No real issues found

> "The diff matches the stated Phase 1B contract: validator shape is `true | {code,message}`, handler only writes `rallyPoints.set`, facade rejects silently, wiring threads the right state, and the 8 requested validator/handler cases are covered."

## Claude F1 (deferred — project-level decision) — Coordinate clamping inverted vs DESIGN spec

DESIGN v17 §6.2 line 98 mandates "clamp in HANDLER, validators reject only NaN/non-integer; off-map clamping is silent." Implementation does the opposite — validator rejects OOB explicitly, handler stores `data.target` verbatim. This mirrors the impl-12 building.placeConfirm pattern (which had an explicit "iter-12 F2" comment justifying the deviation: silent clamping masks failure modes for non-bridge submitters).

This is now a project-level pattern across both position-bearing building commands. Both reviewers (Claude F1 here, Claude F2 in impl-12) flagged the same trade-off. The deviation is justified — non-bridge submitters benefit from real failure codes — but DESIGN v17 §6.2 should be updated in a follow-up to match. For impl-13: ratify by precedent (no code change needed beyond a brief reference comment to impl-12 F2).

**Resolution:** The validator already follows the precedent; no inline change needed. Document deviation in REVIEW.

## Claude F2 (deferred — project-level decision) — Validator doesn't check ownership

DESIGN §6.4 line 1516 says "Validator: building exists + owned." Validator only checks "exists." Ownership lives at the bridge facade in `humanInputOps.ts` (matches the same documented divergence as queue.train: validator does not know `humanPlayerId`, so ownership stays at HUD time).

**Resolution:** Same precedent as queue.train. No inline change.

## Claude F3 (real, fixed inline) — Validator check-order inconsistency with placeConfirm

`buildingSetRallyPointValidator` ran the OOB check BEFORE `isAlive` / building-component check. `buildingPlaceConfirmValidator` runs OOB AFTER. For multi-failure inputs the returned error code differed across the two position-bearing commands.

**Fix:** reordered `buildingSetRallyPointValidator` so structural id checks come first, entity-shape checks next, OOB last. An OOB target on a dead building now reports `building_not_found` (more specific real failure) rather than `out_of_bounds`. Test for OOB updated to use a real alive building (since OOB now requires the building to be alive + complete to be reached).

Added a comment in the validator citing impl-12 F3 as the precedent.

## Anti-regression checklist verified clean

- ✓ Validator returns `true | { code, message }`, never `null`. 6 reject codes.
- ✓ Handler does `rallyPoints.set(buildingId, target)`.
- ✓ Bridge facade preserves pre-1B silent-no-op on rejection (no rally-point toast).
- ✓ `wireBridgeOps` + `registerCommandHandlers` wiring complete; threads `state.rallyPoints` + `state.constructionStates` + map dimensions.
- ✓ `humanInputOps` drops `rallyPoints` from state destructure (no longer mutates directly).
- ✓ Test coverage: 6 reject codes + accept + handler mutation = 8 tests.

## Notable Phase 1B contract clarification

This is the FIRST Phase 1B command with NO resource cost. The B2 fix (best-effort validator + authoritative handler re-check) doesn't apply. Validator does structural checks only. Handler is a single-mutation `rallyPoints.set` with no re-check. The integration test surface for this command is just the existing rally-point integration tests in `createSimulationBridge.utility.test.ts` (which still pass — the one-tick handler-run delay doesn't affect their assertions because they check rally-point behavior via produced units' destinations, not direct `rallyPoints` reads).

## Test count + gates

- 641 passed + 1 skipped (was 633 + 8 net new tests this commit, all in `buildingSetRallyPoint.test.ts`).
- typecheck, lint, build, full test suite all green.
- Codex review: ~3 min. Claude review: ~5 min. Both run in parallel.

## Phase 1B → next steps

12 of 15 commands complete. Next per PLAN v4: `building.action` — currently scoped to the `'ungarrison'` action type. Then `trebuchet.pack`, `trebuchet.unpack`.
