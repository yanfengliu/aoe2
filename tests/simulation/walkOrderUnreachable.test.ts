// GATE: a walk order the game cannot carry out is never dropped in silence.
//
// Found by the standing loop playing a 93-minute Black Forest match: select the
// whole army, attack-move across the map, and nothing happens at all — no
// movement, no message, no console error, and the command is accepted. An
// independent flood fill over terrain + building/resource footprints showed the
// map had sealed itself (enemy units reachable 4/4 at tick 0, 0/26 by tick
// 20,000), so the route genuinely did not exist. Two things were wrong with
// that: `resolveMovePlanFromCache` gave up entirely when the ordered cell sat
// more than `max(mapWidth, mapHeight)` manhattan cells from every cell the unit
// could reach (so the unit did not even walk toward it), and either way the
// player was told nothing.
//
// WHAT A GREEN RUN HERE DOES NOT PROVE (the bound):
//  - ONE map size (60x36) and ONE sealed shape (a 6x6 pocket inside a closed
//    ring of trees). A pocket sealed by BUILDINGS rather than trees is the same
//    predicate (`blocksWholeCell` covers both) but is not exercised here.
//  - LAND units only. A ship ordered across land is not covered.
//  - The move and attack-move orders only. Patrol, attack-ground, gather,
//    build and garrison walks share `resolveMovePlanFromCache` but are not
//    asserted here.
//  - It says nothing about WHY the map seals itself — that is map generation
//    and building placement, not order dispatch.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  WALLED_POCKET_FAR_TARGET,
  WALLED_POCKET_INSIDE_UNIT,
  WALLED_POCKET_LONG_REACHABLE_TARGET,
  WALLED_POCKET_NEAREST_TO_FAR_TARGET,
  WALLED_POCKET_OUTSIDE_UNIT,
} from '../../src/game/simulation/fixtures/walledPocket';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function bootWalledPocket(): Bridge {
  // Owner 2's AI is off so nothing but the order under test moves anything.
  return createSimulationBridge('walled-pocket-fixture', {
    disableAiForOwners: new Set([2]),
  });
}

function unitAt(bridge: Bridge, cell: { x: number; y: number }): number {
  const unit = bridge
    .getEconomyState()
    .units.find((candidate) => candidate.owner === 1 && candidate.x === cell.x && candidate.y === cell.y);
  expect(unit, `expected an owner-1 unit at (${cell.x},${cell.y})`).toBeDefined();
  return unit?.id ?? -1;
}

function positionOf(bridge: Bridge, unitId: number): { x: number; y: number } {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === unitId);
  expect(unit, `unit ${unitId} vanished`).toBeDefined();
  return { x: unit?.x ?? -1, y: unit?.y ?? -1 };
}

function drainRejections(bridge: Bridge): string[] {
  const drained: string[] = [];
  let next = bridge.consumeCommandRejection();
  while (next !== null) {
    drained.push(next);
    next = bridge.consumeCommandRejection();
  }
  return drained;
}

describe('a walk order the game cannot carry out', () => {
  // CONTROL. A fix that refuses more orders than it should breaks this first.
  it('control: a short order inside the pocket is still carried out', () => {
    const bridge = bootWalledPocket();
    const scout = unitAt(bridge, WALLED_POCKET_INSIDE_UNIT);
    const target = { x: 5, y: 5 };

    expect(bridge.selectEntityById(scout)).toBe(true);
    expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
    const arrived = stepBridgeUntil(
      bridge,
      () => {
        const at = positionOf(bridge, scout);
        return Math.abs(at.x - target.x) + Math.abs(at.y - target.y) <= 1;
      },
      { maxSteps: 400 },
    );

    expect(arrived).toBe(true);
    expect(drainRejections(bridge)).toEqual([]);
  });

  // CONTROL. 86 manhattan cells — past the old candidate radius of
  // max(60, 36) = 60 — over ground that is open the whole way.
  it('control: a long order across a reachable map is carried out', () => {
    const bridge = bootWalledPocket();
    const scout = unitAt(bridge, WALLED_POCKET_OUTSIDE_UNIT);
    const target = WALLED_POCKET_LONG_REACHABLE_TARGET;

    expect(bridge.selectEntityById(scout)).toBe(true);
    expect(bridge.issueMoveCommand(target.x, target.y)).toBe(true);
    const arrived = stepBridgeUntil(
      bridge,
      () => {
        const at = positionOf(bridge, scout);
        return Math.abs(at.x - target.x) + Math.abs(at.y - target.y) <= 1;
      },
      { maxSteps: 2000 },
    );

    expect(arrived).toBe(true);
    expect(drainRejections(bridge)).toEqual([]);
  });

  // THE DEFECT, half one: the order is carried out as far as it CAN be.
  it('walks as far toward an unreachable cell as it can instead of standing still', () => {
    const bridge = bootWalledPocket();
    const scout = unitAt(bridge, WALLED_POCKET_INSIDE_UNIT);
    const start = positionOf(bridge, scout);

    expect(bridge.selectEntityById(scout)).toBe(true);
    expect(bridge.issueMoveCommand(WALLED_POCKET_FAR_TARGET.x, WALLED_POCKET_FAR_TARGET.y)).toBe(true);
    const reached = stepBridgeUntil(
      bridge,
      () => {
        const at = positionOf(bridge, scout);
        return at.x === WALLED_POCKET_NEAREST_TO_FAR_TARGET.x
          && at.y === WALLED_POCKET_NEAREST_TO_FAR_TARGET.y;
      },
      { maxSteps: 400 },
    );

    const end = positionOf(bridge, scout);
    expect(
      reached,
      `sealed unit went from (${start.x},${start.y}) to (${end.x},${end.y}); expected it to walk`
      + ` to the pocket cell nearest the ordered one,`
      + ` (${WALLED_POCKET_NEAREST_TO_FAR_TARGET.x},${WALLED_POCKET_NEAREST_TO_FAR_TARGET.y})`,
    ).toBe(true);
  });

  // THE DEFECT, half two: the player learns the order cannot be carried out.
  // A toast, through the same rejection queue the placement validator and the
  // market action already use.
  it('tells the player the ordered cell cannot be reached', () => {
    const bridge = bootWalledPocket();
    const scout = unitAt(bridge, WALLED_POCKET_INSIDE_UNIT);

    expect(bridge.selectEntityById(scout)).toBe(true);
    expect(bridge.issueMoveCommand(WALLED_POCKET_FAR_TARGET.x, WALLED_POCKET_FAR_TARGET.y)).toBe(true);
    const said = drainRejections(bridge);

    expect(said.length, 'the order was accepted and dropped with nothing said').toBeGreaterThan(0);
    // Names the input that caused it and what would satisfy it.
    expect(said[0]).toContain(`${WALLED_POCKET_FAR_TARGET.x}`);
    expect(said[0]).toContain(`${WALLED_POCKET_FAR_TARGET.y}`);
    expect(said[0]?.toLowerCase()).toContain('reach');
  });

  // Attack-move is the order the loop actually gave when it found this, and it
  // reaches the same resolver by a different facade.
  it('tells the player when an attack-move cannot be carried out either', () => {
    const bridge = bootWalledPocket();
    const scout = unitAt(bridge, WALLED_POCKET_INSIDE_UNIT);

    expect(bridge.selectEntityById(scout)).toBe(true);
    expect(
      bridge.issueAttackMoveCommand(WALLED_POCKET_FAR_TARGET.x, WALLED_POCKET_FAR_TARGET.y),
    ).toBe(true);

    expect(drainRejections(bridge).length).toBeGreaterThan(0);
  });
});
