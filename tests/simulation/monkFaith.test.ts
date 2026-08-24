import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  monkFaithCodec,
  monkTasksCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  MONK_FAITH_MAX,
  MONK_FAITH_RECHARGE_TICKS,
} from '../../src/game/simulation/bridge/bridgeConstants';
import {
  ILLUMINATION_FAITH_REGEN_MULTIPLIER,
  monkFaithRegenPerTick,
  monkGroupRestsOnConversion,
} from '../../src/game/simulation/monasteryTechEffects';
import { monasteryTechResearchOptions } from '../../src/game/simulation/monasteryTechOptions';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

const SEED = 'monk-faith-rest-fixture';

// A monk that has just converted somebody is SPENT. In AoE2 its faith empties
// and it cannot convert again until the faith is back — which is the only
// reason massed monks are not an answer to everything, and the mechanic both
// remaining Monastery technologies are about (Illumination speeds the recovery,
// Theocracy makes a group pay for one conversion once).

function unitsOf(bridge: Bridge, owner: number, unitType: string) {
  return bridge.getEconomyState().units.filter(
    (unit) => unit.owner === owner && unit.unitType === unitType,
  );
}

interface RestRunOptions {
  /** Monk index (0 or 1) that converts the first villager. */
  readonly converter?: number;
  /** Extra monks tasked onto the SAME first villager — the "group". */
  readonly groupWith?: readonly number[];
  /** Technologies researched by the monks' owner. */
  readonly researched?: readonly ResearchableTechnologyType[];
  /** Ticks to wait after the first conversion before trying the second. */
  readonly restTicks: number;
  /** Which monk attempts the second conversion. */
  readonly secondMonk?: number;
}

/**
 * Convert one villager, wait, then point a monk at a second villager and report
 * whether that second conversion lands. Everything is seeded through the save
 * blob — the tasks, and the owner's researched set — so one fixture covers
 * every combination.
 */
function secondConversionLands(options: RestRunOptions): boolean {
  const {
    converter = 0, groupWith = [], researched = [], restTicks, secondMonk = converter,
  } = options;
  const boot = createSimulationBridge(SEED);
  const monks = unitsOf(boot, 1, 'monk');
  const villagers = unitsOf(boot, 2, 'villager');
  expect(monks.length).toBeGreaterThanOrEqual(2);
  expect(villagers.length).toBeGreaterThanOrEqual(2);

  const blob = asSchema2Blob(boot.saveGame());
  const first = villagers[0]!;
  worldStateOf(blob)[monkTasksCodec.slot] = [
    [monks[converter]!.id, { kind: 'convert', targetEntityRef: { id: first.id, generation: 0 } }],
    ...groupWith.map((index) => [
      monks[index]!.id,
      { kind: 'convert', targetEntityRef: { id: first.id, generation: 0 } },
    ]),
  ];
  if (researched.length > 0) {
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[1, [...researched]]];
  }

  const bridge = createSimulationBridge(SEED, { savedGame: blob });
  // 120 ticks comfortably covers the 50-progress conversion threshold.
  for (let i = 0; i < 120; i += 1) bridge.step(100);
  expect(bridge.getEconomyState().units.find((u) => u.id === first.id)?.owner).toBe(1);

  for (let i = 0; i < restTicks; i += 1) bridge.step(100);

  const second = villagers[1]!;
  const blob2 = asSchema2Blob(bridge.saveGame());
  worldStateOf(blob2)[monkTasksCodec.slot] = [
    [monks[secondMonk]!.id, { kind: 'convert', targetEntityRef: { id: second.id, generation: 0 } }],
  ];
  const after = createSimulationBridge(SEED, { savedGame: blob2 });
  for (let i = 0; i < 120; i += 1) after.step(100);
  return after.getEconomyState().units.find((u) => u.id === second.id)?.owner === 1;
}

