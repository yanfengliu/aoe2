import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

describe('fog memory', () => {
  it('keeps an enemy house visible as a memory entity after the scout walks out of range', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');

    // Give the tick machinery a few steps so visibility runs and the house starts out
    // properly visible to the scout at (10, 10) (distance 4 from house at (14, 10)).
    for (let i = 0; i < 2; i += 1) {
      bridge.step(100);
    }

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
});
