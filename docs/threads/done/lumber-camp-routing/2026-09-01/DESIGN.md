# The Lumber Camp routing gate — hard-problem search

## The fixed reproduction (unchanged for the whole search)

    npx tsx scripts/selfplay-audit.mjs \
      --seeds "aoe2-prototype,default-seed,corpus-seed-b,seed-1,seed-2,seed-3,delta,epsilon,zeta,eta" \
      --ticks 24000
    # and the identical command with --ticks 34000

Baseline, measured on HEAD:

    24,000 ticks   4 of 20 owner-slots reach Castle   156 building types   89 unit types   110 peak army
    34,000 ticks  10 of 20 owner-slots reach Castle   176 building types  115 unit types   168 peak army

Boot map per-owner at 34,000, which is the row the adoption rule protects:

    aoe2-prototype o1  feudal 12,500  qualified -       castle -       6 bldg  4 unit   4 army
    aoe2-prototype o2  feudal  9,250  qualified 23,500  castle 25,250  9 bldg  8 unit  10 army

## The done-condition

All four, together:

1. Castle-Age owner-slots improve at BOTH horizons.
2. `aoe2-prototype` regresses on nothing, per owner, at both horizons.
3. ~~Camp usage rises — the share of wood-gathering villagers whose nearest
   drop-off is a Lumber Camp rather than the Town Centre.~~ **REVISED after
   round 1 (branch D).** This condition was wrong, and keeping it would have
   rejected the correct fix. Under a true-path optimum the camp's share of
   hauls FALLS on several bases (owner 2 on `aoe2-prototype`: 100% to 10-48%),
   because the best trees sit beside whichever drop-off is nearest in WALKING
   terms — and that is often the Town Centre. "Camp usage rises" and "wood
   throughput rises" are different mechanisms and can point opposite ways.

   The replacement, which measures the mechanism without assuming which
   building wins: **wood throughput rises, and the gathering share of wood
   villagers' time rises.** Measured baseline: wood villagers gather 8-51% of
   the time (median ~24%) against 83-100% for gold, and retarget 1.4-6.2 times
   per delivered load where the design implies 1.
4. Total villager gather time does not fall (the economy is not paying for the
   camps by doing less work elsewhere).

## Disqualifiers — outcomes that will look like success and are not

Written now, with no candidate to be attached to. Six of these have already
happened in this investigation, which is why they are named rather than implied.

1. **Aggregate up, boot map down.** Attempt 16: Castle 4→6 and 10→11, and
   `aoe2-prototype` o2 took the age 3,000 ticks LATER with 3 fewer unit types.
2. **Outcome moves, mechanism does not.** Also attempt 16: camp usage went 21/67
   to 20/73 while the Castle count rose, so the gain came from something other
   than the thing being fixed. A candidate that cannot show (3) is not a fix
   even if it passes (1).
3. **One horizon only.** Attempt 12 improved at 24,000 and REVERSED at 34,000 —
   five slots lost an age they otherwise reach.
4. **The win is an artifact of the candidate's own bugs.** Attempt 10: a null
   anchor fell back to the Town Centre and the second camp displaced the Mining
   Camp; fixing both destroyed the benefit entirely.
5. **Improves by doing less.** A cheaper economy can score better on age
   timings by skipping buildings the metric does not count. Check building
   types and peak army, not just Castle slots.
6. **Tuned on the ten seeds it was measured on.** Confirm on at least three
   held-out seeds before believing it.
7. **Haul traded for approach.** Villagers can reach camps by walking further
   overall. Disqualified unless total gather time holds.

## Ruled out by measurement already — do not re-run these

- Any comparator/ranking change. Pure haul-ranking hits disqualifier 1; the
  weighted form `approach + w*haul` has NO interior optimum (w=1 returns exactly
  to baseline, w=2 falls below it, only the unweighted extreme moves anything).
- Reallocating wood between claimants. Military→buildings helped once;
  farms→buildings actively harms, because farms feed the 800-food age-up.
- More wood villagers (7→9 changed nothing on any seed).
- A second Lumber Camp (the win was an artifact of its own two bugs).