describe('monk faith — a monk that converted must rest', () => {
  it('cannot convert again immediately after a conversion', () => {
    expect(secondConversionLands({ restTicks: 0 })).toBe(false);
  });

  it('can convert again once its faith is back', () => {
    expect(secondConversionLands({ restTicks: MONK_FAITH_RECHARGE_TICKS })).toBe(true);
  });

  it('is still resting most of the way through the recharge', () => {
    expect(secondConversionLands({ restTicks: Math.floor(MONK_FAITH_RECHARGE_TICKS * 0.5) }))
      .toBe(false);
  });
});

describe('Illumination — faith comes back 50% faster', () => {
  it('is a 1.5x regen multiplier, applied per tick', () => {
    expect(ILLUMINATION_FAITH_REGEN_MULTIPLIER).toBe(1.5);
    const base = monkFaithRegenPerTick(new Set());
    expect(base).toBeCloseTo(MONK_FAITH_MAX / MONK_FAITH_RECHARGE_TICKS, 10);
    expect(monkFaithRegenPerTick(new Set(['illumination']))).toBeCloseTo(base * 1.5, 10);
  });

  it('makes a monk ready at a point where an un-teched monk is still resting', () => {
    // Two thirds of the recharge is exactly enough WITH Illumination.
    const ticks = Math.ceil(MONK_FAITH_RECHARGE_TICKS / 1.5) + 2;
    expect(secondConversionLands({ restTicks: ticks })).toBe(false);
    expect(secondConversionLands({ restTicks: ticks, researched: ['illumination'] })).toBe(true);
  });
});

describe('Theocracy — only one monk in a group rests', () => {
  it('is what decides whether the whole group pays', () => {
    expect(monkGroupRestsOnConversion(new Set())).toBe(true);
    expect(monkGroupRestsOnConversion(new Set(['theocracy']))).toBe(false);
  });

  it('rests every monk that was converting the same target without it', () => {
    // Monk 0 converts, monk 1 was also tasked on that villager: both spent.
    expect(secondConversionLands({
      converter: 0, groupWith: [1], restTicks: 0, secondMonk: 1,
    })).toBe(false);
  });

  it('leaves the other monk of the group ready with it', () => {
    expect(secondConversionLands({
      converter: 0, groupWith: [1], restTicks: 0, secondMonk: 1, researched: ['theocracy'],
    })).toBe(true);
  });

  it('still spends the converting monk, even with Theocracy', () => {
    expect(secondConversionLands({
      converter: 0, groupWith: [1], restTicks: 0, secondMonk: 0, researched: ['theocracy'],
    })).toBe(false);
  });
});

describe('monk faith — state and persistence', () => {
  it('holds no entry for a monk at full faith, so an old save loads as rested', () => {
    const bridge = createSimulationBridge(SEED);
    for (let i = 0; i < 5; i += 1) bridge.step(100);
    const blob = asSchema2Blob(bridge.saveGame());
    const faith = worldStateOf(blob)[monkFaithCodec.slot] as unknown[] | undefined;
    expect(faith ?? []).toEqual([]);
  });

  it('survives a save/load round trip mid-rest', () => {
    const boot = createSimulationBridge(SEED);
    const monks = unitsOf(boot, 1, 'monk');
    const villagers = unitsOf(boot, 2, 'villager');
    const blob = asSchema2Blob(boot.saveGame());
    worldStateOf(blob)[monkTasksCodec.slot] = [
      [monks[0]!.id, {
        kind: 'convert',
        targetEntityRef: { id: villagers[0]!.id, generation: 0 },
      }],
    ];
    const bridge = createSimulationBridge(SEED, { savedGame: blob });
    for (let i = 0; i < 120; i += 1) bridge.step(100);

    const midRest = asSchema2Blob(bridge.saveGame());
    const stored = worldStateOf(midRest)[monkFaithCodec.slot] as Array<[number, number]>;
    expect(stored).toHaveLength(1);
    expect(stored[0]![0]).toBe(monks[0]!.id);
    expect(stored[0]![1]).toBeLessThan(MONK_FAITH_MAX);

    // Reloading keeps the rest going rather than restoring a full-faith monk.
    const reloaded = createSimulationBridge(SEED, { savedGame: midRest });
    const afterLoad = asSchema2Blob(reloaded.saveGame());
    const reloadedFaith = worldStateOf(afterLoad)[monkFaithCodec.slot] as Array<[number, number]>;
    expect(reloadedFaith).toHaveLength(1);
    expect(reloadedFaith[0]![1]).toBeCloseTo(stored[0]![1], 6);
  });
});

