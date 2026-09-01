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

# Round 2 — the closest candidate yet, rejected by a gate written before it existed

Branch A's mechanism (anchor the Lumber Camp on the medoid of trees villagers actually target) paired with mining-camp-first ordering, which branch A proved by isolation removes the ten-villager deadlock.

**Measured seeds (10 seeds, 20 owner-slots):**

    24,000   baseline 4 Castle / 156 / 89 / 110    candidate 5 / 165 / 88 / 102
    34,000   baseline 10 Castle / 176 / 115 / 168  candidate 11 / 187 / 121 / 169

**Held-out seeds (6 never used for tuning, 12 owner-slots) — the bar round 1's candidates failed:**

    24,000   baseline 2 Castle / 84 / 50 / 59     candidate 3 / 87 / 54 / 61
    34,000   baseline 6 Castle / 103 / 63 / 97    candidate 8 / 103 / 72 / 91

Castle-Age slots improve at both horizons on BOTH populations. Disqualifier 6 is cleared for the first time in the investigation, and the mechanism check (disqualifier 2) was already cleared by branch A.

**Boot map, per owner at 34,000.** Owner 2 qualifies 7,000 ticks earlier (23,500 to 16,500), reaches Castle 750 earlier, and gains four building types and a unit type; owner 1 gains a building type. But Feudal arrives 1,750 ticks later and peak army falls 10 to 9.

**Rejected, and by the right thing.** `aiReachesCastleAge.test.ts` fails:

    peak military 7 — the age was bought by disbanding the army: expected 7 to be >= 8

That assertion was written earlier in this session, before this candidate existed, for exactly this shape — a candidate that buys an age by giving up the army. It is measuring what it was built to measure and the candidate does what it was built to catch. Moving the bar to admit it is the first item on the hard-problem playbook's audit list ("the assertion moved rather than the behaviour"), so the bar stands and the candidate goes.

**What round 2 establishes.** The mechanism is real and replicates on held-out seeds — camp placement at the work is worth Castle-Age slots on populations it was never tuned against. The cost is army, consistently: A alone 110→101 and 168→158, A plus mining-first 110→102 and 168→169 in aggregate but 8→7 on the boot map specifically. Every variant of this mechanism measured so far trades army for age.

**The gap, stated exactly.** A version of this that does not cost boot-map peak army would pass every bar in DESIGN.md. Nobody has yet explained WHY the army falls — whether it is wood diverted from military, villagers idle during camp relocation, or the mining-camp displacement's residue. That explanation is the next piece of work, and it is a measurement rather than another candidate.


---

## Why the army falls: measured, and it is none of the three candidates

Round 2's record named the gap: "Nobody has yet explained WHY the army falls — whether it is wood diverted from military, villagers idle during camp relocation, or the mining-camp displacement's residue." All three are now falsified, and the real mechanism is measured.

Two independent probes on the boot map (`aoe2-prototype`), owner 2, 24,000 ticks, baseline against branch A + mining-camp-first.

Sampled state:

```
                t=18000                      t=24000
baseline   mil=6  bld=13 wood=0    food=?    mil=8 bld=13 wood=10  food=885
candidate  mil=6  bld=19 wood=235  food=?    mil=2 bld=21 wood=985 food=210
```

Unit-identity ledger, every tick:

```
baseline    trained=9  lost=1  peak=8   feudal@9191
candidate   trained=8  lost=6  peak=7   feudal@10751
```

**The army is trained at parity and then dies.** 8 against 9 is a wash; 6 lost against 1 is the entire effect. The candidate's final `mil=2` is 8 trained minus 6 lost, and the baseline's `mil=8` is 9 minus 1 — the ledger reconciles exactly against the independently-run sampled probe for both arms, which is what rules out reused or unstable unit ids.

What that kills:

- **Wood diverted to buildings** — dead. The candidate is holding **985 unspent wood**, 98x the baseline's 10. It is not wood-starved for military; it is not spending what it has.
- **Villagers idle during relocation** — dead. Both arms field 22 villagers, and the candidate is *ahead* on buildings, 21 to 13.
- **The age was bought with food** — dead, and this one was my own leading hypothesis walking in. **Neither arm reaches the Castle Age on the boot map inside 24,000 ticks**; both stop at Feudal. The 800-food advance never happened here, so it cannot explain the food gap.

The surviving explanation, not yet proved: the mechanism sites the Lumber Camp on the medoid of the trees villagers actually target — forward, off the Town Centre, on exposed ground — and moves the economy out there with it. That is one coherent cause for what looked like three independent tunings, because *every* variant of this mechanism has traded army for age (A alone 110 -> 101, A+mining-first 8 -> 7).

Consequence for the gate: `aiReachesCastleAge` was right to reject round 2 and wrong about why. Its message read "the age was bought by disbanding the army" — accurate for the mechanism it was written for (a wood reserve with no defensive floor, which really did halve the army to buy buildings) and a misdescription of the candidate that next tripped it. Nothing was disbanded and no age was bought. The threshold stays at 8; the message now reports the trained/lost split it measures, so a reader is sent after the right mechanism.

---

## Round 3: the latch fix does not rescue branch A (falsified)

With the villager latch fixed (v0.3.175), branch A + mining-camp-first was re-run against the boot-map gate. The prediction was that the army cost would ease, on two mechanisms: the register records branch A CAUSING a latch ("all ten villagers on ONE cell (51,28) ... unmoving from t=9,000 to t=20,000"), and traffic starvation applies to military units too, so units queueing through a contested gap would arrive piecemeal — which is what a 6-to-1 loss ratio looks like.

Both are wrong. The result is IDENTICAL to round 2:

```
peak military 7 below the bar of 8: trained 8 but LOST 6 — the army died in the field
```

Trained 8, lost 6, peak 7 — the same three numbers. Branch A's army cost is independent of the traffic election, and the two mechanisms above are eliminated rather than merely unsupported: had either contributed, the loss count would have moved.

What still stands: the army dies in the field, at training parity, holding 985 unspent wood, in a match where neither arm leaves Feudal on this map. The cause of the DEATHS remains unmeasured. The open question is now narrower than before — not "why does the army fall" (answered: it dies) and not "does traffic starvation kill it" (answered: no), but where and to what those six units are lost.

Incidental confirmation: the gate message rewritten earlier the same day did its job on its first real failure, naming "trained 8 but LOST 6 — the army died in the field". The message it replaced would have read "the age was bought by disbanding the army" and sent the reader after a resource tradeoff that does not exist here.
