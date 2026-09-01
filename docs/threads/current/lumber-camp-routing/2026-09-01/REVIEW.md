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

## Branches A, B, D — running

A: place the camp where villagers already work, leaving routing alone.
B: home range — restrict a villager's option set to a site's neighbourhood.
D: prior art, plus an offline optimiser to bound what assignment can achieve at all.

## Method notes for round 2

- **The disqualifier list earned its place immediately.** Branch C's candidate passes the fixed reproduction at both horizons. Without disqualifier 2 written in advance, it ships as the first real win in eighteen attempts, and the mechanism it claims to validate is untouched.
- **Contention corrupts measurement.** 109 node processes were live across three branches; one branch measured its workers at ~2% of a core and lost a held-out arm. Round 2 should run branches with serialized measurement, or fewer branches at once. The DESIGN.md baseline was taken on an idle machine and is not comparable to a contended run.
