// The garrison ORDER, split out of `unitCommandOps` for the 500-line budget.
// Garrisoning walks the unit to the building and puts it inside on arrival
// (AoE2); entering from any distance made it a free escape from anything
// chasing the unit. Both right-click routes — by cell (`contextRouter`) and by
// entity (`routeUnitContextAtEntityCommandDirect`) — go through `orderGarrison`
// so the rule has exactly one home.

import type { EntityRef, Position } from 'civ-engine';

import type { BuildingComponent } from '../types';
import { buildingFootprint, type GameWorld } from './pureHelpers';
import type { UnitCommand } from './sharedTypes';

export interface GarrisonOrderOps {
  isUnitAdjacentToBuilding(unitId: number, buildingId: number): boolean;
  orderGarrison(unitId: number, buildingId: number): boolean;
}

export function createGarrisonOrderOps(deps: {
  world: GameWorld;
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
  getEntityRef: (id: number) => EntityRef | null;
  clearGathererOrder: (id: number) => void;
  setUnitCommand: (unitId: number, command: UnitCommand) => void;
}): GarrisonOrderOps {
  const { world, garrisonUnit, getEntityRef, clearGathererOrder, setUnitCommand } = deps;

  /** Standing against the building — the footprint's own cells count, since a
   *  unit inside a doorway cell is as arrived as one beside it. */
  function isUnitAdjacentToBuilding(unitId: number, buildingId: number): boolean {
    const unitPosition = world.getComponent<Position>(unitId, 'position');
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!unitPosition || !buildingPosition || !building) return false;
    const footprint = buildingFootprint(building.buildingType);
    const dx = unitPosition.x < buildingPosition.x
      ? buildingPosition.x - unitPosition.x
      : Math.max(0, unitPosition.x - (buildingPosition.x + footprint.width - 1));
    const dy = unitPosition.y < buildingPosition.y
      ? buildingPosition.y - unitPosition.y
      : Math.max(0, unitPosition.y - (buildingPosition.y + footprint.height - 1));
    return dx + dy <= 1;
  }

  /** Garrison as an ORDER: walk to the building, go in on arrival. A unit
   *  already standing against it enters now, so a click at point-blank range
   *  still feels immediate. */
  function orderGarrison(unitId: number, buildingId: number): boolean {
    if (isUnitAdjacentToBuilding(unitId, buildingId)) {
      return garrisonUnit(unitId, buildingId);
    }
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const buildingRef = getEntityRef(buildingId);
    if (!buildingPosition || !buildingRef) return false;
    clearGathererOrder(unitId);
    setUnitCommand(unitId, {
      type: 'garrison',
      target: { x: buildingPosition.x, y: buildingPosition.y },
      buildingRef,
    });
    return true;
  }

  return { isUnitAdjacentToBuilding, orderGarrison };
}
