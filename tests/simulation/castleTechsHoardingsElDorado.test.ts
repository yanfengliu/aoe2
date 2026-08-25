import { describe, expect, it } from 'vitest';

import { buildingHitPointMultiplier } from '../../src/game/simulation/buildingTechEffects';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import {
  DEFERRED_UNIQUE_TECHNOLOGIES,
  uniqueTechnologiesFor,
  uniqueTechnology,
} from '../../src/game/simulation/uniqueTechnologies';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

// Two Castle technologies from technologies.csv:
//   Hoardings (Imperial, 400 food + 400 gold, 75s) — "+21% HP", castles only.
//   El Dorado (Mayans, Imperial, 750 food + 450 gold, 50s) — "+40 Hit points",
//     which is the Eagle line. It was recorded as deferred because "Eagle
//     Warriors are not on the roster"; they shipped in v0.3.48, so the deferral
//     was stale rather than true — worth knowing that a deferral list ages.

describe('Hoardings — a castle with 21% more hit points', () => {
  const HOARDINGS: ReadonlySet<ResearchableTechnologyType> = new Set(['hoardings']);

  it('costs what technologies.csv says and is researched at the Castle', () => {
    expect(researchCost('hoardings')).toEqual({ food: 400, gold: 400 });
    expect(researchTimeTicks('hoardings')).toBe(750); // 75 s x 10 TPS.
    expect(canResearchAt('castle', 'hoardings')).toBe(true);
  });

  it('multiplies castle hit points by 1.21 and nothing else’s', () => {
    expect(buildingHitPointMultiplier(HOARDINGS, 'castle')).toBeCloseTo(1.21, 10);
    for (const buildingType of ['town-center', 'barracks', 'watch-tower', 'house'] as const) {
      expect(buildingHitPointMultiplier(HOARDINGS, buildingType)).toBe(1);
    }
  });

  it('stacks with Masonry and Architecture, which apply to everything', () => {
    const all: ReadonlySet<ResearchableTechnologyType> = new Set([
      'hoardings', 'masonry', 'architecture',
    ]);
    const general = buildingHitPointMultiplier(all, 'barracks');
    expect(buildingHitPointMultiplier(all, 'castle')).toBeCloseTo(general * 1.21, 10);
  });
});

describe('El Dorado — the Eagle line with 40 more hit points', () => {
  function maxHp(unitType: UnitType, researched: ReadonlySet<ResearchableTechnologyType>) {
    const factory = createCombatStateFactory({
      hasTechnology: (_owner, tech) => researched.has(tech),
      getCivilization: () => 'Mayans',
    getAge: () => 'imperial-age',
    });
    return factory(1, unitType).maxHp;
  }

  it('is a Mayan Imperial technology at the Castle, priced from the CSV', () => {
    const technology = uniqueTechnology('el-dorado');
    expect(technology?.civilization).toBe('Mayans');
    expect(technology?.age).toBe('imperial-age');
    expect(researchCost('el-dorado')).toEqual({ food: 750, gold: 450 });
    expect(researchTimeTicks('el-dorado')).toBe(500); // 50 s x 10 TPS.
    expect(canResearchAt('castle', 'el-dorado')).toBe(true);
    expect(uniqueTechnologiesFor('Mayans').map((t) => t.id)).toContain('el-dorado');
  });

  it('adds 40 hit points to both tiers of the Eagle line', () => {
    const none: ReadonlySet<ResearchableTechnologyType> = new Set();
    const withIt: ReadonlySet<ResearchableTechnologyType> = new Set(['el-dorado']);
    for (const unitType of ['eagle-warrior', 'elite-eagle-warrior'] as const) {
      expect(maxHp(unitType, withIt) - maxHp(unitType, none)).toBe(40);
    }
  });

  it('leaves every other unit alone', () => {
    const none: ReadonlySet<ResearchableTechnologyType> = new Set();
    const withIt: ReadonlySet<ResearchableTechnologyType> = new Set(['el-dorado']);
    for (const unitType of ['militia', 'archer', 'knight', 'villager', 'monk'] as const) {
      expect(maxHp(unitType, withIt)).toBe(maxHp(unitType, none));
    }
  });

  it('is no longer on the deferred list', () => {
    expect([...DEFERRED_UNIQUE_TECHNOLOGIES]).not.toContain('el-dorado');
  });
});

// Both proved the way a player gets them: select a real Castle, research from
// the card, and read the result off the world — not from a table lookup.
describe('researched at a real Castle', () => {
  it('offers Hoardings at an Imperial Castle and toughens the castle', () => {
    const bridge = createSimulationBridge('imperial-castle-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    // Read the health off the SELECTION PANEL, which is where a player sees it.
    const before = bridge.getSelectionState().health!;
    expect(before.max).toBeGreaterThan(0);
    expect(bridge.getSelectionState().researchOptions).toContain('hoardings');
    expect(bridge.queueResearch('hoardings')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'castle');
        return !bridge.getSelectionState().researchOptions.includes('hoardings');
      },
      { maxSteps: 1_500 },
    )).toBe(true);

    selectOwnedBuildingDirect(bridge, 1, 'castle');
    const after = bridge.getSelectionState().health!;
    // technologies.csv: "+21% HP", applied to the castle already standing.
    expect(after.max).toBe(Math.round(before.max * 1.21));
  }, 60_000);

  it('offers El Dorado to a Mayan Castle and toughens its Eagles', () => {
    const bridge = createSimulationBridge('imperial-castle-fixture', {
      civilizationsByOwner: new Map([[1, 'Mayans']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('el-dorado');
    expect(bridge.queueResearch('el-dorado')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'castle');
        return !bridge.getSelectionState().researchOptions.includes('el-dorado');
      },
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 60_000);

  it('offers El Dorado to nobody else', () => {
    const bridge = createSimulationBridge('imperial-castle-fixture', {
      civilizationsByOwner: new Map([[1, 'Britons']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).not.toContain('el-dorado');
    // But Hoardings is everyone's.
    expect(bridge.getSelectionState().researchOptions).toContain('hoardings');
  }, 60_000);
});
