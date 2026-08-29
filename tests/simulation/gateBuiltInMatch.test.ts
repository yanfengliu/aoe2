// A gate BUILT during the match must open for its owner (v0.3.161).
//
// The seeded gates in `gate-fixture` had always opened, so every gate test
// passed — but a seeded building carries NO construction-state entry, while a
// built one keeps its entry forever with `isComplete` flipped to true.
// `admitsThroughGate` read completion as "has no construction entry", so every
// gate a player actually built stayed shut to them for the rest of the match:
// walling your own base in was a way to lock yourself out of it.
//
// These walk the real thing — place the gate through the command flow, build
// it to completion, then send units at it.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

const GATE_CELL = { x: 20, y: 12 };

type Bridge = ReturnType<typeof createSimulationBridge>;

/** Place the gate in the wall's hole and build it to completion. */
function buildTheGate(bridge: Bridge): void {
  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  placeBuildingNearTownCenter(bridge, 'stone-gate', 1, [GATE_CELL]);
  const finished = stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().buildings.some((building) => (
      building.buildingType === 'stone-gate'
      && building.x === GATE_CELL.x
      && building.y === GATE_CELL.y
      && building.isComplete
    )),
    { maxSteps: 4000 },
  );
  expect(finished, 'the villager never finished the gate').toBe(true);
}

/** Send `owner`'s scout across the wall line; true if it reached the far side. */
function walkAcross(bridge: Bridge, owner: number, toX: number): boolean {
  const scout = bridge.getEconomyState().units.find(
    (unit) => unit.owner === owner && unit.unitType === 'scout',
  );
  if (!scout) throw new Error(`no scout for owner ${String(owner)}`);
  const startX = scout.x;
  const accepted = bridge.world.submitWithResult('unit.move', {
    unitId: scout.id,
    target: { x: toX, y: GATE_CELL.y },
  });
  expect(accepted.accepted).toBe(true);
  // Generous enough at §12.4.2 walk speed for a scout to cross several times
  // over, so a scout that has not crossed is one that cannot.
  return stepBridgeUntil(
    bridge,
    () => {
      const now = bridge.getEconomyState().units.find((unit) => unit.id === scout.id);
      if (!now) return false;
      return startX < GATE_CELL.x ? now.x > GATE_CELL.x : now.x < GATE_CELL.x;
    },
    { maxSteps: 4000 },
  );
}

