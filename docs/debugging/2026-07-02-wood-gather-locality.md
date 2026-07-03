# Debugging session — AI wood gather-locality economy throttle

## Symptom
Across multiple groundings (AI-vs-AI 8000t corpus + campaign-12), the built-in AI's WOOD income is chronically low for BOTH players while food/gold flow, even though abundant wood sits near the base. This is the binding constraint keeping the AI from a real mid/late-game economy. Two distinct signatures have been seen on different seeds:
- **Occupancy gridlock**: a wood villager in `to-dropoff` carrying a full load inches through a dense forest pocket at ~0.01 cells/tick (≈30× slow), never rerouting — it HAS a valid path but can barely move for occupancy.
- **Locality / allocation**: villagers assigned to trees 22-32 cells across the map while full trees sit 8 cells from the TC; and/or only 1-2 of N villagers desire wood.

## Expected vs actual
- Expected: an AI with wood within ~10 cells of a lumber camp gathers wood at a healthy, sustained rate.
- Actual: wood stays low (19-138) while food/gold pile up; villagers either gridlock in forest pockets or are assigned far / under-allocated to wood.

## Reproduction
- `npm run playtest -- --seed default-seed --max-ticks 8100 --all-ai --out output/playtests/wood-find`
- `npm run replay:inspect -- output/playtests/wood-find.json --ticks 0,2000,4000,6000,8000` and `--detail <tick> <owner>` for per-villager task/target.
- MUST ground the CURRENT binding signature on THIS bundle before designing — the throttle is seed-dependent and multi-faceted (memory + roadmap).

## Root-cause candidates (from code study, pre-grounding)
- [ ] **Net-progress gridlock** — `villagerEconomySystem.ts` to-dropoff (line ~478): whenever the villager has ANY valid path and takes a step it calls `clearStuck(id)`, so `stuckSince` is never set for a villager that moves-but-doesn't-approach (inching at ~0.01 cells/tick). The existing stuck detection only fires on `!dropOffPlan` (NO path at all), so an occupancy-gridlocked-with-a-path villager is never rerouted. Confirm by replaying: a `to-dropoff` villager whose distance-to-dropoff is ~flat over many ticks.
- [ ] **Assignment locality** — `villagerGatherAssignment.ts` sorts by owner-preference then Manhattan distance; a far OWN resource (tier 0) beats a near NEUTRAL one (tier 1). Confirm: villagers `to-resource` with targets 20+ cells away while nearer same-kind neutral trees exist.
- [ ] **Allocation** — only 1-2 of N villagers have `desiredResource: wood`. This is `villagerTargetsForAge` weighting; a prior reweight was REVERTED (broke age-up which gold funds). Confirm: per-owner desiredResource histogram.

## Investigation log
- 2026-07-02 — Studied the gather state machine. to-resource has a time-based approach timer gated on `overSubscribed` (far uncontended targets are NOT abandoned). to-dropoff uses `gathererDropOffStuckSinceTickCodec` but clears it on every successful step. Neither catches move-without-net-progress. Running a fresh all-AI 8100t bundle to ground the current signature.

## Root cause
GROUNDED on a fresh all-AI 8100t bundle (`output/playtests/wood-find.json`, seed default-seed). The binding signature on this seed is **assignment locality (drop-off round-trip), NOT occupancy gridlock.** At tick 6000 BOTH owners have full trees 7-10 cells from their lumber-camp yet send wood villagers 15-23 cells away (owner 1: u2219/u2266 → res2265@(19,20), ~23 cells from the drop-off; owner 2: u2210/u2256 → res2275@(52,9), ~15-21 cells) — and owner 1 has only 1 of 12 villagers actually `gathering` (the rest perpetually in transit). Wood is pinned near 0 (4-16) while food/gold pile to 1000+. Cause: `villagerGatherAssignment.assignNearestResource` sorts candidates by `manhattan(resource, VILLAGER)` distance. A villager that becomes idle at a FAR tree (resource depleted under it, or it fanned out during a momentary near-saturation) re-assigns to a tree near ITS current far position — spiraling into the far forest and doing a huge resource↔drop-off round-trip every cycle. Villager-distance is a one-time first-trip cost; the STEADY-STATE cost is the resource↔drop-off round-trip, which the sort ignores.

## Fix
In `assignNearestResource`, sort candidates within each owner-preference tier by **round-trip proximity to the nearest own drop-off** (`manhattan(resource, nearestDropOff(resource))`) as the primary distance, with the villager→resource distance kept only as a deterministic tiebreak. This pulls villagers back to base-proximate trees (a villager idle in a far forest picks a near-base tree → walks back once → then cycles near the base), so effective gather throughput rises. Owner-preference (own > home neutral > other) and the unsaturated fan-out are preserved. Drop-off distance is memoized per call (one pass) so the added cost is bounded. This changes gather-assignment behavior for all owners (deliberate — the requested economy fix), so all AI/gather fixtures are re-validated and the fix is re-grounded by replaying a fresh playtest (wood before vs after).

