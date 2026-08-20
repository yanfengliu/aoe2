import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import { monasteryTechResearchOptions } from '../../src/game/simulation/monasteryTechOptions';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import { monkMayConvert } from '../../src/game/simulation/monasteryTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const none = new Set<ResearchableTechnologyType>();
const withTech = (...techs: ResearchableTechnologyType[]) =>
  new Set<ResearchableTechnologyType>(techs);

describe('the Castle-Age Monastery tier', () => {
  it('offers all of it once a Monastery stands in the Castle Age', () => {
    const options = monasteryTechResearchOptions('monastery', 1, () => true, () => false);
    expect(options).toEqual(expect.arrayContaining(['redemption', 'atonement', 'fervor']));
  });

  it('drops each one from the list once it is researched', () => {
    for (const tech of ['redemption', 'atonement', 'fervor'] as const) {
      const options = monasteryTechResearchOptions(
        'monastery', 1, () => true, (_owner, candidate) => candidate === tech,
      );
      expect(options).not.toContain(tech);
    }
  });

  it('costs what technologies.csv says', () => {
    expect(RESEARCH_COSTS.redemption).toEqual({ gold: 475 });
    expect(RESEARCH_COSTS.atonement).toEqual({ gold: 325 });
    expect(RESEARCH_COSTS.fervor).toEqual({ gold: 140 });
    for (const tech of ['redemption', 'atonement', 'fervor'] as const) {
      expect(RESEARCH_TIME_TICKS[tech]).toBeGreaterThan(0);
    }
  });
});

describe('Fervor', () => {
  // technologies.csv: "Monks have +15% speed".
  it('makes a monk faster and leaves everyone else alone', () => {
    const base = movementSpeedPercent(none, 'monk');
    expect(movementSpeedPercent(withTech('fervor'), 'monk')).toBeGreaterThan(base);
    for (const other of ['villager', 'knight', 'militia'] as const) {
      expect(movementSpeedPercent(withTech('fervor'), other))
        .toBe(movementSpeedPercent(none, other));
    }
  });
});

describe('what a monk is allowed to convert', () => {
  // Without Atonement a monk cannot convert another monk, and without
  // Redemption it cannot convert a building or a siege engine. Ordinary enemy
  // units need neither.
  it('takes an ordinary enemy unit with no technology at all', () => {
    expect(monkMayConvert({ kind: 'unit', unitType: 'militia' }, none)).toBe(true);
    expect(monkMayConvert({ kind: 'unit', unitType: 'knight' }, none)).toBe(true);
  });

  it('needs Atonement for an enemy monk', () => {
    expect(monkMayConvert({ kind: 'unit', unitType: 'monk' }, none)).toBe(false);
    expect(monkMayConvert({ kind: 'unit', unitType: 'monk' }, withTech('atonement'))).toBe(true);
  });

  it('needs Redemption for a siege engine', () => {
    for (const siege of ['battering-ram', 'mangonel', 'scorpion'] as const) {
      expect(monkMayConvert({ kind: 'unit', unitType: siege }, none)).toBe(false);
      expect(monkMayConvert({ kind: 'unit', unitType: siege }, withTech('redemption'))).toBe(true);
    }
  });

  it('needs Redemption for a building', () => {
    expect(monkMayConvert({ kind: 'building', buildingType: 'barracks' }, none)).toBe(false);
    expect(monkMayConvert({ kind: 'building', buildingType: 'barracks' }, withTech('redemption')))
      .toBe(true);
  });

  it('never takes the buildings AoE2 puts out of reach, even with Redemption', () => {
    // A Town Center, Castle, Wonder, or a wall line cannot be converted at all.
    const redeemed = withTech('redemption');
    for (const buildingType of
      ['town-center', 'castle', 'wonder', 'stone-wall', 'palisade-wall',
        'stone-gate', 'palisade-gate', 'farm'] as const) {
      expect(monkMayConvert({ kind: 'building', buildingType }, redeemed),
        `${buildingType} must never be convertible`).toBe(false);
    }
  });
});

describe('a monk sent at an enemy monk', () => {
  // Converting another monk is the specific thing Atonement buys, and the rule
  // has to hold where conversion actually happens, not only in the table above.
  // Both fixtures place a monk of player 1 beside a monk of player 2; they
  // differ only in whether player 1 has researched Atonement.
  function convertsWithin(seed: string, ticks: number): boolean {
    const bridge = createSimulationBridge(seed);
    const converter = bridge.getEconomyState().units
      .find((u) => u.owner === 1 && u.unitType === 'monk');
    const target = bridge.getEconomyState().units
      .find((u) => u.owner === 2 && u.unitType === 'monk');
    if (!converter || !target) throw new Error(`${seed} needs a monk on each side`);

    const blob = asSchema2Blob(bridge.saveGame());
    worldStateOf(blob)[monkTasksCodec.slot] = [
      [converter.id, { kind: 'convert', targetEntityRef: { id: target.id, generation: 0 } }],
    ];
    const running = createSimulationBridge(seed, { savedGame: blob });
    for (let tick = 0; tick < ticks; tick += 1) running.step(100);

    const after = running.getEconomyState().units.find((u) => u.id === target.id);
    // Converted means it now belongs to the converter — or died, if the target
    // had Heresy, which these fixtures do not.
    return after?.owner === 1;
  }

  it('cannot take it without Atonement', () => {
    expect(convertsWithin('monk-convert-monk-fixture', 200),
      'a monk converted an enemy monk with no Atonement').toBe(false);
  });

  it('takes it with Atonement', () => {
    expect(convertsWithin('monk-convert-monk-atonement-fixture', 200),
      'Atonement did not let a monk convert an enemy monk').toBe(true);
  });
});
