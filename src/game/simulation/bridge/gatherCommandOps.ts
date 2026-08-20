// Gathering orders. Extracted from ./unitCommandOps.ts for the 500-LOC budget:
// this is the one command family that writes the GathererComponent rather than
// a unit command, so it is the cleanest seam in that file.

import type { Position } from 'civ-engine';

import { canGatherResource, resourceKindToEconomyResource } from '../prototypeEconomyRules';
import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';

export interface GatherCommandOpsDeps {
  world: GameWorld;
  isHarvestableResource: (resourceId: number, resource: ResourceComponent) => boolean;
  clearGathererOrder: (unitId: number) => void;
  clearUnitCommand: (unitId: number) => void;
  findNearestDropOffBuilding: (
    world: GameWorld,
    owner: number,
    economyResource: 'food' | 'wood' | 'gold' | 'stone',
    from: Position,
  ) => number | null;
}

export function createGatherCommandOps(deps: GatherCommandOpsDeps) {
  const {
    world,
    isHarvestableResource,
    clearGathererOrder,
    clearUnitCommand,
    findNearestDropOffBuilding,
  } = deps;

  function setUnitGatherCommandDirect(unitId: number, resourceId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const gatherer = world.getComponent<GathererComponent>(unitId, 'gatherer');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    const targetPosition = world.getComponent<Position>(resourceId, 'position');
    if (!unit || !gatherer || !resource || !targetPosition) return false;

    const economyResource = resourceKindToEconomyResource(resource.resourceType);
    if (economyResource === null || !isHarvestableResource(resourceId, resource)) {
      return false;
    }
    // M1 Farms: a farm (resource + building hybrid) is owner-only. Reject an
    // explicit gather order on another player's farm so a manual/context
    // command can't steal food from it. Neutral resources are unaffected.
    if (
      !canGatherResource(
        unit.owner,
        world.getComponent<BuildingComponent>(resourceId, 'building') !== undefined,
        resource.baseOwner,
      )
    ) {
      return false;
    }

    clearGathererOrder(unitId);
    gatherer.hasExplicitGatherOrder = true;
    clearUnitCommand(unitId);
    gatherer.desiredResource = economyResource;
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = resourceId;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      world,
      unit.owner,
      economyResource,
      targetPosition,
    );
    gatherer.gatherProgressTicks = 0;
    return true;
  }

  // Bridge facade. HUD-time context-command fallthrough calls this; routes
  // through civ-engine's command channel so the recorder captures gather
  // intent. Handler delegates to setUnitGatherCommandDirect at start of
  // next step.
  function issueUnitGatherCommand(unitId: number, resourceId: number): boolean {
    const result = world.submitWithResult('unit.gather', { unitId, resourceId });
    return result.accepted;
  }

  return { setUnitGatherCommandDirect, issueUnitGatherCommand };
}