describe('the two technologies at the Monastery', () => {
  function optionsFor(age: AgeType, researched: ResearchableTechnologyType[] = []) {
    const have = new Set(researched);
    return monasteryTechResearchOptions(
      'monastery',
      1,
      (_o, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
      (_o, tech) => have.has(tech),
    );
  }

  it('offers neither before the Imperial Age', () => {
    expect(optionsFor('castle-age')).not.toContain('illumination');
    expect(optionsFor('castle-age')).not.toContain('theocracy');
  });

  it('offers both in the Imperial Age and drops each once researched', () => {
    expect(optionsFor('imperial-age')).toContain('illumination');
    expect(optionsFor('imperial-age')).toContain('theocracy');
    expect(optionsFor('imperial-age', ['illumination'])).not.toContain('illumination');
    expect(optionsFor('imperial-age', ['theocracy'])).not.toContain('theocracy');
  });

  it('costs what technologies.csv says', () => {
    expect(researchCost('illumination')).toEqual({ gold: 120 });
    expect(researchTimeTicks('illumination')).toBe(650); // 65 s x 10 TPS.
    expect(researchCost('theocracy')).toEqual({ gold: 200 });
    expect(researchTimeTicks('theocracy')).toBe(750); // 75 s x 10 TPS.
  });
});

describe('a resting monk says so on the selection panel', () => {
  it('reads Resting even while holding a convert task, and Converting for a monk that is working', () => {
    const boot = createSimulationBridge(SEED);
    const monks = unitsOf(boot, 1, 'monk');
    const villagers = unitsOf(boot, 2, 'villager');
    const blob = asSchema2Blob(boot.saveGame());
    worldStateOf(blob)[monkTasksCodec.slot] = [
      [monks[0]!.id, {
        kind: 'convert',
        targetEntityRef: { id: villagers[0]!.id, generation: 0 },
      }],
    ];
    const first = createSimulationBridge(SEED, { savedGame: blob });
    for (let i = 0; i < 120; i += 1) first.step(100);

    // Re-task BOTH monks: the spent one onto a third villager, the untouched
    // one onto the second. Twenty ticks is well short of the 50 progress a
    // conversion needs, so the fresh monk is still mid-convert.
    const blob2 = asSchema2Blob(first.saveGame());
    worldStateOf(blob2)[monkTasksCodec.slot] = [
      [monks[0]!.id, {
        kind: 'convert',
        targetEntityRef: { id: villagers[2]!.id, generation: 0 },
      }],
      [monks[1]!.id, {
        kind: 'convert',
        targetEntityRef: { id: villagers[1]!.id, generation: 0 },
      }],
    ];
    const bridge = createSimulationBridge(SEED, { savedGame: blob2 });
    for (let i = 0; i < 20; i += 1) bridge.step(100);

    const spent = bridge.getEconomyState().units.find((u) => u.id === monks[0]!.id)!;
    expect(bridge.selectEntityAtCell(spent.x, spent.y)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('monk');
    // Holding a convert task it cannot act on, so the honest readout is the
    // rest — not "Converting" while nothing happens.
    expect(bridge.getSelectionState().activity?.verb).toBe('resting');

    const working = bridge.getEconomyState().units.find((u) => u.id === monks[1]!.id)!;
    expect(bridge.selectEntityAtCell(working.x, working.y)).toBe(true);
    expect(bridge.getSelectionState().activity?.verb).toBe('converting');
  });
});
