Here is the Iteration 2 review of the current working tree (`8d20013`).

### High

**[V5-1] AI `assignAiMonkTasks` skip check (V4-12) actively pessimizes by doing an extra full-world scan**
- **Theme:** efficiency, correctness
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:354-358`; `src/game/simulation/bridge/playerQueries.ts:105-114`
- **Finding:** Iter-4 V4-12 attempted to optimize `assignAiMonkTasks` (which does a full `world.query('unit')` scan) by skipping it if the AI has no monks: `if (countOwnedUnits(owner, 'monk') > 0) assignAiMonkTasks(owner);`. However, `countOwnedUnits` itself performs a full `world.query('unit')` scan. This means if the AI has 0 monks, the fix replaced one full scan with another (no savings). If the AI has > 0 monks, it now does *two* full world scans per decision tick instead of one.
- **Fix shape:** Maintain an `ownedMonkCountByPlayer` side map (updated in `entityCreateOps`/`entityDestroyOps` or `monkTaskOps`), or revert the `countOwnedUnits` check until such a map exists.

**[V5-2] AI `villagerRebalance` permanently traps villagers gathering a resource with `desired <= 0`**
- **Theme:** correctness, AI economy
- **Where:** `src/game/simulation/bridge/aiDecisionOps.ts:145-151`
- **Finding:** The rebalance loop skips resources with a target of 0: `if (desired <= 0) continue;`. If an AI's build plan drops a resource target to 0 (e.g., stopping stone gathering in a certain age) but villagers are currently gathering it (`actual > 0`), that resource's ratio is never computed. Thus, it can never be selected as `bestKind` (the "donor" resource), and those villagers are permanently trapped gathering it, ignoring the AI's intended distribution.
- **Fix shape:** Compute a ratio of `Number.POSITIVE_INFINITY` when `desired <= 0 && actual > 0` so it reliably becomes the donor, or explicitly unassign villagers from zero-target resources before evaluating ratios.

### Medium

**[V5-3] AI `findIdleProducer` is called ~7+ times per AI per decision tick, scanning all buildings each time**
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:291-325`; `src/game/simulation/bridge/aiDecisionOps.ts:79-106`
- **Finding:** The AI calls `findIdleProducer` inside a `for` loop for every unit type in its `pickUnitMix` and for every military building type (blacksmith, archery-range, barracks, stable, siege-workshop, castle) to queue research. Each call to `findIdleProducer` does a full `world.query('building')` scan. This results in ~7+ full world building scans per AI per decision tick just for training/research queuing.
- **Fix shape:** Query all owned buildings once per decision tick, group them by `buildingType`, and pass that grouped data (or a fast lookup closure) into the `findIdleProducer` equivalents.

### Low / Nit

**[V5-4] AI `attackGroup` assembly performs duplicate full-world unit scans**
- **Theme:** cleanliness, efficiency
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts:360-366`
- **Finding:** The AI calls `ownedMilitaryUnitIds(owner)` to filter dead units from `attackGroup`, then immediately calls `findOwnedMilitaryUnits(owner)` to add new units. Both helpers perform a full `world.query('unit')` scan evaluating the exact same `isAiMilitaryUnit` predicate.
- **Fix shape:** Combine into a single helper that returns both the `Set` (for fast filtering) and the array, or simply build the `Set` inline from the array result.

---

### Verified-not-bugs

- **Multiple monks converting the same target:** When one monk successfully converts a unit, `conversionState.delete(targetId)` is called. If another enemy monk is also converting that target, its owner no longer matches the target's owner, so it safely resets and starts converting from 0 progress.
- **Monk conversion LOS/vision interrupt:** The V3-7 monk conversion interrupt correctly uses `!isVisibleToOwner(monkUnit.owner, targetPosition.x, targetPosition.y)` to break conversion if the target moves out of radial vision, preserving progress but halting ticks.
- **`villagerEconomySystem` drop-off throttle (V4-7):** The retry throttle correctly delays `findNearestDropOffBuilding` for stuck villagers while keeping the gatherer in the `to-dropoff` state. The skip logic cleanly bypasses `moveUnitOneSubgridStep` without breaking other system rules.
- **Save/Load schema integration:** `gathererDropOffStuckSinceTick` was correctly added to `saveSchema.ts` (`SerializedEntityKeyedSideMap<number>`), properly exported in `saveGameOps`, and pruned during hydration for orphan keys.
- **Conquest simultaneous elimination:** The logic in `conquestOutcomeSystem.ts` correctly identifies when both the human player and all enemies have been eliminated in the same tick by reversing the presence lookup (`remainingOwners.delete`), resolving to `'draw'` cleanly.
