# Farms — M1 food backbone (slice 1)

## Goal

A villager-built `farm` that becomes a gatherable food resource (175 food) and is removed when depleted. This is the minimal first sub-slice of the M1 "Farms + reseed" roadmap item; reseed, farm-upgrade techs (Horse Collar / Heavy Plow / Crop Rotation), Mill anchoring, build-menu art polish, and AI farm-building are deferred follow-ups.

## Authoritative data (design/stats/structures.csv)

Farm — Age of Kings, Dark Age, cost {Wood: 60}, build_time 15 (seconds → ×10 TPS = 150 ticks), hit_points 480, Standard = 175 Food.

## Entity model — hybrid single entity (chosen)

A farm is ONE entity that is BOTH a building and a resource:

- Built through the normal placement + construction flow as a 1×1 building (occupies one cell, has 480 HP, ramps HP during construction).
- On construction-complete (`onBuildingConstructionComplete`) it gains a `resource` component: `{ resourceType: 'farm', amount: 175, maxAmount: 175, owner: null, baseOwner: owner }`.
- The existing `villagerEconomySystem` (`world.query('position','resource')` → `isHarvestableResource` → `resourceKindToEconomyResource('farm') === 'food'`) routes a food villager to it; the villager stands ADJACENT (1×1 approach footprint, identical to a berry bush) and gathers food at a berry-bush cadence.
- When `amount` hits 0 the gather loop calls `destroyResourceEntity(farmId)`, which is extended to also clear the building side-maps so the farm vanishes entirely (an un-reseeded farm disappears in AoE2). The building shell is NOT left behind.

### Why hybrid (not a separate resource entity under the building)

- Occupancy: `syncOccupancyForEntity` (transformOps) dispatches on `building` FIRST, so a hybrid entity occupies its footprint as a `building` blocker and the resource component adds NO occupancy claim — no double-claim conflict. A separate resource entity co-located under the building would need careful cell bookkeeping and would double the entity count.
- The relic-drop precedent (a destroyed Monastery spawning relic resource entities) is the separate-entity pattern, but relics are NOT building-shaped and are picked up, not gathered-in-place — a poor fit for a farm.
- Selection: `selectedKind = unit ? 'unit' : building ? 'building' : 'resource'` resolves a hybrid to `building` (correct — you select a farm like a building). `baseOwner = owner` so the food is owner-preferred by the gather sort and `getEconomyState().resources` reports the owner.

### baseOwner / owner

`resource.owner` stays `null` (gatherable-resource convention: owner is the player who has CLAIMED the resource, set by gather assignment; sheep are the exception). `baseOwner = owner` so the villager-economy owner-preference sort treats the farm as the builder's home-base food, and `getEconomyState().resources[].baseOwner` attributes it.

## Depletion cleanup

`destroyResourceEntity` currently only clears resource/wildlife/monk side-maps then `world.destroyEntity`. A depleted farm also carries building side-maps (`constructionStates`, `buildingHealthStates`), so `destroyResourceEntity` is extended: if the entity has a `building` component it also clears `constructionStates` + `buildingHealthStates` + `buildingCombatStates` + `productionQueues` + decrements population if the building provided any (farm provides 0, so the decrement is a no-op but kept for correctness) before destroying. This keeps the depletion path orphan-free without introducing a `destroyResourceEntity → destroyBuildingEntity` cycle.

## Gather cadence

Mirror berry-bush food values: `GATHER_TICKS_BY_KIND.farm = 4`, `GATHER_AMOUNT_BY_KIND.farm = 1` (≈0.25 food/tick before carry/travel; spec §6.3 targets ~0.32–0.34 food/sec for a farm — berry-bush parity is the closest existing food value and keeps the slice minimal). `ECONOMY_RESOURCE_BY_KIND.farm = 'food'`.

## Touchpoints (from the exhaustive audit)

Records that TS-error without a `farm` entry:
- prototypeBuildingRules.ts: BUILDING_POPULATION_PROVIDED (0), BUILDING_BUILD_TIME_TICKS (150), BUILDING_SIZES (1.0), BUILDING_TINTS (palette), BUILDING_MAX_HP (480).
- prototypeEconomyRules.ts: ECONOMY_RESOURCE_BY_KIND ('food'), GATHER_TICKS_BY_KIND (4), GATHER_AMOUNT_BY_KIND (1), RESOURCE_BASE_TINTS (tint), CONSTRUCTION_COSTS ({wood:60}).
- buildingFootprints.ts: AUTHORITATIVE_BUILDING_FOOTPRINTS ({1,1}).
- entityCreateOps.ts: RESOURCE_SIZES (0.5).

Build menu: optionsRules.ts `getBuildOptions` — add 'farm' to the Dark-Age base list.

Construction-complete: entityCreateOps.ts `onBuildingConstructionComplete` — attach the resource component for `buildingType === 'farm'`. (Reached from BOTH the construction-flow completion in playerCommandsSystem.ts AND the `isComplete` branch of `addBuildingEntity`, so a farm spawned already-complete in a fixture also becomes gatherable.)

Exhaustive switch needing a case: pureHelpers.ts `inventoryResourceName` ('food'). UI display (`entityNames.ts`, `icons.ts`) have defaults but get explicit 'Farm'/'Farms'/accent cases for polish.

Depletion: entityDestroyOps.ts `destroyResourceEntity` — building-side-map cleanup.

Tests to update: createSimulationBridge.darkAge.test.ts buildOptions exact array (append 'farm').

## Save format

No schema change. `ResourceKind` / `BuildingType` widen by one string literal; the `resource` component is an existing engine-registered component serialized inside `WorldSnapshot.state`. A saved farm (with or without its resource component) round-trips additively.

## Deferred (follow-ups, NOT in this slice)

- Auto/manual reseed (re-buy the farm's food for wood when depleted; AoE2 Mill batch-reseed queue).
- Farm-upgrade techs: Horse Collar / Heavy Plow / Crop Rotation → 250 / 375 / 550 food.
- Requiring a Mill anchor near the farm.
- Build-menu art / dedicated farm sprite + tiled crop rendering.
- AI building farms (AI villager-targets are food-keyed and unaffected; the AI just won't place farms yet).
