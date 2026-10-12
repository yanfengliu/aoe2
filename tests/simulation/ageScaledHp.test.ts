// The age-scaled HP family (civilizations.csv, matched to current DE in
// v0.3.148):
//  - Vikings: "Infantry +20% HP starting in Feudal Age" — flat, not a ladder
//  - Vietnamese: "Foot Archers and Skirmishers +20% HP" — in every age, Dark
//    included (every Archery Range unit until vNEXT)
//  - Franks: "Mounted units +20% HP starting in Feudal Age"
//  - Mongols: "Scout line +20/30% HP in Castle/Imperial Age"
//  - Portuguese: "Ships +10/15/20% HP by age" (Feudal/Castle/Imperial)
//  - Byzantines: "Buildings (except gates) have +10% HP in Dark Age / +20% HP
//    in Feudal Age / +30% in Castle Age / +40% in Imperial Age"
// Two halves, the Hoardings shape: creation derives the current age's factor;
// advancing an age sweeps what is already standing by the factor RATIO, so a
// ladder replaces its step and never compounds on it. The gate clause is
// walked in the world, through both halves and all four ages, in
// byzantineGateHp.test.ts.

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
import { buildingMaxHpForAge } from '../../src/game/simulation/prototypeBuildingRules';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import type { AgeType, BuildingType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
// civilizations.csv, Byzantines: +10/20/30/40% by age, from the Dark Age up.
const BYZANTINE_LADDER: Readonly<Record<AgeType, number>> = {
  'dark-age': 1.1, 'feudal-age': 1.2, 'castle-age': 1.3, 'imperial-age': 1.4,
};
// "(except gates)": the two gate types this game has, written out here rather
// than read from gates.ts, so the check does not agree with the code by
// construction.
const GATES: ReadonlySet<BuildingType> = new Set<BuildingType>(['stone-gate', 'palisade-gate']);

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
    // Sourced v0.3.148: Vikings are +20% FLAT from Feudal; Vietnamese +20%
    // flat at every age; Franks mounted +20% from Feudal; Mongols scout line
    // +20/30% Castle/Imperial; Portuguese ships +10/15/20 by age.
    expect(ageScaledUnitHpFactor('Vikings', 'militia', 'feudal-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Vikings', 'champion', 'castle-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Vikings', 'berserk', 'imperial-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Vikings', 'militia', 'dark-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Vietnamese', 'archer', 'dark-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Vietnamese', 'skirmisher', 'castle-age')).toBeCloseTo(1.2, 5);
    // Not the gunner or the mounted archers (vNEXT; they had it before).
    expect(ageScaledUnitHpFactor('Vietnamese', 'hand-cannoneer', 'imperial-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Vietnamese', 'cavalry-archer', 'castle-age')).toBe(1);
    expect(ageScaledUnitHpFactor('Franks', 'knight', 'castle-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Mongols', 'hussar', 'imperial-age')).toBeCloseTo(1.3, 5);
    expect(ageScaledUnitHpFactor('Portuguese', 'galley', 'imperial-age')).toBeCloseTo(1.2, 5);
    expect(ageScaledUnitHpFactor('Portuguese', 'galley', 'feudal-age')).toBeCloseTo(1.1, 5);
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

  it('gives neither gate the ladder in any age, and every other building type keeps it', () => {
    // Every building type there is: the footprint table is a
    // Record<BuildingType, ...>, so the compiler holds it complete.
    const census = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[];
    // Not vacuous: both gates are in the census, and so is much else.
    for (const gate of GATES) expect(census).toContain(gate);
    expect(census.length).toBeGreaterThan(GATES.size + 20);

    const wrong: string[] = [];
    for (const buildingType of census) {
      for (const age of AGES) {
        const expected = GATES.has(buildingType) ? 1 : BYZANTINE_LADDER[age];
        const actual = ageScaledBuildingHpFactor('Byzantines', buildingType, age);
        if (Math.abs(actual - expected) > 1e-9) {
          wrong.push(`Byzantine ${buildingType} in the ${age}: ${actual}, expected ${expected}`);
        }
        // Nobody else has a building ladder at all.
        const britons = ageScaledBuildingHpFactor('Britons', buildingType, age);
        if (britons !== 1) wrong.push(`Britons ${buildingType} in the ${age}: ${britons}, expected 1`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('Viking infantry HP through the ages (in the world)', () => {
  it('trains at 40 in the Dark Age, sweeps to 48 on Feudal (flat +20%), trains new at 48', () => {
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
    expect(firstUnitHealth(bridge, 'militia')).toEqual({ currentHp: 48, maxHp: 48 });
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

describe('the generic military-building HP ladder (structures.csv rows by age)', () => {
  it('walks Barracks 1200/1500/1800/2100 and the Feudal pair from 1500', () => {
    expect(buildingMaxHpForAge('barracks', 'dark-age')).toBe(1200);
    expect(buildingMaxHpForAge('barracks', 'feudal-age')).toBe(1500);
    expect(buildingMaxHpForAge('barracks', 'castle-age')).toBe(1800);
    expect(buildingMaxHpForAge('barracks', 'imperial-age')).toBe(2100);
    expect(buildingMaxHpForAge('stable', 'feudal-age')).toBe(1500);
    expect(buildingMaxHpForAge('archery-range', 'imperial-age')).toBe(2100);
    // Everything else reads its flat table value in every age.
    expect(buildingMaxHpForAge('house', 'imperial-age')).toBe(900);
    expect(buildingMaxHpForAge('town-center', 'dark-age')).toBe(2400);
    expect(buildingMaxHpForAge('blacksmith', 'feudal-age')).toBe(2100);
  });

  it('sweeps a standing Barracks up on age advance, for every civilization', () => {
    // outpost-vision-fixture seeds a Dark-Age barracks and can afford Feudal.
    const bridge = boot(); // no civ — the ladder is generic
    const barracks = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'barracks')!;
    expect(bridge.getEntityHealth(barracks.id)).toEqual({ currentHp: 1200, maxHp: 1200 });
    advanceToFeudal(bridge);
    expect(bridge.getEntityHealth(barracks.id)).toEqual({ currentHp: 1500, maxHp: 1500 });
  });

  it('composes with the Byzantine ladder: a Dark barracks at 1320 reaches 1800 in Feudal', () => {
    const bridge = boot('Byzantines');
    const barracks = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'barracks')!;
    expect(bridge.getEntityHealth(barracks.id)).toEqual({ currentHp: 1320, maxHp: 1320 }); // 1200 x 1.1
    advanceToFeudal(bridge);
    // 1500 x 1.2 — both ladders replace their own step, never compound.
    expect(bridge.getEntityHealth(barracks.id)).toEqual({ currentHp: 1800, maxHp: 1800 });
  });
});
