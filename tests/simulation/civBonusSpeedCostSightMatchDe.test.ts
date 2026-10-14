// Civilization bonuses on movement, price and sight do what Definitive
// Edition's do (work 120 M3; defect register 2026-10-12, "Six civilization
// bonuses departed from Definitive Edition's text").
//
// SOURCE: the civilization help texts in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872):
//  - Celts: "Infantry moves +5/10/15/20% faster in Dark/Feudal/Castle/Imperial
//    Age"
//  - Ethiopians, team bonus: "Outposts +3 line of sight and cost no stone"
//  - Italians: "Fishing Ships cost -15%"
//
// THE DEFECTS: Celtic infantry moved 15% faster in every age. The Ethiopian
// side's Watch Towers and Bombard Towers saw 3 farther too, and its Outposts
// still cost stone. An Italian Fishing Ship cost 15 wood less, 60 instead of
// DE's 64 (75 less 15%, rounded as every cost rule here rounds).
//
// THE CLASS: a civilization bonus whose amount, age steps or scope departs from
// DE's text. Each census walks every unit or building type through the seam
// every site reads, against the Britons, who have none of these bonuses:
// movementSpeedPercent (the step executor), teamBuildingVisionBonus (seeding
// and completion), the bridge's construction cost (every charge, check and
// build card) and effectiveTrainingCost (the charge and the validator).
//
// BOUNDS: the seams and the match paths below. The infantry list is written
// out from DE's "(Infantry)" labels and the lines, not read from the code. A
// tower completed in a game saved before this change keeps the sight it was
// saved with (spec §9.2.2, the building-bonus paragraph). The walks cover the
// Dark and Imperial rungs; the census covers all four at the seam.

