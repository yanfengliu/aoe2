import { describe, expect, it } from 'vitest';

import {
  HUSBANDRY_SPEED_PERCENT,
  MOVE_CARRY_CAP_HUNDREDTHS,
  movementEntitlement,
  movementSpeedPercent,
  settleMovementCarry,
} from '../../src/game/simulation/movementTechEffects';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

// Husbandry (v0.1.66): the first movement-speed tech. movementSpeedPercent
// derives a whole-percent multiplier from the owner's researched set + the
// unit type (DERIVED — sappers pattern). The entitle/settle pair implements
// the per-unit carry accumulator (the v0.1.26 gatherProgressTicks pattern):
// round(2 × 1.1) = 2 is a silent no-op, and a stateless per-tick surge
// schedule gets eaten by the per-CELL waypoint clamp (every 4-fine-unit leg
// costs 2 ticks whether granted 2+2 or 3-clamped-to-2+2) — only a carry that
// banks the clamped shortfall delivers a real +10%.

const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();
const HUSBANDRY_ONLY: ReadonlySet<ResearchableTechnologyType> = new Set([
  'husbandry',
] as ResearchableTechnologyType[]);
const UNRELATED_TECH: ReadonlySet<ResearchableTechnologyType> = new Set([
  'loom',
] as ResearchableTechnologyType[]);

const MOUNTED_TYPES: UnitType[] = [
  'scout',
  'light-cavalry',
  'hussar',
  'camel',
  'knight',
  'cavalier',
  'paladin',
  'heavy-camel',
  'cavalry-archer',
  'heavy-cavalry-archer',
];

const UNMOUNTED_TYPES: UnitType[] = [
  'villager',
  'militia',
  'spearman',
  'archer',
  'skirmisher',
  'monk',
  'battering-ram',
  'mangonel',
  'trebuchet',
];

describe('movementSpeedPercent — Husbandry scope (technologies.csv:79 Cavalry;Cavalry Archer)', () => {
  it('grants 110% to every mounted unit when husbandry is researched', () => {
    for (const unitType of MOUNTED_TYPES) {
      expect(movementSpeedPercent(HUSBANDRY_ONLY, unitType)).toBe(HUSBANDRY_SPEED_PERCENT);
      expect(movementSpeedPercent(HUSBANDRY_ONLY, unitType)).toBe(110);
    }
  });

  it('leaves every non-mounted unit at 100% even with husbandry researched', () => {
    for (const unitType of UNMOUNTED_TYPES) {
      expect(movementSpeedPercent(HUSBANDRY_ONLY, unitType)).toBe(100);
    }
  });

  it('leaves mounted units at 100% without husbandry (none / unrelated tech)', () => {
    for (const unitType of MOUNTED_TYPES) {
      expect(movementSpeedPercent(NO_TECHS, unitType)).toBe(100);
      expect(movementSpeedPercent(UNRELATED_TECH, unitType)).toBe(100);
    }
  });
});

describe('movementEntitlement / settleMovementCarry — the carry accumulator', () => {
  it('is the identity at 100%: grant = base and the carry never accumulates', () => {
    let carry = 0;
    for (let tick = 0; tick < 25; tick += 1) {
      const { grantedSteps, entitledHundredths } = movementEntitlement(carry, 2, 100);
      expect(grantedSteps).toBe(2);
      carry = settleMovementCarry(entitledHundredths, grantedSteps);
      expect(carry).toBe(0);
    }
  });

  it('grants the 2,2,2,2,3 pattern at 110% when never clamped (fully consumed)', () => {
    let carry = 0;
    const grants: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      const { grantedSteps, entitledHundredths } = movementEntitlement(carry, 2, 110);
      grants.push(grantedSteps);
      carry = settleMovementCarry(entitledHundredths, grantedSteps);
    }
    expect(grants).toEqual([2, 2, 2, 2, 3, 2, 2, 2, 2, 3]);
    expect(grants.reduce((sum, grant) => sum + grant, 0)).toBe(22);
  });

  it('banks a clamped shortfall instead of losing it', () => {
    // Granted 3 but a 2-fine-unit waypoint leg only let 2 through: the
    // unconsumed 100 hundredths stay banked.
    const { grantedSteps, entitledHundredths } = movementEntitlement(80, 2, 110);
    expect(grantedSteps).toBe(3);
    expect(settleMovementCarry(entitledHundredths, 2)).toBe(100);
  });

  it('caps the bank and never returns a negative carry', () => {
    expect(settleMovementCarry(10_000, 0)).toBe(MOVE_CARRY_CAP_HUNDREDTHS);
    expect(settleMovementCarry(150, 2)).toBe(0);
  });

  it('delivers a real +10% under per-cell waypoint clamping (the quantization trap)', () => {
    // Reproduces the executor's semantics: per-cell waypoints of 4 fine
    // units, each tick's step clamped to the remaining leg, residual grant
    // banked by the settle. Without the carry this walk measures 40 = 40
    // (the clamp eats every surge tick).
    function ticksToWalk(totalFineUnits: number, speedPercent: number): number {
      let carry = 0;
      let travelled = 0;
      let legRemaining = 4;
      for (let tick = 1; tick <= 200; tick += 1) {
        const { grantedSteps, entitledHundredths } = movementEntitlement(carry, 2, speedPercent);
        const moved = Math.min(grantedSteps, legRemaining);
        travelled += moved;
        legRemaining -= moved;
        if (legRemaining === 0) {
          legRemaining = 4;
        }
        carry = settleMovementCarry(entitledHundredths, moved);
        if (travelled >= totalFineUnits) {
          return tick;
        }
      }
      throw new Error('walk did not complete');
    }

    const baselineTicks = ticksToWalk(80, 100);
    const boostedTicks = ticksToWalk(80, 110);
    expect(baselineTicks).toBe(40);
    expect(boostedTicks).toBeLessThanOrEqual(38);
    expect(boostedTicks).toBeGreaterThanOrEqual(36);
  });
});
