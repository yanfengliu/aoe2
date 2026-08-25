// Who is inside what: a building's garrison, and a Transport Ship's cargo.
//
// A transport is a garrison host that moves, and its cargo rides the SAME side
// maps a building's garrison does — both store plain entity ids on either side,
// so nothing about the save format changes and a loaded transport survives
// save/load and replay exactly like a garrisoned Tower. Split out of
// trainingMarketOps.ts, which was over its line budget.

import type { Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent, VisionSourceComponent } from '../types';
import { buildingGarrisonCapacity, canGarrisonAt } from '../prototypeBuildingRules';
import { canBoardTransport, transportCapacity } from '../transportShip';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  garrisonedByBuildingCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
} from './bridgeStateSerialize';
import { civGarrisonCapacityMultiplier, civHouseGarrisonCapacity } from '../civBuildingBonuses';
import type { GameWorld } from './pureHelpers';

// An owner with nothing researched — Careening and Dry Dock raise a
// transport's capacity, so the boarding check reads the owner's set.
const EMPTY_GARRISON_TECH_SET: ReadonlySet<
  import('../types').ResearchableTechnologyType
> = new Set();

export interface GarrisonOpsDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  isGarrisonedUnit: (unitId: number) => boolean;
  clearGathererOrder: (unitId: number) => void;
  clearUnitCommand: (unitId: number) => void;
  clearPositionAndSyncOccupancy: (unitId: number) => void;
  placeFreshSpawnUnit: (entity: number, position: Position) => Position | null;
  findScenarioSpawnPosition: (origin: Position) => Position | null;
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: BuildingComponent['buildingType'],
    preferForeground?: boolean,
  ) => Position | null;
  removeSelectedEntity: (id: number) => void;
  placementMode: { current: unknown };
  markOutOfBandRenderChange: () => void;
}

export interface GarrisonOps {
  /** Put a unit inside a building. */
  garrisonUnit(unitId: number, buildingId: number): boolean;
  /** Turn a building's whole garrison out onto its perimeter. */
  ungarrisonBuilding(buildingId: number): boolean;
  /** Load a land unit onto a Transport Ship. */
  boardTransport(unitId: number, transportId: number): boolean;
  /** Put a Transport Ship's cargo ashore near `target`. */
  unloadTransport(transportId: number, target: Position): boolean;
}

