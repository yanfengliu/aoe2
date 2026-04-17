import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findSheep(
  bridge: Bridge,
  predicate: (sheep: { owner: number | null; baseOwner: number | null; x: number; y: number }) => boolean,
): { owner: number | null; baseOwner: number | null; x: number; y: number } | undefined {
  return bridge
    .getEconomyState()
    .resources.find((resource) => resource.resourceType === 'sheep' && predicate(resource));
}

function findUnclaimedNeutralSheep(bridge: Bridge): { x: number; y: number } | undefined {
  return findSheep(bridge, (sheep) => sheep.owner === null && sheep.baseOwner === null);
}

function findHumanClaimedSheep(bridge: Bridge): { x: number; y: number } | undefined {
  return findSheep(bridge, (sheep) => sheep.owner === 1);
}

function findEnemyClaimedSheep(bridge: Bridge): { x: number; y: number } | undefined {
  return findSheep(bridge, (sheep) => sheep.owner === 2);
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
});
