// Entity creation operations. addUnitEntity / addBuildingEntity /
// addResourceEntity each createEntity() then attach the components for
// their kind, populate the relevant side maps, and trigger occupancy /
// score / countdown follow-ups. Mirrors the pre-extraction inline
// implementation byte-for-byte; the only change is the dependency
// surface is explicit instead of closure-captured.

import { buildingMaxHpWithTechnologies } from '../buildingTechEffects';
import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildingType,
  ResourceComponent,
  ResourceKind,
  UnitType,
  VisionSourceComponent,
} from '../types';
import { buildingFootprint, getUnitTargetTransformForCell, type GameWorld } from './pureHelpers';
import { deriveCap } from './bridgeConstants';
import {
  buildingBuildTimeTicks,
  buildingMaxHp,
  buildingPopulationProvided,
  buildingSize,
  buildingTint,
  buildingVisionRadius,
  createBuildingCombatState,
} from '../prototypeBuildingRules';
import {
  createWildlifeState,
  isWildlifeResourceType,
  unitSize,
  unitTint,
} from '../prototypeUnitRules';
import { resourceTint } from '../prototypeEconomyRules';
import { assignVillagerRole } from './pureHelpers';
import type { CombatState } from './systems/systemTypes';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  playerAgesCodec,
  populationCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
  townCenterRefsCodec,
  trebuchetPackStatesCodec,
  villagerOrdinalsCodec,
  wildlifeStatesCodec,
  wonderCountdownOverridesCodec,
  wonderCountdownsCodec,
} from './bridgeStateSerialize';
import {
  farmFoodCapacity,
  EMPTY_TECH_SET,
  FISH_TRAP_FOOD_AMOUNT,
} from '../economyTechEffects';
import { outpostVisionRadiusForAge } from '../visionTechEffects';

interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  wonderCompleted: boolean;
}

const RESOURCE_SIZES: Record<ResourceComponent['resourceType'], number> = {
  'berry-bush': 0.45,
  'gold-mine': 0.8,
  'stone-mine': 0.8,
  boar: 0.48,
  fish: 0.42,
  sheep: 0.42,
  wolf: 0.46,
  tree: 0.58,
  relic: 0.5,
  // M1 Farms: a farm's resource size is unused for rendering while the
  // building component is present (the building renderable wins), but the
  // RESOURCE_SIZES map is exhaustive over ResourceKind so a value is required.
  farm: 0.9,
};

// `FARM_FOOD_AMOUNT` (the 175 base) + `EMPTY_TECH_SET` moved to economyTechEffects
// (the farm-food module, imported above) to break a bridge↔sim import cycle —
// economyTechEffects.farmFoodCapacity is the sole consumer of the base.

export interface EntityCreateOpsDeps {
  world: GameWorld;
  wonderCountdownTicks: number;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — bridge-state migration. Slots that have been migrated to
  // `world.state.aoe2.*` flow through the accessor; the corresponding
  // `state.X` fields are gone from `BridgeState`. `villagerOrdinals` is
  // the first slot to migrate (per-owner running counter for villager
  // role assignment). Future per-slot migrations land in this same
  // surface.
  accessor: BridgeStateAccessor;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
  createCombatState: (owner: number, unitType: UnitType) => CombatState;
  syncSpawnedEntityOccupancy: (entity: number) => void;
  getEntityRef: (id: number) => EntityRef | null;
}

export interface EntityCreateOps {
  addUnitEntity(
    owner: number,
    unitType: UnitType,
    position: Position,
    vision?: VisionSourceComponent,
  ): number;
  addBuildingEntity(
    owner: number,
    buildingType: BuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ): number;
  addResourceEntity(
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ): number;
  onBuildingConstructionComplete(
    buildingId: number,
    owner: number,
    buildingType: BuildingType,
  ): void;
}

