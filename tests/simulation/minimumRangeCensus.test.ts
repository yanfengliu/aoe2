// The minimum-range census (spec §10.4; defect register, 2026-09-26, "The Siege
// Onager, the Capped Ram and the Elite Skirmisher were left out of tables that
// named the rest of their line").
//
// units.csv gives a unit a minimum range as "min-max". The game's table had
// four of the eleven, so the Skirmisher line, the Scorpion line, the Cannon
// Galleon line and the Trebuchet fired at targets DE does not let them touch.
// tests/content/baseStats.test.ts holds the table to the CSV; this plays it.
// Every unit the CSV gives a minimum, on its own fixture
// (fixtures/minimumRangeCensus.ts), is ordered to attack three things in turn:
// the unit one cell inside its minimum, which it must not fire at while the
// order stands; the unit exactly at its minimum, which it must fire at; and a
// building one cell away, which it must hold its fire at when its minimum is 2
// or more and fire at when its minimum is 1. Then every way a unit gets a
// target with no order from its player. Left to its own targeting among the
// units, its first shot must be at the unit at its minimum; beside the building
// alone, with a second building past every minimum, at the far one (minimum 2
// or more) or the near one (minimum 1). Owned by an AI player, the same two
// scenes, and an order at the unit or the building inside its minimum, which
// the AI must replace with one at the unit or building it can fire at. And
// bitten by a wolf beside it, a land unit must turn on the wolf only when it
// can hit it. The minimums come from the CSV, not from the game, so a table
// and a mechanism that agree with each other and not with the CSV both go red.
//
// Bound: one attack at a time, with no technology. Attack-ground has its own
// case (attackGround.test.ts). A target that walks inside the minimum after a
// player's unit took it on its own is not played: it is held, not dropped
// (spec §10.4). The AI's march on the enemy's first villager, Town Centre or
// last building is not played with that target inside the minimum; those
// branches use the measure the kept-order cases play.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  MINIMUM_RANGE_CENSUS_ATTACKER,
  MINIMUM_RANGE_CENSUS_DEEPEST,
  minimumRangeCensusBuildingAnchor,
  minimumRangeCensusFarBuildingAnchor,
  minimumRangeCensusRoster,
  minimumRangeCensusSeed,
  minimumRangeCensusTargetCell,
  type MinimumRangeCensusScene,
} from '../../src/game/simulation/fixtures/minimumRangeCensus';
import type { UnitType } from '../../src/game/simulation/types';
import { isWaterUnit } from '../../src/game/simulation/unitDomain';

type Bridge = ReturnType<typeof createSimulationBridge>;

// Long enough for the slowest first shot, a Trebuchet's: 50 ticks to unpack,
// then its wind-up. A held order is watched for the same span.
const WATCH_TICKS = 150;

/** units.csv's "min-max" rows, as unit type -> minimum. */
function csvMinimums(): Map<UnitType, number> {
  const minimums = new Map<UnitType, number>();
  const rows = readFileSync('design/stats/units.csv', 'utf-8').split('\n')
    .filter((line) => !line.trimStart().startsWith('#')).slice(1);
  for (const line of rows) {
    const cols = line.split(',');
    if (cols.length < 17) continue;
    const range = cols[12]!.trim();
    if (!range.includes('-')) continue;
    const unitType = cols[0]!.trim().toLowerCase().replace(/ /g, '-') as UnitType;
    minimums.set(unitType, Number(range.split('-')[0]));
  }
  return minimums;
}

const MINIMUMS = csvMinimums();

type CommandRow = { type?: string; targetEntityRef?: { id: number } };

function command(bridge: Bridge, unitId: number): CommandRow | undefined {
  const rows = (bridge.world.getState('aoe2.unitCommands') ?? []) as ReadonlyArray<[number, CommandRow]>;
  return new Map(rows).get(unitId);
}

function commandType(bridge: Bridge, unitId: number): string | undefined {
  return command(bridge, unitId)?.type;
}

