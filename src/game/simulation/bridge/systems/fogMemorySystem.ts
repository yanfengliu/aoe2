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
import { architectureStyleFor } from '../../architectureStyles';

export interface FogMemorySystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
  /** Owner → civilization, for the building-set snapshot (v0.3.105). */
  getCivilizationOf: (owner: number) => string | undefined;
}

export function registerFogMemorySystem(deps: FogMemorySystemDeps): void {
  const { world, humanPlayerId, visibility, getOrCreateMemoryMap, getCivilizationOf } = deps;

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
          architecture: architectureStyleFor(getCivilizationOf(building.owner)),
          generation: activeWorld.getEntityGeneration(id),
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
      // V4-21: anchor-only visibility is correct here only because every
      // memorable static resource (tree, berry-bush, gold-mine, stone-mine)
      // is 1x1 — `isFootprintVisible(... 1, 1)` reduces to `isVisible`. If
      // a future memorable resource has a multi-cell footprint, switch to
      // `isFootprintVisible` here and on the cleanup path below.
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
          generation: activeWorld.getEntityGeneration(id),
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
      // footprint is currently visible — i.e. the player saw it disappear.
      // Footprint-aware match keeps a multi-cell castle from leaving a permanent
      // ghost when only a non-anchor cell of its old footprint is in vision
      // (mirrors the iter-3 V3-1 write/select footprint-visibility fix).
      for (const [entityId, entry] of humanMemory) {
        // Generation-aware existence: isCurrent is false on BOTH death and id
        // recycle (a new entity reusing this id has a bumped generation), so a
        // recycled id no longer masks a destroyed-under-fog building as "still
        // there" (the M5 bug — a raw `getComponent(id,'position')` probe was
        // fooled by the recycled entity's position).
        const stillExists = activeWorld.isCurrent({ id: entityId, generation: entry.generation });
        if (stillExists) {
          continue;
        }
        if (
          isFootprintVisible(
            visibility,
            humanPlayerId,
            entry.position.x,
            entry.position.y,
            entry.footprintWidth,
            entry.footprintHeight,
          )
        ) {
          humanMemory.delete(entityId);
        }
      }
    },
  });
}
