import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { CreateSimulationBridgeOptions } from '../../src/game/simulation/createSimulationBridgeOptions';
import { RELIC_GOLD_FIXTURE_MONASTERIES } from '../../src/game/simulation/fixtures/relicGold';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

// Relic gold at Definitive Edition's rate (work 127). DE pays each relic in a
// Monastery 30 gold a minute, 0.5 a second: its relic-rate resource (191)
// defaults to 30. A side with the Aztecs is paid a third more, one gold every
// 1.5 seconds where everyone else waits 2, so 40 a minute and 2,400 an hour
// (Forgotten Empires' relic table). At this game's 10 ticks a second that is
// one gold every 20 ticks, or every 15 on an Aztec side. Until work 127 the
// game paid one gold per relic EVERY tick, 10 a second and twenty times DE,
// and the Aztec bonus one more every third tick.
//
// Every expected count below is worked out by hand from those two periods, not
// from the code's own constants, so a wrong constant cannot agree with itself.
//
// BOUND: the windows are whole periods (multiples of 20 and 15 ticks), where
// the payout is exact whatever the phase. A relic that arrives or leaves part
// way through a period is paid on the game's payout ticks, so one stay can be
// paid under one gold more or less than DE's running fraction would give; the
// removal case below uses a stay of whole periods. Atheism's halving of enemy
// relic gold in current DE is not modelled (technologies.csv does not list it).

type Bridge = ReturnType<typeof createSimulationBridge>;

const MS_PER_TICK = 1000 / TPS;

/** A bridge that projects the render state only when it is read: these cases
 *  step thousands of ticks and draw nothing, and the projection never writes
 *  world state (tests/simulation/renderProjectionOnRead.test.ts). */
function boot(seed: string, options: CreateSimulationBridgeOptions = {}): Bridge {
  return createSimulationBridge(seed, { renderProjection: 'on-read', ...options });
}

function gold(bridge: Bridge, owner: number): number {
  return bridge.getEconomyState().playerResources[owner].gold;
}

function stepTicks(bridge: Bridge, ticks: number): void {
  // Exactly `ticks`, or the counts below would measure the wrong window: a
  // refused step (a match that ended, say) fails here by name.
  expect(bridge.step(ticks * MS_PER_TICK)).toEqual({ ticks, refusedBecause: null });
}

function goldEarned(bridge: Bridge, owners: readonly number[], ticks: number): number[] {
  const before = owners.map((owner) => gold(bridge, owner));
  stepTicks(bridge, ticks);
  return owners.map((owner, index) => gold(bridge, owner) - before[index]);
}

function relicsOnMap(bridge: Bridge): number {
  return bridge.getEconomyState().resources.filter((r) => r.resourceType === 'relic').length;
}

/** The real relic path: the fixture's Monk is ordered onto the relic, then into
 *  the Monastery, the way a right-click does it. */
function carryTheRelicIn(bridge: Bridge): void {
  const relic = bridge.getEconomyState().resources.find((r) => r.resourceType === 'relic');
  expect(relic).toBeDefined();
  expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
  expect(bridge.issueContextCommandAtEntity(relic!.id)).toBe(true);
  const monkAt = () => bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'monk');
  expect(stepBridgeUntil(bridge, () => {
    const carried = bridge.getEconomyState().resources.find((r) => r.resourceType === 'relic');
    const monk = monkAt();
    return carried !== undefined && monk !== undefined && carried.x === monk.x && carried.y === monk.y;
  }, { maxSteps: 200 })).toBe(true);
  const monastery = bridge.getEconomyState().buildings.find(
    (b) => b.owner === 1 && b.buildingType === 'monastery',
  );
  expect(monastery).toBeDefined();
  expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
  expect(bridge.issueContextCommandAtEntity(monastery!.id)).toBe(true);
  expect(stepBridgeUntil(bridge, () => relicsOnMap(bridge) === 0, { maxSteps: 300 })).toBe(true);
}

const ALLIED_1_AND_3 = new Map([[1, 1], [3, 1], [2, 2]]);

