# Population model → AoE2-correct (roadmap M1, gap #1)

Objective: close the spec §6.10 divergence where Town Centers and Castles supplied **0** population — only Houses raised the cap. Spec §6.10 (and real AoE2) require Houses, Town Centers, and Castles to contribute headroom. This is the highest-leverage / lowest-risk roadmap item: population is the single biggest throttle on army size and sustained late-game play (campaign-3/-4 both capped at 20/20 pop).

## Change
- `BUILDING_POPULATION_PROVIDED` (prototypeBuildingRules): Town Center 0→5, Castle 0→20 (House stays 5).
- The cap becomes fully building-derived: base `STANDARD_POPULATION_CAP` 5→0, and the player's starting Town Center supplies the initial +5 through the normal completion path (so the opening cap is unchanged at 5).

## Why base 0 (not base 5 + TC-exempt)
TDD surfaced the seed order: population is seeded to the base, THEN the starting Town Center entity is created with `isComplete: true`, which fires the pop-add. With base 5 + TC=5 the opening cap became 10. There's no per-instance way to exempt the starting TC, so the correct model is base 0 + every TC (including the starting one) contributing +5. Bootstrap/darkAge tests confirm: opening cap 5, +House → 10.

## Deferred: the 200 population limit
A 200 ceiling was attempted (a `Math.min(200, …)` clamp at the two accumulation sites) but REMOVED after review. Clamping the STORED cap is lossy: over-housing past 200 (raw 205, clamped 200) then destroying a House wrongly drops the cap to 195. A correct ceiling needs RAW building-supply tracking (store raw, or recompute from completed pop-buildings on destroy; effective cap = min(raw, 200)). That is its own focused change — roadmap M1 follow-up. The ceiling is unreachable at current game scale (the game can't yet field 200 pop), so retaining the pre-existing unbounded-by-housing behavior is acceptable for this iteration, and keeps a clean invariant (stored cap = building-derived sum).

## Determinism / fog
None beyond the gameplay value change. Save format unchanged (`{current, cap}`).
