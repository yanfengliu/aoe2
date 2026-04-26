You are a senior code reviewer brainstorming the cleanest fix for finding V4-11 from `docs/reviews/full/2026-04-26/1/REVIEW.md`. Today is 2026-04-26.

# The problem

`src/game/simulation/bridge/matchEndOps.ts:170-186` defines `playerHasConquestPresence(owner: number): boolean`. It walks `world.query('unit')` and `world.query('building')`, short-circuiting on the first owned entity it finds. Called from `src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:41-43` once for the human plus once per enemy every tick (60 TPS).

When a player is on the verge of elimination (zero presence), neither `world.query` short-circuits — both fall through to a full ~200-entity scan. With 4 players that's 4 × full scans × 60 TPS = ~48k component reads per second during the elimination tick. Not a current bottleneck (2 players, presence is rare to be exactly 0) but grows quadratically with player count and entity count.

# The naive fix Claude suggested

Maintain a `playersWithPresence: Set<number>` side map. Update from FOUR sites where ownership changes:

1. `entityCreateOps.addUnitEntity(owner, ...)` — first unit for this owner → add to set
2. `entityCreateOps.addBuildingEntity(owner, ...)` — first building → add (if not already)
3. `entityDestroyOps.destroyUnitEntity(id)` — last unit AND last building for this owner → remove
4. `entityDestroyOps.destroyBuildingEntity(id)` — same condition
5. `monkTaskAppliers.ts:165` (`targetUnit.owner = monkUnit.owner`) — Monk conversion transfers ownership; potentially adds to new owner's set AND removes from old owner's set if last unit

Then `playerHasConquestPresence(owner) === playersWithPresence.has(owner)`.

# Why I'm hesitant about the naive fix

Five mutation sites. Each one has to maintain the invariant. A miss silently turns the conquest system into a no-op (player who actually has no presence stays "alive" forever) or a false-positive elimination (player still has units but the set says they don't). Failure mode is worse than the current 48k-reads-per-second cost.

Specific complications I'm seeing:

- The set has to track unit count + building count separately to know when to remove (last unit doesn't remove if buildings remain). So really `Map<owner, { units: number; buildings: number }>` or two `Map<owner, number>`s.
- Monk conversion only mutates `unit.owner` directly — it doesn't go through any factory function. The site is one line; easy to miss.
- Sheep ownership transfer via the herdable system also reassigns `resource.owner`. Are sheep "presence"? Today's `playerHasConquestPresence` only walks units + buildings, so sheep don't count. But the new side map would be tempted to track resources for symmetry.
- Save/load: the side map needs to round-trip through `SaveBlob`, OR we rebuild it from `world.query` on load (cheap one-shot). Rebuild is simpler and avoids a save-format break.
- Bridge currently has 30+ side maps. Adding another adds testing surface and audit cost.

# What I want from you

Brainstorm 3 alternative fixes that don't require maintaining a separate side map across 5 sites. Constraints:

- Must work for the worst case (player has zero presence; current full-scan cost).
- Must stay correct under entity create/destroy/conversion/sheep-transfer.
- Should not require save-format changes.
- Cost-of-being-wrong should be cheaper than the side-map approach (a stale read that fixes itself next tick is fine; a permanent wrong answer is not).

Possible directions to explore (you may extend or replace these):

1. **Per-tick memoization.** The conquest system queries 4 owners per tick. Cache `playerHasConquestPresence(owner)` results for the current tick number; clear on tick rollover. The first call still pays full-scan cost, but the next 3 are O(1). Save 75% of the worst-case cost.

2. **Reverse the query.** Instead of "walk all units checking for owner == X", walk all units once at the start of the system and accumulate `presenceByOwner: Map<number, boolean>`. One pass, O(N) total per tick instead of O(N × players).

3. **Lazy index with version stamping.** A side cache `presenceCache: Map<number, { hasPresence: boolean; computedAtTick: number }>`. Reads check the tick — if stale, recompute via the existing query (full scan, but only on demand). Writes never happen explicitly; the entity-create/destroy/convert paths just bump a `worldMutationVersion` counter that conquest checks against.

4. **Use civ-engine's queryInRadius / per-owner indices.** Does civ-engine offer a per-component-value index? If yes, `world.queryByOwner(owner)` could be O(1).

5. **Accept the cost.** Note that 48k reads/sec is small compared to the simulation's per-tick budget, document the worst-case bound in a code comment, and don't add complexity. (Codex: would you actually defend this?)

For each of your 3 alternatives:
- Sketch the algorithm.
- Identify the failure mode if it goes wrong.
- Compare cost-of-wrong vs the side-map approach.
- Estimate effort (LOC, sites touched, test surface).

Then **pick a recommendation** and explain why.

# Constraints

- Do NOT modify files. Read-only brainstorm.
- Cite specific files + line numbers where useful.
- Be concise — under 700 words total.

# Output format

```
# V4-11 brainstorm

## Alternative 1: [name]
- Algorithm:
- Failure mode if wrong:
- Cost vs side-map:
- Effort:

## Alternative 2: ...
## Alternative 3: ...

## Recommendation
```
