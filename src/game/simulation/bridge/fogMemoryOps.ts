// Fog memory ops. Reads / writes the per-player last-seen snapshot side map
// keyed by playerId -> entityId -> MemoryEntry. Caller owns the map; the
// factory just bundles the read helpers so createWorld doesn't have to carry
// them inline. Mutations from other callers (save/load hydration, per-tick
// refresh) still go through the same map reference by design.

import type { VisibilityMap } from 'civ-engine';

import type { MemoryEntry } from '../createSimulationBridge';
import type { ProjectedEntityView } from '../types';
import { isFootprintExplored, isFootprintVisible } from './pureHelpers';

export interface FogMemoryOps {
  // Return (creating if missing) the per-player memory map. Used by the
  // per-tick refresh pathway that writes last-seen snapshots.
  getOrCreateMemoryMap(playerId: number): Map<number, MemoryEntry>;
  // Build `ProjectedEntityView` entries for every memory record whose
  // position is explored-but-not-visible, deduped against any live entity
  // the renderer is already drawing for the same entity id. Returned views
  // carry `isMemory: true` for the default (non-visible) case; entries whose
  // cells happen to be visible again get `isMemory: false` so the scene can
  // render them as a live (non-memory) projection.
  getFogMemoryEntities(liveEntityIds: Set<number>): ProjectedEntityView[];
  // Cheap pre-check used by `getRenderState` to short-circuit the merge
  // logic when the human player has no fog memory (e.g. immediately after
  // world bootstrap, or in unit tests that never let the visibility system
  // run). Avoids the `getFogMemoryEntities` call and the dedupe Set
  // allocation in the common case.
  getHumanFogMemorySize(): number;
}

export interface FogMemoryDeps {
  fogMemory: Map<number, Map<number, MemoryEntry>>;
  humanPlayerId: number;
  visibility: VisibilityMap;
}

export function createFogMemoryOps(deps: FogMemoryDeps): FogMemoryOps {
  const { fogMemory, humanPlayerId, visibility } = deps;

  function getOrCreateMemoryMap(playerId: number): Map<number, MemoryEntry> {
    let map = fogMemory.get(playerId);
    if (!map) {
      map = new Map<number, MemoryEntry>();
      fogMemory.set(playerId, map);
    }
    return map;
  }

  function getFogMemoryEntities(liveEntityIds: Set<number>): ProjectedEntityView[] {
    const humanMemory = fogMemory.get(humanPlayerId);
    if (!humanMemory || humanMemory.size === 0) {
      return [];
    }

    const memoryViews: ProjectedEntityView[] = [];
    for (const [entityId, entry] of humanMemory) {
      if (liveEntityIds.has(entityId)) {
        continue;
      }
      // Iter-3 V3-1: surface a memory entry as long as ANY cell of its
      // footprint is explored / visible. The prior anchor-only check
      // hid memory entries for partially-explored multi-cell buildings
      // (the iter-2 M2-1 sibling at the projection layer).
      const isExplored = isFootprintExplored(
        visibility,
        humanPlayerId,
        entry.position.x,
        entry.position.y,
        entry.footprintWidth,
        entry.footprintHeight,
      );
      if (!isExplored) {
        continue;
      }
      const isVisible = isFootprintVisible(
        visibility,
        humanPlayerId,
        entry.position.x,
        entry.position.y,
        entry.footprintWidth,
        entry.footprintHeight,
      );
      // If the entity is currently visible and the live projector is not emitting it
      // (e.g. it was static and never visible at renderAdapter connect time, so the
      // initial snapshot skipped it), surface it from memory as a live (non-memory)
      // projection so the player sees it. When the entity's visibility changes later,
      // memory still carries the most recent snapshot.
      memoryViews.push({
        id: entityId,
        kind: entry.kind,
        layer: entry.kind,
        entityType: entry.entityType,
        owner: entry.owner,
        x: entry.position.x,
        y: entry.position.y,
        tint: entry.tint,
        size: entry.size,
        footprintWidth: entry.footprintWidth,
        footprintHeight: entry.footprintHeight,
        visualVariant: entry.visualVariant,
        selected: false,
        currentHp: null,
        maxHp: null,
        isMemory: !isVisible,
      });
    }
    return memoryViews;
  }

  function getHumanFogMemorySize(): number {
    return fogMemory.get(humanPlayerId)?.size ?? 0;
  }

  return {
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  };
}