/** A fresh census fixture for this unit, with its attacker and a way to find owner 2's entities. */
function stage(unitType: UnitType, scene: MinimumRangeCensusScene = 'units', aiOwned = false) {
  const bridge = createSimulationBridge(minimumRangeCensusSeed(unitType, scene, aiOwned));
  const economy = bridge.getEconomyState();
  const attacker = economy.units.find(
    (unit) => unit.owner === 1 && unit.x === MINIMUM_RANGE_CENSUS_ATTACKER.x && unit.y === MINIMUM_RANGE_CENSUS_ATTACKER.y,
  );
  if (attacker?.unitType !== unitType) {
    throw new Error(`the ${unitType} census fixture has no ${unitType} on the attacker's cell (${String(MINIMUM_RANGE_CENSUS_ATTACKER.x)}, ${String(MINIMUM_RANGE_CENSUS_ATTACKER.y)})`);
  }
  const targetAt = (target: 'unit' | 'building', cell: { x: number; y: number }): number => {
    const id = target === 'unit'
      ? economy.units.find((unit) => unit.owner === 2 && unit.x === cell.x && unit.y === cell.y)?.id
      : economy.buildings.find((building) => building.owner === 2 && building.x === cell.x && building.y === cell.y)?.id;
    if (id === undefined) throw new Error(`the ${unitType} census fixture has no ${target} of owner 2 at (${String(cell.x)}, ${String(cell.y)})`);
    return id;
  };
  return { bridge, attackerId: attacker.id, targetAt };
}

/**
 * Watch the census attacker for WATCH_TICKS, or until its first shot when
 * `untilFirstShot`. Returns the ticks on which it had a shot of its own in the
 * air, the target of the first, and whether an attack order stood throughout.
 */
function watch(bridge: Bridge, attackerId: number, untilFirstShot: boolean) {
  const shotTicks: number[] = [];
  let firstTarget: number | null = null;
  let orderStood = true;
  for (let tick = 0; tick < WATCH_TICKS; tick += 1) {
    bridge.step(100);
    const shot = bridge.getInFlightProjectiles().find((flying) => flying.attackerId === attackerId);
    if (shot) {
      shotTicks.push(tick);
      firstTarget ??= shot.targetId;
      if (untilFirstShot) break;
    }
    if (commandType(bridge, attackerId) !== 'attack') orderStood = false;
  }
  return { shotTicks, firstTarget, orderStood };
}

/** Fails an AI case whose AI never decided: the human seat runs one only when forced (scenarioSeedOps.ts). */
function expectAiRan(bridge: Bridge, unitType: UnitType): void {
  const seats = (bridge.world.getState('aoe2.aiStates') ?? []) as ReadonlyArray<[number, { lastDecisionTick?: number }]>;
  expect(new Map(seats).get(1)?.lastDecisionTick ?? -1, `the ${unitType} census's AI seat on owner 1 never decided, so the case played the unit's own targeting`)
    .toBeGreaterThanOrEqual(0);
}

/** Order the census attacker at the unit at `cell`, or the building anchored there, and watch. */
function orderAndWatch(
  unitType: UnitType,
  target: 'unit' | 'building',
  cell: { x: number; y: number },
  untilFirstShot = false,
  aiOwned = false,
) {
  const { bridge, attackerId, targetAt } = stage(unitType, 'units', aiOwned);
  const targetId = targetAt(target, cell);
  expect(bridge.selectUnitsByIds([attackerId]), `the ${unitType} could not be selected`).toBe(true);
  expect(bridge.issueContextCommandAtEntity(targetId), `the ${unitType} was refused the attack on the ${target}`).toBe(true);
  return watch(bridge, attackerId, untilFirstShot);
}

// A census case steps a real match for up to WATCH_TICKS; the blast census
// gives its cases the same budget.
const CASE_TIMEOUT_MS = 60_000;

/**
 * The building a unit left to find its own target in the `building-alone`
 * scene must take: the near one when it is at the minimum, else the far one.
 */
function minimumBuilding(
  unitType: UnitType,
  minimum: number,
  targetAt: (target: 'unit' | 'building', cell: { x: number; y: number }) => number,
): { id: number; why: string } {
  if (minimum >= 2) {
    return {
      id: targetAt('building', minimumRangeCensusFarBuildingAnchor()),
      why: `the building 1 away is inside its minimum of ${String(minimum)}, so it must take the one ${String(MINIMUM_RANGE_CENSUS_DEEPEST)} away`,
    };
  }
  return {
    id: targetAt('building', minimumRangeCensusBuildingAnchor(unitType)),
    why: 'the building 1 away is at its minimum and the nearest',
  };
}

