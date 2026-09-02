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
import { compareProjectedRenderEntities, isFootprintVisible } from './pureHelpers';
import type { RenderStore } from '../renderStore';
import { indexVisibleUnitAttackAnimations } from './unitAttackAnimationFeed';

export interface RenderStateOpsDeps {
  visibility: VisibilityMap;
  humanPlayerId: number;
  renderStore: RenderStore;
  getHumanFogMemorySize: () => number;
  getFogMemoryEntities: (liveIds: Set<number>) => ProjectedEntityView[];
  getRecentUnitAttacks: () => readonly ProjectedUnitAttackView[];
  getRenderStoreVersion: () => number;
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
    renderStore,
    getHumanFogMemorySize,
    getFogMemoryEntities,
    getRecentUnitAttacks,
    getRenderStoreVersion,
  } = deps;

  let cache: {
    tick: number;
    renderStoreVersion: number;
    fogMemorySize: number;
    value: RenderStateValue;
  } | null = null;

  const isCurrentlyVisible = (entity: ProjectedEntityView): boolean => (
    entity.kind === 'tile'
    || entity.owner === humanPlayerId
    || isFootprintVisible(
      visibility,
      humanPlayerId,
      entity.x,
      entity.y,
      entity.footprintWidth,
      entity.footprintHeight,
    )
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

    renderStore.reconcileUnitAttackAnimations(
      indexVisibleUnitAttackAnimations(
        getRecentUnitAttacks(),
        currentTick,
        humanPlayerId,
      ),
      isCurrentlyVisible,
    );
    const liveEntitiesRaw = renderStore.getEntities();
    // Only entities visible to the human perspective NOW are handed on. The
    // prior-tick position frame that display interpolation once read was
    // filtered through the same rule here; since v0.3.187 the presentation
    // keeps its own per-unit history (displayedPositionSmoother), and an
    // entity absent from the previously presented tick starts fresh there,
    // so nothing about the prior tick leaves this function any more.
    const liveEntities = liveEntitiesRaw.filter(isCurrentlyVisible);

    // Fog-memory ghosts are merged in only when there are any; with none
    // (the common case, and always when fogMemorySize is 0) the live set is
    // returned as-is. All three former exits built an identical value + cache
    // differing only in `entities`, so that construction happens once here.
    let entities = liveEntities;
    if (currentFogMemorySize > 0) {
      const liveIds = new Set<number>();
      for (const entity of liveEntities) {
        liveIds.add(entity.id);
      }
      const memoryEntities = getFogMemoryEntities(liveIds);
      if (memoryEntities.length > 0) {
        const merged = liveEntities.slice();
        for (const entity of memoryEntities) {
          merged.push(entity);
        }
        merged.sort(compareProjectedRenderEntities);
        entities = merged;
      }
    }

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
