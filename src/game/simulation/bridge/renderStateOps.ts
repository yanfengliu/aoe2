// Render-state assembly + per-tick memo. Caller drives `getRenderState()`
// from multiple sites (HUD RAF, GameScene.syncFromBridge, browserTestApi
// getSnapshot); the work below — filter every entity by isFootprintVisible,
// build a dedupe Set, possibly merge memory entries, possibly re-sort —
// is not free. The cache invalidates on (tick, renderStoreVersion,
// fogMemorySize) so any meaningful state change re-runs the projection.

import { VisibilityMap } from 'civ-engine';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from '../types';
import { compareProjectedRenderEntities, isFootprintVisible } from './pureHelpers';
import type { RenderStore } from '../renderStore';

export interface RenderStateOpsDeps {
  visibility: VisibilityMap;
  humanPlayerId: number;
  renderStore: RenderStore;
  getHumanFogMemorySize: () => number;
  getFogMemoryEntities: (liveIds: Set<number>) => ProjectedEntityView[];
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
    getRenderStoreVersion,
  } = deps;

  let cache: {
    tick: number;
    renderStoreVersion: number;
    fogMemorySize: number;
    value: RenderStateValue;
  } | null = null;

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

    const liveEntitiesRaw = renderStore.getEntities();
    const liveEntities = liveEntitiesRaw.filter((entity) => {
      if (entity.kind !== 'building' && entity.kind !== 'resource') return true;
      if (entity.owner === humanPlayerId) return true;
      return isFootprintVisible(
        visibility,
        humanPlayerId,
        entity.x,
        entity.y,
        entity.footprintWidth,
        entity.footprintHeight,
      );
    });

    if (currentFogMemorySize === 0) {
      const value: RenderStateValue = {
        tick: currentTick,
        entities: liveEntities,
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

    const liveIds = new Set<number>();
    for (const entity of liveEntities) {
      liveIds.add(entity.id);
    }
    const memoryEntities = getFogMemoryEntities(liveIds);
    if (memoryEntities.length === 0) {
      const value: RenderStateValue = {
        tick: currentTick,
        entities: liveEntities,
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

    const merged = liveEntities.slice();
    for (const entity of memoryEntities) {
      merged.push(entity);
    }
    merged.sort(compareProjectedRenderEntities);
    const value: RenderStateValue = {
      tick: currentTick,
      entities: merged,
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
