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

    // Window sizing, re-measured 2026-08-29 after the fan-out budget became a
    // TILE allowance (v0.3.165: 32 tiles = 400 ticks, replacing a flat 80 that
    // meant 40 tiles under the old movement clock and only 6.4 under §12.4.2).
    // The excess villager now redistributes off the over-subscribed tree at
    // ~t400 rather than ~t80, then walks to a drop-off-proximate tree and
    // chops it: the second tree first shows damage at **tick 854**, measured
    // by polling this same fixture tick by tick. 1,200 ticks covers that with
    // ~40% margin while the piled tree (100 wood, cap-2 gatherers) is nowhere
    // near depletion — after depletion even the buggy pre-campaign-4 code
    // reassigns villagers, which would mask the fix.
    //
    // The slower fan-out is a deliberate trade, not drift: a budget short
    // enough to redistribute promptly also abandons ordinary walks, which is
    // the freeze this mechanism's own constant caused on two of three corpus
    // seeds. Fan-out is the fallback for a pathological pile, not the hot path.
    for (let i = 0; i < 1200; i += 1) bridge.step(100);

    const eco1 = bridge.getEconomyState();

    // SPREAD (the campaign-4 regression guard): the excess villager must fan
    // OUT of the over-subscribed pile (MAX_GATHERERS_PER_RESOURCE=2 + the
    // to-resource approach timeout), so MORE THAN ONE tree ends up chopped —
    // pre-fix, all villagers latched onto the single piled tree forever.
    const choppedTrees = ownTrees(eco1).filter((r) => r.amount < r.maxAmount).length;
    expect(choppedTrees).toBeGreaterThanOrEqual(2);

    // ANTI-JAM: the piled tree itself is actively harvested (no to-resource
    // deadlock at the pile)...
    const targetNow = eco1.resources.find((r) => r.id === targetTree.id);
    expect(targetNow && targetNow.amount).toBeLessThan(targetTree.amount);

    // ...and the full gather → deposit cycle completes: wood ACCUMULATES.
    const woodAfter = bridge.getHudState().playerResources.wood;
    expect(woodAfter).toBeGreaterThan(woodBefore);
  }, 90_000);
});
