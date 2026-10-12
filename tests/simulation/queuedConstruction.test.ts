// Shift-queued construction (spec §8, v0.3.126): place a second foundation
// with Shift held and the SAME villager finishes the first site, then walks
// to the second — AoE2's build chain. A queued placement also keeps the
// placement mode armed so the player can stamp several foundations.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

describe('shift-queued construction', () => {
  it('chains the second site after the first completes, one builder', () => {
    const bridge = createSimulationBridge('single-villager-construction-fixture');
    const villager = bridge
      .getRenderState()
      .entities.find((e) => e.kind === 'unit' && e.entityType === 'villager');
    if (!villager) throw new Error('no villager');
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    // Shift held on BOTH placements, as in AoE2: mode stays armed throughout.
    // Both sites are on explored ground: DE refuses a foundation on ground
    // wholly unexplored (hotfix 45185, spec §12.1, work 122).
    expect(bridge.confirmBuildingPlacement(12, 12, { queue: true })).toBe(true);
    expect(bridge.getPlacementPreview(12, 15)).not.toBeNull();
    expect(bridge.confirmBuildingPlacement(12, 15, { queue: true })).toBe(true);
    bridge.step(100);
    // MECHANISM: the builder's command carries the queued site.
    const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { type?: string; queuedBuildRefs?: unknown[] }]
    >;
    const cmd = new Map(rows).get(villager.id);
    expect(cmd?.type).toBe('build');
    expect(cmd?.queuedBuildRefs).toHaveLength(1);

    const bothDone = stepBridgeUntil(
      bridge,
      () => {
        const houses = bridge
          .getEconomyState()
          .buildings.filter((b) => b.buildingType === 'house' && b.isComplete);
        return houses.length >= 2;
      },
      { maxSteps: 6000 },
    );
    expect(bothDone, 'the villager never finished both queued houses').toBe(true);
  });

  // Work 122, review finding 10: when a site goes before its builders reach it
  // — deleted, destroyed, or cancelled by the start check over ground the fog
  // hid — every one of them goes on down the chain, not only the one that
  // found it gone first.
  it('a site removed before its builders arrive sends every one of them to the next site', () => {
    const bridge = createSimulationBridge('multi-villager-construction-fixture');
    const villagers = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
      .slice(0, 2);
    expect(villagers).toHaveLength(2);
    expect(bridge.selectUnitsByIds(villagers.map((villager) => villager.id))).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    const first = { x: 12, y: 18 };
    const second = { x: 16, y: 18 };
    expect(bridge.confirmBuildingPlacement(first.x, first.y, { queue: true })).toBe(true);
    expect(bridge.confirmBuildingPlacement(second.x, second.y, { queue: true })).toBe(true);
    bridge.step(100);
    const commands = () => new Map((bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { type?: string; target?: { x: number; y: number }; queuedBuildRefs?: unknown[] }]
    >);
    for (const villager of villagers) {
      const command = commands().get(villager.id);
      expect(command?.type, `villager ${villager.id} is not building`).toBe('build');
      expect(command?.target, `villager ${villager.id} is not on its way to the first site`).toEqual(first);
      expect(command?.queuedBuildRefs, `villager ${villager.id} has no chain`).toHaveLength(1);
    }
    // The first site goes before either builder reaches it.
    expect(bridge.selectEntityAtCell(first.x, first.y)).toBe(true);
    expect(bridge.deleteSelectedEntity()).toBe(true);
    bridge.step(100);
    bridge.step(100);
    for (const villager of villagers) {
      const command = commands().get(villager.id);
      expect(command?.type, `villager ${villager.id} dropped its chain`).toBe('build');
      expect(command?.target, `villager ${villager.id} is not on its way to the second site`).toEqual(second);
    }
  });

  it('a queued confirm keeps placement mode armed; a plain confirm ends it', () => {
    const bridge = createSimulationBridge('single-villager-construction-fixture');
    const villager = bridge
      .getRenderState()
      .entities.find((e) => e.kind === 'unit' && e.entityType === 'villager');
    if (!villager) throw new Error('no villager');
    bridge.selectUnitsByIds([villager.id]);
    bridge.beginBuildingPlacement('house');
    expect(bridge.confirmBuildingPlacement(12, 12, { queue: true })).toBe(true);
    // Still armed: the preview still answers.
    expect(bridge.getPlacementPreview(16, 12)).not.toBeNull();
    expect(bridge.confirmBuildingPlacement(16, 12)).toBe(true);
    expect(bridge.getPlacementPreview(20, 12)).toBeNull();
  });
});
