// Attack-ground (spec §10.7, v0.3.117): the mangonel line can bombard a CELL
// — no target entity, the stone lands where it was told and the blast does
// the rest, friend and foe alike. AoE2's tool against masses and the reason
// a good player never parks infantry in a clump. Which units may take the
// order, and that each one's ground shot blasts, is the blast census
// (`blastCensus.test.ts`).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BLAST_CENSUS_ATTACKER,
  BLAST_CENSUS_GROUND_TARGET,
  blastCensusSeed,
} from '../../src/game/simulation/fixtures/blastCensusLayout';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

function commandOf(bridge: ReturnType<typeof createSimulationBridge>, unitId: number) {
  const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<[number, { type?: string }]>;
  return new Map(rows).get(unitId);
}

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

  it('bombards the cell on its ordinary reload, shot after shot, not once', () => {
    // Nothing counted the reload down during this order until the defect
    // register's "The Siege Onager fired direct hits with no splash"
    // (2026-09-24), so the first stone was the last one: the order stood, and
    // the siege stood silent under it.
    const bridge = createSimulationBridge(blastCensusSeed('siege-onager'));
    const onager = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.x === BLAST_CENSUS_ATTACKER.x && u.y === BLAST_CENSUS_ATTACKER.y,
    );
    if (onager?.unitType !== 'siege-onager') throw new Error('no siege onager in the census fixture');
    const combat = new Map((bridge.world.getState('aoe2.combatStates') ?? []) as Array<[number, { reloadTicks: number }]>);
    const reload = combat.get(onager.id)!.reloadTicks;
    expect(reload).toBeGreaterThan(1);

    // The census's ground target is in range from where the onager stands, so
    // no shot waits on a walk.
    expect(bridge.selectUnitsByIds([onager.id])).toBe(true);
    expect(bridge.issueAttackGroundCommand(BLAST_CENSUS_GROUND_TARGET.x, BLAST_CENSUS_GROUND_TARGET.y)).toBe(true);
    const launchTicks = new Map<number, number>();
    for (let step = 0; step < reload * 4 + 2; step += 1) {
      bridge.step(100);
      for (const shot of bridge.getInFlightProjectiles()) {
        if (shot.attackerId === onager.id) launchTicks.set(shot.id, shot.launchTick);
      }
    }
    const ticks = [...launchTicks.values()].sort((a, b) => a - b);
    expect(ticks.length, `shots launched at ticks ${ticks.join(', ')}`).toBeGreaterThanOrEqual(4);
    const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index]!);
    expect(new Set(gaps), `ticks between shots: ${gaps.join(', ')}; the reload is ${reload}`).toEqual(new Set([reload]));
    expect(commandOf(bridge, onager.id)?.type).toBe('attack-ground');
  });

  it('holds a Siege Onager\'s fire at a cell inside its minimum range', () => {
    // units.csv gives the Siege Onager a range of 3-8, and the table had no
    // minimum for it. Once its shot blasted, a point-blank bombardment would
    // have landed its 1.5 blast on whatever stood beside it, its own side
    // included. Two cells north of it is inside the minimum.
    const bridge = createSimulationBridge(blastCensusSeed('siege-onager'));
    const onager = bridge.getEconomyState().units.find(
      (u) => u.owner === 1 && u.x === BLAST_CENSUS_ATTACKER.x && u.y === BLAST_CENSUS_ATTACKER.y,
    );
    if (onager?.unitType !== 'siege-onager') throw new Error('no siege onager in the census fixture');
    expect(bridge.selectUnitsByIds([onager.id])).toBe(true);
    expect(bridge.issueAttackGroundCommand(BLAST_CENSUS_ATTACKER.x, BLAST_CENSUS_ATTACKER.y - 2)).toBe(true);
    let shots = 0;
    for (let step = 0; step < 120; step += 1) {
      bridge.step(100);
      shots += bridge.getInFlightProjectiles().filter((shot) => shot.attackerId === onager.id).length;
    }
    // The instrument: the order stood the whole time, so no shot means it held.
    expect(commandOf(bridge, onager.id)?.type).toBe('attack-ground');
    expect(shots, 'the Siege Onager fired at a cell two away, inside its minimum range of 3').toBe(0);
  });

  it('drops an attack-ground order a save holds for a unit that cannot attack the ground', () => {
    // The validator accepted the order from a Demolition Ship until the
    // defect register's "The Siege Onager fired direct hits with no splash"
    // (2026-09-24), so a save made before then can hold one. Loaded as it
    // was, the ship would lob shots that hurt nobody for as long as the order
    // stood, and never be spent.
    const seed = blastCensusSeed('demolition-ship');
    const bridge = createSimulationBridge(seed);
    const ship = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'demolition-ship');
    if (!ship) throw new Error('no demolition ship in the census fixture');
    const blob = JSON.parse(JSON.stringify(bridge.saveGame())) as SaveBlob;
    expect('state' in blob.worldSnapshot, 'the save has no world state to hold the order').toBe(true);
    (blob.worldSnapshot as { state: Record<string, unknown> }).state['aoe2.unitCommands'] = [
      [ship.id, { type: 'attack-ground', target: { ...BLAST_CENSUS_GROUND_TARGET } }],
    ];

    const loaded = createSimulationBridge(seed, { savedGame: blob });
    // The instrument: the stale order really is in the loaded world, or the
    // checks below would pass on a load that dropped every order.
    expect(commandOf(loaded, ship.id)?.type).toBe('attack-ground');
    loaded.step(100);
    expect(commandOf(loaded, ship.id)?.type).not.toBe('attack-ground');
    expect(loaded.getInFlightProjectiles().filter((shot) => shot.attackerId === ship.id)).toEqual([]);
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
