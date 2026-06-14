// Campaign-4 found via replay-inspect: villagers ordered onto the same
// tree piled up — 14 of 18 woodcutters targeted ONE tree — and jammed in
// `to-resource` (0 gathering) because assignment always picked the single
// nearest tree and to-resource had no give-up path. This pins the fix:
// villagers spread across the forest and actually accumulate wood.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('villager wood-gather spread (to-resource gridlock fix)', () => {
  it('villagers piled onto one tree fan out across the forest and accumulate wood', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const eco0 = bridge.getEconomyState();
    const tc = eco0.buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(tc).toBeDefined();
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    // Restrict to player 1's OWN forest (near its TC). The map also has the
    // AI (player 2) chopping its trees elsewhere — counting those would mask
    // whether PLAYER 1's piled villagers spread.
    const ownTrees = (state: ReturnType<typeof bridge.getEconomyState>) =>
      state.resources.filter((r) => r.resourceType === 'tree' && dist(r, tc!) <= 14);
    const trees = ownTrees(eco0).sort((a, b) => dist(a, tc!) - dist(b, tc!));
    expect(trees.length).toBeGreaterThanOrEqual(5);
    const targetTree = trees[0]!;

    const villagers = eco0.units.filter((u) => u.owner === 1 && u.unitType === 'villager');
    expect(villagers.length).toBeGreaterThanOrEqual(3);
    const woodBefore = bridge.getHudState().playerResources.wood;

    // Pile EVERY villager onto the single nearest tree — the campaign-4
    // micro that jammed them all in to-resource.
    for (const v of villagers) {
      expect(bridge.selectEntityAtCell(v.x, v.y)).toBe(true);
      bridge.issueContextCommandAtEntity(targetTree.id);
    }

    // Short run, on purpose: stop BEFORE the piled-on tree depletes (~tick
    // 167 at this gather rate). After depletion even the buggy code
    // reassigns villagers to a second tree, which would mask the fix. In
    // this window the discriminator is clean — pre-fix all villagers stay
    // piled on the one tree; the fix (MAX_GATHERERS_PER_RESOURCE = 2 +
    // to-resource timeout-abandon) fans the excess out to other trees.
    for (let i = 0; i < 130; i += 1) bridge.step(100);

    const eco1 = bridge.getEconomyState();
    const choppedTrees = ownTrees(eco1).filter((r) => r.amount < r.maxAmount).length;
    // SPREAD: more than two villagers on one tree must fan out, so more than
    // one tree is being chopped (pre-fix: only the single piled-on tree).
    expect(choppedTrees).toBeGreaterThanOrEqual(2);

    // And they actually gather (the tree's wood is dropping).
    const targetNow = eco1.resources.find((r) => r.id === targetTree.id);
    expect(targetNow && targetNow.amount).toBeLessThan(targetTree.amount);
    void woodBefore;
  }, 60_000);
});
