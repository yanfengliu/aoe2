// Fog memory ops. Reads / writes the per-player last-seen snapshot side map
// keyed by playerId -> entityId -> MemoryEntry. Phase 2D moved the side map
// onto `world.state.aoe2.lastSeenStatic` via accessor + codec; the factory
// now closes over a BridgeStateAccessor and the get-or-create helper goes
// through `accessor.mutate` so the dirty bit fires on every tick that
// writes to fog memory.

import type { VisibilityMap } from 'civ-engine';

import type { MemoryEntry } from './memoryTypes';
import type { ProjectedEntityView } from '../types';
import { isFootprintExplored, isFootprintVisible } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { lastSeenStaticCodec } from './bridgeStateSerialize';

export interface FogMemoryOps {
  // Return (creating if missing) the per-player memory map. Reading it does
  // NOT mark `lastSeenStatic` dirty — creating a missing inner map does,
  // because that IS a change. A caller that mutates the returned Map must
  // call `noteMemoryChanged()`, or the write will not be persisted.
  //
  // It used to mark dirty up front, on the reasoning that the caller mutates
  // the returned Map in place where the accessor cannot see it. That was safe
  // and very expensive: the codec re-serialises the WHOLE nested map into
  // every tick it is dirty, and the only per-tick caller marked it on every
  // tick whether or not anything changed. Measured 2026-09-02 on the corpus's
  // 13,000-tick boot-map run: `aoe2.lastSeenStatic` was 358 MB of a 537 MB
  // replay bundle, which is past V8's ~537 MB string ceiling — the corpus gate
  // died on `RangeError: Invalid string length` in JSON.stringify.
  getOrCreateMemoryMap(playerId: number): Map<number, MemoryEntry>;
  // Announce an in-place write to a Map handed out above.
  noteMemoryChanged(): void;
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
  // Phase 2D: lastSeenStatic migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  humanPlayerId: number;
  visibility: VisibilityMap;
}

export function createFogMemoryOps(deps: FogMemoryDeps): FogMemoryOps {
  const { accessor, humanPlayerId, visibility } = deps;

  function getOrCreateMemoryMap(playerId: number): Map<number, MemoryEntry> {
    const existing = accessor.get(lastSeenStaticCodec).get(playerId);
    if (existing) return existing;
    let created: Map<number, MemoryEntry> | undefined;
    accessor.mutate(lastSeenStaticCodec, (outer) => {
      created = new Map<number, MemoryEntry>();
      outer.set(playerId, created);
    });
    return created!;
  }

  function noteMemoryChanged(): void {
    accessor.markDirty(lastSeenStaticCodec);
  }

  function getFogMemoryEntities(liveEntityIds: Set<number>): ProjectedEntityView[] {
    const humanMemory = accessor.get(lastSeenStaticCodec).get(humanPlayerId);
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
        generation: entry.generation,
        kind: entry.kind,
        layer: entry.kind,
        entityType: entry.entityType,
        owner: entry.owner,
        x: entry.position.x,
        y: entry.position.y,
        elevation: 0,
        tint: entry.tint,
        size: entry.size,
        footprintWidth: entry.footprintWidth,
        footprintHeight: entry.footprintHeight,
        visualVariant: entry.visualVariant,
        ...(entry.architecture ? { architecture: entry.architecture } : {}),
        selected: false,
        currentHp: null,
        maxHp: null,
        isMemory: !isVisible,
      });
    }
    return memoryViews;
  }

  function getHumanFogMemorySize(): number {
    return accessor.get(lastSeenStaticCodec).get(humanPlayerId)?.size ?? 0;
  }

  return {
    getOrCreateMemoryMap,
    noteMemoryChanged,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  };
}
