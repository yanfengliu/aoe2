// A villager converted beside its own side's gate must not walk through that
// gate afterwards — it belongs to the enemy now, and a gate admits only its
// owner's units.
//
// Review C1 (docs/threads/current/concurrency-review-2026-09-02): the
// approach-plan cache keys a remembered route on (unit, start cell, target,
// structural revision) and replays it without re-checking passability, while
// the search that produced it read the asking unit's OWNER (a gate admits its
// owner and allies). Monk conversion flipped `unit.owner` in place and moved
// the revision not at all, so a converted villager standing where it had
// planned a step into its old side's gate replayed that step and walked
// through the enemy's wall; the entry only died at the next unrelated
// structural change, a window measured at median 97-746 ticks and up to
// ~2,000 in play, and unbounded in a quiet late game. The reviewer's R4a
// reproduction is the unit-level shape; this is the same defect walked
// through the real bridge — fixture, monk, conversion, gather orders and all.
//
// The conversion is injected nearly complete (progress 48 of 50) into a save
// of the booted fixture, so that it lands two ticks after the villager's
// gather order — after the route through the gate has been remembered from
// the cell beside it, and before the villager has walked out of that cell.

import { describe, expect, it } from 'vitest';

import {
  conversionStateCodec,
  monkTasksCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { MONK_CONVERT_FLIP_THRESHOLD } from '../../src/game/simulation/bridge/bridgeConstants';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

const GATE_X = 20;
const BESIDE_THE_GATE = { x: 19, y: 12 };

function unitOf(bridge: Bridge, owner: number, unitType: string): { id: number; x: number; y: number } {
  const unit = bridge.getEconomyState().units.find((u) => u.owner === owner && u.unitType === unitType);
  if (!unit) throw new Error(`the fixture has no ${unitType} for owner ${String(owner)}`);
  return unit;
}

function unitById(bridge: Bridge, id: number): { owner: number; x: number; y: number; task: string } {
  const unit = bridge.getEconomyState().units.find((u) => u.id === id);
  if (!unit) throw new Error(`unit ${String(id)} is gone`);
  return unit;
}

function orderGather(bridge: Bridge, unitId: number, resourceId: number): void {
  const result = bridge.world.submitWithResult('unit.gather', { unitId, resourceId });
  expect(result.accepted, 'the gather order was refused').toBe(true);
}

/** Boot the fixture, order the villager through its own gate, and convert it
 *  two ticks later while it still stands beside the gate. */
function convertBesideTheGate(): { bridge: Bridge; villagerId: number; berriesId: number } {
  const booted = createSimulationBridge('converted-unit-gate-fixture');
  const villager = unitOf(booted, 2, 'villager');
  const monk = unitOf(booted, 1, 'monk');
  const berries = booted.getEconomyState().resources.find((r) => r.resourceType === 'berry-bush');
  if (!berries) throw new Error('the fixture has no berry bush');
  expect(villager).toMatchObject(BESIDE_THE_GATE);

  const blob = asSchema2Blob(booted.saveGame());
  worldStateOf(blob)[monkTasksCodec.slot] = [
    [monk.id, { kind: 'convert', targetEntityRef: { id: villager.id, generation: 0 } }],
  ];
  worldStateOf(blob)[conversionStateCodec.slot] = [
    [villager.id, { byOwner: 1, progress: MONK_CONVERT_FLIP_THRESHOLD - 2 }],
  ];
  const bridge = createSimulationBridge('converted-unit-gate-fixture', { savedGame: blob });

  orderGather(bridge, villager.id, berries.id);
  let flippedAt: number | null = null;
  for (let tick = 1; tick <= 10 && flippedAt === null; tick += 1) {
    bridge.step(100);
    if (unitById(bridge, villager.id).owner === 1) flippedAt = tick;
  }
  expect(flippedAt, 'the conversion never completed').not.toBeNull();
  // The premise: the villager was converted while still standing beside the
  // gate, having already remembered its route through it.
  expect(unitById(bridge, villager.id), 'the villager left its cell before the conversion landed')
    .toMatchObject(BESIDE_THE_GATE);
  return { bridge, villagerId: villager.id, berriesId: berries.id };
}

describe('a villager converted beside its old side\'s gate', () => {
  it('does not walk through that gate when its new owner sends it to the same food', () => {
    const { bridge, villagerId, berriesId } = convertBesideTheGate();
    // Its new owner wants the same berries, on the far side of a wall that is
    // now an enemy's. The only route is a gate that no longer admits it.
    orderGather(bridge, villagerId, berriesId);
    let furthestEast = BESIDE_THE_GATE.x;
    for (let tick = 0; tick < 400; tick += 1) {
      bridge.step(100);
      furthestEast = Math.max(furthestEast, unitById(bridge, villagerId).x);
    }
    expect(
      furthestEast,
      `the converted villager walked through the enemy gate at x=${String(GATE_X)}`,
    ).toBeLessThan(GATE_X);
  });

  it('stands beside the wall and never touches the food behind it', () => {
    const { bridge, villagerId, berriesId } = convertBesideTheGate();
    const berriesBefore = bridge.getEconomyState().resources.find((r) => r.id === berriesId)?.amount;
    orderGather(bridge, villagerId, berriesId);
    const cellsSeen = new Set<string>();
    for (let tick = 0; tick < 400; tick += 1) {
      bridge.step(100);
      const { x, y } = unitById(bridge, villagerId);
      cellsSeen.add(`${String(x)},${String(y)}`);
    }
    // Re-planned from its own cell: the fresh search finds no route, so the
    // villager takes no step at all — not even the one into the gate cell —
    // and waits under the ordinary unreachable-target rule (spec §12: it
    // re-probes on an interval rather than dropping the order). The wall
    // holds: the berries behind it are exactly as they were.
    expect([...cellsSeen], 'the converted villager moved').toEqual(
      [`${String(BESIDE_THE_GATE.x)},${String(BESIDE_THE_GATE.y)}`],
    );
    expect(bridge.getEconomyState().resources.find((r) => r.id === berriesId)?.amount)
      .toBe(berriesBefore);
  });
});