export function createGarrisonOps(deps: GarrisonOpsDeps): GarrisonOps {
  const {
    world,
    accessor,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    clearPositionAndSyncOccupancy,
    placeFreshSpawnUnit,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    removeSelectedEntity,
    placementMode,
    markOutOfBandRenderChange,
  } = deps;

  function boardTransport(unitId: number, transportId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const transport = world.getComponent<UnitComponent>(transportId, 'unit');
    if (
      !unit
      || !transport
      || transport.unitType !== 'transport-ship'
      || unit.owner !== transport.owner
      || !canBoardTransport(unit.unitType)
    ) {
      return false;
    }

    const aboard = accessor.get(garrisonedByBuildingCodec).get(transportId) ?? [];
    const ownerTechs = accessor.get(researchedTechnologiesCodec).get(transport.owner) ?? EMPTY_GARRISON_TECH_SET;
    if (aboard.length >= transportCapacity(ownerTechs) || isGarrisonedUnit(unitId)) {
      return false;
    }

    clearGathererOrder(unitId);
    clearUnitCommand(unitId);

    const visionSource = world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
    if (visionSource) {
      accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => m.set(unitId, { ...visionSource }));
      world.removeComponent(unitId, 'visionSource');
    }

    clearPositionAndSyncOccupancy(unitId);
    accessor.mutate(garrisonedUnitToBuildingCodec, (m) => m.set(unitId, transportId));
    accessor.mutate(garrisonedByBuildingCodec, (m) => {
      const list = m.get(transportId) ?? [];
      list.push(unitId);
      m.set(transportId, list);
    });
    markOutOfBandRenderChange();
    return true;
  }

  // Put the cargo ashore. Each unit takes the first free LAND cell near the
  // target; one that cannot be placed stays aboard rather than vanishing, so a
  // transport ordered onto a crowded beach unloads what fits and keeps the rest.
  function unloadTransport(transportId: number, target: Position): boolean {
    const transport = world.getComponent<UnitComponent>(transportId, 'unit');
    const aboard = accessor.get(garrisonedByBuildingCodec).get(transportId) ?? [];
    if (!transport || transport.unitType !== 'transport-ship' || aboard.length === 0) {
      return false;
    }
    // The ship must actually BE at the shore it is unloading onto (v0.3.95):
    // without this, pointing a loaded transport at a distant coast teleported
    // the cargo across the map. The router turns a far click into a sail.
    const transportPosition = world.getComponent<Position>(transportId, 'position');
    if (
      !transportPosition
      || Math.abs(transportPosition.x - target.x) + Math.abs(transportPosition.y - target.y) > 3
    ) {
      return false;
    }

    const remaining: number[] = [];
    let landed = 0;
    for (const unitId of aboard) {
      const shore = findScenarioSpawnPosition(target);
      if (!shore || !placeFreshSpawnUnit(unitId, shore)) {
        remaining.push(unitId);
        continue;
      }
      const storedVision = accessor.get(garrisonedUnitVisionSourcesCodec).get(unitId);
      if (storedVision) {
        world.addComponent(unitId, 'visionSource', storedVision);
        accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => m.delete(unitId));
      }
      accessor.mutate(garrisonedUnitToBuildingCodec, (m) => m.delete(unitId));
      landed += 1;
    }
    accessor.mutate(garrisonedByBuildingCodec, (m) => {
      if (remaining.length === 0) m.delete(transportId);
      else m.set(transportId, remaining);
    });
    if (landed > 0) markOutOfBandRenderChange();
    return landed > 0;
  }

  function garrisonUnit(unitId: number, buildingId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    // Teuton towers shelter twice the table ("Towers can garrison 2x units"),
    // and Khmer houses hold five villagers on a base of zero.
    const buildingCivilization = building
      ? accessor.get(playerCivilizationsCodec).get(building.owner)
      : undefined;
    const capacity = building
      ? (buildingGarrisonCapacity(building.buildingType)
        + civHouseGarrisonCapacity(buildingCivilization, building.buildingType))
        * civGarrisonCapacityMultiplier(buildingCivilization, building.buildingType)
      : 0;
    if (
      !unit
      || !building
      || unit.owner !== building.owner
      || !canGarrisonAt(building.buildingType, unit.unitType, buildingCivilization)
    ) {
      return false;
    }

    const currentUnits = accessor.get(garrisonedByBuildingCodec).get(buildingId) ?? [];
    if (currentUnits.length >= capacity || isGarrisonedUnit(unitId)) {
      return false;
    }

    clearGathererOrder(unitId);
    clearUnitCommand(unitId);

    const visionSource = world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
    if (visionSource) {
      accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) =>
        m.set(unitId, { ...visionSource }),
      );
      world.removeComponent(unitId, 'visionSource');
    }

    clearPositionAndSyncOccupancy(unitId);
    accessor.mutate(garrisonedUnitToBuildingCodec, (m) => m.set(unitId, buildingId));
    accessor.mutate(garrisonedByBuildingCodec, (m) => {
      const list = m.get(buildingId) ?? [];
      list.push(unitId);
      m.set(buildingId, list);
    });
    // Drop ONLY this unit from the selection (v0.3.102): it just vanished
    // into the building, so a selection holding it would be a ghost — but the
    // rest of the player's selection, or a selection belonging to a DIFFERENT
    // player entirely, is none of this garrison's business. The old
    // unconditional clearSelection() wiped the HUMAN's selection every time
    // an AI unit garrisoned anywhere on the map — invisible until v0.3.89
    // widened garrison eligibility and AI archers started sheltering.
    removeSelectedEntity(unitId);
    placementMode.current = null;
    markOutOfBandRenderChange();
    return true;
  }

  function ungarrisonBuilding(buildingId: number): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const garrisonedUnits = accessor.get(garrisonedByBuildingCodec).get(buildingId) ?? [];
    if (!building || !buildingPosition || garrisonedUnits.length === 0) {
      return false;
    }

    const remainingGarrisonedUnits: number[] = [];
    let didUngarrisonUnit = false;

    for (const unitId of garrisonedUnits) {
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) continue;

      const spawnPosition = findBuildingSpawnPosition(
        buildingPosition,
        building.buildingType,
        true,
      );
      if (!spawnPosition) {
        remainingGarrisonedUnits.push(unitId);
        continue;
      }

      if (!placeFreshSpawnUnit(unitId, spawnPosition)) {
        remainingGarrisonedUnits.push(unitId);
        continue;
      }
      const storedVisionSource = accessor.get(garrisonedUnitVisionSourcesCodec).get(unitId);
      if (storedVisionSource) {
        world.addComponent(unitId, 'visionSource', storedVisionSource);
        accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => m.delete(unitId));
      }
      accessor.mutate(garrisonedUnitToBuildingCodec, (m) => m.delete(unitId));
      clearGathererOrder(unitId);
      didUngarrisonUnit = true;
    }

    accessor.mutate(garrisonedByBuildingCodec, (m) => {
      if (remainingGarrisonedUnits.length > 0) {
        m.set(buildingId, remainingGarrisonedUnits);
      } else {
        m.delete(buildingId);
      }
    });

    if (didUngarrisonUnit) {
      markOutOfBandRenderChange();
    }
    return didUngarrisonUnit;
  }

  return { garrisonUnit, ungarrisonBuilding, boardTransport, unloadTransport };
}
