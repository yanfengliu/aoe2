// Render-state assembly + per-tick memo. Caller drives `getRenderState()`
// from multiple sites (HUD RAF, AoeVoxelGameView, browserTestApi
// getSnapshot); the work below — filter every entity by isFootprintVisible,
// possibly merge memory entries, possibly re-sort — is not free. The cache
// invalidates on (tick, renderStoreVersion,
// fogMemorySize) so any meaningful state change re-runs the projection.

import { VisibilityMap } from 'civ-engine';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  ProjectedUnitAttackView,
} from '../types';
import type { EntityIdLookup } from './fogMemoryOps';
import { compareProjectedRenderEntities } from './pureHelpers';
import { joinProjectedEntityLists } from '../projectedEntityLists';
import { isLiveEntityDrawn } from './humanSight';
import type { RenderStore } from '../renderStore';
import { indexVisibleUnitAttackAnimations } from './unitAttackAnimationFeed';

export interface RenderStateOpsDeps {
  visibility: VisibilityMap;
  humanPlayerId: number;
  /** The perspective's sight: `humanPlayerId` plus every owner it shares
   *  vision with (`humanSight.ts`). Read once per rebuild. */
  getSightOwners: () => readonly number[];
  renderStore: RenderStore;
  getHumanFogMemorySize: () => number;
  getFogMemoryEntities: (liveIds: EntityIdLookup) => ProjectedEntityView[];
  getRecentUnitAttacks: () => readonly ProjectedUnitAttackView[];
  getRenderStoreVersion: () => number;
  /** Whether this building is hidden from the perspective however much of it
   *  is lit: an enemy's foundation nobody has started building
   *  (unstartedFoundations.ts). Required, so no render path can forget it. */
  isFoundationHidden: (buildingId: number) => boolean;
}

export interface RenderStateValue {
  tick: number;
  entities: ProjectedEntityView[];
  frame: ProjectedFrameView | null;
}

export function createRenderStateOps(deps: RenderStateOpsDeps): {
  getRenderState(): RenderStateValue;
} {
  const {
    visibility,
    humanPlayerId,
    getSightOwners,
    renderStore,
    getHumanFogMemorySize,
    getFogMemoryEntities,
    getRecentUnitAttacks,
    getRenderStoreVersion,
    isFoundationHidden,
  } = deps;

  const terrainIdsByList = new WeakMap<readonly ProjectedEntityView[], Set<number>>();
  function idsOf(terrain: readonly ProjectedEntityView[]): Set<number> {
    let ids = terrainIdsByList.get(terrain);
    if (!ids) {
      ids = new Set<number>();
      for (const entity of terrain) {
        ids.add(entity.id);
      }
      terrainIdsByList.set(terrain, ids);
    }
    return ids;
  }

  let cache: {
    tick: number;
    renderStoreVersion: number;
    fogMemorySize: number;
    value: RenderStateValue;
  } | null = null;

  // Visible NOW through the perspective's SIGHT — its own vision and its
  // allies' — not its own vision alone (register 2026-09-24: an ally's base
  // was lit and empty because this asked `humanPlayerId` only). The world and
  // the minimap both draw this list, so an enemy's unstarted foundation leaves
  // both at once (work 121). The rule is humanSight's `isLiveEntityDrawn`,
  // which the player's placement asks too (work 122).
  const isCurrentlyVisibleTo = (sight: readonly number[]) => (entity: ProjectedEntityView): boolean => (
    entity.kind === 'tile'
    || isLiveEntityDrawn(visibility, sight, humanPlayerId, entity, () => (
      entity.kind === 'building' && isFoundationHidden(entity.id)
    ))
  );

  function getRenderState(): RenderStateValue {
    const currentTick = renderStore.getTick();
    const currentFogMemorySize = getHumanFogMemorySize();
    const currentVersion = getRenderStoreVersion();
    if (
      cache !== null
      && cache.tick === currentTick
      && cache.renderStoreVersion === currentVersion
      && cache.fogMemorySize === currentFogMemorySize
    ) {
      return cache.value;
    }

    const sight = getSightOwners();
    const isCurrentlyVisible = isCurrentlyVisibleTo(sight);
    renderStore.reconcileUnitAttackAnimations(
      indexVisibleUnitAttackAnimations(
        getRecentUnitAttacks(),
        currentTick,
        sight,
      ),
      isCurrentlyVisible,
    );
    // The list is the terrain cells and then everything else, and the store hands back those two halves: one
    // entity per cell, 14,400 on a 120x120 map, which the store keeps sorted and this function never walks. A cell
    // is drawn whatever the fog (the first clause of the rule above), so the terrain passes whole; were the half
    // ever to hold something that is not a tile, it is filtered like the rest and the list is handed on with
    // nothing remembered about it, as it was before (work 150 M2b).
    const lists = renderStore.getEntityLists();
    const terrain = lists.terrainIsTilesOnly ? lists.terrain : lists.terrain.filter(isCurrentlyVisible);
    // Only entities visible to the human perspective NOW are handed on. The
    // prior-tick position frame that display interpolation once read was
    // filtered through the same rule here; since v0.3.192 the presentation
    // keeps its own per-unit history (displayedPositionSmoother), and an
    // entity absent from the previously PRESENTED tick starts fresh there
    // (weaker than the store's old per-tick rule when a frame coalesces
    // ticks — named in that module's header), so nothing about the prior
    // tick leaves this function any more.
    const liveOthers = lists.others.filter(isCurrentlyVisible);

    // Fog-memory ghosts are merged in only when there are any; with none
    // (the common case, and always when fogMemorySize is 0) the live set is
    // returned as-is. The merged sort is over everything but the terrain: it
    // orders by layer first and is stable, so the terrain block stays where
    // it is and the rest keep the order a sort of the whole list gave them.
    let others = liveOthers;
    if (currentFogMemorySize > 0) {
      // Which ids are live: the rest's, gathered now, and the terrain's, gathered once for as long as the
      // store hands back the same terrain.
      const terrainIds = idsOf(terrain);
      const otherIds = new Set<number>();
      for (const entity of liveOthers) {
        otherIds.add(entity.id);
      }
      const memoryEntities = getFogMemoryEntities({
        has: (id) => otherIds.has(id) || terrainIds.has(id),
      });
      if (memoryEntities.length > 0) {
        const merged = liveOthers.slice();
        for (const entity of memoryEntities) {
          merged.push(entity);
        }
        merged.sort(compareProjectedRenderEntities);
        others = merged;
      }
    }
    const entities = lists.terrainIsTilesOnly ? joinProjectedEntityLists(terrain, others) : terrain.concat(others);

    const value: RenderStateValue = {
      tick: currentTick,
      entities,
      frame: renderStore.getFrame(),
    };
    cache = {
      tick: currentTick,
      renderStoreVersion: currentVersion,
      fogMemorySize: currentFogMemorySize,
      value,
    };
    return value;
  }

  return { getRenderState };
}
