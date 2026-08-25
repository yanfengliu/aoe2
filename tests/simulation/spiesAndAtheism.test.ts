import { describe, expect, it } from 'vitest';

import {
  SPIES_GOLD_PER_ENEMY_VILLAGER,
  spiesCost,
} from '../../src/game/simulation/spiesRules';
import {
  ATHEISM_COUNTDOWN_EXTENSION_TICKS,
  DEFERRED_UNIQUE_TECHNOLOGIES,
  uniqueTechnology,
} from '../../src/game/simulation/uniqueTechnologies';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  playerCivilizationsCodec,
  relicCountdownsCodec,
  researchedTechnologiesCodec,
  wonderCountdownsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { researchCost, researchTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';

// The last two technology rows of technologies.csv. Spies buys every enemy's
// line of sight, priced per enemy villager; Atheism (Huns) adds 100 years to
// every Wonder and Relic victory countdown and halves what Spies costs. With
// both, all 140 rows of the dataset are in the game.

describe('Spies — the price of seeing everything', () => {
  it('costs 200 gold per living enemy villager, and Atheism halves it', () => {
    expect(SPIES_GOLD_PER_ENEMY_VILLAGER).toBe(200);
    expect(spiesCost(8, false)).toEqual({ gold: 1600 });
    expect(spiesCost(8, true)).toEqual({ gold: 800 });
    // Never free: an enemy with no villagers still costs the base note.
    expect(spiesCost(0, false)).toEqual({ gold: 200 });
    expect(spiesCost(0, true)).toEqual({ gold: 100 });
  });

  it('is a Castle technology in the Imperial Age', () => {
    expect(canResearchAt('castle', 'spies')).toBe(true);
    // The static table carries the floor; the real charge is dynamic.
    expect(researchCost('spies')).toEqual({ gold: 200 });
    expect(researchTimeTicks('spies')).toBe(10);
  });

  it('reveals every other player once researched, allies and enemies alike', () => {
    const boot = createSimulationBridge('ai-versus-ai-fixture');
    const blob = asSchema2Blob(boot.saveGame());
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[1, ['spies']]];
    const bridge = createSimulationBridge('ai-versus-ai-fixture', { savedGame: blob });
    // Both players exist; player 1 sees player 2's vision without any team.
    expect(bridge.getSharedVisionOwners(1)).toContain(2);
    // The other player researched nothing and sees nothing extra.
    expect(bridge.getSharedVisionOwners(2)).toEqual([]);
  });

  it('charges the dynamic price at the Castle, not the table price', () => {
    // vikings-regeneration fixture: player 1 has a Castle and gold 2000;
    // player 2 has villagers (the standard opening spawns three).
    const bridge = createSimulationBridge('vikings-regeneration-fixture');
    const enemyVillagers = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType === 'villager',
    ).length;
    expect(enemyVillagers).toBeGreaterThan(0);

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    const goldBefore = bridge.getEconomyState().playerResources[1]!.gold;
    expect(bridge.queueResearch('spies')).toBe(true);
    for (let step = 0; step < 3; step += 1) bridge.step(100);
    const charged = goldBefore - bridge.getEconomyState().playerResources[1]!.gold;
    expect(charged).toBe(enemyVillagers * SPIES_GOLD_PER_ENEMY_VILLAGER);
  });
});

describe('Atheism — the Huns unique technology', () => {
  it('is priced from the CSV, extends countdowns, and nothing is deferred any more', () => {
    const technology = uniqueTechnology('atheism');
    expect(technology?.civilization).toBe('Huns');
    expect(researchCost('atheism')).toEqual({ food: 500, gold: 500 });
    expect(researchTimeTicks('atheism')).toBe(600);
    expect(canResearchAt('castle', 'atheism')).toBe(true);
    // +100 years at 10 ticks a year (the 2000-tick countdown is 200 years).
    expect(ATHEISM_COUNTDOWN_EXTENSION_TICKS).toBe(1000);
    expect(technology?.countdownExtensionTicks).toBe(1000);
    expect([...DEFERRED_UNIQUE_TECHNOLOGIES]).toEqual([]);
  });

  it('adds 100 years to a Wonder countdown already running when researched', () => {
    // A countdown mid-flight, and a Huns player researching Atheism at a real
    // Castle: on completion the countdown is 1000 ticks longer than the pure
    // ticking of the research time would leave it.
    const boot = createSimulationBridge('vikings-regeneration-fixture');
    // Keyed by a REAL building id — the load path prunes countdowns whose
    // entity no longer exists, so an invented key would silently vanish.
    const castleId = boot.getEconomyState().buildings.find(
      (building) => building.buildingType === 'castle',
    )!.id;
    const blob = asSchema2Blob(boot.saveGame());
    worldStateOf(blob)[wonderCountdownsCodec.slot] = [[castleId, {
      remainingTicks: 5000, totalTicks: 5000, lastCompletedTick: null,
    }]];
    // The civ override only reaches a FRESH scenario, so on the load path the
    // civilization is seeded in the blob itself.
    worldStateOf(blob)[playerCivilizationsCodec.slot] = [[1, 'Huns'], [2, 'Franks']];
    const bridge = createSimulationBridge('vikings-regeneration-fixture', { savedGame: blob });
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueResearch('atheism')).toBe(true);
    const readCountdown = () => {
      const state = asSchema2Blob(bridge.saveGame());
      return (worldStateOf(state)[wonderCountdownsCodec.slot] as Array<[number, {
        remainingTicks: number; totalTicks: number;
      }]>).find(([id]) => id === castleId)![1];
    };
    // 700 steps cover the 600-tick research with margin; the countdown ticks
    // down 1 per step but gains 1000 on completion, so it ends HIGHER only if
    // the extension landed.
    const before = readCountdown().remainingTicks;
    for (let step = 0; step < 700; step += 1) bridge.step(100);
    const after = readCountdown();
    expect(after.totalTicks).toBe(6000);
    expect(after.remainingTicks).toBe(before - 700 + 1000);
  }, 60_000);

  it('lengthens a countdown that STARTS while any owner has Atheism', () => {
    // The relic-short fixture's Monastery holds every relic, so its countdown
    // opens on the first tick — at 10 ticks by override, or 1010 when ANYBODY
    // in the match (here the other player) has researched Atheism. The
    // extension belongs to the match, not to the researcher: it delays every
    // victory clock, which is the whole point of the technology.
    const boot = createSimulationBridge('relic-short-countdown-fixture');
    const blob = asSchema2Blob(boot.saveGame());
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[2, ['atheism']]];
    const bridge = createSimulationBridge('relic-short-countdown-fixture', { savedGame: blob });
    for (let step = 0; step < 3; step += 1) bridge.step(100);
    const state = asSchema2Blob(bridge.saveGame());
    const entries = worldStateOf(state)[relicCountdownsCodec.slot] as Array<[number, {
      totalTicks: number;
    }]>;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]![1].totalTicks).toBe(10 + ATHEISM_COUNTDOWN_EXTENSION_TICKS);
  });
});
