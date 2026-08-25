import { describe, expect, it } from 'vitest';

import {
  setupQueryString,
  shouldShowSetupScreen,
} from '../../src/app/bootstrap/setupScreen';
import { parseDifficultyParam } from '../../src/app/bootstrap/difficultyParam';
import {
  parseResourcesParam,
  parseSpeedParam,
  parseVictoryParam,
} from '../../src/app/bootstrap/matchOptionParams';
import { decisionIntervalTicks } from '../../src/game/simulation/ai';

// The setup screen's contract (spec §4.6): bare visits see it, configured
// visits never do, and the query it writes is exactly what the app reads.

describe('when the setup screen shows', () => {
  it('shows on a bare URL and never on a configured one', () => {
    expect(shouldShowSetupScreen('http://localhost/')).toBe(true);
    expect(shouldShowSetupScreen('http://localhost/?seed=aoe2-prototype')).toBe(false);
    // Quit to title (createApp onQuit) navigates to origin+pathname — the
    // param-stripped form of any in-match URL must land on the setup screen.
    const inMatch = new URL('http://localhost/?seed=aoe2-prototype&players=4&civ=Huns');
    expect(shouldShowSetupScreen(inMatch.origin + inMatch.pathname)).toBe(true);
    expect(shouldShowSetupScreen('http://localhost/?players=4')).toBe(false);
    // ANY param counts — a harness flag must not open a menu over its run.
    expect(shouldShowSetupScreen('http://localhost/?disableAi=2')).toBe(false);
  });
});

describe('the query the screen writes', () => {
  it('carries every non-default choice and omits the defaults', () => {
    expect(setupQueryString({
      seed: 'arena', players: 4, civilization: 'Franks', teams: 'two-sides', difficulty: 'hard',
      resources: 'high', victory: 'conquest-only', speed: 'fast', popCap: 100,
    })).toBe('seed=arena&players=4&civ=Franks&teams=1%2C1%2C2%2C2&difficulty=hard&resources=high&victory=conquest-only&speed=fast&popcap=100');
    // Defaults stay out of the URL, so the ordinary 1v1 link stays short.
    expect(setupQueryString({
      seed: 'aoe2-prototype', players: 2, civilization: 'Britons', teams: 'ffa', difficulty: 'standard',
      resources: 'standard', victory: 'standard', speed: 'slow', popCap: 200,
    })).toBe('seed=aoe2-prototype&civ=Britons');
  });

  it('splits odd counts with the extra seat on the human side', () => {
    const query = setupQueryString({
      seed: 'aoe2-prototype', players: 5, civilization: 'Britons', teams: 'two-sides', difficulty: 'standard',
      resources: 'standard', victory: 'standard', speed: 'slow', popCap: 200,
    });
    expect(new URLSearchParams(query).get('teams')).toBe('1,1,1,2,2');
  });
});

describe('the difficulty parameter', () => {
  it('parses the three levels and refuses anything else', () => {
    expect(parseDifficultyParam('http://localhost/?difficulty=easy')).toBe('easy');
    expect(parseDifficultyParam('http://localhost/?difficulty=HARD')).toBe('hard');
    expect(parseDifficultyParam('http://localhost/?difficulty=nightmare')).toBeUndefined();
    expect(parseDifficultyParam('http://localhost/')).toBeUndefined();
  });

  it('maps to the AI decision interval the tiers promise', () => {
    expect(decisionIntervalTicks('easy')).toBe(60);
    expect(decisionIntervalTicks('standard')).toBe(30);
    expect(decisionIntervalTicks('hard')).toBe(15);
  });
});

describe('the match-option parameters', () => {
  it('parse their presets and refuse the rest', () => {
    expect(parseResourcesParam('http://x/?resources=medium')).toBe('medium');
    expect(parseResourcesParam('http://x/?resources=infinite')).toBeUndefined();
    expect(parseVictoryParam('http://x/?victory=conquest-only')).toBe('conquest-only');
    expect(parseVictoryParam('http://x/?victory=regicide')).toBeUndefined();
    expect(parseSpeedParam('http://x/?speed=fast')).toBe(2);
    expect(parseSpeedParam('http://x/?speed=normal')).toBe(1.5);
    expect(parseSpeedParam('http://x/')).toBe(1);
    expect(parseSpeedParam('http://x/?speed=ludicrous')).toBe(1);
  });
});

describe('the options inside a real match', () => {
  it('seeds the resource preset for every seat the scenario does not pin', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const bridge = createSimulationBridge(undefined, { resourcePreset: 'high' });
    const resources = bridge.getEconomyState().playerResources;
    expect(resources[1]).toMatchObject({ food: 1000, wood: 1000, gold: 700, stone: 800 });
    expect(resources[2]).toMatchObject({ food: 1000, wood: 1000, gold: 700, stone: 800 });
  });

  it('conquest-only never opens a relic clock, and it survives a save', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const { relicCountdownsCodec } = await import('../../src/game/simulation/bridge/bridgeStateSerialize');
    const { asSchema2Blob, worldStateOf } = await import('./saveBlobTestUtils');
    // The relic-short fixture's clock opens on tick one and wins in ten —
    // unless the match is conquest-only, in which case it never opens at all.
    const bridge = createSimulationBridge('relic-short-countdown-fixture', {
      victory: 'conquest-only',
    });
    for (let step = 0; step < 60; step += 1) bridge.step(100);
    expect(bridge.getMatchState().outcome).toBe('running');
    const blob = asSchema2Blob(bridge.saveGame());
    expect(worldStateOf(blob)[relicCountdownsCodec.slot] ?? []).toEqual([]);

    // Reload the save: the setting persisted, so the clock stays shut.
    const reloaded = createSimulationBridge('relic-short-countdown-fixture', { savedGame: blob });
    for (let step = 0; step < 60; step += 1) reloaded.step(100);
    expect(reloaded.getMatchState().outcome).toBe('running');
  }, 60_000);
});

describe('the population cap option', () => {
  it('parses 25..500 and refuses the rest', async () => {
    const { parsePopCapParam } = await import('../../src/app/bootstrap/matchOptionParams');
    expect(parsePopCapParam('http://x/?popcap=100')).toBe(100);
    expect(parsePopCapParam('http://x/?popcap=500')).toBe(500);
    expect(parsePopCapParam('http://x/?popcap=10')).toBeUndefined();
    expect(parsePopCapParam('http://x/?popcap=lots')).toBeUndefined();
    expect(parsePopCapParam('http://x/')).toBeUndefined();
  });

  it('caps a match below 200 and survives a save', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const { asSchema2Blob } = await import('./saveBlobTestUtils');
    // The building-showcase fixture stands enough housing to clear 30 supply,
    // so a 30 cap binds while the default 200 would not.
    const bridge = createSimulationBridge('building-showcase-fixture', { populationCap: 30 });
    expect(bridge.getPopulationState(1).cap).toBe(30);
    const reloaded = createSimulationBridge('building-showcase-fixture', {
      savedGame: asSchema2Blob(bridge.saveGame()),
    });
    expect(reloaded.getPopulationState(1).cap).toBe(30);
  }, 60_000);
});
