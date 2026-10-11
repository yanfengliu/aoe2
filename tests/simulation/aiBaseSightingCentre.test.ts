// The AI's base-sighting scan is a circle of 12 cells around the MIDDLE of its
// Town Center, the point the Town Center sees from (work 117, register
// 2026-10-11; spec §12.2 measures building sight from the footprint's centre).
// It used to be a circle around the footprint's top-left cell. Then an enemy
// the Town Center plainly saw two or three cells past its south-east corner was
// never sighted — with Town Watch, DE's Town Center sees 12 cells from its
// middle, which reaches about 14 from that corner along the diagonal — while
// one standing off the north-west corner, farther from the middle than 12,
// was.
//
// The scan feeds the town bell and the watch-tower reply (§13.2), so a missed
// sighting is a raid the AI does not answer.
//
// BOUND: one map (`ai-under-raid-fixture`: the AI's 4x4 Town Center at (20,12)
// with open grass all round), sixteen probe cells — a cell just inside 12 and
// one just outside along each of eight directions from the footprint's centre
// — and one decision of the real AI system per probe. The AI's own sight is not
// what is under test, so the Town Center's line of sight is set to 16 (Town
// Watch and Town Patrol on DE's 8), which lights every probe; the enemy is a
// human Militia set down on the probe with the other two Militia set down far
// outside that sight.

import { describe, expect, it } from 'vitest';

import { aiStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { VisionSourceComponent } from '../../src/game/simulation/types';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

const AI = 2;
const TOWN_CENTER = { x: 20, y: 12 };
const TOWN_CENTER_SIZE = 4;
const SCAN_RADIUS = 12;

/** Written out independently of the code under test: a cell's centre is
 *  (x + 0.5, y + 0.5) and the footprint's is (ax + 2, ay + 2). */
function insideScan(cell: { x: number; y: number }): boolean {
  const dx = cell.x + 0.5 - (TOWN_CENTER.x + TOWN_CENTER_SIZE / 2);
  const dy = cell.y + 0.5 - (TOWN_CENTER.y + TOWN_CENTER_SIZE / 2);
  return dx * dx + dy * dy <= SCAN_RADIUS * SCAN_RADIUS;
}

// A cell just inside the circle and one just outside it, along each of eight
// directions from the footprint's centre (22, 14): on the axis rows and the
// diagonals, or one cell beside a diagonal. South-east (29,22), nine and ten
// cells from the corner, is the case work 117 was opened for.
const PROBES: ReadonlyArray<{ name: string; x: number; y: number }> = [
  { name: 'east, inside', x: 33, y: 13 },
  { name: 'east, outside', x: 34, y: 13 },
  { name: 'west, inside', x: 10, y: 13 },
  { name: 'west, outside', x: 9, y: 13 },
  { name: 'south, inside', x: 21, y: 25 },
  { name: 'south, outside', x: 21, y: 26 },
  { name: 'north, inside', x: 21, y: 2 },
  { name: 'north, outside', x: 21, y: 1 },
  { name: 'south-east, inside', x: 29, y: 22 },
  { name: 'south-east, outside', x: 30, y: 22 },
  { name: 'north-west, inside', x: 14, y: 6 },
  { name: 'north-west, outside', x: 13, y: 5 },
  { name: 'north-east, inside', x: 30, y: 6 },
  { name: 'north-east, outside', x: 30, y: 5 },
  { name: 'south-west, inside', x: 14, y: 21 },
  { name: 'south-west, outside', x: 13, y: 22 },
];

interface SightingState {
  lastDecisionTick: number;
  lastEnemySightingTick: number;
  lastEnemySightingPosition: { x: number; y: number } | null;
}

/** The AI's state as the world holds it after a tick (the slot is flushed at
 *  every tick's end), without serialising a whole save per step. */
function aiState(bridge: ReturnType<typeof createSimulationBridge>): SightingState {
  const rows = (bridge.world.getState(aiStatesCodec.slot) ?? []) as unknown as Array<[number, SightingState]>;
  const row = rows.find(([owner]) => owner === AI);
  if (!row) throw new Error('The fixture seeded no AI state for owner 2.');
  return row[1];
}

/** One AI decision with a single enemy, a human Militia, standing on `probe`. */
function sightingWithEnemyAt(probe: { x: number; y: number }): SightingState {
  const bridge = createSimulationBridge('ai-under-raid-fixture');
  const world = bridge.world;
  const economy = bridge.getEconomyState();
  const townCenter = economy.buildings.find((building) => building.owner === AI && building.buildingType === 'town-center')!;
  expect(townCenter, 'the premise: the AI Town Center stands where this test measures from').toMatchObject(TOWN_CENTER);
  const sight = world.getComponent<VisionSourceComponent>(townCenter.id, 'visionSource')!;
  world.setComponent(townCenter.id, 'visionSource', { ...sight, radius: 16 });

  const militia = economy.units.filter((unit) => unit.owner === 1 && unit.unitType === 'militia');
  expect(militia).toHaveLength(3);
  world.setPosition(militia[0]!.id, probe);
  world.setPosition(militia[1]!.id, { x: 50, y: 30 });
  world.setPosition(militia[2]!.id, { x: 52, y: 30 });

  // The AI decides on its first tick and every 30 ticks after. Its first
  // decision may read the sight from before the Militia were set down, so
  // wait for one that cannot have.
  expect(stepBridgeUntil(bridge, () => aiState(bridge).lastDecisionTick >= 2, { maxSteps: 120 })).toBe(true);
  const state = aiState(bridge);
  // The premise of a fair probe: the enemy has not moved off it, and the AI's
  // Town Center sees it, so only the scan can decide the answer.
  expect(bridge.getEconomyState().units.find((unit) => unit.id === militia[0]!.id)).toMatchObject({ x: probe.x, y: probe.y });
  expect(bridge.isCellVisibleForOwner(AI, probe.x, probe.y), 'the premise: the AI can see the probe cell').toBe(true);
  return state;
}

describe('the AI sights an enemy within 12 cells of the middle of its Town Center', () => {
  it.each(PROBES)('$name of the footprint, at ($x,$y)', (probe) => {
    const state = sightingWithEnemyAt(probe);
    if (insideScan(probe)) {
      expect(state.lastEnemySightingPosition, 'an enemy inside the scan the AI can see was not sighted').toEqual({ x: probe.x, y: probe.y });
    } else {
      expect(state.lastEnemySightingTick, `an enemy outside the scan was sighted at ${JSON.stringify(state.lastEnemySightingPosition)}`).toBe(-1);
    }
  });

  it('holds probes on both sides of the circle in every direction', () => {
    // The table above is the gate's reach: without both kinds in every
    // direction, a scan shifted off the centre could pass on the side it
    // still covers.
    for (const direction of ['east', 'west', 'north', 'south', 'north-east', 'north-west', 'south-east', 'south-west']) {
      const probes = PROBES.filter((probe) => probe.name.split(',')[0] === direction);
      expect(probes.map(insideScan).sort(), direction).toEqual([false, true]);
    }
  });
});
