// Construction work animation (spec §14.5, user directive 2026-07-14): the
// renderer needs to know a villager is actively BUILDING. No task/activity
// field existed on the projected view — build state lived only in
// `unitCommands` for the HUD's selection panel. `activeVerb` is the smallest
// honest carrier: derived per visible unit from the same command the HUD
// reads, so it adds no recorded/persisted state and is replay-identical by
// construction.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

function villagers(bridge: Bridge) {
  return bridge
    .getRenderState()
    .entities.filter((entity) => entity.kind === 'unit' && entity.entityType === 'villager');
}

describe('builder activity projection (spec §14.5)', () => {
  it('marks a villager building only while its build command is active', () => {
    const bridge = createSimulationBridge('single-villager-construction-fixture');
    const builder = villagers(bridge)[0];
    expect(builder).toBeDefined();
    expect(builder!.activeVerb).toBeUndefined();

    expect(bridge.selectUnitsByIds([builder!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(12, 12)).toBe(true); // clear of the 4x4 TC at (8,8)

    // Walks to the site first, then builds.
    let sawBuilding = false;
    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      const view = villagers(bridge).find((entity) => entity.id === builder!.id);
      if (view?.activeVerb === 'building') sawBuilding = true;
      const house = bridge
        .getEconomyState()
        .buildings.find((b) => b.buildingType === 'house' && b.x === 12 && b.y === 12);
      if (house?.isComplete) break;
    }
    expect(sawBuilding, 'the builder never projected activeVerb building').toBe(true);

    // Once the house is done the command clears — no lingering work loop.
    for (let step = 0; step < 10; step += 1) bridge.step(100);
    expect(villagers(bridge).find((entity) => entity.id === builder!.id)?.activeVerb)
      .toBeUndefined();
  });

  it('never marks non-builders', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    for (const villager of villagers(bridge)) {
      expect(villager.activeVerb).toBeUndefined();
    }
  });
});

describe('gatherer activity projection (v0.3.113)', () => {
  it('marks a villager CHOPPING only while it works AT the tree (v0.3.121 names the work)', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    // The default map auto-assigns nobody for the human; order one villager
    // onto the nearest tree and watch the verb follow the task states.
    const villager = villagers(bridge)[0];
    expect(villager).toBeDefined();
    const tree = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree!.id)).toBe(true);

    let sawGathering = false;
    for (let step = 0; step < 600 && !sawGathering; step += 1) {
      bridge.step(100);
      const view = villagers(bridge).find((entity) => entity.id === villager!.id);
      if (view?.activeVerb === 'chopping') sawGathering = true;
    }
    expect(sawGathering, 'the woodcutter never projected activeVerb chopping').toBe(true);
  });
});
