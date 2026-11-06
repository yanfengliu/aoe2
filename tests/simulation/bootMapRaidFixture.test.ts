// The boot map's scripted raid (work 144 M2), the scenario the attack warning's
// browser specs and the Home key's spec use since the computer stopped raiding
// the idle human in its Dark Age (`fixtures/raidWarning.ts` says why).
//
// The contract the specs lean on: it IS the boot map (the view the minimap
// mark's pixel floor was sized on), nothing is hit until a spec orders the
// raid, and the ordered raid lands on a human villager within a few seconds,
// the same tick every time.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createDefaultMap } from '../../src/game/simulation/mapGeneration/defaultMap';
import {
  BOOT_MAP_RAID_MILITIA,
  BOOT_MAP_RAID_SEED,
  createBootMapRaidFixture,
} from '../../src/game/simulation/fixtures/raidWarning';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';

type Bridge = ReturnType<typeof createSimulationBridge>;

/** The order the specs give, pushed onto the command queue the browser agent API pushes onto. */
function orderRaid(bridge: Bridge): number {
  const units = bridge.getEconomyState().units;
  const militia = units.find((unit) => unit.owner === 2 && unit.unitType === 'militia');
  if (!militia) throw new Error('the fixture has no Militia of owner 2');
  const villagers = units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager');
  const target = villagers.reduce((best, unit) => (
    Math.hypot(unit.x - militia.x, unit.y - militia.y) < Math.hypot(best.x - militia.x, best.y - militia.y) ? unit : best
  ));
  bridge.pendingCommands.push({
    type: 'unit.attack',
    data: { unitId: militia.id, targetEntityId: target.id, targetEntityKind: 'unit' },
  });
  return target.id;
}

/** Steps until a villager of the human's is below full hit points, or `limit` ticks. */
function firstHumanVillagerHurt(bridge: Bridge, limit: number): number | null {
  for (let step = 0; step < limit; step += 1) {
    bridge.step(100);
    const hurt = bridge.getRenderState().entities.some((entity) => entity.owner === 1
      && entity.entityType === 'villager' && entity.currentHp !== null
      && entity.maxHp !== null && entity.currentHp < entity.maxHp);
    if (hurt) return bridge.world.tick;
  }
  return null;
}

describe('the boot map\'s scripted raid (work 144 M2)', () => {
  it('is the boot map, with owner 2\'s AI off and one more Militia of its own', () => {
    const boot = createDefaultMap(DEFAULT_SEED, 2);
    const raid = createBootMapRaidFixture(BOOT_MAP_RAID_SEED);
    expect(raid.seed).toBe(BOOT_MAP_RAID_SEED);
    expect([raid.width, raid.height]).toEqual([boot.width, boot.height]);
    expect(raid.terrain).toEqual(boot.terrain);
    expect(raid.starts).toEqual(boot.starts.map((start) => (start.owner === 2 ? { ...start, disableAi: true } : start)));
    expect(raid.spawns.slice(0, boot.spawns.length)).toEqual(boot.spawns);
    expect(raid.spawns.slice(boot.spawns.length)).toEqual([
      expect.objectContaining({ kind: 'militia', owner: 2, x: BOOT_MAP_RAID_MILITIA.x, y: BOOT_MAP_RAID_MILITIA.y }),
    ]);
  });

  it('hits nothing until the raid is ordered, then lands it on a villager of the human\'s, the same tick each time', () => {
    const quiet = createSimulationBridge(BOOT_MAP_RAID_SEED, { renderProjection: 'on-read' });
    // A thousand ticks with no order: the Militia stands out of reach of the
    // human's Town Center, Scout and villagers, and nobody's AI moves anyone.
    // The hit feed keeps only its last ten ticks, so it is read after every
    // step (review round 5, R5-1: read once at the end it missed earlier blows).
    const unordered = new Set<string>();
    for (let tick = 0; tick < 1_000; tick += 1) {
      quiet.step(100);
      for (const blow of quiet.getRecentPlayerHits()) unordered.add(`tick ${String(blow.tick)}: #${String(blow.attackerId)} hit #${String(blow.targetId)}`);
    }
    expect([...unordered].slice(0, 5), 'something was hit before any order').toEqual([]);

    const landings: number[] = [];
    for (let run = 0; run < 2; run += 1) {
      const bridge = createSimulationBridge(BOOT_MAP_RAID_SEED, { renderProjection: 'on-read' });
      for (let tick = 0; tick < 100; tick += 1) bridge.step(100);
      orderRaid(bridge);
      const hurtAt = firstHumanVillagerHurt(bridge, 600);
      expect(hurtAt, 'the ordered raid hit no villager of the human\'s within 600 ticks').not.toBeNull();
      landings.push(hurtAt! - 100);
    }
    console.log(`BOOT-MAP RAID: the first villager is hit ${String(landings[0])} ticks after the order`);
    expect(landings[1], 'the raid landed on a different tick the second time').toBe(landings[0]);
  });
});
