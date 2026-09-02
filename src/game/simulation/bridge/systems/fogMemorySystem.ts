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
  /** Announce that this tick actually wrote to the memory map. */
  noteMemoryChanged: () => void;
  /** Owner → civilization, for the building-set snapshot (v0.3.105). */
  getCivilizationOf: (owner: number) => string | undefined;
}

export function registerFogMemorySystem(deps: FogMemorySystemDeps): void {
  const {
    world, humanPlayerId, visibility, getOrCreateMemoryMap, noteMemoryChanged, getCivilizationOf,
  } = deps;

  // Everything a memory entry says about how the thing LOOKS — which since
  // 2026-09-02 is every field it has. An entry is rewritten only when this
  // changes, because a dirty slot is re-serialised WHOLE into that tick's
  // replay diff: refreshing identical entries every tick was 358 MB of a
  // 537 MB corpus bundle, past V8's string ceiling. (The field that made them
  // differ, `lastSeenTick`, had no consumer and is gone; see memoryTypes.ts.)
  const sameAppearance = (a: MemoryEntry | undefined, b: MemoryEntry): boolean =>
    a !== undefined
    && a.kind === b.kind
    && a.entityType === b.entityType
    && a.architecture === b.architecture
    && a.generation === b.generation
    && a.position.x === b.position.x
    && a.position.y === b.position.y
    && a.footprintWidth === b.footprintWidth
    && a.footprintHeight === b.footprintHeight
    && a.tint === b.tint
    && a.owner === b.owner
    && a.size === b.size
    && a.visualVariant === b.visualVariant;

  world.registerSystem({
    name: 'prototypeFogMemory',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      const humanMemory = getOrCreateMemoryMap(humanPlayerId);
      let changed = false;
      const remember = (id: number, entry: MemoryEntry): void => {
        if (sameAppearance(humanMemory.get(id), entry)) return;
        humanMemory.set(id, entry);
        changed = true;
      };

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
        remember(id, {
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
        remember(id, {
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
          changed = true;
        }
      }

      if (changed) noteMemoryChanged();
    },
  });
}
