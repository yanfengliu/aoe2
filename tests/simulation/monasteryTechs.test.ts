import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { monkConvertRangeBonus } from '../../src/game/simulation/monasteryTechEffects';
import { monasteryTechResearchOptions } from '../../src/game/simulation/monasteryTechOptions';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

// Block Printing (v0.1.58): a DERIVED Monastery tech that adds +2 to monk
// conversion range, recomputed from the owner's researched set at the monk
// action site (monasteryTechEffects). Deterministic — no probability roll.

function findUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge.getEconomyState().units.find((u) => u.owner === owner && u.unitType === unitType);
}

function optionsFor(age: AgeType, researched: ResearchableTechnologyType[] = []) {
  const have = new Set(researched);
  return monasteryTechResearchOptions(
    'monastery',
    1,
    (_o, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    (_o, tech) => have.has(tech),
  );
}

// Boots a fixture, injects a convert task (monk → the enemy villager) via the
// save/mutate/reload path, runs the loop, and reports whether the villager was
// converted to player 1.
function convertsEnemy(seed: string): boolean {
  const boot = createSimulationBridge(seed);
  const monk = findUnit(boot, 1, 'monk')!;
  const villager = findUnit(boot, 2, 'villager')!;
  const blob = asSchema2Blob(boot.saveGame());
  worldStateOf(blob)[monkTasksCodec.slot] = [
    [monk.id, { kind: 'convert', targetEntityRef: { id: villager.id, generation: 0 } }],
  ];
  const bridge = createSimulationBridge(seed, { savedGame: blob });
  // 120 ticks comfortably covers the 50-progress-per-tick conversion threshold.
  for (let i = 0; i < 120; i += 1) bridge.step(100);
  return bridge.getEconomyState().units.find((u) => u.id === villager.id)?.owner === 1;
}

describe('monasteryTechEffects — derived monk conversion range bonus (pure)', () => {
  it('is 0 without Block Printing and +2 with it', () => {
    expect(monkConvertRangeBonus(new Set())).toBe(0);
    expect(monkConvertRangeBonus(new Set(['block-printing']))).toBe(2);
  });
});

describe('monasteryTechOptions — gating at the Monastery', () => {
  it('offers nothing before Castle Age', () => {
    expect(optionsFor('feudal-age')).toEqual([]);
    expect(optionsFor('dark-age')).toEqual([]);
  });
  it('offers Block Printing in Castle Age, and drops it once researched', () => {
    expect(optionsFor('castle-age')).toEqual(['block-printing']);
    expect(optionsFor('imperial-age', ['block-printing'])).toEqual([]);
  });
  it('offers nothing for a non-Monastery building', () => {
    const have = new Set<ResearchableTechnologyType>();
    expect(monasteryTechResearchOptions('town-center', 1, () => true, (_o, t) => have.has(t))).toEqual([]);
  });
});

describe('Block Printing — cost / time / hosting', () => {
  it('costs 100 food / 130 gold and takes 550 ticks, hosted at the Monastery', () => {
    expect(researchCost('block-printing')).toEqual({ food: 100, gold: 130 });
    expect(researchTimeTicks('block-printing')).toBe(550);
    expect(canResearchAt('monastery', 'block-printing')).toBe(true);
    expect(canResearchAt('town-center', 'block-printing')).toBe(false);
  });
});

describe('Block Printing — live monk conversion range', () => {
  it('a boxed monk cannot convert an enemy at distance 5 without Block Printing', () => {
    // Base action range 4 < distance 5, and the monk is boxed so it cannot
    // move closer → the enemy is never converted.
    expect(convertsEnemy('monk-block-printing-baseline-fixture')).toBe(false);
  });

  it('the SAME boxed monk converts the distance-5 enemy WITH Block Printing (range 6)', () => {
    expect(convertsEnemy('monk-block-printing-fixture')).toBe(true);
  });
}, 30_000);
