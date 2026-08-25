// Attack-ground (spec §10.7, v0.3.117): the mangonel line can bombard a CELL
// — no target entity, the stone lands where it was told and the blast does
// the rest, friend and foe alike. AoE2's tool against masses and the reason
// a good player never parks infantry in a clump.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

describe('attack-ground', () => {
  it('bombards the ordered cell and splashes the cluster standing on it', () => {
    const bridge = createSimulationBridge('mangonel-vs-clustered-infantry-fixture');
    const mangonel = bridge.getEconomyState().units.find((u) => u.unitType === 'mangonel');
    if (!mangonel) throw new Error('no mangonel in the fixture');
    const cluster = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 2 && u.unitType === 'spearman');
    expect(cluster.length).toBeGreaterThanOrEqual(2);
    const hpBefore = cluster.map((u) => bridge.getEntityHealth(u.id)?.currentHp ?? 0);

    expect(bridge.selectUnitsByIds([mangonel.id])).toBe(true);
    expect(bridge.issueAttackGroundCommand(cluster[0]!.x, cluster[0]!.y)).toBe(true);

    const hurt = stepBridgeUntil(
      bridge,
      () => cluster.some(
        (u, i) => (bridge.getEntityHealth(u.id)?.currentHp ?? 0) < hpBefore[i]!,
      ),
      { maxSteps: 600 },
    );
    expect(hurt, 'the ground bombardment never hurt the cluster').toBe(true);
  });

  it('keeps firing at the empty cell after everyone leaves — ground is the target', () => {
    const bridge = createSimulationBridge('mangonel-vs-clustered-infantry-fixture');
    const mangonel = bridge.getEconomyState().units.find((u) => u.unitType === 'mangonel');
    if (!mangonel) throw new Error('no mangonel in the fixture');
    // An empty cell in range: nothing stands at (16, 12).
    bridge.selectUnitsByIds([mangonel.id]);
    expect(bridge.issueAttackGroundCommand(16, 12)).toBe(true);
    for (let i = 0; i < 80; i += 1) bridge.step(100);
    // The order stands (no target death can clear it) and the mangonel holds.
    const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<
      [number, { type?: string }]
    >;
    const cmd = new Map(rows).get(mangonel.id);
    expect(cmd?.type).toBe('attack-ground');
  });

  it('refuses a unit with no blast', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const militia = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === 'militia',
    );
    if (!militia) throw new Error('no militia');
    bridge.selectUnitsByIds([militia.id]);
    expect(bridge.issueAttackGroundCommand(25, 25)).toBe(false);
  });
});
