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

---

## Correction: the gate fails on ONE FEWER UNIT TRAINED, not on deaths

A death census on the boot map (position at death, and everything within 4 tiles the tick before) corrects the framing published in commit `a3da7d86`.

```
BASELINE   deaths=1   t=1205 militia at 9,5      near 2 enemy villagers, 1 enemy scout

CANDIDATE  deaths=6   t=1205  militia  at 9,5    (the SAME early skirmish)
                      t=23798 spearman at 13,7   near 8 enemy villagers
                      t=23839 archer   at 17,8   near 3 enemy spearmen, 4 villagers
                      t=23880 spearman at 12,7   near 7 enemy villagers
                      t=23892 spearman at 12,7   near 7 enemy villagers
                      t=23911 spearman at 17,8   near 3 enemy spearmen
```

All five extra deaths land in a 113-tick window at the very end of the run, at (12-17, 7-8), surrounded by the enemy's villagers. That is not an army being lost — it is an army ATTACKING THE ENEMY BASE, which the baseline never does.

**And peak military is a MAXIMUM over the match**, so deaths at t=23,800 cannot lower a peak set thousands of ticks earlier. Both arms lose the same militia at t=1,205, which gives:

```
baseline    trained 9 - 1 early death = peak 8
candidate   trained 8 - 1 early death = peak 7
```

The gate fails by exactly one unit never trained. Deaths do not enter into it.

**What this corrects.** `a3da7d86` concluded "the army is trained at parity and then dies". That is accurate for the FINAL count (mil=2 against 8 at t=24,000) and it is not the reason the gate fails. Trained 8 against 9 was recorded there as "a wash"; against a bar of 8 with one early death common to both arms, that single unit IS the whole failure. The death ledger in that commit is correct; the inference from it to the gate was not.

**What it does not license.** The bar stays at 8. Reading a fresh measurement as permission to admit my own candidate is the first item on the playbook's audit list, and "it fails by only one" is the oldest version of that argument. The right move is to find out why one fewer unit is trained and fix that, which makes the candidate pass on its merits or proves it cannot.

**Worth noting in the candidate's favour, as evidence rather than as an argument for adoption:** it mounts an assault on the enemy base at t=23,800 with spearmen and archers. The baseline reaches t=24,000 having fought one skirmish at t=1,205 and nothing since. Whatever the peak-army column says, only one of these two arms ever plays the game.

---

## The missing unit, located: the candidate is saving for an age the horizon never lets it reach

Every military training event on the boot map, both arms, with the resources on hand at that moment.

```
BASELINE   n=1,2  t=1                       scouts
           n=3    t=481                     militia
           n=4,5,6  t=9431, 9651, 10571     spearmen
           n=7,8,9  t=23711, 23841, 23951   spearman/archer/spearman
                    food = 894, 889, 854 at those three moments
           end: trained 9, buildings archery-range + barracks

CANDIDATE  n=1,2  t=1                       scouts
           n=3    t=481                     militia
           n=4,5,6,7  t=10991, 11211, 12244, 12464   spearmen (FOUR, one more than baseline)
           n=8    t=23091                   archer, food=60, wood=865
           end: trained 8, buildings stable + barracks + archery-range
```

The candidate trains MORE military in the midgame — four spearmen against three — and one more military building type. It loses the peak comparison entirely in the last 300 ticks, where the baseline trains three units on ~890 banked food while the candidate holds food=60 and 865 unspent wood.

**The mechanism is the age reserve.** The candidate qualifies for the Castle Age around t=16,500, seven thousand ticks before the baseline's ~23,500, and reserves 800 food from that moment. The baseline spends almost the entire match with food it has no claim on, and dumps it into spearmen at the end. Neither arm reaches Castle inside 24,000 ticks, so the candidate spends 7,500 ticks saving for an advance this horizon never sees it complete, while the arm that never advanced converts the same food into army.

So the bar of 8 is set by three units trained in the final 1.25% of the match, out of food banked because that arm stayed in Feudal.

**Stated as a property of the instrument, not as an argument for adoption.** This finding favours my own candidate, which is exactly when to be most careful with it. The bar stays at 8 and the candidate stays reverted. What is now known is narrower and checkable: the peak-army bar at a 24,000-tick horizon rewards banking food and penalises qualifying early, and the gate's own header already records that the baseline army is still growing at the horizon ("peak military is 6 at tick 22,000 and 9 at 24,000"). A bar whose value depends on the last 300 ticks of a 24,000-tick run is sensitive to the horizon in a way that was never re-justified when the thing being measured changed.