describe('relic gold at Definitive Edition\'s rate (work 127)', () => {
  it('steps 10 ticks for each second of game time, the factor every count here rests on', () => {
    expect(TPS).toBe(10);
    const bridge = createSimulationBridge('relic-gold-fixture');
    const tick = bridge.world.tick;
    expect(bridge.step(1000)).toEqual({ ticks: 10, refusedBecause: null });
    expect(bridge.world.tick - tick).toBe(10);
  });

  it('pays a relic a Monk carries in 30 gold a minute, every minute for ten minutes', () => {
    // Conquest only: holding the map's one relic would otherwise start the
    // relic victory clock, and its 2,000 ticks end the match inside the window.
    const bridge = boot('monk-relic-fixture', {
      disableAiForOwners: new Set([2]),
      victory: 'conquest-only',
    });
    carryTheRelicIn(bridge);
    const perMinute: number[] = [];
    for (let minute = 0; minute < 10; minute += 1) {
      perMinute.push(goldEarned(bridge, [1], 600)[0]);
    }
    expect(perMinute).toEqual([30, 30, 30, 30, 30, 30, 30, 30, 30, 30]);
  });

  it('pays exactly one gold per relic in any 20 ticks, whatever the phase, and in any 15 on an Aztec side', () => {
    for (const { civ, period } of [{ civ: 'Britons', period: 20 }, { civ: 'Aztecs', period: 15 }]) {
      const bridge = boot('relic-gold-fixture', { civilizationsByOwner: new Map([[1, civ]]) });
      // Owner 1's gold after each of 70 single ticks: the windows start on
      // every tick from 0 on, which covers every phase of the period.
      const series = [gold(bridge, 1)];
      for (let i = 0; i < 70; i += 1) {
        stepTicks(bridge, 1);
        series.push(gold(bridge, 1));
      }
      const windows = [];
      for (let start = 0; start + period <= 70; start += 1) {
        windows.push(series[start + period] - series[start]);
      }
      // Owner 1 keeps three relics.
      expect(windows, `${civ}: gold in every window of ${String(period)} ticks`)
        .toEqual(windows.map(() => 3));
    }
  });

  it('pays every relic a side keeps, in one Monastery or several', () => {
    // Two relics in one Monastery: ten minutes pay 600.
    const pair = boot('relic-not-all-held-fixture', { disableAiForOwners: new Set([2]) });
    expect(goldEarned(pair, [1], 6000)).toEqual([600]);
    // Owner 1 keeps three relics in two Monasteries, owner 2 one, owner 3 none:
    // ten minutes pay 900, 300 and 0.
    const bridge = boot('relic-gold-fixture');
    expect(RELIC_GOLD_FIXTURE_MONASTERIES.map((m) => [m.owner, m.relics]))
      .toEqual([[1, 2], [1, 1], [2, 1]]);
    expect(goldEarned(bridge, [1, 2, 3], 6000)).toEqual([900, 300, 0]);
  });

  it('pays an Aztec owner a third more: 40 gold a minute a relic', () => {
    const bridge = boot('relic-gold-fixture', {
      civilizationsByOwner: new Map([[1, 'Aztecs'], [2, 'Britons']]),
    });
    expect(goldEarned(bridge, [1, 2], 6000)).toEqual([1200, 300]);
  });

  it('pays a third more on a side whose Aztec player is an ally, and nothing more to the Aztecs\' enemy', () => {
    const allyIsAztec = boot('relic-gold-fixture', {
      teamsByOwner: ALLIED_1_AND_3,
      civilizationsByOwner: new Map([[1, 'Britons'], [2, 'Britons'], [3, 'Aztecs']]),
    });
    expect(goldEarned(allyIsAztec, [1, 2, 3], 6000)).toEqual([1200, 300, 0]);
    const enemyIsAztec = boot('relic-gold-fixture', {
      teamsByOwner: ALLIED_1_AND_3,
      civilizationsByOwner: new Map([[1, 'Britons'], [2, 'Aztecs'], [3, 'Britons']]),
    });
    expect(goldEarned(enemyIsAztec, [1, 2, 3], 6000)).toEqual([900, 400, 0]);
  });

  it('stops paying for relics that leave mid-window, from the tick they leave', () => {
    const bridge = boot('relic-gold-fixture');
    const start = gold(bridge, 1);
    // 340 ticks with three relics, then the two-relic Monastery is deleted,
    // which spills its relics onto the map; 260 more ticks with one relic. The
    // delete runs at the start of the 341st tick, so the two relics stayed
    // exactly 340 ticks: 17 whole periods, 17 gold each. The third stayed all
    // 600 ticks: 30.
    stepTicks(bridge, 340);
    const pairHouse = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'monastery' && b.x === 14 && b.y === 4,
    );
    expect(pairHouse).toBeDefined();
    expect(bridge.selectEntityById(pairHouse!.id)).toBe(true);
    expect(bridge.deleteSelectedEntity()).toBe(true);
    stepTicks(bridge, 260);
    // The loose relic and the two the Monastery dropped.
    expect(relicsOnMap(bridge)).toBe(3);
    expect(gold(bridge, 1) - start).toBe(2 * 17 + 30);
  });

  it('keeps the schedule through a save made mid-period: nothing lost, nothing paid twice', () => {
    const played = boot('relic-gold-fixture');
    const start = gold(played, 1);
    stepTicks(played, 7);
    const blob = JSON.parse(JSON.stringify(played.saveGame())) as SaveBlob;
    const savedAtTick = played.world.tick;
    stepTicks(played, 593);
    const loaded = boot('relic-gold-fixture', { savedGame: blob });
    expect(loaded.world.tick).toBe(savedAtTick);
    stepTicks(loaded, 593);
    // 600 ticks from the start, 30 periods, three relics, either way.
    expect(gold(played, 1) - start).toBe(90);
    expect(gold(loaded, 1) - start).toBe(90);
  });
});
