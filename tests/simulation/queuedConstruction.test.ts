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
    expect(bridge.confirmBuildingPlacement(12, 12, { queue: true })).toBe(true);
    expect(bridge.getPlacementPreview(14, 16)).not.toBeNull();
    expect(bridge.confirmBuildingPlacement(14, 16, { queue: true })).toBe(true);
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