## Verification
**Re-ground (the decisive arbiter): same seed/args, before vs after, replayed.** Wood income rose 3-15× across the mid-game for BOTH owners, and owner 1 advanced an extra age:
- owner 1 wood (t2000/4000/6000/8000): baseline 62/159/29/**4** → fixed 63/153/103/**60**; owner 1 age@8000 Feudal → **Castle**.
- owner 2 wood: baseline 27/86/6/**16** → fixed 87/**235**/80/**65**.
Wood is no longer starved to ~0; it sustains 60-235 through the mid-game, and the extra wood lets owner 1 afford Castle Age. Bundles: `output/playtests/wood-find.json` (baseline v0.1.78) vs `output/playtests/wood-fixed.json` (fixed).

TDD: `villagerGatherAssignment.test.ts` — new reproducing case (a villager far from base picks the drop-off-proximate resource, not the villager-proximate one) + a no-drop-off fallback case (villager distance, legacy byte-identical). Full suite + fixture re-validation + adversarial review: pending.

Perf note: the fix calls `findNearestDropOffBuilding` per candidate (memoized per assignment). Watch the heavy sim fixtures' timing; if a suite times out, cache drop-off positions per tick (drop-offs rarely move).

## OUTCOME (2026-07-02): fix VALIDATED for wood but NOT SHIPPED — it exposes a coupled AI age-up regression. Reverted; documented for a dedicated iteration.

The exact fix (works, ~15 lines in `villagerGatherAssignment.ts`): before the candidate sort, look up the drop-off nearest the VILLAGER (`referenceDropOff = getComponent(findNearestDropOffBuilding(world, owner, desiredResource, villagerPosition), 'position')`, one O(1) lookup — NOT per-candidate, which was 2-3× too slow); then in the sort comparator, after owner-preference + the unsaturated flag, sort by `manhattan(candidate.position, referenceDropOff)` (Infinity when no drop-off → falls back to villager distance, byte-identical legacy), with villager distance + `id` as tiebreaks. TDD: `villagerGatherAssignment.test.ts` "prefers the resource nearest the DROP-OFF" + a no-drop-off fallback case.

**Why reverted — the full-suite run surfaced a coupled regression (2 test files failed):**
- `villagerGatherSpread.test.ts` — the "≥2 trees chopped" spread proxy: a legitimate consequence (villagers now cluster on near-drop-off trees; the anti-jam guarantee is preserved by the unchanged `MAX_GATHERERS_PER_RESOURCE=2` cap + redistribute — the diagnostic confirmed villagers gather, not jam). This alone would be a justified test update.
- `aiPlayer.test.ts` "ages up through the ages" — **the blocker.** On the FU4-tuned `ai-planner-fixture` (multi-drop-off: TC + lumber-camp + mining-camp) the AI reached Feudal (t1941) but NEVER Castle, ending with food=3905 / gold=990 (ample for Castle). Diagnostic trajectory (`tmp/review-runs/ageup-diag`): at t1000 dark-age already has food=1320/wood=1600/gold=1550; Feudal by t2000 with food=1250/gold=1610 (>> Castle cost) — yet it stays Feudal, training military (food → 173 by t3000). **Mechanism:** the richer/faster economy (from the wood-locality fix) lets the AI train military aggressively; `savingForAgeUp` only suppresses military when `minProgress>=0.6 && !canAfford` (false once affordable), and the age-up research push (`aiSystem.ts:602`) is gated on `hasBuffer` + `tcEffectiveQueueLengthBeforeAgeUp < 2`. With resources churning through military, the buffer/queue conditions for the Castle push aren't met at the right moment, so the age-up never fires despite ample resources. This is a LATENT AI age-up-priority bug (age-up should preempt discretionary military spend once affordable + prereqs met) that the economy improvement EXPOSES.

**Net:** the wood-locality fix is directionally correct (re-ground: owner wood 3-15× higher, `output/playtests/wood-find.json` baseline vs `wood-fixed*.json`), but shipping it requires a COUPLED age-up-priority fix (a second high-risk AI-decision change) so the richer economy actually converts into age progression rather than stalling. That is a dedicated 2-part iteration (ground both `ai-planner-fixture` AND `default-seed` before+after; adversarial + multi-CLI review per the high-risk protocol), not a tail-of-session change. Both root causes are now identified and documented here + in `docs/engine-feedback`/roadmap for the next session. Main reverted to green.