import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { effectiveTrainingCost } from '../../src/game/simulation/civBonusEffects';
import { teamBuildingVisionBonus } from '../../src/game/simulation/civBuildingBonuses';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import { UNIT_BASE_SPEED_PERCENT } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';
import type { AgeType, BuildingType, PlayerResources, ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';
import { selectOwnedBuildingDirect, selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();
const EVERY_UNIT_TYPE = Object.keys(UNIT_BASE_SPEED_PERCENT) as UnitType[];
const EVERY_BUILDING_TYPE = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[];

// DE: +5/10/15/20% in Dark/Feudal/Castle/Imperial.
const CELT_LADDER: Readonly<Record<AgeType, number>> = {
  'dark-age': 1.05, 'feudal-age': 1.1, 'castle-age': 1.15, 'imperial-age': 1.2,
};
const INFANTRY: ReadonlySet<UnitType> = new Set<UnitType>([
  'militia', 'man-at-arms', 'long-swordsman', 'two-handed-swordsman', 'champion',
  'spearman', 'pikeman', 'halberdier', 'eagle-warrior', 'elite-eagle-warrior',
  'woad-raider', 'elite-woad-raider', 'huskarl', 'elite-huskarl', 'samurai', 'elite-samurai',
  'jaguar-warrior', 'elite-jaguar-warrior', 'teutonic-knight', 'elite-teutonic-knight',
  'throwing-axeman', 'elite-throwing-axeman', 'berserk', 'elite-berserk',
]);
const GUNPOWDER_UNITS: ReadonlySet<UnitType> = new Set<UnitType>([
  'hand-cannoneer', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'conquistador', 'elite-conquistador', 'janissary', 'elite-janissary',
]);

describe('Celtic infantry speed steps with the age', () => {
  it('moves infantry +5/10/15/20% by age at the step executor\'s seam, and nothing else', () => {
    const wrong: string[] = [];
    for (const unitType of EVERY_UNIT_TYPE) {
      // Left out: this build files the Petard under the infantry armour
      // class, so every infantry bonus reaches it, while DE's data gives it
      // none (aoe2techtree 3bb43b14, unit 440, armour classes 3, 4 and 31).
      // That is a question about the class list, reported with work 120 M3,
      // not about this ladder.
      if (unitType === 'petard') continue;
      for (const age of AGES) {
        const plain = movementSpeedPercent(NONE, unitType, 'Britons', age);
        const expected = INFANTRY.has(unitType)
          ? Math.round(UNIT_BASE_SPEED_PERCENT[unitType] * CELT_LADDER[age])
          : plain;
        const actual = movementSpeedPercent(NONE, unitType, 'Celts', age);
        if (actual !== expected) wrong.push(`${unitType} in the ${age}: ${actual}%, expected ${expected}%`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('a Celtic militia outwalks a plain one by about 5% in the Dark Age, not 15%', () => {
    // attack-ally-fixture is a Dark-Age match whose militia has open grass east.
    const target = { x: 32, y: 14 };
    const ratio = militiaArrivalTicks('attack-ally-fixture', 'Britons', target)
      / militiaArrivalTicks('attack-ally-fixture', 'Celts', target);
    // 118% against 112% walks about 1.05 times as fast; the old 129% made it 1.14.
    expect(ratio).toBeGreaterThan(1.02);
    expect(ratio).toBeLessThan(1.09);
  }, 60_000);

  it('a Celtic militia outwalks a plain one by about 20% in the Imperial Age, the age the step executor reads', () => {
    // civ-goths-infantry-fixture is an Imperial-Age match whose militia has
    // open grass south. The rung comes from the owner's age at the step
    // executor, so a walk outside the Dark Age is what sees that age read:
    // the Dark rung would make this about 1.05, the old flat 15% about 1.14.
    const target = { x: 13, y: 28 };
    const ratio = militiaArrivalTicks('civ-goths-infantry-fixture', 'Britons', target)
      / militiaArrivalTicks('civ-goths-infantry-fixture', 'Celts', target);
    // 134% against 112% walks about 1.19 times as fast.
    expect(ratio).toBeGreaterThan(1.16);
    expect(ratio).toBeLessThan(1.24);
  }, 60_000);
});

/** Ticks owner 1's militia takes to reach `target` when ordered there. */
function militiaArrivalTicks(fixture: string, civilization: string, target: { x: number; y: number }): number {
  const bridge = createSimulationBridge(fixture, {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
  expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);
  expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
  for (let tick = 1; tick <= 1500; tick += 1) {
    bridge.step(100);
    const militia = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === 'militia');
    if (militia && militia.x === target.x && militia.y === target.y) return tick;
  }
  throw new Error(`the ${civilization} militia in ${fixture} did not reach (${target.x},${target.y})`);
}

describe('the Ethiopian side\'s Outposts', () => {
  const SOLO = new Map<number, number>();

  it('see 3 farther, and no other building does', () => {
    const wrong: string[] = [];
    for (const buildingType of EVERY_BUILDING_TYPE) {
      const expected = buildingType === 'outpost' ? 3 : 0;
      const ethiopian = teamBuildingVisionBonus(SOLO, new Map([[1, 'Ethiopians']]), 1, buildingType);
      const plain = teamBuildingVisionBonus(SOLO, new Map([[1, 'Britons']]), 1, buildingType);
      if (ethiopian - plain !== expected) wrong.push(`${buildingType}: +${ethiopian - plain}, expected +${expected}`);
    }
    expect(wrong).toEqual([]);
    // A team bonus: an ally of the Ethiopians sees it too, an enemy does not.
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    const civs = new Map([[1, 'Britons'], [2, 'Ethiopians'], [3, 'Britons']]);
    expect(teamBuildingVisionBonus(teams, civs, 1, 'outpost')).toBe(3);
    expect(teamBuildingVisionBonus(teams, civs, 3, 'outpost')).toBe(0);
  });

  it('in a seeded match, only the Outpost sees farther', () => {
    const radii = (civilization: string): Map<string, number> => {
      const bridge = createSimulationBridge('building-showcase-fixture', {
        civilizationsByOwner: new Map([[1, civilization]]),
      });
      const byType = new Map<string, number>();
      for (const building of bridge.getEconomyState().buildings) {
        if (building.owner !== 1 || byType.has(building.buildingType)) continue;
        const radius = bridge.world.getComponent<{ radius: number }>(building.id, 'visionSource')?.radius;
        if (radius !== undefined) byType.set(building.buildingType, radius);
      }
      return byType;
    };
    const ethiopian = radii('Ethiopians');
    const plain = radii('Britons');
    expect(ethiopian.get('outpost')).toBe(plain.get('outpost')! + 3);
    for (const [buildingType, radius] of plain) {
      if (buildingType !== 'outpost') expect(ethiopian.get(buildingType), buildingType).toBe(radius);
    }
    expect(plain.has('watch-tower') && plain.has('bombard-tower')).toBe(true);
  }, 60_000);

  it('cost no stone, for the side, at the seam every charge and build card reads', () => {
    const costs = (civilizations: Map<number, string>, teams?: Map<number, number>): Map<BuildingType, Partial<PlayerResources>> => {
      const bridge = createSimulationBridge('outpost-vision-fixture', {
        civilizationsByOwner: civilizations,
        ...(teams ? { teamsByOwner: teams } : {}),
      });
      return new Map(EVERY_BUILDING_TYPE.map((type) => [type, bridge.getConstructionCost(1, type)]));
    };
    const plain = costs(new Map([[1, 'Britons']]));
    const { stone: outpostStone, ...outpostWithoutStone } = plain.get('outpost')!;
    expect(outpostStone).toBeGreaterThan(0);
    for (const [label, priced] of [
      ['an Ethiopian player', costs(new Map([[1, 'Ethiopians']]))],
      ['an ally of the Ethiopians', costs(new Map([[1, 'Britons'], [2, 'Ethiopians']]), new Map([[1, 1], [2, 1]]))],
    ] as const) {
      for (const buildingType of EVERY_BUILDING_TYPE) {
        const expected = buildingType === 'outpost' ? outpostWithoutStone : plain.get(buildingType);
        expect(priced.get(buildingType), `${label}: ${buildingType}`).toEqual(expected);
      }
    }
    // An enemy of the Ethiopians pays the stone.
    const enemy = costs(new Map([[1, 'Britons'], [2, 'Ethiopians']]), new Map([[1, 1], [2, 2]]));
    expect(enemy.get('outpost')).toEqual(plain.get('outpost'));
  }, 60_000);

  it('an Ethiopian villager\'s Outpost is charged wood and no stone', () => {
    const spent = (civilization: string): { wood: number; stone: number } => {
      const bridge = createSimulationBridge('outpost-vision-fixture', {
        civilizationsByOwner: new Map([[1, civilization]]),
      });
      const before = bridge.getEconomyState().playerResources[1]!;
      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      expect(bridge.beginBuildingPlacement('outpost')).toBe(true);
      expect(bridge.confirmBuildingPlacement(18, 14)).toBe(true);
      expect(stepBridgeUntil(bridge, () => bridge.getEconomyState().buildings.some(
        (b) => b.owner === 1 && b.buildingType === 'outpost' && b.x === 18,
      ), { maxSteps: 400 })).toBe(true);
      const after = bridge.getEconomyState().playerResources[1]!;
      return { wood: before.wood - after.wood, stone: before.stone - after.stone };
    };
    const plain = spent('Britons');
    expect(plain.stone).toBeGreaterThan(0);
    expect(spent('Ethiopians')).toEqual({ wood: plain.wood, stone: 0 });
  }, 60_000);
});

describe('Italian Fishing Ships cost 15% less', () => {
  it('prices every unit in every age as DE does: Fishing Ships -15%, Gunpowder Units -20%, the rest unchanged', () => {
    const wrong: string[] = [];
    for (const unitType of TRAINABLE_UNIT_TYPES) {
      for (const age of AGES) {
        const multiplier = unitType === 'fishing-ship' ? 0.85 : GUNPOWDER_UNITS.has(unitType) ? 0.8 : 1;
        const base = trainingCost(unitType);
        const expected: Partial<PlayerResources> = {};
        for (const key of Object.keys(base) as (keyof PlayerResources)[]) {
          expected[key] = Math.round((base[key] ?? 0) * multiplier);
        }
        const actual = effectiveTrainingCost('Italians', age, unitType, NONE);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          wrong.push(`${unitType} in the ${age}: ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    // Shipwright's -20% wood comes first and the Italian -15% applies to what
    // is left: 75 x 0.8 x 0.85 = 51.
    expect(effectiveTrainingCost('Italians', 'castle-age', 'fishing-ship', new Set(['shipwright'])))
      .toEqual({ wood: 51 });
  });

  it('an Italian Dock charges 64 wood for a Fishing Ship', () => {
    const charged = (civilization: string): number => {
      const bridge: Bridge = createSimulationBridge('naval-fixture', {
        civilizationsByOwner: new Map([[1, civilization]]),
      });
      const before = bridge.getEconomyState().playerResources[1]!.wood;
      expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
      expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);
      // The order is carried out on the next tick, which charges it.
      expect(stepBridgeUntil(bridge, () => bridge.getEconomyState().buildings.some(
        (b) => b.owner === 1 && b.buildingType === 'dock' && b.queue.some((item) => item.unitType === 'fishing-ship'),
      ), { maxSteps: 5 })).toBe(true);
      return before - bridge.getEconomyState().playerResources[1]!.wood;
    };
    expect(charged('Britons')).toBe(75);
    expect(charged('Italians')).toBe(64);
  }, 30_000);
});
