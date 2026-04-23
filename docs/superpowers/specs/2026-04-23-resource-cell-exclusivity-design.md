# Resource cell exclusivity + procedural default map

## Problem

Two defects that share a root cause (hand-authored offset tables with no dedupe):

1. **Resource stacking in `npm run dev`.** The default seed `aoe2-prototype` pushes `STARTING_STONE` offsets `(0,5),(1,5),(0,6),(1,6)` followed by `FOREST_PATCHES[2]` offsets `(-2..1, 5..6)`. The south forest patch covers every stone cell, so each player's stone mines spawn with trees stacked on top.
2. **No structural guard.** `createSimulationBridge` already validates building-building, unit-building, and resource-building overlaps at boot but has no resource-resource check. Fresh hand-authored fixtures could reintroduce the same defect silently.

## Goal

Enforce a hard invariant: **at most one resource per cell**. Fix it structurally so authors and generators cannot violate it:

- All resource spawns flow through a deduping insert that keeps the first placement and drops subsequent collisions.
- The bridge-boot validator throws on any remaining resource-on-resource overlap, matching the existing building-overlap error style.
- The default `aoe2-prototype` map is produced by a deterministic procedural generator that uses the seed for layout and guarantees that after dedupe every player base has at least one cell of every starting resource type (sheep, boar, berry bush, gold, stone, tree) and the existing spawn counts are preserved.

## Non-goals

- Do not change the Black Forest / Arena map generators' high-level structure. They already go through `applyStandardPlayerOpening`; they inherit the fix automatically when the spawn helpers become dedupe-safe.
- Do not change fixture seed layouts. Hand-authored fixtures keep literal coordinates; they just get caught by the new validator if they're wrong.
- No change to `civ-engine`; all work stays in `src/game/simulation/`.
- No change to the save-schema version (`SAVE_SCHEMA_VERSION = 1` stays).

## Design

### Module layout

Split the map-generation code out of the 9.6k-line `prototypeScenario.ts` as part of this change (small, focused, test-isolable units):

- `src/game/simulation/mapGeneration/spawnList.ts`
  - `createSpawnList()` returns a helper object wrapping a `ScenarioSpawnSpec[]`.
  - `addResourceSpawn(spec)` — rejects the add when another resource already occupies `(x, y)` and returns a structured result so the generator can log/count drops. Deduplication is **first-write-wins**: the existing resource keeps the cell.
  - `addBuildingSpawn`, `addUnitSpawn` — pass-through, no dedupe (buildings and units have their own overlap rules validated later at the bridge).
  - `toArray()` returns the underlying spawn array in insertion order.
- `src/game/simulation/mapGeneration/defaultMap.ts`
  - `createDefaultMap(seed: string): PrototypeScenario` — new procedural generator for `aoe2-prototype`.
  - Uses a seeded PRNG (reuse `createBlackForestWiggleRng` style Park-Miller LCG, already proven deterministic in this file).
  - Lays down TCs, then each resource type in priority order (starting-resource types first, then forest), so starting resources always win dedupe over trees.

The existing `applyResourcePatch`, `applyForestPatch`, `applyShoreFishPatches` get routed through `spawnList.addResourceSpawn`. They keep their signatures.

### Procedural default-map algorithm

Keep the existing per-base counts intact (guaranteed by `prototypeScenario.test.ts`):
- sheep × 4, boar × 2, berry bush × 6, gold-mine × 4, stone-mine × 4, tree × 24.

