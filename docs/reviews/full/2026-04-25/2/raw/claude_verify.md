I've finished the verification. Here's the report.

# Verification report

## V2-1 — `getHudState()` seed
- **Lands**: `createSimulationBridge.ts:7325` (`seed: effectiveSeed`). ✓
- **Completeness**: I traced the other two seed surfaces. `createProjector(..., effectiveSeed, ...)` at L7182 was already correct, and `saveGame` reads its seed via `getSeed: () => seed` at L6905 inside `createWorld`, where `seed` is the inner parameter that gets `effectiveSeed` passed in at L7177. So the entire load → snapshot/save chain reports the saved seed. ✓
- **Defects**: None.
- **Tests**: Both saveLoad cases hit the contract directly; the second (re-save) is particularly strong because it confirms `getSeed`'s closure is also bound to the right seed.
- **Verdict**: OK.

## H2-1 — `applyTechnology` idempotency
- **Lands**: `technologyOps.ts:166-170`, the only call site is `createSimulationBridge.ts:5468`. ✓
- **Completeness**: Guard correctly blocks the second tier-bonus increment (`forging`, `iron-casting`, `blast-furnace`, `bracer`, every armor tier). Optional chaining on both `ownerSet?.has` and `ownerSet?.add` keeps the unmissing-owner edge case behaviorally identical to the pre-fix code.
- **Defects**: None for the bonus path. **But**: the *cost* is still spent twice — `enqueueResearch` (L3387–3409) only dedupes within a single building's queue and `getResearchOptions` filters by `hasTechnology` (completed only), so the player who race-queues Forging at two Blacksmiths still pays 2× food/gold even though only one bonus is granted. Not addressed by this fix.
- **Tests**: Strong — verifies fixture has two Blacksmiths, both queues accept Forging, and final `attackDamage === 5` (would be 6 pre-fix). 400-tick research time fits comfortably in maxSteps=600 + 200-tick tail.
- **Verdict**: OK with caveats: bonus is correct now, but resource cost is still double-spent on race-queued techs — flag for follow-up (see out-of-scope).

## H2-2 — Gather: preserve carry
- **Lands**: `createSimulationBridge.ts:5694-5708`. ✓
- **Completeness**: Villager only enters `to-dropoff` when carry-cap reached or resource depleted (L5671-5673), so the new branch correctly handles both "fully loaded with no path" and "partial carry from depleted source with no path". `carriedAmount <= 0` plus `carriedResource === null` covers the empty-carry reset cleanly.
- **Defects**: Empty `else if` block is intentional but stylistically unusual — lint passes per validation. `findNearestDropOffBuilding` re-runs each tick for stuck villagers (mild CPU waste, not a bug). Hoisting `gatherer.carriedResource` to a `const` also fixes a latent type-narrowing issue further down at L5721. Nice incidental cleanup.
- **Tests**: Strong — asserts `tree.amount ≥ 190` (only one chop should happen) and `stockpile.wood === 200` (no deposit). Pre-fix, the villager would loop tree → 0 and stockpile would stay 200, so checking the tree amount is the right discriminator. Disabling the AI for player 2 prevents the regression test being polluted by AI villager activity.
- **Verdict**: OK.

## H2-3 — Black Forest pocket radius
- **Lands**: `blackForestMap.ts:39`. ✓
- **Completeness**: Verified squared distances vs. `paintDisc`'s `dx² + dy² ≤ radius²`:
  - STARTING_STONE max `(1,6)`: 37 ≤ 49 ✓
  - STARTING_GOLD max `(6,-1)`: 37 ≤ 49 ✓
  - STARTING_BOARS max `(4,-5)`: 41 ≤ 49 ✓
  - All sheep / berry / villager / scout offsets were already inside R=6.
- **Defects**: ~36% larger pocket area (≈40 extra cells per pocket × 2 pockets ≈ 80 cells in a 2048-cell map). Negligible visually; "dense-forest character" claim still holds.
- **Tests**: Strong — locks per-owner counts of 4 stone / 4 gold / 2 boar. Catches future POCKET_RADIUS regressions and any future starting-offset additions that bust the carve.
- **Verdict**: OK.

## M2-1 — Footprint visibility for building targeting
- **Lands**: `targetFindingOps.ts:311-356`, helper widened in `pureHelpers.ts:399-410`. ✓
- **Completeness**: `findPreferredVisibleEnemyBuilding` is the only consumer (called from AI auto-attack loop at `createSimulationBridge.ts:4821`). Mirrors `createProjector` (`bridge/visibility.ts:83`) so the rendering contract and targeting contract match. The `IsVisibleQuery` widening is structural and consistent with `VisibilityQuery` already used in deps.
- **Defects**: None — type narrowing is sound (`VisibilityMap` and the local mock both satisfy the structural interface), tsc clean.
- **Tests**: Strong unit tests with synthetic world + visibility mock — covers (a) regression: only non-anchor cell visible → returns the building; (b) sanity: nothing visible → null; (c) sanity: only anchor visible → still returns the building. Mock verified against real `getBuildingFootprint('castle')` returning `{4, 4}`.
- **Verdict**: OK.

---

## Out-of-scope follow-ups

- **High** — `enqueueResearch` charges twice when two producer buildings race-queue the same tech. H2-1 fixes the bonus side; the cost side still leaks. Either dedupe across all owned buildings against in-flight queue entries, or refund on the second `applyTechnology` no-op.
- **Medium** — `createSimulationBridge.ts:5897-5919` still tests `visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)` (anchor-only) when refreshing fog memory for multi-cell buildings, and the comment at L5894-5896 explicitly claims this matches the projector's contract — which is no longer true (`createProjector` uses `isFootprintVisible`, and now so does target-finding). A player who sees only a non-anchor cell of an enemy Castle won't get a fog-memory snapshot of it. Same anchor-only pattern at `createSimulationBridge.ts:2548` (`isVisibleToHuman`) — most callers there are 1×1 entities so it usually doesn't matter, but worth a sweep.
