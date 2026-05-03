// Entity destroy operations. Each `destroy*` clears every side map that
// holds bookkeeping for the entity, then calls world.destroyEntity. Mirrors
// the pre-extraction inline implementation byte-for-byte; the only change
// is the dependency surface is explicit instead of closure-captured.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  ResourceComponent,
  ResourceKind,
  UnitComponent,
} from '../types';
import { buildingFootprint, isSameEntity, type GameWorld } from './pureHelpers';
import { buildingPopulationProvided } from '../prototypeBuildingRules';
import {
  conversionStateCodec,
  gathererDropOffStuckSinceTickCodec,
  monkHealCountersCodec,
  rallyPointsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  townCenterRefsCodec,
  wonderCountdownsCodec,
} from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

export interface EntityDestroyOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — gathererDropOffStuckSinceTick flows through accessor.
  accessor: BridgeStateAccessor;
  removeSelectedEntity: (id: number) => void;
  clearUnitCommand: (id: number) => void;
  getApproachCellsForFootprint: (
    anchor: Position,
    width: number,
    height: number,
    range?: number,
  ) => Position[];
  isTerrainPassableForUnit: (x: number, y: number) => boolean;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
  isCellBlockedByResource: (x: number, y: number) => boolean;
  addResourceEntity: (
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ) => number;
  markOutOfBandRenderChange: () => void;
}

export interface EntityDestroyOps {
  destroyUnitEntity(id: number): void;
  destroyBuildingEntity(id: number): void;
  killWildlifeEntity(id: number): void;
  destroyResourceEntity(id: number): void;
}