For each player start:
1. Paint a grass pocket (radius 4) around the TC and push the TC, villagers × 3, starting scout.
2. For each starting-resource kind in the following order (sheep, boar, berry, gold, stone), pick a cluster **direction** deterministically from the seed (one of eight compass headings, offset from the same angle the hand-crafted offsets used so the opening "feels" the same). Within that cluster direction, deterministically pick `N` cells in a tight pattern from a short candidate list, skipping any that collide with the TC footprint, villager spots, or a prior resource. Keep picking from the candidate list until `N` cells placed; if candidate list exhausts, spiral outward for a small number of extra rings (capped).
3. After all starting resources are placed, place forest clusters (24 trees per base) by picking three cluster seeds at directions that don't collide with starting-resource directions. Each cluster places trees from a fixed 8-cell shape; any tree cell that would land on top of a previously placed resource is dropped silently (first-resource-wins). A small spill-over pass places extra tree cells from a wider pool to top the count back up to 24 per base so the `countBy('tree', owner) === 24` test stays green.
4. Place the forward enemy scout/house and neutral relics at the same fixed positions used today (these are not per-base and don't conflict with resource patches).
5. Apply shoreline fish patches.

The seed drives cluster direction and within-cluster tie-breaking. All other properties (counts, spawn ordering, map dimensions) are seed-independent so determinism tests remain tight.

### Bridge-boot validation

Add a third pass alongside the existing building and unit passes in `createSimulationBridge.ts:2411+`:

```
for each resource R:
  if R is in overlapWhitelist: continue
  for each other resource R' at the same cell:
    if R' not in overlapWhitelist:
      throw `Scenario '${seed}': ${R.resourceType} resource at (${x},${y}) overlaps ${R'.resourceType} at the same cell.`
```

Match the existing error-message format so logs read consistently.

### Error handling

- `addResourceSpawn` silently drops duplicates; the map generator owns the "enough of this type near the base" invariant. The spawn list helper is a correctness floor, not a policy layer.
- The bridge-boot validator throws. This is the loud backstop for fixtures and for any future generator regression — the mode that caught the original tree+stone bug only because the user ran the game.
- `worldOccupancy` semantics stay unchanged: its overflow logic is still there for the fresh-scenario bootstrap path so the validator's seed-scoped error surfaces first.

## Testing

Follow the repo's TDD rule: tests first, then make them pass.

### New vitest coverage

In `tests/simulation/mapGeneration/spawnList.test.ts`:
- `addResourceSpawn` accepts a first spawn at `(x, y)`.
- `addResourceSpawn` rejects a second resource at the same `(x, y)` and reports the drop, keeping the first.
- `addResourceSpawn` accepts two resources of different types at different `(x, y)`.
- `addBuildingSpawn` and `addUnitSpawn` are pass-through (no dedupe).

In `tests/simulation/mapGeneration/defaultMap.test.ts`:
- Same seed → identical `PrototypeScenario` (determinism).
- Different seeds → different scenarios.
- Every player base has at least one sheep, boar, berry bush, gold-mine, stone-mine, and tree within radius 10 of its town center (per-base resource-type coverage invariant).
- No two resource spawns share a `(x, y)` pair.
- Per-owner counts match the existing contract: sheep 4, boar 2, berry 6, gold 4, stone 4, tree 24.

In `tests/simulation/scenarioValidation.test.ts` (extend existing):
- A hand-authored scenario with two resources at the same cell now throws `'resource at (x,y) overlaps'` at bridge boot.
- The `overlapWhitelist` escape hatch still bypasses this check for fixtures that need it.

### Preserving existing coverage

- `prototypeScenario.test.ts`'s per-owner count expectations (sheep 4, boar 2, berry 6, tree 24, gold 4, stone 4) and determinism test remain green with the new generator.
- All fixture-specific tests (`resource-depletion-fixture`, `tile-selection-cycle-fixture`, etc.) are unaffected because they use their own seeds.
- Browser tests that don't hardcode default-seed coordinates (confirmed by survey) continue to pass; any that implicitly rely on a specific tree/stone cell in the default seed need to be re-anchored to "the nearest tree/stone to the human TC" via existing helpers.

### Visual verification

Per AGENTS.md visual-change rule: the default map is visual.
- Capture a before screenshot of the `npm run dev` Town Center region under seed `aoe2-prototype`.
- After the change, capture an after screenshot with the same camera.
- Generate a pixel diff and include the count in the devlog alongside the normal test gates.

## Rollout

1. Write spawn-list + default-map tests (all failing or missing).
2. Extract `spawnList.ts` and route `applyResourcePatch` / `applyForestPatch` / `applyShoreFishPatches` through it.
3. Extract `defaultMap.ts` and rewrite the default-seed branch in `createPrototypeScenario` to delegate to it.
4. Add the resource-on-resource validation pass in `createSimulationBridge.ts`.
5. Run the affected tests, then the full suite. Capture before/after screenshots. Update devlog.
