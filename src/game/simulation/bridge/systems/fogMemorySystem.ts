// Fog-of-war memory: every tick, take a snapshot of every static building
// or static memorable resource (trees, berries, gold mines, stone mines)
// the human player currently sees. Snapshots persist after vision loss so
// the renderer can render last-known state under fog.

import { VisibilityMap, type Position } from 'civ-engine';
import type {
  BuildingComponent,
  RenderableComponent,
  ResourceComponent,
} from '../../types';
import { isFootprintVisible, type GameWorld } from '../pureHelpers';
import { isStaticMemorableResourceType } from '../../prototypeUnitRules';
import type { MemoryEntry } from '../memoryTypes';

export interface FogMemorySystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
}

export function registerFogMemorySystem(deps: FogMemorySystemDeps): void {
  const { world, humanPlayerId, visibility, getOrCreateMemoryMap } = deps;

  world.registerSystem({
    name: 'prototypeFogMemory',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      const humanMemory = getOrCreateMemoryMap(humanPlayerId);

      // Refresh every building the human player currently sees. Visibility is
      // tested over the full footprint to match the projector and the iter-2
      // M2-1 target-finding fix.
      for (const id of activeWorld.query('position', 'building', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !building || !renderable) {
          continue;
        }
        if (
          !isFootprintVisible(
            visibility,
            humanPlayerId,
            position.x,
            position.y,
            renderable.footprintWidth,
            renderable.footprintHeight,
          )
        ) {
          continue;
        }
        humanMemory.set(id, {
          kind: 'building',
          entityType: building.buildingType,
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: building.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
          lastSeenTick: activeWorld.tick,
        });
      }

      // Refresh every static resource the human player currently sees.
      for (const id of activeWorld.query('position', 'resource', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !resource || !renderable) {
          continue;
        }
        if (!isStaticMemorableResourceType(resource.resourceType)) {
          continue;
        }
        if (!visibility.isVisible(humanPlayerId, position.x, position.y)) {
          continue;
        }
        humanMemory.set(id, {
          kind: 'resource',
          entityType: resource.resourceType,
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: resource.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
          lastSeenTick: activeWorld.tick,
        });
      }

      // Forget memories of entities that no longer exist AND whose last-known
      // cell is currently visible — i.e. the player saw it disappear.
      for (const [entityId, entry] of humanMemory) {
        const stillExists = activeWorld.getComponent<Position>(entityId, 'position') !== undefined;
        if (stillExists) {
          continue;
        }
        if (visibility.isVisible(humanPlayerId, entry.position.x, entry.position.y)) {
          humanMemory.delete(entityId);
        }
      }
    },
  });
}
