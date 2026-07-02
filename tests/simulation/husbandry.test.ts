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

// Husbandry (v0.1.66): the first movement-speed tech. Stable, Castle Age,
// 250 food / 500 ticks (technologies.csv:79 — AoK values). +10% movement speed
// for MOUNTED units (cavalry + cavalry archers), DERIVED inside the single
// step executor moveUnitOneSubgridStep via the per-unit carry accumulator
// (movementTechEffects entitle/settle banking into
// UnitTransformComponent.moveCarryHundredths — an additive save field written
// only at speed percent ≠ 100) — no applyTechnology case. The live movement
// races live further down; this block is the cost/gating contract mirroring
// bloodlines.test.ts.

type Bridge = ReturnType<typeof createSimulationBridge>;

describe('Husbandry — cost & research-time tables', () => {
  it('costs 250 food and takes 500 ticks (technologies.csv:79, 50 s × 10 TPS)', () => {
    expect(researchCost('husbandry')).toEqual({ food: 250 });
    expect(researchTimeTicks('husbandry')).toBe(500);
  });
});

describe('Husbandry — gating at the Stable', () => {
  it('is researchable only at the Stable', () => {
    expect(canResearchAt('stable', 'husbandry')).toBe(true);
    expect(canResearchAt('blacksmith', 'husbandry')).toBe(false);
    expect(canResearchAt('town-center', 'husbandry')).toBe(false);
    expect(canResearchAt('barracks', 'husbandry')).toBe(false);
  });

  it('is offered at a Castle+/Stable and drops once researched', () => {
    const bridge: Bridge = createSimulationBridge('imperial-stable-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('husbandry');

    expect(bridge.queueResearch('husbandry')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'stable');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('husbandry');
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('husbandry');
  }, 30_000);

  it('is NOT offered before Castle Age (Feudal-Age Stable)', () => {
    const bridge: Bridge = createSimulationBridge('bloodlines-feudal-stable-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('husbandry');
  });
});

// Movement race on the husbandry fixture twins: knight (10,13) and militia
// (10,16) each run 20 cells straight east on open grass (80 subgrid units —
// 40 ticks at the base 2/tick cadence, ~37 at 110%). Arrival = the unit's
// GRID cell equals the target; the twins share the seed so entity ids / slot
// offsets / fine thresholds are identical and tick counts compare exactly.

const KNIGHT_TARGET = { x: 30, y: 13 };
const MILITIA_TARGET = { x: 30, y: 16 };

function getOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function commandMoveTo(
  bridge: Bridge,
  unitType: string,
  target: { x: number; y: number },
): void {
  expect(selectOwnedUnitDirect(bridge, 1, unitType)).toBe(true);
  expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
}

function arrivalTick(
  bridge: Bridge,
  unitType: string,
  target: { x: number; y: number },
  maxTicks = 200,
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

describe('Husbandry — +10% mounted movement speed (per-unit carry accumulator)', () => {
  it('a Husbandry knight outraces a baseline knight over the same straight 20-cell run', () => {
    const baseline: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    const researched: Bridge = createSimulationBridge('husbandry-movement-researched-fixture');

    commandMoveTo(baseline, 'knight', KNIGHT_TARGET);
    commandMoveTo(researched, 'knight', KNIGHT_TARGET);

    const baselineTicks = arrivalTick(baseline, 'knight', KNIGHT_TARGET);
    const researchedTicks = arrivalTick(researched, 'knight', KNIGHT_TARGET);

    // ~10% faster over 20 cells is ≥ 2 whole ticks — a 1-tick gap could be a
    // rounding artifact, a 0-tick gap means the tech is a silent no-op.
    expect(researchedTicks).toBeLessThan(baselineTicks);
    expect(baselineTicks - researchedTicks).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('a non-mounted militia walks identically with and without Husbandry', () => {
    const baseline: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    const researched: Bridge = createSimulationBridge('husbandry-movement-researched-fixture');

    commandMoveTo(baseline, 'militia', MILITIA_TARGET);
    commandMoveTo(researched, 'militia', MILITIA_TARGET);

    const baselineTicks = arrivalTick(baseline, 'militia', MILITIA_TARGET);
    const researchedTicks = arrivalTick(researched, 'militia', MILITIA_TARGET);

    expect(researchedTicks).toBe(baselineTicks);
  }, 30_000);

  it('a knight commanded AFTER a live husbandry research walks faster than an unresearched control', () => {
    const bridge: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueResearch('husbandry')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'stable');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('husbandry');
        },
        { maxSteps: 700 },
      ),
    ).toBe(true);

    commandMoveTo(bridge, 'knight', KNIGHT_TARGET);
    const liveResearchedTicks = arrivalTick(bridge, 'knight', KNIGHT_TARGET);

    const control: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    commandMoveTo(control, 'knight', KNIGHT_TARGET);
    const controlTicks = arrivalTick(control, 'knight', KNIGHT_TARGET);

    expect(liveResearchedTicks).toBeLessThan(controlTicks);
  }, 60_000);
});

describe('Husbandry — carry-field hygiene + in-flight research', () => {
  it('never materializes moveCarryHundredths at 100% and banks it only on boosted movers', () => {
    const baseline: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    const researched: Bridge = createSimulationBridge('husbandry-movement-researched-fixture');

    commandMoveTo(baseline, 'knight', KNIGHT_TARGET);
    commandMoveTo(researched, 'knight', KNIGHT_TARGET);
    commandMoveTo(researched, 'militia', MILITIA_TARGET);
    for (let tick = 0; tick < 10; tick += 1) {
      baseline.step(100);
      researched.step(100);
    }

    // The un-teched world must never materialize the field — the changelog's
    // "only boosted units persist the counter" promise.
    for (const id of baseline.world.query('unit', 'unitTransform')) {
      const transform = baseline.world.getComponent<{ moveCarryHundredths?: number }>(id, 'unitTransform');
      expect(transform?.moveCarryHundredths).toBeUndefined();
    }

    // On the researched twin only the BOOSTED mover banks carry; the moving
    // militia (percent 100) stays clean.
    const boostedKnight = getOwnedUnit(researched, 1, 'knight');
    const unboostedMilitia = getOwnedUnit(researched, 1, 'militia');
    expect(boostedKnight).toBeDefined();
    expect(unboostedMilitia).toBeDefined();
    const knightTransform = researched.world.getComponent<{ moveCarryHundredths?: number }>(
      boostedKnight!.id,
      'unitTransform',
    );
    const militiaTransform = researched.world.getComponent<{ moveCarryHundredths?: number }>(
      unboostedMilitia!.id,
      'unitTransform',
    );
    expect(typeof knightTransform?.moveCarryHundredths).toBe('number');
    expect(militiaTransform?.moveCarryHundredths).toBeUndefined();
  }, 30_000);

  it('research completing MID-WALK accelerates the remainder of the walk', () => {
    // 30 cells east of the knight; research (500 ticks) is queued at t0 and
    // the walk starts at t460, so completion lands ~2/3 into the ~60-tick
    // walk and only the remainder runs at 110% — still strictly earlier than
    // the never-researched control walking the same lane from the same tick.
    const FAR_TARGET = { x: 40, y: 13 };
    const PRE_TICKS = 460;

    const live: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    expect(selectOwnedBuildingDirect(live, 1, 'stable')).toBe(true);
    expect(live.queueResearch('husbandry')).toBe(true);
    for (let tick = 0; tick < PRE_TICKS; tick += 1) {
      live.step(100);
    }
    commandMoveTo(live, 'knight', FAR_TARGET);
    const liveTicks = arrivalTick(live, 'knight', FAR_TARGET);

    const control: Bridge = createSimulationBridge('husbandry-movement-baseline-fixture');
    for (let tick = 0; tick < PRE_TICKS; tick += 1) {
      control.step(100);
    }
    commandMoveTo(control, 'knight', FAR_TARGET);
    const controlTicks = arrivalTick(control, 'knight', FAR_TARGET);

    expect(liveTicks).toBeLessThan(controlTicks);
  }, 60_000);
});