export function createEntityCreateOps(deps: EntityCreateOpsDeps): EntityCreateOps {
  const {
    world,
    wonderCountdownTicks,
    state,
    accessor,
    ensurePlayerScoreCounters,
    createCombatState,
    syncSpawnedEntityOccupancy,
    getEntityRef,
  } = deps;
  const {
    monksByOwner,
  } = state;

  function addUnitEntity(
    owner: number,
    unitType: UnitType,
    position: Position,
    vision?: VisionSourceComponent,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'unit', { owner, unitType });
    world.addComponent(entity, 'unitTransform', getUnitTargetTransformForCell(entity, position));
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint: unitTint(unitType, owner),
      size: unitSize(unitType),
      footprintWidth: 1,
      footprintHeight: 1,
      visualVariant: 'default',
    });

    const populationState = accessor.get(populationCodec).get(owner);
    if (populationState) {
      populationState.current += 1;
      accessor.markDirty(populationCodec);
    }

    ensurePlayerScoreCounters(owner).unitsProduced += 1;
    accessor.mutate(combatStatesCodec, (m) => m.set(entity, createCombatState(owner, unitType)));

    if (unitType === 'trebuchet') {
      accessor.mutate(trebuchetPackStatesCodec, (m) => {
        m.set(entity, {
          packed: true,
          transitionTicksRemaining: 0,
        });
      });
    }

    if (unitType === 'monk') {
      let monkSet = monksByOwner.get(owner);
      if (!monkSet) {
        monkSet = new Set();
        monksByOwner.set(owner, monkSet);
      }
      monkSet.add(entity);
    }

    if (unitType === 'fishing-ship') {
      // M5 naval: a Fishing Ship is an economy unit and reuses the villager
      // gather -> carry -> deposit loop wholesale. It only ever wants food,
      // and only ever from fish, because those are the only harvestable
      // resources it can reach across water.
      world.addComponent(entity, 'gatherer', {
        desiredResource: 'food',
        hasExplicitGatherOrder: false,
        task: 'idle',
        targetResourceId: null,
        dropOffBuildingId: null,
        carriedResource: null,
        carriedAmount: 0,
        carryCapacity: 15,
        gatherProgressTicks: 0,
      });
    }

    if (unitType === 'villager') {
      // Phase 2D — villagerOrdinals routes through accessor.mutate.
      // Read+increment+write the per-owner counter via the cached Map; the
      // mutation gets flushed to world.state.aoe2.villagerOrdinals at
      // tick-end via bridgeSnapshotSystem.
      const ordinals = accessor.get(villagerOrdinalsCodec);
      const ordinal = ordinals.get(owner) ?? 0;
      accessor.mutate(villagerOrdinalsCodec, (m) => m.set(owner, ordinal + 1));
      world.addComponent(entity, 'gatherer', {
        desiredResource: assignVillagerRole(owner, ordinal),
        hasExplicitGatherOrder: false,
        task: 'idle',
        targetResourceId: null,
        dropOffBuildingId: null,
        carriedResource: null,
        carriedAmount: 0,
        carryCapacity: 10,
        gatherProgressTicks: 0,
      });
    }

    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    }

    syncSpawnedEntityOccupancy(entity);
    return entity;
  }

  function onBuildingConstructionComplete(
    buildingId: number,
    owner: number,
    buildingType: BuildingType,
  ): void {
    const counters = ensurePlayerScoreCounters(owner);
    counters.buildingsProduced += 1;
    if (buildingType === 'wonder') {
      counters.wonderCompleted = true;
      const totalTicks = accessor.get(wonderCountdownOverridesCodec).get(owner) ?? wonderCountdownTicks;
      accessor.mutate(wonderCountdownsCodec, (m) => {
        m.set(buildingId, {
          remainingTicks: totalTicks,
          totalTicks,
          lastCompletedTick: null,
        });
      });
    }
    if (buildingType === 'farm') {
      // M1 Farms: a completed Farm becomes a gatherable FOOD resource. It
      // gains a `resource` component (in ADDITION to its `building`
      // component — a building+resource hybrid) so the existing
      // villagerEconomySystem (`world.query('position','resource')` →
      // `isHarvestableResource` → `resourceKindToEconomyResource('farm')
      // === 'food'`) routes a food villager to it and the villager stands
      // adjacent (1x1 approach) to gather, exactly like a berry bush. The
      // renderable stays a building renderable (set in addBuildingEntity);
      // occupancy stays a building blocker (transformOps dispatches on the
      // `building` component first), so the resource component adds gather
      // semantics WITHOUT a second occupancy claim. `owner` stays null
      // (gatherable-resource convention; the gather system claims it), while
      // `baseOwner` is the builder so the owner-preference gather sort and
      // the economy snapshot attribute the food to them.
      //
      // Farm-food techs (Horse Collar / Heavy Plow / Crop Rotation) raise the
      // capacity, DERIVED from the OWNER's persisted researched-tech set — a
      // farm built by a player who has the techs holds the upgraded food; a
      // default owner (no farm techs) holds the base FARM_FOOD_AMOUNT (175).
      const farmCapacity = farmFoodCapacity(
        accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET,
      );
      world.addComponent(buildingId, 'resource', {
        resourceType: 'farm',
        amount: farmCapacity,
        maxAmount: farmCapacity,
        owner: null,
        baseOwner: owner,
      });
    }
    if (buildingType === 'fish-trap') {
      // The naval Farm, on the same hybrid seam: a completed Fish Trap gains a
      // `resource` component of kind FISH, so the gather loop routes a Fishing
      // Ship to it exactly as it would to a wild shoal — a Fishing Ship is a
      // gatherer whose domain is water, and it already fishes. 715 food is
      // structures.csv's "Gives 715 Food". No reseed: an emptied trap is gone,
      // and the player builds another.
      world.addComponent(buildingId, 'resource', {
        resourceType: 'fish',
        amount: FISH_TRAP_FOOD_AMOUNT,
        maxAmount: FISH_TRAP_FOOD_AMOUNT,
        owner: null,
        baseOwner: owner,
      });
    }
  }

  function addBuildingEntity(
    owner: number,
    buildingType: BuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ): number {
    const footprint = buildingFootprint(buildingType);
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'building', { owner, buildingType });
    world.addComponent(entity, 'renderable', {
      kind: 'building',
      layer: 'building',
      tint: buildingTint(buildingType, owner, isComplete),
      size: buildingSize(buildingType),
      footprintWidth: footprint.width,
      footprintHeight: footprint.height,
      visualVariant: isComplete ? 'complete' : 'construction',
    });
    // Masonry / Architecture raise the hit points of everything this owner
    // builds; the buildings already standing are bumped at research time
    // (buildingHpTechEffect). Both halves are needed, exactly like Loom.
    const fullHp = buildingMaxHpWithTechnologies(
      buildingMaxHp(buildingType),
      accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET,
      buildingType,
    );
    accessor.mutate(buildingHealthStatesCodec, (m) =>
      m.set(entity, {
        currentHp: isComplete ? fullHp : Math.max(1, Math.floor(fullHp * 0.1)),
        maxHp: fullHp,
      }),
    );

    if (buildingType === 'town-center') {
      const entityRef = getEntityRef(entity);
      if (entityRef) {
        accessor.mutate(townCenterRefsCodec, (m) => m.set(owner, entityRef));
      }
    }

    if (
      buildingType === 'town-center'
      || buildingType === 'barracks'
      || buildingType === 'stable'
      || buildingType === 'archery-range'
      || buildingType === 'blacksmith'
      || buildingType === 'market'
      || buildingType === 'siege-workshop'
      || buildingType === 'monastery'
      || buildingType === 'castle'
    ) {
      accessor.mutate(productionQueuesCodec, (m) => {
        if (!m.has(entity)) {
          m.set(entity, []);
        }
      });
    }

    const defaultVisionRadius = buildingVisionRadius(buildingType);
    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    } else if (isComplete && defaultVisionRadius !== null) {
      world.addComponent(entity, 'visionSource', {
        playerId: owner,
        // The Outpost's "+2 per age" (structures.csv): a fixture that seeds one
        // into a Castle-Age game gets the same radius the age-up bumps would
        // have produced.
        radius: buildingType === 'outpost'
          ? outpostVisionRadiusForAge(
            accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
            defaultVisionRadius,
          )
          : defaultVisionRadius,
      });
    }

    const buildingCombatState = createBuildingCombatState(buildingType);
    if (isComplete && buildingCombatState) {
      accessor.mutate(buildingCombatStatesCodec, (m) => m.set(entity, buildingCombatState));
    }

    const populationState = accessor.get(populationCodec).get(owner);
    const populationProvided = buildingPopulationProvided(buildingType);
    if (isComplete && populationState && populationProvided > 0) {
      // Raise the honest raw supply; cap is the derived 200-clamp of it.
      populationState.rawSupply += populationProvided;
      populationState.cap = deriveCap(populationState.rawSupply);
      accessor.markDirty(populationCodec);
    }

    if (!isComplete) {
      accessor.mutate(constructionStatesCodec, (m) => {
        m.set(entity, {
          isComplete: false,
          buildProgressTicks: 0,
          totalBuildTicks: buildingBuildTimeTicks(buildingType),
          populationProvided: buildingPopulationProvided(buildingType),
          width: footprint.width,
          height: footprint.height,
        });
      });
    } else {
      onBuildingConstructionComplete(entity, owner, buildingType);
    }

    syncSpawnedEntityOccupancy(entity);
    return entity;
  }

  function addResourceEntity(
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);

    world.addComponent(entity, 'resource', {
      resourceType,
      amount,
      maxAmount: amount,
      owner: null,
      baseOwner,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'resource',
      layer: 'resource',
      tint: resourceTint(resourceType, null),
      size: RESOURCE_SIZES[resourceType],
      footprintWidth: 1,
      footprintHeight: 1,
      visualVariant: 'default',
    });

    if (resourceType === 'sheep') {
      world.addComponent(entity, 'unitTransform', getUnitTargetTransformForCell(entity, position));
    }

    if (isWildlifeResourceType(resourceType)) {
      accessor.mutate(wildlifeStatesCodec, (m) => m.set(entity, createWildlifeState(resourceType)));
    }

    syncSpawnedEntityOccupancy(entity);
    return entity;
  }

  return {
    addUnitEntity,
    addBuildingEntity,
    addResourceEntity,
    onBuildingConstructionComplete,
  };
}
