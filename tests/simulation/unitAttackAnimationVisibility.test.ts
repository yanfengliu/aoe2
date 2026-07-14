import type { RenderEntity, RenderServerMessage } from 'civ-engine';
import { VisibilityMap } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createRenderStateOps } from '../../src/game/simulation/bridge/renderStateOps';
import { createProjector } from '../../src/game/simulation/bridge/visibility';
import { RenderStore } from '../../src/game/simulation/renderStore';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  ProjectedUnitAttackView,
} from '../../src/game/simulation/types';

type Message = RenderServerMessage<ProjectedEntityView, ProjectedFrameView, null>;

function enemy(x = 5): RenderEntity<ProjectedEntityView> {
  const view: ProjectedEntityView = {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 2,
    x,
    y: 5,
    elevation: 0,
    tint: 0,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
  };
  return { ref: { id: 7, generation: 3 }, view };
}

function frame(tick: number, visibleCells: number[]): ProjectedFrameView {
  return {
    tick,
    playerId: 1,
    seed: 'visibility-lifetime',
    mapWidth: 20,
    mapHeight: 20,
    visibleCells,
    exploredCells: visibleCells,
    recentUnitDeaths: [],
  };
}

function renderMessage(tick: number, initial: boolean): Message {
  return initial ? {
    type: 'renderSnapshot',
    data: { render: { tick, entities: [enemy()], frame: null }, debug: null },
  } : {
    type: 'renderTick',
    data: {
      render: { tick, created: [], updated: [], destroyed: [], frame: null },
      debug: null,
    },
  };
}

describe('unit attack animation visibility lifetime', () => {
  it('keeps initially fogged entities in the raw store for later LOS reveals', () => {
    const visibility = new VisibilityMap(20, 20);
    visibility.setSource(1, 99, { x: 5, y: 5, radius: 1 });
    visibility.update();
    visibility.removeSource(1, 99);
    visibility.update();
    expect(visibility.isVisible(1, 5, 5)).toBe(false);
    const components = new Map<string, unknown>([
      ['position', { x: 5, y: 5 }],
      ['renderable', {
        kind: 'unit',
        layer: 'unit',
        footprintWidth: 1,
        footprintHeight: 1,
        tint: 0,
        size: 1,
        visualVariant: 'default',
      }],
      ['unit', { owner: 2, unitType: 'villager' }],
    ]);
    const projector = createProjector(
      visibility,
      1,
      'raw-fog-store',
      () => false,
      () => null,
      () => [],
      () => [],
    );

    expect(projector.projectEntity(
      { id: 7, generation: 3 },
      {
        tick: 0,
        getComponent: (_id: number, key: string) => components.get(key),
      } as never,
      null,
    )).not.toBeNull();
  });

  it('hides stationary enemies and never resurrects their old witnessed cue', () => {
    const visibility = new VisibilityMap(20, 20);
    const store = new RenderStore();
    let version = 0;
    let attacks: ProjectedUnitAttackView[] = [{
      attackerId: 7,
      attackerGeneration: 3,
      tick: 5,
      sourceX: 5,
      sourceY: 5,
      targetX: 6,
      targetY: 5,
      witnessedBy: [1],
    }];
    const renderState = createRenderStateOps({
      visibility,
      humanPlayerId: 1,
      renderStore: store,
      getHumanFogMemorySize: () => 0,
      getFogMemoryEntities: () => [],
      getRecentUnitAttacks: () => attacks,
      getRenderStoreVersion: () => version,
    });

    visibility.setSource(1, 99, { x: 5, y: 5, radius: 2 });
    visibility.update();
    store.apply(renderMessage(5, true));
    expect(renderState.getRenderState().entities[0]?.attackAnimation?.tick).toBe(5);

    visibility.removeSource(1, 99);
    visibility.update();
    version += 1;
    store.apply(renderMessage(6, false));
    const hidden = renderState.getRenderState();
    expect(hidden.entities).toEqual([]);
    expect(hidden.previousPositionFrame?.positions).toEqual([]);

    visibility.setSource(1, 99, { x: 5, y: 5, radius: 2 });
    visibility.update();
    version += 1;
    store.apply(renderMessage(7, false));
    expect(renderState.getRenderState().entities[0]?.attackAnimation).toBeUndefined();

    attacks = [{ ...attacks[0]!, tick: 8 }];
    version += 1;
    store.apply(renderMessage(8, false));
    expect(renderState.getRenderState().entities[0]?.attackAnimation?.tick).toBe(8);
  });

  it('does not interpolate a newly revealed enemy from its prior fogged position', () => {
    const visibility = new VisibilityMap(20, 20);
    const store = new RenderStore();
    const renderState = createRenderStateOps({
      visibility,
      humanPlayerId: 1,
      renderStore: store,
      getHumanFogMemorySize: () => 0,
      getFogMemoryEntities: () => [],
      getRecentUnitAttacks: () => [],
      getRenderStoreVersion: () => 0,
    });

    store.apply({
      type: 'renderSnapshot',
      data: { render: { tick: 5, entities: [enemy(5)], frame: frame(5, []) }, debug: null },
    });
    visibility.setSource(1, 99, { x: 6, y: 5, radius: 0 });
    visibility.update();
    store.apply({
      type: 'renderTick',
      data: {
        render: {
          tick: 6,
          created: [],
          updated: [enemy(6)],
          destroyed: [],
          frame: frame(6, [6 + 5 * 20]),
        },
        debug: null,
      },
    });

    const revealed = renderState.getRenderState();
    expect(revealed.entities[0]).toMatchObject({ id: 7, x: 6, y: 5 });
    expect(revealed.previousPositionFrame?.positions).toEqual([]);
  });
});
