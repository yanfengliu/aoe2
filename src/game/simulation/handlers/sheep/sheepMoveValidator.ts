// Validator for `sheep.move` command (DESIGN v17 §6.2 / §6.4).

import type { World } from 'civ-engine';

import type { ResourceComponent } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export type SheepMoveValidator = (
  data: GameCommands['sheep.move'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | false | { code: string; message: string };

export const sheepMoveValidator: SheepMoveValidator = (data, world) => {
  if (!Number.isInteger(data.sheepId)) {
    return { code: 'invalid_sheep_id', message: 'Sheep id must be an integer.' };
  }
  if (!Number.isInteger(data.target?.x) || !Number.isInteger(data.target?.y)) {
    return { code: 'invalid_target', message: 'Target coordinates must be integers.' };
  }
  if (!world.isAlive(data.sheepId)) {
    return { code: 'sheep_not_found', message: 'Sheep no longer exists.' };
  }
  const resource = world.getComponent<ResourceComponent>(data.sheepId, 'resource');
  if (!resource) {
    return { code: 'not_a_resource', message: 'Entity is not a resource.' };
  }
  if (resource.resourceType !== 'sheep') {
    return { code: 'not_a_sheep', message: 'Entity is not a sheep.' };
  }
  return true;
};
