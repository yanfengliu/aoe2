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

// Boots a fixture, injects a convert task (monk → the enemy trade cart) via the
// save/mutate/reload path, runs the loop, and reports whether the villager was
// converted to player 1. (The target is a trade cart — it stands still.)
function convertsEnemyIn(seed: string, steps: number): boolean {
  const boot = createSimulationBridge(seed);
  const monk = findUnit(boot, 1, 'monk')!;
  const villager = (findUnit(boot, 2, 'trade-cart') ?? findUnit(boot, 2, 'villager'))!;
  const blob = asSchema2Blob(boot.saveGame());
  worldStateOf(blob)[monkTasksCodec.slot] = [
    [monk.id, { kind: 'convert', targetEntityRef: { id: villager.id, generation: 0 } }],
  ];
  const bridge = createSimulationBridge(seed, { savedGame: blob });
  for (let i = 0; i < steps; i += 1) bridge.step(100);
  return bridge.getEconomyState().units.find((u) => u.id === villager.id)?.owner === 1;
}

function convertsEnemy(seed: string): boolean {
  // 120 ticks comfortably covers the 50-progress-per-tick conversion threshold.
  return convertsEnemyIn(seed, 120);
}

describe('monasteryTechEffects — derived monk conversion range bonus (pure)', () => {
  it('is 0 without Block Printing and +3 with it', () => {
    expect(monkConvertRangeBonus(new Set())).toBe(0);
    expect(monkConvertRangeBonus(new Set(['block-printing']))).toBe(3); // technologies.csv: +3
  });
});

describe('monasteryTechOptions — gating at the Monastery', () => {
  it('offers nothing before Castle Age', () => {
    expect(optionsFor('feudal-age')).toEqual([]);
    expect(optionsFor('dark-age')).toEqual([]);
  });
  it('offers the Castle techs in Castle Age and the Imperial four only in Imperial, dropping each once researched', () => {
    // Block Printing moved to the Imperial gate in v0.3.91 (technologies.csv:
    // Imperial, 200g, +3 range) — Castle Age no longer offers it.
    expect(optionsFor('castle-age')).toEqual([
      'sanctity',
      'herbal-medicine',
      'heresy',
      'redemption',
      'atonement',
      'fervor',
    ]);
    expect(optionsFor('castle-age', ['sanctity'])).toEqual([
      'herbal-medicine',
      'heresy',
      'redemption',
      'atonement',
      'fervor',
    ]);
    // Block Printing, Faith, Illumination and Theocracy are the Imperial-gated
    // four; Herbal Medicine (v0.1.70) and Heresy (v0.1.71) are Castle techs
    // that stay offered through Imperial until researched.
    expect(
      optionsFor('imperial-age', [
        'sanctity', 'herbal-medicine', 'heresy',
        'redemption', 'atonement', 'fervor',
      ]),
    ).toEqual(['block-printing', 'faith', 'illumination', 'theocracy']);
    expect(
      optionsFor('imperial-age', [
        'block-printing',
        'sanctity',
        'herbal-medicine',
        'heresy',
        'redemption',
        'atonement',
        'fervor',
        'faith',
        'illumination',
        'theocracy',
      ]),
    ).toEqual([]);
  });
  it('offers nothing for a non-Monastery building', () => {
    const have = new Set<ResearchableTechnologyType>();
    expect(monasteryTechResearchOptions('town-center', 1, () => true, (_o, t) => have.has(t))).toEqual([]);
  });
});

describe('Monastery techs — cost / time / hosting', () => {
  it('Block Printing costs 200g / 550 ticks; Sanctity 120g / 600 ticks; both at the Monastery', () => {
    // technologies.csv:69 — Imperial, 200 gold, 55 s.
    expect(researchCost('block-printing')).toEqual({ gold: 200 });
    expect(researchTimeTicks('block-printing')).toBe(550);
    expect(researchCost('sanctity')).toEqual({ gold: 120 });
    expect(researchTimeTicks('sanctity')).toBe(600);
    expect(researchCost('faith')).toEqual({ food: 750, gold: 1000 });
    expect(canResearchAt('monastery', 'block-printing')).toBe(true);
    expect(canResearchAt('monastery', 'sanctity')).toBe(true);
    expect(canResearchAt('monastery', 'faith')).toBe(true);
    expect(canResearchAt('town-center', 'sanctity')).toBe(false);
  });
});

describe('Faith — conversion resistance (halves incoming convert progress)', () => {
  it('a baseline enemy converts within a 70-tick window but a Faith-defended one does NOT', () => {
    // Base convert progress is 1/tick (flips at 50), so a baseline villager
    // flips before tick 70; Faith halves it to 0.5/tick (needs ~100 ticks), so
    // the defended villager is NOT yet converted at tick 70.
    expect(convertsEnemyIn('monk-faith-baseline-fixture', 70)).toBe(true);
    expect(convertsEnemyIn('monk-faith-defended-fixture', 70)).toBe(false);
  }, 30_000);

  it('Faith SLOWS but does not prevent conversion — the defended enemy still flips given enough time', () => {
    expect(convertsEnemyIn('monk-faith-defended-fixture', 150)).toBe(true);
  }, 30_000);
});

describe('Sanctity — +15 monk HP (create path)', () => {
  it('a monk built with Sanctity researched has 15 more max HP than the baseline monk', () => {
    const base = createSimulationBridge('monk-sanctity-baseline-fixture');
    const holy = createSimulationBridge('monk-sanctity-fixture');
    const baseMonk = findUnit(base, 1, 'monk')!;
    const holyMonk = findUnit(holy, 1, 'monk')!;
    const baseHp = base.getEntityHealth(baseMonk.id)!;
    const holyHp = holy.getEntityHealth(holyMonk.id)!;
    expect(holyHp.maxHp).toBe(baseHp.maxHp + 15);
    // A freshly-built monk is at full HP, so current also gains the bump.
    expect(holyHp.currentHp).toBe(baseHp.currentHp + 15);
  });
});

describe('Monk conversion range — AoE2-faithful base 9, Block Printing +3', () => {
  it('a boxed monk converts an enemy at distance 9 with NO tech (base range 9)', () => {
    expect(convertsEnemy('monk-base-convert-range-fixture')).toBe(true);
  });

  it('a boxed monk cannot convert an enemy at distance 10 without Block Printing', () => {
    // Base conversion range 9 < distance 10, and the monk is boxed so it
    // cannot move closer → the enemy is never converted.
    expect(convertsEnemy('monk-block-printing-baseline-fixture')).toBe(false);
  });

  it('the SAME boxed monk converts the distance-10 enemy WITH Block Printing (range 12)', () => {
    expect(convertsEnemy('monk-block-printing-fixture')).toBe(true);
  });
}, 45_000);
