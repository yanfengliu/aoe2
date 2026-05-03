// Entity creation operations. addUnitEntity / addBuildingEntity /
// addResourceEntity each createEntity() then attach the components for
// their kind, populate the relevant side maps, and trigger occupancy /
// score / countdown follow-ups. Mirrors the pre-extraction inline
// implementation byte-for-byte; the only change is the dependency
// surface is explicit instead of closure-captured.

import type { EntityRef, Position } from 'civ-engine';
import type {
  BuildingType,
  ResourceComponent,
  ResourceKind,
  UnitType,
  VisionSourceComponent,
} from '../types';
import { buildingFootprint, getUnitTargetTransformForCell, type GameWorld } from './pureHelpers';
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
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  productionQueuesCodec,
  townCenterRefsCodec,
  trebuchetPackStatesCodec,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
  wonderCountdownsCodec,
} from './bridgeStateSerialize';

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
};

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
    population,
    buildingCombatStates,
    wildlifeStates,
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

    const populationState = population.get(owner);
    if (populationState) {
      populationState.current += 1;
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
    const fullHp = buildingMaxHp(buildingType);
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
        radius: defaultVisionRadius,
      });
    }

    const buildingCombatState = createBuildingCombatState(buildingType);
    if (isComplete && buildingCombatState) {
      buildingCombatStates.set(entity, buildingCombatState);
    }

    const populationState = population.get(owner);
    const populationProvided = buildingPopulationProvided(buildingType);
    if (isComplete && populationState && populationProvided > 0) {
      populationState.cap += populationProvided;
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
      wildlifeStates.set(entity, createWildlifeState(resourceType));
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
