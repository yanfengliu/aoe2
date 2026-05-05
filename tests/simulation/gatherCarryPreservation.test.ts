import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findOwnedVillager(bridge: Bridge, owner: number) {
  return bridge.getEconomyState().villagers.find((v) => v.owner === owner);
}

function findTree(bridge: Bridge) {
  return bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
}

describe('iter-2 H2-2 — gather carry preserved when no drop-off path exists', () => {
  it('villager carrying wood does not zero its load and re-gather forever when no wood drop-off is owned', () => {
    // Player 1 has only a Mill (food drop-off) and a single tree. The
    // villager picks up wood, transitions to `to-dropoff`, and finds no
    // owned wood drop-off building. Without the fix the gather-system
    // zeroes the carry every tick — and shouldMaintainGatheringOrder
    // re-targets the same tree, so the villager farms the tree from
    // 200 → 0 for nothing. With the fix the load persists and the
    // villager idles holding the 10-wood carry; the tree stops at 190.
    const bridge = createSimulationBridge('villager-no-wood-dropoff-fixture');

    const villager = findOwnedVillager(bridge, 1);
    expect(villager).toBeDefined();
    expect(villager?.carriedAmount).toBe(0);

    const initialTree = findTree(bridge);
    expect(initialTree).toBeDefined();
    expect(initialTree?.amount).toBe(200);
    expect(
      bridge
        .getEconomyState()
        .buildings.filter(
          (b) =>
            b.owner === 1
            && (b.buildingType === 'town-center' || b.buildingType === 'lumber-camp'),
        ),
    ).toHaveLength(0);

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueContextCommand(initialTree!.x, initialTree!.y)).toBe(true);

    // Wait for at least one gather to land — sample tree amount and
    // wait until it drops below 200 (the villager has chopped at least
    // one wood off).
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const t = findTree(bridge);
          return !!t && t.amount < 200;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Step a generous tail past the point where the villager fills its
    // 10-wood carry. With the bug, the villager would zero the carry
    // and re-target the tree on the next tick, so the tree's amount
    // would keep decreasing past 190 toward 0. With the fix the carry
    // stays at 10 and the villager idles in `to-dropoff`; tree never
    // drops past 190.
    for (let i = 0; i < 800; i += 1) {
      bridge.step(100);
    }

    const treeAfter = findTree(bridge);
    expect(treeAfter).toBeDefined();
    expect(treeAfter!.amount).toBeGreaterThanOrEqual(190);

    // Villager still carries the original load (the stronger contract:
    // not just "tree didn't deplete further" but "the carry is intact").
    const villagerAfter = findOwnedVillager(bridge, 1);
    expect(villagerAfter).toBeDefined();
    expect(villagerAfter!.carriedResource).toBe('wood');
    expect(villagerAfter!.carriedAmount).toBe(10);

    // Stockpile didn't grow — there was no drop-off to deposit at.
    expect(bridge.getEconomyState().playerResources[1].wood).toBe(200);
  }, 45_000);
});
