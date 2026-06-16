// Validator for `unit.gather` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type {
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
} from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canGatherResource } from '../../prototypeEconomyRules';

export type UnitGatherValidator = (
  data: GameCommands['unit.gather'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const unitGatherValidator: UnitGatherValidator = (data, world) => {
  if (!Number.isInteger(data.unitId) || !Number.isInteger(data.resourceId)) {
    return { code: 'invalid_id', message: 'Gather ids must be integers.' };
  }
  if (!world.isAlive(data.unitId)) {
    return { code: 'unit_not_found', message: 'Gatherer no longer exists.' };
  }
  const unit = world.getComponent<UnitComponent>(data.unitId, 'unit');
  if (!unit) {
    return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  }
  const gatherer = world.getComponent<GathererComponent>(data.unitId, 'gatherer');
  if (!gatherer) {
    return { code: 'not_a_gatherer', message: 'Unit cannot gather.' };
  }
  if (!world.isAlive(data.resourceId)) {
    return { code: 'resource_not_found', message: 'Resource no longer exists.' };
  }
  const resource = world.getComponent<ResourceComponent>(data.resourceId, 'resource');
  if (!resource) {
    return { code: 'not_a_resource', message: 'Target is not a resource.' };
  }
  // M1 Farms: a farm (resource + building hybrid) is an owned structure —
  // only its owner may gather it. Reject a gather order from another player so
  // an enemy/AI villager cannot harvest food from an opponent's farm.
  const building = world.getComponent<BuildingComponent>(data.resourceId, 'building');
  if (!canGatherResource(unit.owner, building !== undefined, resource.baseOwner)) {
    return { code: 'not_owned', message: 'Cannot gather another player\'s farm.' };
  }
  return true;
};