describe('a gate built during the match', () => {
  it('opens for the player who built it', () => {
    const bridge = createSimulationBridge('gate-built-in-match-fixture');
    buildTheGate(bridge);
    expect(walkAcross(bridge, 1, 24), 'the builder could not use its own gate').toBe(true);
  });

  it('stays shut to the enemy', () => {
    const bridge = createSimulationBridge('gate-built-in-match-fixture');
    buildTheGate(bridge);
    expect(walkAcross(bridge, 2, 16), 'an enemy walked through a built gate').toBe(false);
  });

  // The v0.3.160 unreachable-plan cache remembers "no path exists" against the
  // occupancy revision, and a gate opening claims no cell — so without an
  // explicit bump on completion, a villager that gave up while the gate was a
  // foundation would keep refusing the route after the gate opened. This is
  // the test for that bump: order the gather while the way is sealed, then
  // finish the gate and require the food to arrive anyway.
  it('reopens a route that was cached as unreachable while it was a foundation', () => {
    const bridge = createSimulationBridge('gate-built-in-match-fixture');

    // Send the gatherer at the berries beyond the wall while the way is still
    // open — a gather at an unreachable resource is refused outright, so the
    // route has to be sealed UNDER the villager rather than before it starts.
    const gatherer = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.y === 13,
    );
    expect(gatherer, 'the fixture lost its gatherer').toBeDefined();
    expect(bridge.selectEntityById(gatherer!.id)).toBe(true);
    const berries = bridge.getEconomyState().resources.find(
      (resource) => resource.x === 24 && resource.y === 12,
    );
    expect(berries, 'the fixture lost its far-side berries').toBeDefined();
    expect(bridge.issueContextCommandAtEntity(berries!.id)).toBe(true);

    // Now close the hole in front of it. The builder is the villager on the
    // gate's own row; the gatherer must not be the one holding the hammer.
    const builder = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.y === 12,
    );
    expect(builder, 'the fixture lost its builder').toBeDefined();
    expect(bridge.selectEntityById(builder!.id)).toBe(true);
    // Pinned, not assumed: the placement helper falls back to a ring search
    // around the Town Centre when the preferred anchor is invalid, and a gate
    // built anywhere else would leave the hole open and pass this vacuously.
    expect(placeBuildingNearTownCenter(bridge, 'stone-gate', 1, [GATE_CELL])).toEqual(GATE_CELL);

    // Long enough for the gatherer to reach the sealed wall, fail to path,
    // and have that refusal cached — and short of the 700-tick build time, so
    // the route really is sealed for all of it.
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    const sealedGate = bridge.getEconomyState().buildings.find((building) => (
      building.buildingType === 'stone-gate' && building.x === GATE_CELL.x
    ));
    expect(sealedGate?.isComplete, 'the gate finished before the route was sealed').toBe(false);
    const foodWhileSealed = bridge.getEconomyState().playerResources[1]?.food ?? 0;
    expect(foodWhileSealed, 'the gatherer got through while the wall was sealed').toBe(0);

    // Now let the builder finish. The gate opens for its owner, and the
    // gatherer must take the route it had already written off.
    const gathered = stepBridgeUntil(
      bridge,
      () => (bridge.getEconomyState().playerResources[1]?.food ?? 0) > foodWhileSealed,
      { maxSteps: 6000 },
    );
    expect(gathered, 'the villager never used the route its gate opened').toBe(true);
  });

  // Spec §gates: an unfinished gate admits NOBODY, its own builder included.
  // Two independent layers enforce that, which is worth stating because it
  // bounds what this test can prove: the foundation's occupancy claim blocks
  // the cell, AND `gateAdmits` refuses on `isComplete`. Measured 2026-08-29 by
  // forcing the completion read to a hardcoded `true`: `isCellPassableForUnit`
  // then answered TRUE for the owner at the gate cell and the scout still did
  // not enter. So this pins the RULE, not the completion read — the read's own
  // discriminator is the built-gate case above, which fails without the fix.
  // An enemy proves less still: `gateAdmits` refuses a non-ally on the owner
  // branch whatever `isComplete` says.
  it('shuts out its OWN owner while it is still a foundation', () => {
    const bridge = createSimulationBridge('gate-built-in-match-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    const anchor = placeBuildingNearTownCenter(bridge, 'stone-gate', 1, [GATE_CELL]);
    expect(anchor).toEqual(GATE_CELL);

    const scout = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    expect(scout, 'the fixture lost its owner scout').toBeDefined();
    const accepted = bridge.world.submitWithResult('unit.move', {
      unitId: scout!.id,
      target: { x: 24, y: GATE_CELL.y },
    });
    expect(accepted.accepted).toBe(true);
    // 300 ticks: ample for a 150%-speed scout to cross seven open cells, and
    // less than half the gate's build time.
    const crossed = stepBridgeUntil(
      bridge,
      () => {
        const now = bridge.getEconomyState().units.find((unit) => unit.id === scout!.id);
        return now ? now.x > GATE_CELL.x : false;
      },
      { maxSteps: 300 },
    );
    const gate = bridge.getEconomyState().buildings.find((building) => (
      building.buildingType === 'stone-gate' && building.x === GATE_CELL.x
    ));
    expect(gate?.isComplete, 'the gate finished inside the window').toBe(false);
    expect(crossed, 'the owner walked through its own gate FOUNDATION').toBe(false);
  });

  it('stays shut to the enemy while it is still a foundation', () => {
    const bridge = createSimulationBridge('gate-built-in-match-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(placeBuildingNearTownCenter(bridge, 'stone-gate', 1, [GATE_CELL])).toEqual(GATE_CELL);
    expect(walkAcross(bridge, 2, 16), 'an enemy walked through a gate foundation').toBe(false);
  });
});
