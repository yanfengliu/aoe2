import type { Position } from 'civ-engine';
import type { ResourceComponent } from '../types';
import { clamp, type GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { sheepMoveOrdersCodec } from './bridgeStateSerialize';

export interface SheepCommandOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  accessor: BridgeStateAccessor;
}

export interface SheepCommandOps {
  setSheepMoveCommandDirect(sheepId: number, target: Position): boolean;
  issueSheepMoveCommand(sheepId: number, target: Position): boolean;
}

export function createSheepCommandOps(deps: SheepCommandOpsDeps): SheepCommandOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    accessor,
  } = deps;

  function setSheepMoveCommandDirect(sheepId: number, target: Position): boolean {
    const resource = world.getComponent<ResourceComponent>(sheepId, 'resource');
    if (
      !resource
      || resource.resourceType !== 'sheep'
      || resource.owner !== humanPlayerId
      || resource.amount <= 0
    ) {
      return false;
    }

    accessor.mutate(sheepMoveOrdersCodec, (m) => m.set(sheepId, {
      x: clamp(target.x, 0, mapWidth - 1),
      y: clamp(target.y, 0, mapHeight - 1),
    }));
    return true;
  }

  function issueSheepMoveCommand(sheepId: number, target: Position): boolean {
    const result = world.submitWithResult('sheep.move', { sheepId, target });
    return result.accepted;
  }

  return { setSheepMoveCommandDirect, issueSheepMoveCommand };
}
