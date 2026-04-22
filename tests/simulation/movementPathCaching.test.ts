import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('civ-engine', async () => {
  const actual = await vi.importActual<typeof import('civ-engine')>('civ-engine');
  return {
    ...actual,
    findGridPath: vi.fn(actual.findGridPath),
  };
});

import { findGridPath } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

const findGridPathMock = vi.mocked(findGridPath);

describe('move path caching', () => {
  beforeEach(() => {
    findGridPathMock.mockClear();
  });

  it('does not resolve a fresh grid path on every tick of the same move order', () => {
    const bridge = createSimulationBridge('villager-selection-fixture');
    const target = { x: 20, y: 20 };
    const startingVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');

    expect(startingVillager).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);

    findGridPathMock.mockClear();

    for (let tick = 0; tick < 16; tick += 1) {
      bridge.step(100);
    }

    const movedVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.id === startingVillager?.id);
    const startingDistance =
      Math.abs((startingVillager?.x ?? 0) - target.x)
      + Math.abs((startingVillager?.y ?? 0) - target.y);
    const movedDistance =
      Math.abs((movedVillager?.x ?? 0) - target.x)
      + Math.abs((movedVillager?.y ?? 0) - target.y);

    expect(movedVillager).toBeDefined();
    expect(movedDistance).toBeLessThan(startingDistance);
    expect(findGridPathMock).toHaveBeenCalledTimes(1);
  });

  it('drops the cached route when the player issues a new move order', () => {
    const bridge = createSimulationBridge('villager-selection-fixture');
    const initialTarget = { x: 20, y: 20 };
    const retarget = { x: 4, y: 20 };

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(initialTarget.x, initialTarget.y)).toBe(true);

    for (let tick = 0; tick < 4; tick += 1) {
      bridge.step(100);
    }

    const villagerBeforeRetarget = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');

    expect(villagerBeforeRetarget).toBeDefined();
    expect(bridge.issueMoveCommand(retarget.x, retarget.y)).toBe(true);

    findGridPathMock.mockClear();
    bridge.step(100);

    expect(findGridPathMock).toHaveBeenCalledTimes(1);
    for (let tick = 0; tick < 8; tick += 1) {
      bridge.step(100);
    }

    const villagerAfterRetarget = bridge
      .getEconomyState()
      .units.find((unit) => unit.id === villagerBeforeRetarget?.id);
    const distanceBeforeRetarget =
      Math.abs((villagerBeforeRetarget?.x ?? 0) - retarget.x)
      + Math.abs((villagerBeforeRetarget?.y ?? 0) - retarget.y);
    const distanceAfterRetarget =
      Math.abs((villagerAfterRetarget?.x ?? 0) - retarget.x)
      + Math.abs((villagerAfterRetarget?.y ?? 0) - retarget.y);

    expect(villagerAfterRetarget).toBeDefined();
    expect(distanceAfterRetarget).toBeLessThan(distanceBeforeRetarget);
  });

  it('replans after save/load instead of carrying a transient cached route across the snapshot', () => {
    const bridge = createSimulationBridge('villager-selection-fixture');
    const target = { x: 20, y: 20 };

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);

    for (let tick = 0; tick < 4; tick += 1) {
      bridge.step(100);
    }

    const savedGame = bridge.saveGame();
    const restoredBridge = createSimulationBridge('villager-selection-fixture', { savedGame });
    const villagerBeforeResume = restoredBridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');

    expect(villagerBeforeResume).toBeDefined();

    findGridPathMock.mockClear();
    restoredBridge.step(100);

    for (let tick = 0; tick < 8; tick += 1) {
      restoredBridge.step(100);
    }

    const villagerAfterResume = restoredBridge
      .getEconomyState()
      .units.find((unit) => unit.id === villagerBeforeResume?.id);
    const distanceBeforeResume =
      Math.abs((villagerBeforeResume?.x ?? 0) - target.x)
      + Math.abs((villagerBeforeResume?.y ?? 0) - target.y);
    const distanceAfterResume =
      Math.abs((villagerAfterResume?.x ?? 0) - target.x)
      + Math.abs((villagerAfterResume?.y ?? 0) - target.y);

    expect(findGridPathMock).toHaveBeenCalledTimes(1);
    expect(villagerAfterResume).toBeDefined();
    expect(distanceAfterResume).toBeLessThan(distanceBeforeResume);
  });

  it('keeps the move order anchored to the clicked cell when that blocker disappears mid-walk', () => {
    const bridge = createSimulationBridge('move-target-unblocks-fixture');

    expect(bridge.selectEntityAtCell(17, 8)).toBe(true);
    expect(bridge.issueContextCommand(18, 8)).toBe(true);

    const movingVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x === 10 && unit.y === 8);
    expect(movingVillager).toBeDefined();

    expect(bridge.selectEntityAtCell(10, 8)).toBe(true);
    expect(bridge.issueMoveCommand(18, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .resources.some((resource) => resource.resourceType === 'tree' && resource.x === 18 && resource.y === 8),
        { maxSteps: 160 },
      ),
    ).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const updatedVillager = bridge
            .getEconomyState()
            .units.find((unit) => unit.id === movingVillager?.id);
          return updatedVillager?.x === 18 && updatedVillager.y === 8;
        },
        { maxSteps: 160 },
      ),
    ).toBe(true);
  });

  it('redirects to the clicked cell before touching the stale fallback once the blocker clears', () => {
    const bridge = createSimulationBridge('move-target-unblocks-fixture');

    expect(bridge.selectEntityAtCell(17, 8)).toBe(true);
    expect(bridge.issueContextCommand(18, 8)).toBe(true);

    const movingVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x === 10 && unit.y === 8);
    expect(movingVillager).toBeDefined();

    expect(bridge.selectEntityAtCell(10, 8)).toBe(true);
    expect(bridge.issueMoveCommand(18, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .resources.some((resource) => resource.resourceType === 'tree' && resource.x === 18 && resource.y === 8),
        { maxSteps: 160 },
      ),
    ).toBe(true);

    let reachedClickedCellBeforeFallback = false;
    for (let tick = 0; tick < 120; tick += 1) {
      bridge.step(100);
      const updatedVillager = bridge
        .getEconomyState()
        .units.find((unit) => unit.id === movingVillager?.id);

      if (updatedVillager?.x === 18 && updatedVillager.y === 8) {
        reachedClickedCellBeforeFallback = true;
        break;
      }

      if (updatedVillager?.x === 18 && updatedVillager.y === 7) {
        break;
      }
    }

    expect(reachedClickedCellBeforeFallback).toBe(true);
  });
});