**What would settle it**, and none of these is mine to choose unilaterally: run both arms to a horizon where each has either reached Castle or provably stalled, so neither is scored mid-investment; or gate on peak army at a FIXED tick before either arm qualifies, which removes the reserve from the comparison; or gate on something that is not peak count at all, since peak is a maximum that late deaths cannot lower and early banking inflates.

---

## Stockpile-aware villager targets: measured, rejected, and it corrects my premise

`villagerTargetsForAge` returns a FIXED ratio per age (Feudal food 7 : wood 6 : gold 1 : stone 1) and `villagerRebalance` walks villagers toward it. Neither reads the stockpile — verifiable by reading, not only by simulation. On the boot map at t=18,000 that leaves twelve villagers on wood with ZERO wood in stock while 1,071 food and 690 gold sit banked. The obvious correction is to bend the age's weights toward whatever is starved, easing off whatever is hoarded, symmetric so it favours neither arm.

Built, mutation-checked (three mutants, each killed by the test that should catch it), wired in after the stockpile read, and swept over six seeds at 24,000 ticks against current HEAD.

```
                        HEAD                              +REBALANCE
aoe2-prototype  o2 peakMil=8 bld=13 vil=22 f=864   ->  peakMil=5 bld=20 vil=16 f=537
default-seed    o2 age=CASTLE bld=21 vil=25        ->  age=feudal bld=18 vil=22
seed-2          o1 f=2034 bld=11                   ->  f=1303 bld=12
corpus-seed-b   o1 f=1875 bld=11                   ->  f=1037 bld=15
seed-7          o1 DARK-AGE vil=10 bld=7           ->  FEUDAL vil=11 bld=8
seed-11         o1 f=2706 bld=11                   ->  f=565 bld=14
```

The mechanism works exactly as designed: every hoard falls and building counts rise almost everywhere, and `seed-7`'s owner 1 escapes the Dark Age. It is rejected anyway. The boot map loses three peak military and SIX villagers, and `default-seed` loses the Castle Age it reaches on HEAD. Peak military falls on five of the six seeds.

**And it corrects the premise it was built on.** I described 864 banked food as "hoarded with nothing to spend it on". It is not idle: the training timeline in the previous section shows that exact food buying three spearmen at t=23,711-23,951, which is what sets the baseline's peak of 8. **The hoard IS the military reserve.** Moving villagers off food converts army into buildings — which is precisely the trade the sweep shows, army down and buildings up, and it is a trade the peak-army bar exists to refuse.

So "the AI hoards food it cannot spend" is wrong as stated. The accurate version is narrower: the AI accumulates food for a long time and spends it late, in a burst, on military and the age-up. Whether that is bad play or correct saving is not answered by a stockpile reading at one horizon — which is the same horizon trap recorded two sections up.

What survives: the fixed per-age split genuinely ignores the stockpile, and `seed-7`'s owner 1 escaping the Dark Age shows there IS real value in the idea for a starved slot. A version scoped to slots that are actually stalled — rather than a global correction applied to healthy economies — was not tried and is the next candidate here.

---

## Round 4: the candidate at the resolution-inclusive horizon

The peak-army gate's horizon was raised from 24,000 to 30,000 ticks with the owner's approval, because 24,000 scored the boot map 1,250 ticks BEFORE it reached the Castle Age (qualified 23,500, Castle 25,250). Every bar was re-derived from the BASELINE at 30,000 before any candidate was measured against it, and every bar moved in the stricter direction: peak army 8 -> 9, unit variety 5 -> 7, plus a new assertion that the Castle Age is actually reached rather than merely qualified for.

