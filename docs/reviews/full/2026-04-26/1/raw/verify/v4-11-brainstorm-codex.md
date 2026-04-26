# V4-11 brainstorm

## Alternative 1: Tick-scoped lazy snapshot
- Algorithm: Keep `playerHasConquestPresence(owner)` in `src/game/simulation/bridge/matchEndOps.ts:170-186`, but back it with closure state `{ computedAtTick, ownersWithPresence }`. On the first call for a new `world.tick`, scan `world.query('unit')` and `world.query('building')` once, fill a `Set<number>`, then answer `set.has(owner)` for the human and enemies. This stays correct for Monk conversion at `src/game/simulation/bridge/monkTaskAppliers.ts:165` and sheep transfers in `src/game/simulation/bridge/visibility.ts:271-275` because it always reads authoritative world state, and conquest still ignores sheep.
- Failure mode if wrong: stale within the same tick if some future caller computes early and another system mutates ownership later that tick. It self-heals on the next tick.
- Cost vs side-map: much cheaper wrongness. No permanent drift from a missed write hook; worst case is one bad tick.
- Effort: ~25-35 LOC, 1 file, small test surface.

## Alternative 2: Conquest-local reverse scan
- Algorithm: Move the aggregation into `src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:41-43`. Build `remainingOwners = new Set(playerResources.keys())`, scan units once deleting seen owners, then scan buildings only if needed. Derive `humanAlive` / `allEnemiesEliminated` from that one snapshot. You can early-exit once all owners are found.
- Failure mode if wrong: only this system misclassifies this tick; it recomputes from world next tick. No cache, no hidden shared state.
- Cost vs side-map: best correctness/complexity trade. Same asymptotic win as a cache, but simpler and harder to misuse later.
- Effort: ~30-50 LOC, probably 2-3 files if you remove the now-dead helper/wiring; moderate but still tight test surface.

## Alternative 3: Dedicated ephemeral presence system
- Algorithm: Add a `prototypePresenceSnapshot` system just before `prototypeConquestOutcome`. Each tick it clears/refills an ephemeral `Set<number>` from current `unit` + `building` ownership; conquest only reads that set. Do not serialize it.
- Failure mode if wrong: stale or missing for one tick if ordering is wrong or the system is skipped. It still self-heals next tick.
- Cost vs side-map: far safer than a five-site mutation map because there is one rebuild point, not many invariants to maintain.
- Effort: ~40-70 LOC, 3-5 files (`bridgeState`, system registration, new system, conquest read path), wider test surface.

## Recommendation
Alternative 2.

It matches the question the code is asking: “which owners have conquest presence right now?” Compute that once inside `conquestOutcomeSystem.ts`, from authoritative state, and use it immediately. That avoids a new long-lived side map in `bridgeState.ts`, avoids save/load concerns, and avoids the brittle write interception at `entityCreateOps`, `entityDestroyOps`, `monkTaskAppliers.ts:165`, and sheep ownership code that should not matter for conquest anyway.

One extra note: per-owner memoization does not actually help here. `conquestOutcomeSystem.ts` checks each owner once per tick, so memoizing `playerHasConquestPresence(owner)` by owner still does four full scans in the 4-player zero-presence case. Memoize the full snapshot or reverse the query; do not memoize the wrong dimension.
