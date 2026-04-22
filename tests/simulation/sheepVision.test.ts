import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface SheepInfo {
  owner: number | null;
  x: number;
  y: number;
}

function findHumanClaimedSheep(bridge: Bridge): SheepInfo | undefined {
  return bridge
    .getEconomyState()
    .resources.find((resource) => resource.resourceType === 'sheep' && resource.owner === 1);
}

function findSheepAtCell(bridge: Bridge, x: number, y: number): SheepInfo | undefined {
  return bridge
    .getEconomyState()
    .resources.find(
      (resource) => resource.resourceType === 'sheep' && resource.x === x && resource.y === y,
    );
}

function findEnemyHouseInRender(bridge: Bridge) {
  return bridge.getRenderState().entities.find(
    (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
  );
}

describe('sheep vision', () => {
  it('reveals hidden enemy buildings as an owned sheep explores', () => {
    const bridge = createSimulationBridge('sheep-vision-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => findHumanClaimedSheep(bridge) !== undefined,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    // The fixture includes nearby neutral and enemy-owned sheep around the
    // hidden house. Those must not leak vision to the human player.
    expect(findSheepAtCell(bridge, 22, 10)?.owner).toBeNull();
    expect(findSheepAtCell(bridge, 20, 13)?.owner).toBe(2);
    expect(findEnemyHouseInRender(bridge)).toBeUndefined();

    const sheep = findHumanClaimedSheep(bridge);
    expect(sheep).toBeDefined();
    expect(bridge.selectEntityAtCell(sheep!.x, sheep!.y)).toBe(true);
    expect(bridge.issueMoveCommand(15, 10)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => findEnemyHouseInRender(bridge)?.isMemory === false,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    const liveHouse = findEnemyHouseInRender(bridge);
    expect(liveHouse).toBeDefined();
    expect(liveHouse!.isMemory).toBe(false);

    const sheepNearHouse = findHumanClaimedSheep(bridge);
    expect(sheepNearHouse).toBeDefined();
    expect(bridge.selectEntityAtCell(sheepNearHouse!.x, sheepNearHouse!.y)).toBe(true);
    expect(bridge.issueMoveCommand(11, 10)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => findEnemyHouseInRender(bridge)?.isMemory === true,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    expect(findSheepAtCell(bridge, 22, 10)?.owner).toBeNull();
    expect(findSheepAtCell(bridge, 20, 13)?.owner).toBe(2);
  });

  it('preserves owned-sheep vision across save and load', () => {
    const bridge = createSimulationBridge('sheep-vision-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => findHumanClaimedSheep(bridge) !== undefined,
        { maxSteps: 30 },
      ),
    ).toBe(true);

    const sheep = findHumanClaimedSheep(bridge);
    expect(sheep).toBeDefined();
    expect(bridge.selectEntityAtCell(sheep!.x, sheep!.y)).toBe(true);
    expect(bridge.issueMoveCommand(15, 10)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => findEnemyHouseInRender(bridge)?.isMemory === false,
        { maxSteps: 200 },
      ),
    ).toBe(true);

    const savedGame = bridge.saveGame();
    const loadedBridge = createSimulationBridge('aoe2-prototype', { savedGame });

    const visibleHouseAfterLoad = findEnemyHouseInRender(loadedBridge);
    expect(visibleHouseAfterLoad).toBeDefined();
    expect(visibleHouseAfterLoad!.isMemory).toBe(false);
  });
});
