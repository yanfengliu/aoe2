import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface SheepInfo {
  owner: number | null;
  baseOwner: number | null;
  x: number;
  y: number;
}

function findSheep(bridge: Bridge, predicate: (sheep: SheepInfo) => boolean): SheepInfo | undefined {
  return bridge
    .getEconomyState()
    .resources.find((resource) => resource.resourceType === 'sheep' && predicate(resource));
}

function findHumanClaimedSheep(bridge: Bridge): SheepInfo | undefined {
  return findSheep(bridge, (sheep) => sheep.owner === 1);
}

function selectSheepAt(bridge: Bridge, x: number, y: number): boolean {
  return bridge.selectEntityAtCell(x, y);
}

function stepBridgeNTicks(bridge: Bridge, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    bridge.step(100);
  }
}

describe('sheep movement', () => {
  it('keeps sheep ownership sticky after the claiming unit walks far away', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // First: the human villager spawned adjacent to the neutral sheep claims it within a few ticks.
    // The enemy scout at (21, 19) is also in range but loses the distance tie-break (lower owner wins).
    expect(
      stepBridgeUntil(
        bridge,
        () => findHumanClaimedSheep(bridge) !== undefined,
        { maxSteps: 20 },
      ),
    ).toBe(true);

    const claimedSheep = findHumanClaimedSheep(bridge);
    expect(claimedSheep).toBeDefined();

    // Move the human villager far from the sheep so its vision no longer covers the sheep.
    // The enemy scout at (21, 19) stays put — the AI does not command non-militia units —
    // so without sticky ownership it would re-claim the sheep on the next tick.
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
          if (!villager || !claimedSheep) {
            return false;
          }
          const dx = Math.abs(villager.x - claimedSheep.x);
          const dy = Math.abs(villager.y - claimedSheep.y);
          // Human villager vision radius is 4, so once distance > 4 it stops covering the sheep.
          return dx + dy > 5;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Give the enemy scout several ticks to attempt re-claiming the sheep.
    for (let i = 0; i < 10; i += 1) {
      bridge.step(100);
    }

    // Sheep ownership must still be the human player — the sticky guard prevents the enemy steal.
    const sheepAfterWalkAway = findSheep(
      bridge,
      (sheep) => sheep.x === claimedSheep?.x && sheep.y === claimedSheep?.y,
    );
    expect(sheepAfterWalkAway).toBeDefined();
    expect(sheepAfterWalkAway?.owner).toBe(1);
  });

  it('moves an owned sheep toward the right-clicked destination', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');

    // Wait for the human villager to claim the sheep at (20, 19).
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheepBefore = findHumanClaimedSheep(bridge);
    expect(sheepBefore).toBeDefined();
    const startX = sheepBefore!.x;
    const startY = sheepBefore!.y;

    // Select the sheep at its cell and command a move toward the human Town Center direction.
    expect(selectSheepAt(bridge, startX, startY)).toBe(true);
    const targetX = 4;
    const targetY = 4;
    expect(bridge.issueMoveCommand(targetX, targetY)).toBe(true);

    // After enough ticks, the sheep should be measurably closer to the target.
    stepBridgeNTicks(bridge, 80);
    const sheepAfter = findHumanClaimedSheep(bridge);
    expect(sheepAfter).toBeDefined();
    const startDist = Math.abs(startX - targetX) + Math.abs(startY - targetY);
    const afterDist = Math.abs(sheepAfter!.x - targetX) + Math.abs(sheepAfter!.y - targetY);
    expect(afterDist).toBeLessThan(startDist);
  });

  it('clears the sheep move order once the destination is reached', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheep = findHumanClaimedSheep(bridge)!;
    // Pick a nearby target so arrival happens quickly.
    const targetX = sheep.x - 2;
    const targetY = sheep.y;
    expect(selectSheepAt(bridge, sheep.x, sheep.y)).toBe(true);
    expect(bridge.issueMoveCommand(targetX, targetY)).toBe(true);

    // Wait until the sheep arrives at the target cell.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const current = findHumanClaimedSheep(bridge);
          return current !== undefined && current.x === targetX && current.y === targetY;
        },
        { maxSteps: 200 },
      ),
    ).toBe(true);

    // Position must remain stable for additional ticks (order is cleared, sheep no longer moves).
    stepBridgeNTicks(bridge, 20);
    const sheepAfterDwell = findHumanClaimedSheep(bridge)!;
    expect(sheepAfterDwell.x).toBe(targetX);
    expect(sheepAfterDwell.y).toBe(targetY);
  });

  it('rejects move commands on an unclaimed sheep', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    // The sheep at (45, 25) starts unclaimed and has no nearby player units, so it stays unclaimed.
    const unclaimedX = 45;
    const unclaimedY = 25;
    const sheepBefore = findSheep(bridge, (sheep) => sheep.x === unclaimedX && sheep.y === unclaimedY);
    expect(sheepBefore?.owner).toBeNull();

    expect(selectSheepAt(bridge, unclaimedX, unclaimedY)).toBe(true);
    expect(bridge.issueMoveCommand(10, 10)).toBe(false);

    stepBridgeNTicks(bridge, 30);
    const sheepAfter = findSheep(bridge, (sheep) => sheep.x === unclaimedX && sheep.y === unclaimedY);
    expect(sheepAfter).toBeDefined();
    expect(sheepAfter?.x).toBe(unclaimedX);
    expect(sheepAfter?.y).toBe(unclaimedY);
  });

  it('rejects move commands on an enemy-owned sheep', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    // Pre-owned enemy sheep starts at (35, 25) with no human units near.
    const enemyX = 35;
    const enemyY = 25;
    const sheepBefore = findSheep(bridge, (sheep) => sheep.x === enemyX && sheep.y === enemyY);
    expect(sheepBefore?.owner).toBe(2);

    expect(selectSheepAt(bridge, enemyX, enemyY)).toBe(true);
    expect(bridge.issueMoveCommand(10, 10)).toBe(false);

    stepBridgeNTicks(bridge, 30);
    const sheepAfter = findSheep(bridge, (sheep) => sheep.x === enemyX && sheep.y === enemyY);
    expect(sheepAfter).toBeDefined();
    expect(sheepAfter?.x).toBe(enemyX);
    expect(sheepAfter?.y).toBe(enemyY);
  });

  it('moves an owned sheep at half villager speed', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    expect(
      stepBridgeUntil(bridge, () => findHumanClaimedSheep(bridge) !== undefined, { maxSteps: 20 }),
    ).toBe(true);

    const sheepStart = findHumanClaimedSheep(bridge)!;
    const villagerStart = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagerStart).toBeDefined();

    // Both move toward the human Town Center. Villager step is 0.5 cells/tick, sheep is 0.25.
    expect(selectSheepAt(bridge, sheepStart.x, sheepStart.y)).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(4, 4)).toBe(true);

    stepBridgeNTicks(bridge, 32);

    const sheepEnd = findHumanClaimedSheep(bridge)!;
    const villagerEnd = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!;

    const sheepCellsCovered = Math.abs(sheepStart.x - sheepEnd.x) + Math.abs(sheepStart.y - sheepEnd.y);
    const villagerCellsCovered =
      Math.abs(villagerStart!.x - villagerEnd.x) + Math.abs(villagerStart!.y - villagerEnd.y);

    // Villager should cover roughly twice the cells the sheep does. Coarse-cell snapping
    // introduces ±1 jitter, so accept villager >= 2*sheep - 2 and villager <= 2*sheep + 2.
    expect(sheepCellsCovered).toBeGreaterThan(0);
    expect(villagerCellsCovered).toBeGreaterThan(sheepCellsCovered);
    expect(villagerCellsCovered).toBeGreaterThanOrEqual(sheepCellsCovered * 2 - 2);
    expect(villagerCellsCovered).toBeLessThanOrEqual(sheepCellsCovered * 2 + 2);
  });
});
