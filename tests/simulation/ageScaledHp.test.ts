// The age-scaled HP family (civilizations.csv):
//  - Vikings: "Infantry have +10% HP in Feudal Age / +15% in Castle Age /
//    +20% in Imperial Age"
//  - Vietnamese: "Archery Range units have +10% HP in Feudal Age, +15% in
//    Castle Age, and +20% in Imperial Age. Does not stack."
//  - Byzantines: "Buildings (except gates) have +10% HP in Dark Age / +20% in
//    Feudal Age / +30% in Castle Age / +40% in Imperial Age"
// Two halves, the Hoardings shape: creation derives the current age's factor;
// advancing an age sweeps what is already standing by the factor RATIO (which
// is what "does not stack" means — the ladder replaces, never compounds).

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import {
  ageScaledBuildingHpFactor,
  ageScaledUnitHpFactor,
} from '../../src/game/simulation/ageScaledHp';

type Bridge = ReturnType<typeof createSimulationBridge>;

function boot(civ?: string): Bridge {
  return createSimulationBridge('outpost-vision-fixture', {
    ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
  });
}

function firstUnitHealth(bridge: Bridge, unitType: string) {
  const unit = bridge
    .getEconomyState()
    .units.find((u) => u.owner === 1 && u.unitType === unitType);
  return unit ? bridge.getEntityHealth(unit.id) : null;
}

function advanceToFeudal(bridge: Bridge): void {
  expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
  expect(bridge.queueResearch('feudal-age')).toBe(true);
  expect(
    stepBridgeUntil(bridge, () => bridge.getEconomyState().ages[1] === 'feudal-age', {
      maxSteps: 2600,
    }),
  ).toBe(true);
}

describe('age-scaled HP factors (pure)', () => {
  it('walks the Viking infantry and Vietnamese archery ladders', () => {
    expect(ageScaledUnitHpFactor('Vikings', 'militia', 'dark-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Vikings', 'militia', 'feudal-age')).toBeCloseTo(1.1, 5);
    expect(ageScaledUnitHpFactor('Vikings', 'champion', 'castle-age')).toBeCloseTo(1.15, 5);
    expect(ageScaledUnitHpFactor('Vikings', 'berserk', 'imperial-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Vietnamese', 'archer', 'feudal-age')).toBeCloseTo(1.1, 5);
    expect(ageScaledUnitHpFactor('Vietnamese', 'skirmisher', 'castle-age')).toBeCloseTo(1.15, 5);
    expect(ageScaledUnitHpFactor('Vietnamese', 'hand-cannoneer', 'imperial-age')).toBeCloseTo(1.2, 5);
    // Wrong class or wrong civ reads 1.
    expect(ageScaledUnitHpFactor('Vikings', 'archer', 'imperial-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Vietnamese', 'militia', 'imperial-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Britons', 'militia', 'imperial-age')).toBe(1);
    expect(ageScaledUnitHpFactor(undefined, 'militia', 'imperial-age')).toBe(1);
  });

  it('walks the Byzantine building ladder from the Dark Age up', () => {
    expect(ageScaledBuildingHpFactor('Byzantines', 'town-center', 'dark-age')).toBeCloseTo(1.1, 5);
    expect(ageScaledBuildingHpFactor('Byzantines', 'house', 'feudal-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledBuildingHpFactor('Byzantines', 'castle', 'castle-age')).toBeCloseTo(1.3, 5);
    expect(ageScaledBuildingHpFactor('Byzantines', 'wonder', 'imperial-age')).toBeCloseTo(1.4, 5);
    expect(ageScaledBuildingHpFactor('Britons', 'town-center', 'imperial-age')).toBe(1);
    expect(ageScaledBuildingHpFactor(undefined, 'town-center', 'imperial-age')).toBe(1);
  });
});

describe('Viking infantry HP through the ages (in the world)', () => {
  it('trains at 40 in the Dark Age, sweeps to 44 on Feudal, trains new at 44', () => {
    const bridge = boot('Vikings');
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => firstUnitHealth(bridge, 'militia') !== null, {
        maxSteps: 600,
      }),
    ).toBe(true);
    expect(firstUnitHealth(bridge, 'militia')).toEqual({ currentHp: 40, maxHp: 40 });

    advanceToFeudal(bridge);
    // The one already standing is swept to the Feudal factor, still full.
    expect(firstUnitHealth(bridge, 'militia')).toEqual({ currentHp: 44, maxHp: 44 });
  });

  it('a generic civ militia stays at 40 across the advance', () => {
    const bridge = boot();
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => firstUnitHealth(bridge, 'militia') !== null, {
        maxSteps: 600,
      }),
    ).toBe(true);
    advanceToFeudal(bridge);
    expect(firstUnitHealth(bridge, 'militia')).toEqual({ currentHp: 40, maxHp: 40 });
  });
});

describe('Byzantine building HP through the ages (in the world)', () => {
  it('boots the TC at 2640 (Dark +10%) and sweeps to 2880 on Feudal', () => {
    const bridge = boot('Byzantines');
    const townCenter = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'town-center')!;
    // 2400 base × 1.1 — the Byzantine ladder starts in the Dark Age.
    expect(bridge.getEntityHealth(townCenter.id)).toEqual({ currentHp: 2640, maxHp: 2640 });

    advanceToFeudal(bridge);
    // 2640 × (1.2 / 1.1) = 2880 — the ladder replaces, it does not stack.
    expect(bridge.getEntityHealth(townCenter.id)).toEqual({ currentHp: 2880, maxHp: 2880 });
  });

  it('applies at creation to every building type, not just the TC', () => {
    const bridge = boot('Byzantines');
    const outpost = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'outpost')!;
    // 500 base × 1.1 = 550.
    expect(bridge.getEntityHealth(outpost.id)?.maxHp).toBe(550);
  });
});