describe('the minimum-range census', () => {
  it('stages every unit units.csv gives a minimum, within its targets', () => {
    // The instrument: eleven rows (four before 2026-09-26 in the game), each
    // a unit the census can stage, each minimum short of the deepest target.
    expect([...MINIMUMS.keys()].sort()).toEqual([
      'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon', 'elite-skirmisher', 'heavy-scorpion',
      'mangonel', 'onager', 'scorpion', 'siege-onager', 'skirmisher', 'trebuchet',
    ]);
    for (const [unitType, minimum] of MINIMUMS) {
      expect(minimumRangeCensusRoster(), `${unitType} fires no projectile, so the census cannot stage it`).toContain(unitType);
      expect(minimum, unitType).toBeGreaterThanOrEqual(1);
      expect(minimum, unitType).toBeLessThan(MINIMUM_RANGE_CENSUS_DEEPEST);
    }
  });

  for (const [unitType, minimum] of MINIMUMS) {
    describe(`${unitType} (units.csv minimum ${String(minimum)})`, () => {
      it('holds its fire at the unit one cell inside its minimum, with the order standing', () => {
        const { shotTicks, orderStood } = orderAndWatch(unitType, 'unit', minimumRangeCensusTargetCell(minimum - 1));
        expect(shotTicks, `the ${unitType} fired at a unit ${String(minimum - 1)} away, inside its minimum of ${String(minimum)}`).toEqual([]);
        expect(orderStood, 'the order must stand the whole time, or no shot proves nothing').toBe(true);
      }, CASE_TIMEOUT_MS);

      it('fires at the unit exactly at its minimum', () => {
        const { shotTicks } = orderAndWatch(unitType, 'unit', minimumRangeCensusTargetCell(minimum), true);
        expect(shotTicks.length, `the ${unitType} never fired at a unit ${String(minimum)} away, its minimum`).toBeGreaterThan(0);
      }, CASE_TIMEOUT_MS);

      it(minimum >= 2 ? 'holds its fire at a building one cell away' : 'fires at a building one cell away', () => {
        const { shotTicks, orderStood } = orderAndWatch(unitType, 'building', minimumRangeCensusBuildingAnchor(unitType), minimum < 2);
        if (minimum >= 2) {
          expect(shotTicks, `the ${unitType} fired at a building 1 away, inside its minimum of ${String(minimum)}`).toEqual([]);
          expect(orderStood, 'the order must stand the whole time, or no shot proves nothing').toBe(true);
        } else {
          expect(shotTicks.length, `the ${unitType} never fired at a building 1 away, at its minimum`).toBeGreaterThan(0);
        }
      }, CASE_TIMEOUT_MS);

      it('left to itself, opens fire at the nearest unit at its minimum, not at one inside it', () => {
        // Automatic targeting skips a target inside the minimum, as a tower's
        // does. It used to take the nearest unit, inside the minimum, and hold
        // its fire at it for good (the independent review of 2026-09-26).
        const { bridge, attackerId, targetAt } = stage(unitType);
        const { firstTarget } = watch(bridge, attackerId, true);
        expect(firstTarget, `the ${unitType}, left to itself, never fired`).not.toBeNull();
        expect(firstTarget, `the ${unitType}'s first shot, by target id; the unit at its minimum is ${String(targetAt('unit', minimumRangeCensusTargetCell(minimum)))}`)
          .toBe(targetAt('unit', minimumRangeCensusTargetCell(minimum)));
      }, CASE_TIMEOUT_MS);

      it(minimum >= 2
        ? 'left alone beside a building one cell away, opens fire at the one past its minimum instead'
        : 'left alone beside a building one cell away, opens fire at it', () => {
        // No owner 2 units: the building one cell away and one past every
        // minimum, so a unit that passes over the near one still has
        // something to take, and a unit that never looks at buildings fails.
        const { bridge, attackerId, targetAt } = stage(unitType, 'building-alone');
        const expected = minimumBuilding(unitType, minimum, targetAt);
        const { firstTarget } = watch(bridge, attackerId, true);
        expect(firstTarget, `the ${unitType}, left alone, fired first at ${String(firstTarget)}; ${expected.why}`).toBe(expected.id);
      }, CASE_TIMEOUT_MS);

      describe('owned by an AI player', () => {
        // The AI orders its units itself, before their own targeting runs
        // (autoAggressionSystem.ts skips a unit with a pending order), and it
        // kept any order whose target lived.
        it('is ordered at the nearest unit at its minimum, not at one inside it', () => {
          const { bridge, attackerId, targetAt } = stage(unitType, 'units', true);
          const expected = targetAt('unit', minimumRangeCensusTargetCell(minimum));
          const { firstTarget } = watch(bridge, attackerId, true);
          expectAiRan(bridge, unitType);
          expect(firstTarget, `the AI's ${unitType} never fired`).not.toBeNull();
          expect(firstTarget, `the AI's ${unitType}'s first shot, by target id; the unit at its minimum is ${String(expected)}`).toBe(expected);
        }, CASE_TIMEOUT_MS);

        it(minimum >= 2
          ? 'beside a building one cell away, is ordered at the one past its minimum instead'
          : 'beside a building one cell away, is ordered at it', () => {
          const { bridge, attackerId, targetAt } = stage(unitType, 'building-alone', true);
          const expected = minimumBuilding(unitType, minimum, targetAt);
          const { firstTarget } = watch(bridge, attackerId, true);
          expectAiRan(bridge, unitType);
          expect(firstTarget, `the AI's ${unitType} fired first at ${String(firstTarget)}; ${expected.why}`).toBe(expected.id);
        }, CASE_TIMEOUT_MS);

        it(minimum >= 2
          ? 'replaces an order at the building inside its minimum with one at the building past it'
          : 'keeps an order at the building at its minimum', () => {
          // The building half of the AI's measure, on a kept order: the nearest
          // footprint cell, not the anchor. The House's anchor is 2 cells west
          // and the Dock's 3, so a check by anchor would keep the Scorpions'
          // and the Cannon Galleons' orders here and freeze them.
          const { bridge, attackerId, targetAt } = stage(unitType, 'building-alone', true);
          const near = targetAt('building', minimumRangeCensusBuildingAnchor(unitType));
          expect(bridge.selectUnitsByIds([attackerId]), `the ${unitType} could not be selected`).toBe(true);
          expect(bridge.issueContextCommandAtEntity(near), `the ${unitType} was refused the attack on the building`).toBe(true);
          const expected = minimumBuilding(unitType, minimum, targetAt);
          const { firstTarget } = watch(bridge, attackerId, true);
          expectAiRan(bridge, unitType);
          expect(firstTarget, `the AI's ${unitType} fired first at ${String(firstTarget)}; ${expected.why}`).toBe(expected.id);
        }, CASE_TIMEOUT_MS);

        it('replaces an order at the unit inside its minimum with one at the unit at it', () => {
          // Given by the seat's player here, but for an AI-owned unit every
          // order is the AI's own, whoever gave it; this is the one a target
          // walking inside would leave it with.
          const { bridge, attackerId, targetAt } = stage(unitType, 'units', true);
          const inside = targetAt('unit', minimumRangeCensusTargetCell(minimum - 1));
          expect(bridge.selectUnitsByIds([attackerId]), `the ${unitType} could not be selected`).toBe(true);
          expect(bridge.issueContextCommandAtEntity(inside), `the ${unitType} was refused the attack`).toBe(true);
          const expected = targetAt('unit', minimumRangeCensusTargetCell(minimum));
          const { firstTarget } = watch(bridge, attackerId, true);
          expectAiRan(bridge, unitType);
          expect(firstTarget, `the AI's ${unitType} kept its order at the unit ${String(minimum - 1)} away, inside its minimum, and never fired`).not.toBeNull();
          expect(firstTarget, `the AI's ${unitType}'s first shot, by target id; the unit at its minimum is ${String(expected)}`).toBe(expected);
        }, CASE_TIMEOUT_MS);
      });

      if (!isWaterUnit(unitType)) {
        it(minimum >= 2
          ? 'bitten by a wolf beside it, takes no order at the wolf'
          : 'bitten by a wolf beside it, turns on the wolf and hits it', () => {
          const { bridge, attackerId } = stage(unitType, 'wolf');
          const wolfId = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'wolf')?.id;
          if (wolfId === undefined) throw new Error(`the ${unitType} wolf fixture has no wolf`);
          const maxHp = bridge.getEntityHealth(attackerId)?.maxHp ?? 0;
          const wolfMaxHp = bridge.getEntityHealth(wolfId)?.maxHp ?? 0;
          let orderedAtWolf = false;
          for (let tick = 0; tick < WATCH_TICKS; tick += 1) {
            bridge.step(100);
            if (command(bridge, attackerId)?.targetEntityRef?.id === wolfId) orderedAtWolf = true;
          }
          // The instrument: a wolf that never bit proves nothing.
          expect(bridge.getEntityHealth(attackerId)?.currentHp ?? 0, `the wolf never bit the ${unitType}`).toBeLessThan(maxHp);
          if (minimum >= 2) {
            expect(orderedAtWolf, `the ${unitType} took an order at the wolf 1 away, inside its minimum of ${String(minimum)}, where it can never fire`).toBe(false);
          } else {
            // The wolf's health is the evidence, over the whole watch: a shot
            // at an animal rolls to hit as one at a unit does (spec §10.4), so
            // the first one may miss.
            expect(orderedAtWolf, `the ${unitType}, bitten by the wolf 1 away, at its minimum, never turned on it`).toBe(true);
            expect(bridge.getEntityHealth(wolfId)?.currentHp ?? 0, `the ${unitType} never hurt the wolf 1 away, at its minimum`).toBeLessThan(wolfMaxHp);
          }
        }, CASE_TIMEOUT_MS);
      }
    });
  }
});
