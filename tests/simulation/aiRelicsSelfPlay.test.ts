// Standard boot-map transport, knowledge and conservation (work128; spec
// §13.3/§4.3). Bound: one fixed seed/settings/horizon, with attacks on.
// The original all-relic countdown assertion failed on the combined work133
// tree: owner2 stored2261 at35511, while2260 stayed unexplored to that seat
// and owner1 never acquired a Monk. The maintained Standard ledger confirmed
// real transport (pickup35155 at40,10; deposit at43,25 into42,29), not a stuck
// carrier. See work133's authored diagnosis; the historical failure is retained.
// Requiring ownership of an unknown relic was a strategic trajectory premise,
// not the carried-cell defect. This same45k Standard run requires actual home
// delivery, no stranded carrier, conservation and no premature countdown.
// A separate short all-known saved-game setup requires the countdown outright.
// Neither seed/horizon tuning nor conditional assertions can stand in for that
// unconditional all-relic transport case. Both transport cases must go red if
// carried relics once again claim and block their carrier's starting cell.

import type { VisibilityMapState } from 'civ-engine';
import { describe, expect, it } from 'vitest';
import {
  aiStatesCodec, monkCarriedRelicCodec, relicCountdownsCodec, relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { createRelicOracle, slot } from './aiRelicsSelfPlay.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import { exploredCellsInState } from './vietnameseRevealHelpers';

const HORIZON_TICKS = 45_000;
const SAMPLE_INTERVAL = 250;

describe('under Standard rules the computer transports known relics home (work128)', () => {
  it('delivers a relic in the fixed45k boot match and preserves unknown ground and valid countdowns', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]), renderProjection: 'on-read',
    });
    const oracle = createRelicOracle(bridge);
    expect(oracle.initialRelics.length, 'the boot map lost its relics').toBeGreaterThan(0);
    expect(slot(bridge, relicsInMonasteryCodec).size).toBe(0);
    let lastTick = 0;
    try {
      for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
        bridge.step(100);
        lastTick = tick;
        oracle.observe(tick);
        // Preserve the maintained case's economy sampling cadence; the oracle
        // reads only tracked relic IDs, carriers and stored Monasteries.
        if (tick % SAMPLE_INTERVAL === 0) bridge.getEconomyState();
        if (bridge.getMatchState().outcome !== 'running') break;
      }
      const residual = oracle.residualKnowledge();
      console.log(`SELFPLAY-RELICS aoe2-prototype: censused ${lastTick}; stores [${oracle.stores.join('; ')}]; `
        + `transported ${oracle.transported().length}; remaining ${JSON.stringify(residual)}; countdowns ${slot(bridge, relicCountdownsCodec).size}`);
      expect(oracle.transported().length, 'no observed pickup travelled from beyond deposit range into its own completed Monastery').toBeGreaterThan(0);
      expect(slot(bridge, monkCarriedRelicCodec).size, 'a carrier remained stranded at the horizon').toBe(0);
      if (residual.ground.length > 0) {
        expect(residual.owners.length, 'no living collector remained to make the unknown-ground check meaningful').toBeGreaterThan(0);
        for (const relic of residual.ground) expect(relic.knownByCollectors, `ground relic${relic.id} is known to a living collector's own/shared sight`).toEqual([]);
        expect(slot(bridge, relicCountdownsCodec).size, 'unknown ground remains, so no seat holds every relic').toBe(0);
      }
    } finally { oracle.close(); }
  }, 600_000);

  it('collects all three initially known ground relics and starts its countdown after real AI transport', () => {
    // Initial-state declaration only: the existing zero-purse fixture has
    // three reachable relics and a distant own Monastery. Its saved fog is
    // changed only to add the formerly unknown cell as prior exploration.
    // Real exploration inputs remain gated by aiMonkKnownRelics.test.ts.
    const options = { forceAiForOwners: new Set([HUMAN_PLAYER_ID]), renderProjection: 'on-read' as const };
    const fresh = createSimulationBridge('ai-monk-known-relic-fixture', options);
    const baseline = asSchema2Blob(fresh.saveGame());
    const saved = structuredClone(baseline);
    const state = worldStateOf(saved);
    const explored = exploredCellsInState(state, HUMAN_PLAYER_ID);
    const relics = fresh.getEconomyState().resources.filter((resource) => resource.resourceType === 'relic');
    const unknown = relics.filter((relic) => !explored.has(`${relic.x},${relic.y}`));
    expect(relics).toHaveLength(3);
    expect(unknown).toHaveLength(1);
    const visibility = state['aoe2.visibility'] as VisibilityMapState;
    const owner = visibility.players.find(([id]) => id === HUMAN_PLAYER_ID)!;
    owner[1].explored.push(unknown[0]!.y * visibility.width + unknown[0]!.x);
    owner[1].explored.sort((a, b) => a - b);
    const otherwiseUnchanged = structuredClone(saved);
    worldStateOf(otherwiseUnchanged)['aoe2.visibility'] = worldStateOf(baseline)['aoe2.visibility'];
    expect(otherwiseUnchanged).toEqual(baseline);
    const bridge = createSimulationBridge('ai-monk-known-relic-fixture', { ...options, savedGame: saved });
    const oracle = createRelicOracle(bridge);
    expect(oracle.initialRelics).toHaveLength(3);
    expect(slot(bridge, monkCarriedRelicCodec).size).toBe(0);
    expect(slot(bridge, relicsInMonasteryCodec).size).toBe(0);
    expect(slot(bridge, relicCountdownsCodec).size).toBe(0);
    expect(slot(bridge, aiStatesCodec).has(HUMAN_PLAYER_ID), 'the declared collector is not under the AI').toBe(true);
    const known = exploredCellsInState(worldStateOf(bridge.saveGame()), HUMAN_PLAYER_ID);
    for (const relic of oracle.initialRelics) expect(known.has(`${relic.x},${relic.y}`)).toBe(true);
    try {
      for (let tick = 1; tick <= 6_000; tick += 1) {
        bridge.step(100);
        oracle.observe(tick);
        if (slot(bridge, relicCountdownsCodec).has(HUMAN_PLAYER_ID)) break;
      }
      expect([...oracle.picked].sort((a, b) => a - b)).toEqual(oracle.initialRelics.map((relic) => relic.id).sort((a, b) => a - b));
      expect(oracle.transported()).toHaveLength(3);
      expect(slot(bridge, monkCarriedRelicCodec).size).toBe(0);
      expect(oracle.residualKnowledge().ground).toEqual([]);
      expect([...slot(bridge, relicsInMonasteryCodec).values()].reduce((sum, count) => sum + count, 0)).toBe(3);
      expect([...slot(bridge, relicCountdownsCodec).keys()]).toEqual([HUMAN_PLAYER_ID]);
    } finally { oracle.close(); }
  }, 30_000);
});
