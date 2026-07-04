// Conscription (v0.1.85): Imperial-Age Castle tech (150 food + 150 gold, 60 s)
// that makes units trained at the Barracks / Archery Range / Stable / Castle
// 25% faster (×0.75 train time). It rides the train-time seam added for the
// Aztecs creation-speed civ bonus (v0.1.84): a pure DERIVED multiplier read at
// the single production enqueue site, stacking with the civ multiplier.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { researchCost, researchTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import {
  CONSCRIPTION_TRAIN_TIME_MULTIPLIER,
  conscriptionTrainTimeMultiplier,
} from '../../src/game/simulation/productionTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const set = (...techs: ResearchableTechnologyType[]) => new Set(techs);

describe('Conscription — cost & research-time tables (technologies.csv)', () => {
  it('costs 150 food / 150 gold and takes 600 ticks (60 s × 10 TPS)', () => {
    expect(researchCost('conscription')).toEqual({ food: 150, gold: 150 });
    expect(researchTimeTicks('conscription')).toBe(600);
  });
});

describe('conscriptionTrainTimeMultiplier — the derived ×0.75 at military buildings', () => {
  it('speeds up units from the Barracks / Archery Range / Stable / Castle', () => {
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'barracks')).toBe(
      CONSCRIPTION_TRAIN_TIME_MULTIPLIER,
    );
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'archery-range')).toBe(0.75);
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'stable')).toBe(0.75);
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'castle')).toBe(0.75);
    expect(CONSCRIPTION_TRAIN_TIME_MULTIPLIER).toBe(0.75);
  });

  it('does NOT speed up other buildings (Town Center, Siege Workshop, Monastery, Dock)', () => {
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'town-center')).toBe(1);
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'siege-workshop')).toBe(1);
    expect(conscriptionTrainTimeMultiplier(set('conscription'), 'monastery')).toBe(1);
  });

  it('is 1 (no effect) when Conscription is not researched', () => {
    expect(conscriptionTrainTimeMultiplier(set(), 'barracks')).toBe(1);
    expect(conscriptionTrainTimeMultiplier(set('loom'), 'stable')).toBe(1);
  });
});

describe('Conscription — offer gating at the Castle (Imperial only)', () => {
  it('is researchable only at the Castle', () => {
    const bridge = createSimulationBridge('conscription-fixture');
    expect(bridge.selectEntityAtCell(4, 4)).toBe(true); // Town Center
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('conscription');

    expect(bridge.selectEntityAtCell(18, 4)).toBe(true); // Castle
    expect(bridge.getSelectionState().selectedEntityType).toBe('castle');
    expect(bridge.getSelectionState().researchOptions).toContain('conscription');
  });
});

describe('Conscription — live train-speed effect', () => {
  it('a Barracks trains a Militia in fewer ticks after Conscription is researched', () => {
    const ticksToMilitia = (research: boolean): number => {
      const bridge = createSimulationBridge('conscription-fixture');
      if (research) {
        expect(bridge.selectEntityAtCell(18, 4)).toBe(true); // Castle
        expect(bridge.queueResearch('conscription')).toBe(true);
        for (let i = 0; i < 620; i += 1) bridge.step(100); // finish the research
      }
      expect(bridge.selectEntityAtCell(4, 16)).toBe(true); // Barracks
      expect(bridge.getSelectionState().selectedEntityType).toBe('barracks');
      expect(bridge.queueTrainUnit('militia')).toBe(true);
      const before = bridge.getEconomyState().units.filter(
        (u) => u.owner === 1 && u.unitType === 'militia',
      ).length;
      let ticks = 0;
      const militiaCount = () =>
        bridge.getEconomyState().units.filter((u) => u.owner === 1 && u.unitType === 'militia').length;
      while (militiaCount() < before + 1 && ticks < 600) {
        bridge.step(100);
        ticks += 1;
      }
      expect(militiaCount()).toBe(before + 1);
      return ticks;
    };

    const baseline = ticksToMilitia(false);
    const conscripted = ticksToMilitia(true);
    expect(baseline).toBeGreaterThan(0);
    expect(conscripted).toBeLessThan(baseline);
  }, 60_000);
});