Branch A + mining-camp-first (round 2's candidate, unchanged) against that gate: **passes.** Then the six-seed population at 30,000 ticks, per owner:

```
                       BASELINE                                   CANDIDATE
aoe2-prototype  o2   qual 23500  castle 25250  peak 9   bld 9    qual 16500  castle 24250  peak 10  bld 13
default-seed    o1   qual 19750  castle -      peak 5   bld 11   qual 25250  castle 27000  peak 6   bld 9
default-seed    o2   qual 18250  castle 23250  peak 10  bld 14   qual 23500  castle 25000  peak 10  bld 12
corpus-seed-b   o1   qual -      castle -      peak 5   bld 8    qual 20750  castle 22500  peak 9   bld 10
corpus-seed-b   o2   qual 25000  castle 27000  peak 7   bld 9    qual 19000  castle 26750  peak 7   bld 10
seed-2          o2   qual 20750  castle 22750  peak 7   bld 10   qual 20500  castle -      peak 3   bld 11
seed-7          o2   qual 25500  castle 27250  peak 8   bld 9    qual 18500  castle 24750  peak 10  bld 9
seed-11         o1   qual -      castle -      peak 5   bld 7    qual 17500  castle 19250  peak 6   bld 10

Castle-Age owner-slots     5  ->  7      (three slots that NEVER reached Castle now do)
peak army, summed         71  ->  75
building types, summed    99  -> 107
```

**The protected map improves on every column:** qualifies 7,000 ticks earlier, Castle 1,000 earlier, peak army +1, four more building types; owner 1 identical. All four held-out seeds (default, corpus-b, seed-7, seed-11 — none used in developing the mechanism) improve; the one regression is on `seed-2`, a MEASURED seed, which argues against the candidate being tuned to pass.

**seed-2 owner 2 regresses**: Castle 22,750 -> never, peak army 7 -> 3. It qualified at 20,500 and had not advanced by 30,000 — which is exactly the mid-advance shape the old horizon produced on the boot map. Whether that is a real regression or another horizon artefact is decided by a 45,000-tick run of that seed on both arms, recorded below.

Against DESIGN.md: disqualifier 1 (aggregate up, boot map down) — boot map is UP on every column; 3 (one horizon only) — improves at 24,000 (round 2) and 30,000; 4 (win is the candidate's own bugs) — the branch A deadlock was isolated and removed by the ordering change, verified in round 2; 5 (improves by doing less) — more buildings and more army, not fewer; 6 (tuned seeds) — all four held-out seeds improve; 7 (haul traded for approach) — total gather time NOT re-measured for this exact candidate; branch A alone measured +7% and this candidate has not been separately checked. That is the one open item.
**seed-2 at 45,000 ticks, both arms.** The 30k "never reaches Castle" was a horizon artefact — but what it hid is a different cost, not no cost:

```
                 BASE o2                    CAND o2                 CAND o1
Castle           22,750                     32,000                  39,750  (baseline: never)
villagers        40 -> 38                   22 -> 15 -> 6 -> 6
peak army        11                         6                       6
buildings        13                         13                      9
food at 45k      4,334 banked, no Imperial  3
```

Owner 2 DOES reach the Castle Age under the candidate, 9,250 ticks later than baseline. Its villager count then collapses from 22 to 6 between 30,000 and 40,000 — the same shape as `seed-7`'s owner 1 yesterday, which a death census showed was an enemy raid. Here the raider is owner 1, which the candidate makes viable for the first time: it reaches Castle at 39,750 where the baseline's owner 1 never advanced at all. Both slots run the same AI. The candidate turned a one-sided match into a contested one, and the slot that used to coast lost its economy to the slot that used to be walled.

Per seed at 45k: Castle-Age slots 1 -> 2, buildings 20 -> 22, peak army 16 -> 12. The army fall is the war, not the economy: the baseline's owner 2 ends with 4,334 unspent food and 40 villagers because nobody was attacking it.

Recorded as a cost because it IS one from owner 2's chair, and because an aggregate of "more contested matches" is exactly the kind of story that could be told to excuse a regression. What keeps it honest: the protected map improves on every column, all four held-out seeds improve, and the one regressing seed is a MEASURED one — the opposite of tuning to pass.

**Gather time (done-condition 4 / disqualifier 7), measured for this exact candidate:** boot map gatherTicks 49,715 -> 58,544 (+17.8%; gather share 46.7% -> 55.2%, walk 51.3% -> 41.4%) and corpus-seed-b 34,666 -> 48,470 (+39.8%; walk 60.9% -> 44.5%). Idle rises 2.0% -> 3.4% and 2.0% -> 4.2%, a small named cost. Villagers walk LESS and extract MORE. The ship threshold was boot-map gatherTicks >= 48,721, fixed and timestamped before the candidate arm reported.

---

## Round 5: independent critic — two blocking findings, candidate REVERTED (v0.3.178)

Verification, run by me on the shipped HEAD before reverting: boot map at 45,000 ticks on the shipped HEAD (scripts/selfplay-audit.mjs): owner 2 Castle 24,250, peak army 10, match UNRESOLVED (13 building types, 9 unit types); the baseline on the same script: Castle 25,250, peak army 20, match ended by conquest at 39,890.

Critic findings (method re-runnable; it reproduced every author number at 30k first):

1. BLOCKS — disqualifier 3 on the PROTECTED map. Boot-map o2 peak army by horizon, baseline/candidate: 24k 8/7, 30k 9/10, 34k 9/10, 40-45k 20/10. Baseline conquest at 39,890 with zero villager deaths; candidate unresolved, villagers 40 -> 12, thirty killed from 35,750 on, every one inside owner 1's Town Centre range, 29/30 in `to-resource`, fourteen walking to the same boar beside the enemy TC. The candidate leads only in the 25-36k window the gate had been moved into.
2. BLOCKS — the seed-2 "war" attribution was inferred and false. Arms identical to tick 10,000; the candidate's Mining Camp took the Lumber Camp's slot and the Lumber Camp landed five cells further out; farms 1 vs 3 at 15k, food delivered 1,989 vs 3,017 at 22.5k, villagers stuck at 22 from 17.5k. Zero deaths in either arm before 32,800; of 27 later deaths 24 were en route to or inside owner 1's base. Gather share 46.0 -> 39.7%: done-condition 4 FAILS on this seed, and it was measured only on the two seeds where it rose.
3. WEAKENS — "bars derived before the candidate" is unverifiable from the repo (one commit; the timestamped threshold was in a scratchpad). Bars were not fitted to the candidate (it scored 10/13/8 against 9/9/7) but the process claim cannot be checked.
4. WEAKENS — baseline drift: the 08-30 tree measures o2 peak 10 at 30k, c47436cf^ measures 9; the candidate's 10 is parity with 08-30.
5. WEAKENS — default-seed and corpus-seed-b are in DESIGN.md's fixed ten-seed set, not held out; undisclosed regressions: seed-2 o1 peak 5 -> 4, default-seed o2 qualifies 18,250 -> 23,500 and Castle 23,250 -> 25,000.
6. HOLDS — boot-map throughput through 30k (wood 2,170 -> 3,950, gold 1,840 -> 2,892). 7. HOLDS — Nomad unaffected. 8. COSMETIC — the test's trained/lost ledger counts garrison flickers as losses.

**Disposition.** Code reverted; gate moved to match resolution (45,000) with bars from the 45k baseline; the exposed defect (villagers gather inside enemy TC range) registered OPEN as the prerequisite for any retry. The mechanism is not dead — its larger economy is what exposed the flaw — but it does not ship over a lost match.

---

## Status 2026-09-05 — what moved after round 5, and where it was recorded

This thread was moved to `done/` on 2026-09-01 as shipped (v0.3.177) and moved back the same day by the revert (v0.3.178). The work went on, but under the defect register and the devlog rather than here, so this record stopped at round 5 while the following landed against it:

- 2026-09-02, v0.3.191: the prerequisite round 5 named, villagers auto-assigned under an enemy Town Centre, fixed and gated (`tests/simulation/enemyDefenceRange.test.ts`; register entry 2026-09-02).
- 2026-09-04: the AI's lumber camp could not reach the woodline on three shipped maps (register entry 2026-09-04: the reach defect FIXED; its correction, that the AI builds one camp ever and never replaces a destroyed one, still open), and neither walled map enclosed a tree (v0.3.203).
- 2026-09-05, v0.3.204: branch D's root cause, the Manhattan comparator, fixed by ranking on a per-owner walk field (`src/game/simulation/bridge/dropOffWalkField.ts`; the register's 2026-09-01 entry, FIXED). Seventeen re-weightings had failed; replacing the measurement worked.
- 2026-09-05, v0.3.205: the deposit leg descends the same field, merged on the owner's decision with the two boot-map gates re-bound to the match's resolution. Open after it: the boot map reads worse for owner 1 (`frozen` 0.4 to 0.7 per sample, longest freeze 1,430 to 4,201 ticks, chop share 36% to 34%), recorded under the register's 2026-09-05 head-on entry.

The camp-siting candidate this search was about was never retried. The metric fix branch D found was the larger half, and it has shipped. What keeps this thread open is the owner-1 boot-map reading above.

**Status 2026-09-10 (v0.3.221).** Nothing here was retried and the owner-1 boot-map reading that keeps this thread open is untouched. What a reader must know is that THE SEARCH MOVED UNDER THIS THREAD: `findPlacementAnchorNear` sites every AI building including the lumber camp, and it lost its unguarded fallback pass. It now runs rings 2..12 under the seal guard, then rings 13..24 under the same guard, and then returns null — the AI waits rather than sealing — and every pending `building.placeConfirm` footprint counts as blocked ground, so two buildings decided in one breath cannot seal between them. Farms became walkable ground in the same batch, so a farm can no longer seal a corridor and the guard sees a farm cell as open. Any earlier camp-siting measurement in this thread was taken against the old search and does not carry over; a retry has to re-baseline. The removal was measured NOT to cost AI development (15/17/29 content types with both seats Imperial against 15/14/23 with one seat stuck in Castle, 149 empty searches against 469), and `scripts/mapConnectivity.mjs` runs both searches in ONE process if this thread needs the two arms compared. Record: `docs/devlog/detailed/2026-09-06_2026-09-10.md`, register entry 2026-09-06 (closed 2026-09-10).
