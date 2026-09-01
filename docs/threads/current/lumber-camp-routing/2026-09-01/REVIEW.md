# Search synthesis — round 1

Scored against `DESIGN.md`, which was written before any branch existed.

## Branch C — attack the demand (CLOSED, blocked, with the round's most valuable finding)

**Result: blocked. Two disqualifiers hit, done-condition 2 failed.**

Its candidate — cap Feudal farm demand by standing natural food within gather range — improved the headline at both horizons (Castle-Age owner-slots 4→7 at 24,000 and 10→13 at 34,000, with building and unit types up at both). It was rejected anyway, correctly, by the branch itself:

- **Disqualifier 2 (outcome moves, mechanism does not).** The wood ledger moved only 5.6%. Soil costs 60 wood per 175 food whether it is BUILT or RESEEDED, so capping plot count cannot cut wood — new-farm wood fell 23% and came straight back as reseeds up 25%. The headline gain was a build-order sequencing effect: the picker stops returning `farm` and reaches `blacksmith`.
- **Disqualifier 6 (tuned on the measured seeds).** Held-out seeds at 24,000 went Castle 1→0.
- **Done-condition 2.** The boot map lost peak army at 24,000 and a unit type at 34,000.
- Also unshipped: a +17% simulation wall-time cost from an unoptimised per-tick scan.

**The finding that reframes the whole investigation.** Measured observationally over nine seeds and eighteen owner-slots, the Feudal wood ledger is:

    farms 63.6%   (41.4% construction + 22.2% reseeding)
    halls 20.7%   (blacksmith, archery range, stable, market)
    military under 10%

The figure this investigation had been reasoning from — "715 to buildings, 525 to spearmen out of 1,240" — was stale by an order of magnitude and counted no reseeds at all. **Military versus construction was never the contention.** Committed as a correction to the register in `0419291c`.

And the AI farms while free food stands beside it: `default-seed` owner 1 held 2,125 food of gatherable natural food inside its own Town Center's gather range, flat from tick 18,000, while wood never passed 58 and it built seven farms. A farm gathers 0.333 food/s against boar and deer at 0.408.

**Lead handed to round 2, untested:** the reseed is ungated — it fires whenever affordable, even at 1,600 banked food, and is 22% of Feudal wood — and the assignment comparator prefers a 60-wood Town-Center-adjacent farm to free sheep ten tiles away. The second is what would make the first pay.

## Branch D — prior art and the upper bound (CLOSED; it relocates the root cause)

**The prize is real and bounded: a near-optimal assignment is worth 1.49x the AI's measured total gather throughput.** Not a few percent, so the family is not capped; not an order of magnitude either. Measured over 16 owner-snapshots across four seeds, three of them held out, at two ticks each. A replica of the CURRENT policy scores 1.01x measured, which is what validates the model.

**93% of the headroom is wood:**

    wood   3,518 -> 9,188   2.61x
    food   6,451 -> 6,774   1.05x
    gold   2,400 -> 2,396   1.00x
    stone    550 ->   670   1.22x

**The root cause is one layer below where this investigation put it.** The comparator ranks candidates by MANHATTAN distance, and the pathfinder is strictly 4-connected: `findGridPath` is called from `movementPlanOps.ts:236` with no `allowDiagonal`, and `civ-engine/src/path-service.ts:202` defaults it to `false`. I verified both call sites myself.

On open ground 4-connected walk distance IS Manhattan, so the metric is exact — which is why gold, sitting in the open, has literally nothing to gain (1.00x). Around obstacles it is arbitrarily wrong, and a forest is a dense block of impassable resource cells. Measured on the AI's own live targets: wood villagers are assigned trees at Manhattan 3.6-10.1 whose TRUE walk is 2.6-45.1 tiles. On `aoe2-prototype` at tick 24,000, three villagers were working trees at walk 37 and 35 while trees at walk 0 and 3, each holding 100 wood, sat unused — all four look like Manhattan 8-9 to the comparator.

**Which half matters, ablated separately (wood, true path costs):**

    anchor only  (rank from the resource's own nearest drop-off)   1.16x - 7.63x
    metric only  (rank by true walk)                               1.62x - 7.63x
    both                                                           1.62x - 7.63x

**The metric fix dominates and is never worse.** The anchor defect — the one identified in commit `5c31d4e8` and treated as THE root cause since — is the smaller half, and fixing it alone leaves value on the table on every base measured. That also explains why every comparator attempt failed: they all re-weighted a metric that was measuring the wrong quantity.

**Camp placement is the small family.** One extra optimally-placed drop-off, on top of optimal assignment, adds only 8-20%. The camp is not the bottleneck; the choice is.

**Independent corroboration from prior art, verified verbatim rather than summarised.** AoE2's own AI scripting language measures resource-to-dropsite distance and never villager-to-dropsite; its `sn-wood-dropsite-distance` targets a 3-tile wood haul against our measured 2.6-45.1; and `sn-max-retask-gather-amount` = 40 is explicit anti-churn hysteresis against our 1.4-6.2 retargets per load. 0 A.D.'s Petra builds a dropsite when `lost/total > 0.15` on exactly the two gatherer states we can sample — our wood ratio is 0.66-0.67, over four times its threshold, against 0.10 for food and 0.00 for gold.

**The branch caught an instrument error that would have ended the search.** Its first pass priced hauls at Manhattan distance and concluded "optimal is worth 1.03-1.27x, decaying to 1.0 — this family is capped, abandon it." Wrong, and wrong in the direction that stops the work. It was caught because the modelled gathering fraction (70%) did not match the measured one (19%). The same Manhattan assumption that causes the bug nearly hid it.

## Branches A, B — running

A: place the camp where villagers already work, leaving routing alone.
B: home range — restrict a villager's option set to a site's neighbourhood.
D: prior art, plus an offline optimiser to bound what assignment can achieve at all.

## Method notes for round 2

- **The disqualifier list earned its place immediately.** Branch C's candidate passes the fixed reproduction at both horizons. Without disqualifier 2 written in advance, it ships as the first real win in eighteen attempts, and the mechanism it claims to validate is untouched.
- **Contention corrupts measurement.** 109 node processes were live across three branches; one branch measured its workers at ~2% of a core and lost a held-out arm. Round 2 should run branches with serialized measurement, or fewer branches at once. The DESIGN.md baseline was taken on an idle machine and is not comparable to a contended run.
