# Farm auto-reseed — M1 farms slice 2 (v0.1.35)

## Goal

When a farm's stored food reaches 0, instead of unconditionally removing the farm (slice 1 behavior), auto-reseed it if the farm OWNER can afford the wood: deduct 60 wood from the owner and reset the farm's stored food to its max (175) so the assigned villager keeps gathering seamlessly — same entity id, no re-path, no HP change, instant. If the owner cannot afford 60 wood, remove the farm exactly as slice 1. This is the AoE2 "farm = wood→food converter" mechanic in minimal form.

## Decision: where the reseed fires

The depletion site is `villagerEconomySystem.ts`, the `if (targetResource.amount <= 0)` branch inside the `gathering` task (currently nulls `gatherer.targetResourceId` then calls `destroyResourceEntity`). The reseed decision goes RIGHT THERE, BEFORE the destroy. On a successful reseed the villager's `targetResourceId` is NOT nulled and `destroyResourceEntity` is NOT called, so the gatherer continues its normal cycle (it transitions to `to-dropoff` to deposit the carry, then idle→reassign re-targets the SAME farm because it is still the nearest owned food). The farm entity id is stable, occupancy/building side-maps untouched.

## Reuse, do not reinvent

- Affordability + deduction: reuse `canAfford(stockpile, cost)` + `spendResources(stockpile, cost)` + `accessor.markDirty(playerResourcesCodec)` — the EXACT trio that `startConstructionWithBuildersDirect` (trainingMarketOps.ts) uses to charge wood on placement.
- Cost source: `constructionCost('farm')` → `{ wood: 60 }` (the same CONSTRUCTION_COSTS entry the build charges). No second hard-coded 60.
- Max food: `FARM_FOOD_AMOUNT` (175), exported from entityCreateOps.ts and imported here (no duplicated literal).
- Component mutation: in-place `resource.amount = ...` via the live `getComponent` reference — the established codebase convention (scenarioSeedOps.ts:315 and villagerEconomySystem.ts:410 both mutate `resource.amount` in place; there is no `patchComponent` in this codebase).

## Owner correctness

A farm is gather-restricted to its owner (`canGatherResource` gate in assignNearestResource), so the gatherer's owner always equals the farm's `baseOwner`. The reseed charges `resource.baseOwner` (the FARM's owner), NOT the villager's owner — correct AoE2 semantic (the farm owner pays to reseed their own farm) and robust even if a future path lets a non-owner gather. If `baseOwner` is null (defensive; never true for a real farm) the farm is destroyed, not reseeded.

## File-size ceiling

villagerEconomySystem.ts is at 495 LOC; an inline reseed block pushes it over 500. Extract a small pure helper `tryReseedFarm(world, accessor, resourceId, resource): boolean` into a new module `src/game/simulation/bridge/farmReseed.ts`. The system calls it; on `true` it skips destroy, on `false` it destroys as before.

## Reset semantics

Reset `resource.amount = FARM_FOOD_AMOUNT`; also `resource.maxAmount = Math.max(resource.maxAmount, FARM_FOOD_AMOUNT)` so amount never exceeds max. Today maxAmount === 175 for any normally-built farm, so this is a no-op on max; it keeps the invariant if a fixture seeded a different max. When farm-capacity upgrade techs land they will raise the farm's maxAmount and the reseed will naturally reset to the higher capacity (read from FARM_FOOD_AMOUNT until those techs exist; capacity-from-tech is a deferred follow-up).

## Out of scope (still deferred)

- Walk-over reseed animation/delay (reseed is instant; farm was never damaged).
- Farm-capacity upgrade techs (Horse Collar / Heavy Plow / Crop Rotation).
- Mill batch-reseed QUEUE and the per-farm manual reseed toggle.
- AI building/maintaining farms.

## Save format

No schema change. The farm's `resource` + `building` components and the per-owner `playerResources` map are all existing serialized state; a reseed only mutates `resource.amount`/`maxAmount` and the owner's wood — additive, round-trips.

## Tests (TDD, createSimulationBridge.farm.test.ts)

1. Reseed when affordable (NEW fixture `createFarmReseedFixture` giving the owner ≥120 wood and a low-food farm): after food crosses 0 the farm entity STILL EXISTS (same id), its food is back at 175, the owner's wood dropped by exactly 60, and food keeps rising. Assert across TWO reseed cycles → wood drains 60 each cycle, farm persists.
2. No reseed when broke (existing depletion fixture: owner wood is set to < 60 so it cannot pay): farm is REMOVED as slice 1. The existing depletion-removal test stays green by ensuring its fixture owner has < 60 wood.
3. Existing 5 farm tests + 9 unitGather tests stay green.
