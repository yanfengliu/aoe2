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

## Branch B — home range (CLOSED, blocked, blocker located)

**Result: blocked, and the blocker is a property of the map rather than of the mechanism.** Its benefit is a function of camp-to-Town-Center SEPARATION, and nothing in the design knows that.

    corpus-seed-b     camp 10 tiles from the TC   camp usage 0% -> 36.6%   wood +72%
                      owner 2 goes from never qualifying to Castle at 22,250

    aoe2-prototype o2 camp  5 tiles from the TC   camp usage 75% -> 69.8%  wood -19%
                      walking share 73.3% -> 78.8%

Where the camp is a genuinely separate neighbourhood, homing works and works hard. Where it overlaps the Town Center, splitting one forest between two anchors makes villagers walk MORE. The boot map is the second case, so disqualifier 1 is hit: aggregate Castle-Age slots rise (3→4 at 24,000, 6→7 at 34,000) while `aoe2-prototype` owner 2 regresses on five of six columns. Peak army falls about 10% at both horizons (disqualifier 5, partly).

The branch built three corrective variants, all showing the identical boot-map slip — and one of them falsified its own traced hypothesis, which is worth more than the variants: an arm leaving food untouched still slipped, so the food-spill explanation it had traced was wrong. A fourth variant — merge drop-offs within 8 tiles into ONE site — is the shape that should fix the overlap case and **was never measured**; its threshold would also be tuned on these seeds.

Its test is a real gate: it FAILS on clean HEAD (baseline picks the Town-Centre tree and deposits at the TC) and passes with the mechanism.

## Two method errors of mine, corrected by the branches

**1. My contention warning was half wrong, and the wrong half could have cost real work.** I told all three running branches that measurements taken under heavy CPU load might not be comparable to the DESIGN.md baseline. Branch B checked rather than accepting it: `bridge.step` is a fixed-step accumulator and `src/game/simulation/` contains no `Math.random` or `Date.now` (verified here — the only matches are a comment in `garrisonHealSystem` explaining their absence). Empirically it reproduced the baseline EXACTLY under 106-process load, and two independent 34,000-tick controls were byte-identical.

So contention costs wall-clock, not validity. Had a branch discarded good numbers on my say-so, that would have been my error propagating. The correct warning was the narrower one: contention makes runs SLOW and can leave arms unfinished, which is what actually happened to branch C.

**2. Fanning four branches at one working tree was a design mistake.** Branch B found another branch editing `src/` underneath it mid-run and moved to private worktrees to protect its own measurements; one artifact of the collision still reached its patch (an inert `export` picked up from a sibling). Independent branches need independent trees. Round 2 issues worktrees up front rather than leaving each branch to discover the hazard.

## Branch A — move the camp to the work (CLOSED; mechanism VALIDATED, candidate disqualified)

**The first candidate in this investigation to move the mechanism.** Anchoring the Lumber Camp on the MEDOID of the nodes the owner's wood villagers currently target, rather than on the tree nearest the Town Center:

    camp usage (delivery ground truth)   39.68% -> 51.90% at 24k, 40.76% -> 44.44% at 34k
    median haul, tree to drop-off        9 -> 7 and 9 -> 8
    total gather time                    +7% at both horizons
    Castle owner-slots                   4 -> 7 at 24k, 10 -> 14 at 34k
    building types                       156 -> 175 and 176 -> 190

Measured before writing code: the camp is planted a median **14 tiles** from the woodline being cut; the candidate puts it a median **4.5** tiles away. Placement ticks are identical in both arms, so up to that moment it is a pure siting change.

Disqualifiers 2, 3, 4 and 7 all CLEARED — the first time any candidate has cleared 2. Disqualifier 5 partly flagged (peak army falls 110→101 and 168→158, real and unexplained). Disqualifier 6 not run.

**Disqualified by 1, and the cause is not the mechanism.** The relocated camp takes the ground the Mining Camp used, pushing it to (52,24), hard against the Town Center's footprint. On the boot map, owner 2's economy then stops dead at tick ~7,500 and never restarts: all ten villagers stand on **one cell, (51,28)**, every one in `to-resource`, none moving, from tick 9,000 to tick 20,000, with the berry bushes regrowing because nobody eats them. Owner 2 never leaves the Dark Age.

The branch isolated it rather than theorising: flipping the Dark-Age build order so the Mining Camp is requested first returns it to (46,31) and **the deadlock disappears entirely**. So the stall is caused by the DISPLACEMENT, not by the camp's own position — the same failure mode the register already recorded for attempt 10.

**And it found something bigger than its own mechanism.** (51,28) is NOT a sealed pocket: (50,28) and (52,28) are open grass in both arms. Ten units latched permanently on an open cell, with a gold mine three tiles away they never reach. That is a movement or assignment latch that any building rearrangement could trigger, and it is independent of camp siting entirely. It is now the gate in front of the largest prize measured on this wall.

A: place the camp where villagers already work, leaving routing alone.
B: home range — restrict a villager's option set to a site's neighbourhood.
D: prior art, plus an offline optimiser to bound what assignment can achieve at all.

## Method notes for round 2

- **The disqualifier list earned its place immediately.** Branch C's candidate passes the fixed reproduction at both horizons. Without disqualifier 2 written in advance, it ships as the first real win in eighteen attempts, and the mechanism it claims to validate is untouched.
- **Contention corrupts measurement.** 109 node processes were live across three branches; one branch measured its workers at ~2% of a core and lost a held-out arm. Round 2 should run branches with serialized measurement, or fewer branches at once. The DESIGN.md baseline was taken on an idle machine and is not comparable to a contended run.

## Round 2's target, specified

Branch D's ablation makes the choice for us: the METRIC fix dominates the anchor fix (1.62-7.63x against 1.16-7.63x on wood, and both together equal the metric alone). So round 2 is one focused change, not another portfolio.

**Replace Manhattan with true 4-connected walk distance in the gather comparator.** Reading `villagerGatherAssignment.ts`, the error is in TWO places, which is more than the branch reports called out:

- line 186, the home-range FILTER — `manhattanDistance(candidate, referenceDropOff) <= HOME_GATHER_RANGE`. An unreachable tree at Manhattan 8 passes this today.
- lines 240-243, the primary RANKING by distance to the reference drop-off.

One multi-source BFS from every drop-off of the relevant kind fixes both, and subsumes a third thing: the `MAX_REACHABILITY_PROBES = 16` per-call pathfinding that exists precisely because the comparator cannot tell reachable from unreachable. A BFS field returns Infinity for unreachable cells for free.

**The invalidation signal already exists, and this is the third consumer.** `worldOccupancy.structuralRevision` is bumped by every claim and release and by `notePassabilityChange()`. It already keys the v0.3.160 unreachable-plan cache and the spawn-passability memo added earlier this session. The architecture decision written with that memo says: "A third consumer should be read as a signal that the counter deserves a named invalidation type rather than another comment." Round 2 is that third consumer, so it should introduce the named type rather than adding a third bare comment.

**Cost.** 2,160 cells on a 60x36 map, one BFS per owner per resource kind, recomputed only when the structural revision moves. Microseconds, against a comparator that currently runs a bounded A* probe loop per assignment.

**What must still be proved, and is not yet.** 1.49x is a resource RATE. Nobody has shown that rate is what gates the Castle Age — every disqualifier in DESIGN.md applies to this candidate unchanged, and the two that killed round 1's candidates (aggregate-up-boot-map-down, and outcome-moves-mechanism-does-not) are the ones to watch. The revised done-condition 3 is the guard: wood throughput and the gathering share of wood villagers' time must both rise.
