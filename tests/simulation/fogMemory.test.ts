import { describe, expect, it } from 'vitest';

import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// Read player 1's fog-memory (lastSeenStatic) directly off world.state — the
// RenderStore isn't updated by raw runMaintenance mutations, so we assert on the
// authoritative serialized slot the fog-memory system writes.
function humanFogMemoryIds(bridge: ReturnType<typeof createSimulationBridge>): number[] {
  const serialized = bridge.world.getState(lastSeenStaticCodec.slot) as
    | Array<[number, Array<[number, unknown]>]>
    | undefined;
  const inner = serialized?.find(([playerId]) => playerId === 1)?.[1] ?? [];
  return inner.map(([entityId]) => entityId);
}

describe('fog memory', () => {
  it('keeps an enemy house visible as a memory entity after the scout walks out of range', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    // Wait for the fog-memory writer to record the currently visible house.
    // Do not couple this prerequisite to a fixed number of auto-aggression
    // movement ticks: sub-cell slot convergence may legitimately change when
    // the scout crosses the next coarse visibility cell.
    const visibleHouseId = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 2 && building.buildingType === 'house')?.id;
    expect(visibleHouseId).toBeDefined();
    expect(stepBridgeUntil(
      bridge,
      () => {
        const candidate = bridge.getRenderState().entities.find((entity) => entity.id === visibleHouseId);
        return candidate?.isMemory === false && humanFogMemoryIds(bridge).includes(visibleHouseId!);
      },
      { maxSteps: 20 },
    )).toBe(true);

    // The enemy house should be in the live render frame as a normal (non-memory) entity.
    const initialEntities = bridge.getRenderState().entities;
    const initialHouse = initialEntities.find(
      (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
    );
    expect(initialHouse).toBeDefined();
    expect(initialHouse!.isMemory).toBe(false);

    // Walk the scout back to (4, 4) so the house at (14, 10) leaves its vision.
    // The TC at (4, 4) has vision radius 7, which reaches to (11, 11); the house at
    // (14, 10) is outside that, and once the scout is at (4, 4) the scout's radius-4
    // vision does not reach (14, 10) either.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(4, 5)).toBe(true);

    // Step until the scout is close to (4, 5) (distance-from-goal metric).
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 4) + Math.abs(scout.y - 5) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Extra ticks so visibility definitively drops off the house cell.
    for (let i = 0; i < 5; i += 1) {
      bridge.step(100);
    }

    // Now the house cell is explored but not visible. The render frame must still
    // include the house, this time with `isMemory: true`.
    const afterEntities = bridge.getRenderState().entities;
    const memoryHouse = afterEntities.find(
      (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
    );
    expect(memoryHouse).toBeDefined();
    expect(memoryHouse!.isMemory).toBe(true);
    expect(memoryHouse!.generation).toBe(initialHouse!.generation);
    expect(memoryHouse!.elevation).toBe(0);
    expect(memoryHouse!.x).toBe(14);
    expect(memoryHouse!.y).toBe(10);

    // Walking the scout back toward the house brings it into vision again; the memory
    // flag must flip back to false.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(10, 10)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 10) + Math.abs(scout.y - 10) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }

    const revisitEntities = bridge.getRenderState().entities;
    const revisitHouse = revisitEntities.find(
      (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
    );
    expect(revisitHouse).toBeDefined();
    expect(revisitHouse!.isMemory).toBe(false);
  });

  it('also memorizes static resource patches that exit vision', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    // Warm up: the scout spawns at (10, 10) with vision radius 4; the mine at
    // (14, 12) is distance 6 away — NOT in scout vision from spawn. Send the scout
    // toward the mine so it enters vision.
    for (let i = 0; i < 2; i += 1) {
      bridge.step(100);
    }
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    // (12, 11) is distance sqrt(2^2 + 1^2) ≈ 2.2 from the mine at (14, 12), well
    // within the scout's radius-4 vision, and the cell itself is free so the scout
    // won't block on the mine's footprint.
    expect(bridge.issueMoveCommand(12, 11)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 12) + Math.abs(scout.y - 11) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);

    // Confirm the gold mine is currently a live (non-memory) entity.
    const liveEntities = bridge.getRenderState().entities;
    const liveMine = liveEntities.find(
      (entity) => entity.kind === 'resource' && entity.entityType === 'gold-mine',
    );
    expect(liveMine).toBeDefined();
    expect(liveMine!.isMemory).toBe(false);

    // Walk the scout back to (4, 5). The mine at (14, 12) ends outside both the
    // scout's and the TC's vision radii.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(4, 5)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 4) + Math.abs(scout.y - 5) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      bridge.step(100);
    }

    const memoryMine = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'resource' && entity.entityType === 'gold-mine',
      );
    expect(memoryMine).toBeDefined();
    expect(memoryMine!.isMemory).toBe(true);
  });

  it('does not memorize a boar after it exits the scout\'s vision', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    for (let i = 0; i < 2; i += 1) {
      bridge.step(100);
    }

    // The boar at (13, 11) starts within scout vision; capture its id from the live
    // render frame.
    const initialBoar = bridge
      .getRenderState()
      .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'boar');
    expect(initialBoar).toBeDefined();
    const boarId = initialBoar!.id;
    expect(initialBoar!.isMemory).toBe(false);

    // Walk the scout back to (4, 5) so the boar's cell exits vision.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(4, 5)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 4) + Math.abs(scout.y - 5) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      bridge.step(100);
    }

    // The boar must not appear as either a live or a memory entity in the render
    // frame: live because the scout no longer sees it, and memory because boars
    // are wildlife and excluded from fog memory.
    const afterEntities = bridge.getRenderState().entities;
    const stillRenderedBoar = afterEntities.find((entity) => entity.id === boarId);
    expect(stillRenderedBoar).toBeUndefined();
  });

  it('forgets a destroyed-under-fog building whose id is recycled (full-review M5)', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    // Wait for the house to be both live-visible and recorded. A fixed tick
    // count is brittle because the scout may begin an auto-attack route along
    // a different fine-slot phase while preserving the same visibility rules.
    const visibleHouseId = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 2 && building.buildingType === 'house')?.id;
    expect(visibleHouseId).toBeDefined();
    expect(stepBridgeUntil(
      bridge,
      () => {
        const candidate = bridge.getRenderState().entities.find((entity) => entity.id === visibleHouseId);
        return candidate?.isMemory === false && humanFogMemoryIds(bridge).includes(visibleHouseId!);
      },
      { maxSteps: 20 },
    )).toBe(true);
    const house = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
      );
    expect(house).toBeDefined();
    expect(house!.isMemory).toBe(false);
    const houseId = house!.id;
    const staleRef = bridge.world.getEntityRef(houseId);
    expect(staleRef).not.toBeNull();
    // Sanity: the house is recorded in fog memory before we destroy it.
    expect(humanFogMemoryIds(bridge)).toContain(houseId);

    // Destroy the house directly on the world (as if it died under fog), then
    // recycle its id onto a bare positioned entity. civ-engine reuses the freed
    // id at a BUMPED generation, so `isCurrent(staleRef)` is now false — but the
    // old cleanup's `getComponent(id, 'position')` probe is fooled into "still
    // exists" by the recycled entity's position.
    const recycled = bridge.world.runMaintenance(() => {
      bridge.world.destroyEntity(houseId);
      const id = bridge.world.createEntity();
      bridge.world.addComponent(id, 'position', { x: 1, y: 1 });
      return id;
    });
    expect(recycled).toBe(houseId);
    expect(bridge.world.isCurrent(staleRef!)).toBe(false);

    // The scout still sees the house's old footprint (14, 10) → the player has
    // watched the ground go empty. A generation-aware cleanup deletes the fog
    // entry; the raw-id cleanup is fooled by the recycled entity and keeps the
    // ghost forever (the M5 bug).
    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }
    expect(humanFogMemoryIds(bridge)).not.toContain(houseId);
  });

  it('treats a multi-tile building as live when any cell of its footprint is visible', () => {
    const bridge = createSimulationBridge('building-footprint-vision-fixture');

    // Step a few ticks so visibility propagates and the projector emits initial views.
    for (let i = 0; i < 3; i += 1) {
      bridge.step(100);
    }

    const enemyTc = bridge
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.kind === 'building' && entity.entityType === 'town-center' && entity.owner === 2,
      );
    expect(enemyTc).toBeDefined();

    // The TC anchor (13, 10) sits well outside the scout's radius-1 vision around
    // (16, 13); only the bottom-right corner is visible. With the footprint-aware
    // visibility check, the TC must render as a live entity (isMemory: false), not
    // as a memory entity, because at least one of its cells is in vision.
    expect(enemyTc!.isMemory).toBe(false);
    expect(enemyTc!.x).toBe(13);
    expect(enemyTc!.y).toBe(10);
  });

  it('rejects entity commands targeting a fog-of-war-hidden enemy entity', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    for (let i = 0; i < 2; i += 1) {
      bridge.step(100);
    }

    // The enemy house starts visible to the scout; capture its id while it's still
    // in the live render frame.
    const initialHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
      );
    expect(initialHouse).toBeDefined();
    const houseId = initialHouse!.id;

    // Walk the scout back so the house cell exits vision and becomes a memory entity.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(4, 5)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          if (!scout) {
            return false;
          }
          return Math.abs(scout.x - 4) + Math.abs(scout.y - 5) <= 1;
        },
        { maxSteps: 400 },
      ),
    ).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      bridge.step(100);
    }

    // Sanity: the house is now a memory entity.
    const memoryHouse = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === houseId);
    expect(memoryHouse).toBeDefined();
    expect(memoryHouse!.isMemory).toBe(true);

    // With the scout still selected, an explicit context command against the house id
    // must be rejected (the player can't see it). The scout's task must stay 'idle'.
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    const scoutBefore = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(scoutBefore).toBeDefined();
    const taskBefore = scoutBefore!.task;

    expect(bridge.issueContextCommandAtEntity(houseId)).toBe(false);

    const scoutAfter = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(scoutAfter).toBeDefined();
    expect(scoutAfter!.task).toBe(taskBefore);
  });
});