export function createEntityDestroyOps(deps: EntityDestroyOpsDeps): EntityDestroyOps {
  const {
    world,
    mapWidth,
    mapHeight,
    state,
    accessor,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    markOutOfBandRenderChange,
  } = deps;
  const {
    garrisonedUnitToBuilding,
    garrisonedByBuilding,
    garrisonedUnitVisionSources,
    population,
    combatStates,
    monkTasks,
    monkCarriedRelic,
    monksByOwner,
    trebuchetPackStates,
    productionQueues,
    constructionStates,
    buildingHealthStates,
    buildingCombatStates,
    inFlightTechByOwner,
    wildlifeStates,
  } = state;

  function destroyUnitEntity(id: number): void {
    const garrisonBuildingId = garrisonedUnitToBuilding.get(id) ?? null;
    if (garrisonBuildingId !== null) {
      const garrisonedUnits = garrisonedByBuilding.get(garrisonBuildingId) ?? [];
      garrisonedByBuilding.set(
        garrisonBuildingId,
        garrisonedUnits.filter((candidateId) => candidateId !== id),
      );
      if ((garrisonedByBuilding.get(garrisonBuildingId)?.length ?? 0) === 0) {
        garrisonedByBuilding.delete(garrisonBuildingId);
      }
      garrisonedUnitToBuilding.delete(id);
      garrisonedUnitVisionSources.delete(id);
    }

    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const populationState = population.get(unit.owner);
      if (populationState) {
        populationState.current = Math.max(0, populationState.current - 1);
      }
      if (unit.unitType === 'monk') {
        const monkSet = monksByOwner.get(unit.owner);
        if (monkSet) {
          monkSet.delete(id);
          if (monkSet.size === 0) {
            monksByOwner.delete(unit.owner);
          }
        }
      }
    }

    removeSelectedEntity(id);

    clearUnitCommand(id);
    combatStates.delete(id);
    monkTasks.delete(id);
    monkCarriedRelic.delete(id);
    accessor.mutate(conversionStateCodec, (m) => m.delete(id));
    accessor.mutate(monkHealCountersCodec, (m) => m.delete(id));
    trebuchetPackStates.delete(id);
    accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) => m.delete(id));
    world.destroyEntity(id);
    markOutOfBandRenderChange();
  }

  function destroyBuildingEntity(id: number): void {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const construction = constructionStates.get(id);
    for (const garrisonedUnitId of garrisonedByBuilding.get(id) ?? []) {
      destroyUnitEntity(garrisonedUnitId);
    }
    garrisonedByBuilding.delete(id);

    if (building?.buildingType === 'town-center') {
      const townCenterRef = accessor.get(townCenterRefsCodec).get(building.owner) ?? null;
      if (isSameEntity(townCenterRef, id, world)) {
        accessor.mutate(townCenterRefsCodec, (m) => m.delete(building.owner));
      }
    }

    if (building) {
      const populationState = population.get(building.owner);
      const populationProvided =
        construction?.populationProvided ?? buildingPopulationProvided(building.buildingType);
      const isComplete = construction?.isComplete ?? true;
      if (populationState && isComplete && populationProvided > 0) {
        populationState.cap = Math.max(populationState.current, populationState.cap - populationProvided);
      }
    }

    removeSelectedEntity(id);

    if (building) {
      const queue = productionQueues.get(id);
      if (queue) {
        for (const entry of queue) {
          if (entry.kind === 'technology' && entry.technologyType) {
            inFlightTechByOwner.get(building.owner)?.delete(entry.technologyType);
          }
        }
      }
    }

    productionQueues.delete(id);
    accessor.mutate(rallyPointsCodec, (m) => {
      m.delete(id);
    });
    constructionStates.delete(id);
    buildingHealthStates.delete(id);
    buildingCombatStates.delete(id);
    accessor.mutate(wonderCountdownsCodec, (m) => {
      m.delete(id);
    });

    // Stored relics on a destroyed Monastery spill back onto the map.
    // Search outward until enough free cells are collected, capped at
    // mapWidth + mapHeight; on failure stack remaining relics on the
    // anchor cell (relics have no unit-occupancy, so visual overlap is
    // tolerated).
    const storedRelicCount = accessor.get(relicsInMonasteryCodec).get(id) ?? 0;
    const relicDropPositions: Position[] = [];
    if (storedRelicCount > 0 && building) {
      const position = world.getComponent<Position>(id, 'position');
      if (position) {
        const footprint = buildingFootprint(building.buildingType);
        const maxSearchRange = mapWidth + mapHeight;
        for (
          let searchRange = Math.max(2, Math.max(footprint.width, footprint.height));
          searchRange <= maxSearchRange && relicDropPositions.length < storedRelicCount;
          searchRange += 1
        ) {
          const candidates = getApproachCellsForFootprint(
            position,
            footprint.width,
            footprint.height,
            searchRange,
          );
          for (const candidate of candidates) {
            if (relicDropPositions.length >= storedRelicCount) {
              break;
            }
            if (!isTerrainPassableForUnit(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByBuilding(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByResource(candidate.x, candidate.y)) {
              continue;
            }
            if (relicDropPositions.some((p) => p.x === candidate.x && p.y === candidate.y)) {
              continue;
            }
            relicDropPositions.push(candidate);
          }
        }
        while (relicDropPositions.length < storedRelicCount) {
          relicDropPositions.push({ x: position.x, y: position.y });
        }
      }
    }
    accessor.mutate(relicsInMonasteryCodec, (m) => m.delete(id));
    world.destroyEntity(id);
    for (const dropPosition of relicDropPositions) {
      addResourceEntity('relic', dropPosition, 0, null);
    }
    markOutOfBandRenderChange();
  }

  function killWildlifeEntity(id: number): void {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    const wildlife = wildlifeStates.get(id);
    if (!resource || !wildlife) {
      return;
    }

    wildlife.currentHp = 0;
    wildlife.cooldownTicks = 0;
    wildlife.isAlive = false;
    wildlife.targetEntityRef = null;

    if (!wildlife.corpsePersists || resource.amount <= 0) {
      destroyResourceEntity(id);
      return;
    }

    markOutOfBandRenderChange();
  }

  function destroyResourceEntity(id: number): void {
    removeSelectedEntity(id);
    wildlifeStates.delete(id);
    accessor.mutate(sheepMoveOrdersCodec, (m) => m.delete(id));
    for (const [monkId, carriedId] of monkCarriedRelic.entries()) {
      if (carriedId === id) {
        monkCarriedRelic.delete(monkId);
      }
    }
    world.destroyEntity(id);
    markOutOfBandRenderChange();
  }

  return {
    destroyUnitEntity,
    destroyBuildingEntity,
    killWildlifeEntity,
    destroyResourceEntity,
  };
}
