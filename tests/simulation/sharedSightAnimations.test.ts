import type { RenderServerMessage } from 'civ-engine';
import { VisibilityMap } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createRenderStateOps } from '../../src/game/simulation/bridge/renderStateOps';
import { createProjector } from '../../src/game/simulation/bridge/visibility';
import { RenderStore } from '../../src/game/simulation/renderStore';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
  ProjectedUnitAttackView,
  ProjectedUnitDeathView,
} from '../../src/game/simulation/types';

// GATE (register 2026-09-24, "an ally's base is lit but empty"): a swing or a
// death an ALLY witnessed animates for the human, because the human sees
// through its allies' eyes. The witness lists are recorded per owner; the
// three filters that turn them into what the human is shown — the render
// state's attack-animation index, the projector's attack-animation index and
// the projector's death feed — must ask the human's whole sight.
//
// Owner 1 is the human, owner 3 the ally whose eyes it shares, owner 2 an
// enemy. Each case has an in-test control: the same inputs with sight [1]
// must NOT animate, so the case cannot pass on a filter that ignores sight.
//
// Bound: synthetic inputs at the factories (`createRenderStateOps`,
// `createProjector`). The wiring that hands them the real sight is held
// elsewhere: the live render state's by `tests/simulation/sharedVisionEntities.test.ts`,
// the live projector's only by the lit-cell count in
// `tests/simulation/alliances.test.ts` (the same getter feeds the lit cells,
// the swings and the deaths), and the replay bridge's by
// `tests/replay/makeReplayBridge.sharedSight.test.ts`.

type Message = RenderServerMessage<ProjectedEntityView, ProjectedFrameView, null>;

const ENEMY: ProjectedEntityView = {
  id: 7,
  generation: 3,
  kind: 'unit',
  layer: 'unit',
  entityType: 'militia',
  owner: 2,
  x: 5,
  y: 5,
  elevation: 0,
  tint: 0,
  size: 1,
  footprintWidth: 1,
  footprintHeight: 1,
  visualVariant: 'default',
  selected: false,
  currentHp: 40,
  maxHp: 40,
  isMemory: false,
};

// The enemy swings at tick 5 and only the ALLY saw both ends of it.
const SWING: ProjectedUnitAttackView = {
  attackerId: 7,
  attackerGeneration: 3,
  tick: 5,
  sourceX: 5,
  sourceY: 5,
  targetX: 6,
  targetY: 5,
  witnessedBy: [3],
};

function snapshot(tick: number): Message {
  return {
    type: 'renderSnapshot',
    data: { render: { tick, entities: [{ ref: { id: 7, generation: 3 }, view: ENEMY }], frame: null }, debug: null },
  };
}

// The human and the ally both see the enemy's cell, so the entity is drawn
// either way and only the swing's witness list decides the animation.
function visibilityWithBothSeeing(): VisibilityMap {
  const visibility = new VisibilityMap(20, 20);
  visibility.setSource(1, 90, { x: 5, y: 5, radius: 1 });
  visibility.setSource(3, 91, { x: 5, y: 5, radius: 3 });
  visibility.update();
  return visibility;
}

function unitWorld(tick: number) {
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
    ['unit', { owner: 2, unitType: 'militia' }],
  ]);
  return {
    tick,
    grid: { width: 20, height: 20 },
    getComponent: (_id: number, key: string) => components.get(key),
  } as never;
}

function projectorFor(
  shared: readonly number[],
  attacks: readonly ProjectedUnitAttackView[],
  deaths: readonly ProjectedUnitDeathView[],
) {
  return createProjector(
    visibilityWithBothSeeing(),
    1,
    'shared-sight-animations',
    () => false,
    () => null,
    () => deaths,
    () => attacks,
    () => undefined,
    () => undefined,
    () => [],
    () => shared,
  );
}

describe('a swing or a death an ally witnessed animates for the human', () => {
  it('render state: the attack animation shows through the ally’s eyes', () => {
    const animationWith = (sight: readonly number[]) => {
      const store = new RenderStore();
      store.apply(snapshot(5));
      const renderState = createRenderStateOps({
        visibility: visibilityWithBothSeeing(),
        humanPlayerId: 1,
        getSightOwners: () => sight,
        renderStore: store,
        getHumanFogMemorySize: () => 0,
        getFogMemoryEntities: () => [],
        getRecentUnitAttacks: () => [SWING],
        getRenderStoreVersion: () => 0,
      });
      const entities = renderState.getRenderState().entities;
      expect(entities.map((entity) => entity.id)).toEqual([7]);
      return entities[0]!.attackAnimation;
    };
    expect(animationWith([1, 3])?.tick).toBe(5);
    expect(animationWith([1])).toBeUndefined();
  });

  it('projector: the projected unit carries the swing the ally witnessed', () => {
    const projected = (shared: readonly number[]) =>
      projectorFor(shared, [SWING], []).projectEntity({ id: 7, generation: 3 }, unitWorld(5), null);
    expect(projected([3])?.attackAnimation?.tick).toBe(5);
    expect(projected([])?.attackAnimation).toBeUndefined();
  });

  it('projector: the death feed carries a death the ally witnessed', () => {
    const death: ProjectedUnitDeathView = {
      id: 9,
      tick: 10,
      x: 5,
      y: 5,
      owner: 2,
      unitType: 'militia',
      tint: 0,
      size: 1,
      witnessedBy: [3],
    };
    const deathsShown = (shared: readonly number[]) =>
      projectorFor(shared, [], [death]).projectFrame!(unitWorld(12), null)!.recentUnitDeaths.map((d) => d.id);
    expect(deathsShown([3])).toEqual([9]);
    expect(deathsShown([])).toEqual([]);
  });
});
