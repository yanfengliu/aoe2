// Under the shipped Standard rules, the computer plays the relic game (work 128;
// defect register 2026-10-15; spec §13.3 and §4.3).
//
// Before work 128 the computer never stored a relic in a full match. On this
// configuration owner 2 picked both relics up (ticks 26,011 and 26,968 on main
// `83b6ffa3`) and stood still with them: a carried relic claimed its Monk's
// cell, and every path search refuses a blocked start. The match ran
// unresolved to tick 45,000. Since work 128 owner 2 stores both relics, holds
// every relic on the map, and its Relic victory countdown starts.
//
// The match is the castle configuration's, `aiReachesCastleAge.test.ts`'s,
// under the Standard rules that gate no longer plays (its header says why):
// the boot map, both seats AI, standard resources, the standard AI, attacks
// on, every victory condition on. The loop stops the moment a countdown
// starts, so it plays about 28,000 ticks, not 45,000.
//
// WHAT THIS GATES: the claim rule, that a Monk carrying a relic can walk it
// home. It does not gate what the computer knows of relics: with the search
// put back to relics in sight now, this case stays green (measured on work
// 128's `d5d46364`: owner 2 stores at ticks 26,439 and 27,552, against 26,381
// and 27,651 with the rule). `aiMonkKnownRelics.test.ts` gates the knowledge
// rule.
//
// WHAT IS NOT ASSERTED: when the countdown ends or who wins. Its length, 2,000
// ticks for "200 years", is in question (Definitive Edition's community table
// gives 200 years as 1,000 seconds, and makes the years depend on map size),
// and that is its own work item. Nor are the ticks of the stores asserted:
// they are a trajectory, printed for the reader, and other AI work moves them.
//
// BOUND: one seed. The countdown starts only while one seat holds every relic,
// so a change that has owner 1 store a relic of its own stops it, and that is
// play, not this defect: re-derive the case from the printed ledger rather
// than weakening it.

import { describe, expect, it } from 'vitest';

import {
  monkCarriedRelicCodec,
  relicCountdownsCodec,
  relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

const HORIZON_TICKS = 45_000;
/** Stores are read every tick from world state; the economy every 250. */
const SAMPLE_INTERVAL = 250;

type Bridge = ReturnType<typeof createSimulationBridge>;

function slot<T>(bridge: Bridge, codec: { slot: string; deserialize: (json: never) => T }): T {
  return codec.deserialize(bridge.world.getState(codec.slot) as never);
}

describe('under the Standard rules the computer stores relics and starts its Relic victory countdown (work 128)', () => {
  it('stores relics in the castle configuration, and the countdown starts for the seat that holds them all', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
      // Nothing here draws; the match is the same (renderProjectionOnRead.test.ts).
      renderProjection: 'on-read',
    });
    const relicsAtStart = bridge.getEconomyState().resources
      .filter((resource) => resource.resourceType === 'relic').length;
    expect(relicsAtStart, 'the boot map lost its relics').toBeGreaterThan(0);

    const monasteryOwner = new Map<number, number>();
    const stores: string[] = [];
    let storedRelics = 0;
    let countdown: { tick: number; owner: number } | null = null;
    for (let tick = 1; tick <= HORIZON_TICKS && countdown === null; tick += 1) {
      bridge.step(100);
      if (tick % SAMPLE_INTERVAL === 0) {
        for (const building of bridge.getEconomyState().buildings) {
          if (building.buildingType === 'monastery') monasteryOwner.set(building.id, building.owner);
        }
      }
      let stored = 0;
      for (const count of slot(bridge, relicsInMonasteryCodec).values()) stored += count;
      if (stored > storedRelics) {
        const holders = [...slot(bridge, relicsInMonasteryCodec)]
          .map(([monastery, count]) => `o${monasteryOwner.get(monastery) ?? '?'}x${count}`).join(' ');
        stores.push(`t=${tick} ${holders}`);
      }
      storedRelics = stored;
      const running = [...slot(bridge, relicCountdownsCodec).keys()];
      if (running.length > 0) countdown = { tick, owner: running[0]! };
      if (bridge.getMatchState().outcome !== 'running') break;
    }
    console.log(`SELFPLAY-RELICS aoe2-prototype: stores [${stores.join('; ')}]; `
      + `countdown ${countdown === null ? 'never started' : `started t=${countdown.tick} for owner ${countdown.owner}`}`);

    expect(stores.length, 'no seat stored a relic in its Monastery within the horizon').toBeGreaterThan(0);
    expect(countdown, `no Relic victory countdown started within ${HORIZON_TICKS} ticks`).not.toBeNull();
    // The seat whose countdown runs holds every relic the map began with: none
    // is left on the ground or in a Monk's hands.
    expect(bridge.getEconomyState().resources.filter((resource) => resource.resourceType === 'relic')).toEqual([]);
    expect(slot(bridge, monkCarriedRelicCodec).size).toBe(0);
    let heldByCountdownOwner = 0;
    for (const [monastery, count] of slot(bridge, relicsInMonasteryCodec)) {
      const owner = bridge.getEconomyState().buildings.find((building) => building.id === monastery)?.owner;
      if (owner === countdown!.owner) heldByCountdownOwner += count;
    }
    expect(heldByCountdownOwner).toBe(relicsAtStart);
  }, 600_000);
});
