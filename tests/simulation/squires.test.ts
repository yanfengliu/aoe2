import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Squires (v0.1.68): the infantry counterpart to Husbandry on the shared
// movement-speed seam. Barracks, Castle Age, 200 food / 400 ticks
// (technologies.csv:12). +10% movement speed for INFANTRY, DERIVED via
// movementSpeedPercent inside moveUnitOneSubgridStep (the carry accumulator) —
// no applyTechnology case. Mirrors husbandry.test.ts.

type Bridge = ReturnType<typeof createSimulationBridge>;

const MILITIA_TARGET = { x: 30, y: 13 };
const KNIGHT_TARGET = { x: 30, y: 16 };

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function commandMoveTo(bridge: Bridge, unitType: string, target: { x: number; y: number }): void {
  expect(selectOwnedUnitDirect(bridge, 1, unitType)).toBe(true);
  expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
}

function arrivalTick(
  bridge: Bridge,
  unitType: string,
  target: { x: number; y: number },
  maxTicks = 1400,
): number {
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    bridge.step(100);
    const unit = getOwnedUnit(bridge, 1, unitType);
    if (unit && unit.x === target.x && unit.y === target.y) {
      return tick;
    }
  }
  throw new Error(`${unitType} did not reach (${target.x},${target.y}) within ${maxTicks} ticks`);
}

describe('Squires — cost & research-time tables', () => {
  it('costs 200 food and takes 400 ticks (technologies.csv:12, 40 s × 10 TPS)', () => {
    expect(researchCost('squires')).toEqual({ food: 200 });
    expect(researchTimeTicks('squires')).toBe(400);
  });
});

describe('Squires — gating at the Barracks', () => {
  it('is researchable only at the Barracks', () => {
    expect(canResearchAt('barracks', 'squires')).toBe(true);
    expect(canResearchAt('stable', 'squires')).toBe(false);
    expect(canResearchAt('blacksmith', 'squires')).toBe(false);
    expect(canResearchAt('town-center', 'squires')).toBe(false);
  });

  it('is offered at a Castle+/Barracks and drops once researched', () => {
    const bridge: Bridge = createSimulationBridge('squires-movement-baseline-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('squires');

    expect(bridge.queueResearch('squires')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'barracks');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('squires');
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('squires');
  }, 30_000);

  it('is NOT offered before Castle Age (Feudal-Age Barracks)', () => {
    const bridge: Bridge = createSimulationBridge('feudal-spearman-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('squires');
  });
});

describe('Squires — +10% infantry movement speed (carry accumulator)', () => {
  it('a Squires militia outraces a baseline militia over the same straight 20-cell run', () => {
    const baseline: Bridge = createSimulationBridge('squires-movement-baseline-fixture');
    const researched: Bridge = createSimulationBridge('squires-movement-researched-fixture');

    commandMoveTo(baseline, 'militia', MILITIA_TARGET);
    commandMoveTo(researched, 'militia', MILITIA_TARGET);

    const baselineTicks = arrivalTick(baseline, 'militia', MILITIA_TARGET);
    const researchedTicks = arrivalTick(researched, 'militia', MILITIA_TARGET);

    expect(researchedTicks).toBeLessThan(baselineTicks);
    expect(baselineTicks - researchedTicks).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('a non-infantry knight walks identically with and without Squires', () => {
    const baseline: Bridge = createSimulationBridge('squires-movement-baseline-fixture');
    const researched: Bridge = createSimulationBridge('squires-movement-researched-fixture');

    commandMoveTo(baseline, 'knight', KNIGHT_TARGET);
    commandMoveTo(researched, 'knight', KNIGHT_TARGET);

    const baselineTicks = arrivalTick(baseline, 'knight', KNIGHT_TARGET);
    const researchedTicks = arrivalTick(researched, 'knight', KNIGHT_TARGET);

    expect(researchedTicks).toBe(baselineTicks);
  }, 30_000);

  it('a militia commanded AFTER a live Squires research walks faster than an unresearched control', () => {
    const bridge: Bridge = createSimulationBridge('squires-movement-baseline-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueResearch('squires')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'barracks');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('squires');
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    commandMoveTo(bridge, 'militia', MILITIA_TARGET);
    const liveResearchedTicks = arrivalTick(bridge, 'militia', MILITIA_TARGET);

    const control: Bridge = createSimulationBridge('squires-movement-baseline-fixture');
    commandMoveTo(control, 'militia', MILITIA_TARGET);
    const controlTicks = arrivalTick(control, 'militia', MILITIA_TARGET);

    expect(liveResearchedTicks).toBeLessThan(controlTicks);
  }, 60_000);
});
