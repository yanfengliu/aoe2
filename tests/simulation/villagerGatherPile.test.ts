import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { SHARED_PILE, SHARED_PILE_SEED } from '../../src/game/simulation/fixtures/economyBasics/sharedGathering';
import type { GathererComponent } from '../../src/game/simulation/types';

// Campaign-4's gridlock must not come back (work 145). Replaying that bundle
// found 14 of 18 woodcutters piled onto ONE tree and jammed in `to-resource`
// for good (v0.1.24, 2026-06-13). The rule cap of 2 gatherers per node that
// fixed it is gone for the human player's villagers, since DE names a worker
// limit for the Farm alone: a node now takes as many as fit beside it. What
// stops the jam is that a villager which never gets beside its node gives up
// on it and carries on to the next tree of the woodline.
//
// Bound: eighteen villagers on the fixture's edge tree, whose one open side
// holds 16 (§12.6's sixteen sub-cell slots), with 2,000 wood so it stands for
// the whole case; a Lumber Camp three cells from the woodline. It proves no
// villager of the pile is left without work, not where each one works.
describe('campaign-4 pile on one tree (work 145)', () => {
  it('eighteen villagers ordered onto one edge tree all get to work, none jammed', () => {
    const bridge = createSimulationBridge(SHARED_PILE_SEED, { renderProjection: 'on-read' });
    const villagers = bridge.getEconomyState().units
      .filter((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')
      .map((unit) => unit.id);
    expect(villagers).toHaveLength(18);
    const tree = bridge.getEconomyState().resources
      .find((resource) => resource.resourceType === 'tree' && resource.x === SHARED_PILE.P.x && resource.y === SHARED_PILE.P.y)!.id;
    expect(bridge.selectUnitsByIds(villagers)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree)).toBe(true);

    const filled = new Set<number>();
    let mostOnTree = 0;
    for (let tick = 0; tick < 1_600; tick += 1) {
      bridge.step(100);
      let onTree = 0;
      for (const id of villagers) {
        const gatherer = bridge.world.getComponent<GathererComponent>(id, 'gatherer')!;
        if (gatherer.carriedAmount >= 10) filled.add(id);
        if (gatherer.task === 'gathering' && gatherer.targetResourceId === tree) onTree += 1;
      }
      mostOnTree = Math.max(mostOnTree, onTree);
    }
    // The jam first: it is campaign-4's defect, and the room is the sharing rule.
    expect(villagers.filter((id) => !filled.has(id)), 'a villager of the pile never filled a load').toEqual([]);
    expect(mostOnTree, 'the pile never filled the room beside its tree').toBeGreaterThanOrEqual(16);
  }, 60_000);
});
