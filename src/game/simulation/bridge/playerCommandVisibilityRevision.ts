import type { Position } from 'civ-engine';

import type { VisionSourceComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { garrisonedByBuildingCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export interface PlayerCommandVisibilityRevision {
  current: () => number;
  markMutation: () => void;
  runEntityMutation: (entityId: number, mutate: () => void) => void;
  runEntitiesMutation: (entityIds: readonly number[], mutate: () => void) => void;
}

export function runBuildingDestructionVisibilityMutation(
  revision: PlayerCommandVisibilityRevision,
  accessor: BridgeStateAccessor,
  buildingId: number,
  destroy: () => void,
): void {
  revision.runEntitiesMutation(
    [buildingId, ...(accessor.get(garrisonedByBuildingCodec).get(buildingId) ?? [])],
    destroy,
  );
}

function visibilitySourceFingerprint(world: GameWorld, entityId: number): string | null {
  const position = world.getComponent<Position>(entityId, 'position');
  const source = world.getComponent<VisionSourceComponent>(entityId, 'visionSource');
  if (!position || !source) return null;
  return `${source.playerId}:${position.x}:${position.y}:${source.radius}`;
}

export function createPlayerCommandVisibilityRevision(world: GameWorld): PlayerCommandVisibilityRevision {
  let revision = 0;
  const markMutation = (): void => {
    revision += 1;
  };
  const runEntitiesMutation = (entityIds: readonly number[], mutate: () => void): void => {
    const before = new Map<number, string | null>();
    for (const entityId of entityIds) {
      if (!before.has(entityId)) {
        before.set(entityId, visibilitySourceFingerprint(world, entityId));
      }
    }
    try {
      mutate();
    } finally {
      for (const [entityId, fingerprint] of before) {
        if (fingerprint !== visibilitySourceFingerprint(world, entityId)) {
          markMutation();
          break;
        }
      }
    }
  };
  return {
    current: () => revision,
    markMutation,
    runEntityMutation(entityId, mutate) {
      runEntitiesMutation([entityId], mutate);
    },
    runEntitiesMutation,
  };
}
