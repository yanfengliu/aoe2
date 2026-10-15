// Campaign-4 found via replay-inspect: villagers ordered onto the same
// tree piled up — 14 of 18 woodcutters targeted ONE tree — and jammed in
// `to-resource` (0 gathering) because assignment always picked the single
// nearest tree and to-resource had no give-up path. This pins the fix:
// every villager in the pile works, and the pile actually accumulates wood.
//
// Revised by work 131 (spec §6.4, "Carrying on when a resource runs out").
// Until then the case asserted that the pile FANNED OUT across the forest
// within 1,200 ticks — two trees chopped while the piled one still stood —
// and that held because the player's villagers were re-ranked against every
// tree in reach after every delivery. Definitive Edition's villager goes back
// to its own tree after a delivery (Update 108769 hotfix 109739 restored that
// after the Drop Off command broke it), so three villagers that all fit
// beside one tree chop that tree together and move on to the next one only
// when it falls. What the case still forbids is the campaign-4 jam: a villager
// of the pile that never gets to work.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';

describe('villager wood-gather spread (to-resource gridlock fix)', () => {
  it('villagers piled onto one tree all work it, then carry on along the woodline, and wood accumulates', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const eco0 = bridge.getEconomyState();
    const tc = eco0.buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center');
    expect(tc).toBeDefined();
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    // Restrict to player 1's OWN forest (near its TC). The map also has the
    // AI (player 2) chopping its trees elsewhere — counting those would mask
    // what PLAYER 1's piled villagers did.
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

    // 1,600 ticks: the piled tree (100 wood) falls to the three of them at
    // about tick 1,200, and they carry on to the woodline beside it.
    const filledALoad = new Set<number>();
    let piledTreeFellAt: number | null = null;
    for (let tick = 1; tick <= 1600; tick += 1) {
      bridge.step(100);
      for (const v of villagers) {
        const gatherer = bridge.world.getComponent<GathererComponent>(v.id, 'gatherer');
        if ((gatherer?.carriedAmount ?? 0) >= 10) filledALoad.add(v.id);
      }
      const piled = bridge.world.getComponent<ResourceComponent>(targetTree.id, 'resource');
      if (piledTreeFellAt === null && piled?.resourceType !== 'tree') piledTreeFellAt = tick;
    }

    // ANTI-JAM (the campaign-4 regression guard): every villager of the pile
    // filled a load — none was left walking at a tree it could not reach.
    expect(filledALoad.size, 'a villager of the pile never got to work').toBe(villagers.length);
    // The pile works its tree down and moves on along the woodline: the piled
    // tree is gone and another of player 1's trees has been chopped.
    expect(piledTreeFellAt, 'the piled tree never fell').not.toBeNull();
    const eco1 = bridge.getEconomyState();
    expect(ownTrees(eco1).filter((r) => r.amount < r.maxAmount).length).toBeGreaterThanOrEqual(1);
    // ...and the full gather → deposit cycle completes: wood ACCUMULATES.
    const woodAfter = bridge.getHudState().playerResources.wood;
    expect(woodAfter - woodBefore, 'the pile banked less than a load each').toBeGreaterThanOrEqual(30);
  }, 90_000);
});
