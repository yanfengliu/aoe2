// Farms are walkable ground (2026-09-08).
//
// In Definitive Edition every land unit of every player walks across a farm;
// only the Mill or Town Centre beside it blocks. Here a farm's footprint was an
// engine occupancy claim like any building's, and the engine refuses a unit
// slot on a cell another entity occupies — so flipping the passability
// predicate alone would have routed units through farms and stacked them there
// as overflow. `structureClaimKind` decides the claim kind instead, and this
// suite is the class gate for it: a land unit crosses an ENEMY farm and takes a
// real slot on it, a Town Centre ringed by farms still spawns what it trains,
// a house stays a wall, and nothing can be built on a farm.
//
// BOUND (what a green run does not prove): ONE map (`farms-are-walkable-
// fixture`), 1x1 farms, one ordered land unit type (militia) plus one trained
// villager, COMPLETE farms only (fixture spawns seed complete — a foundation
// takes the same claim kind but is not exercised here), no water domain, no
// wildlife, no save/load round trip, a 3,000-tick window per move order and a
// 600-tick window for the trained villager. Ships, deer, foundations, 3x3
// farms and the farmer's own stance are outside it.
//
// Instrument check: the fixture's farm and house counts are asserted at boot,
// so a fixture that failed to seed reads as red rather than as "never
// entered".
//
// Mutation proofs are recorded in the handoff for this change: (a)
// `structureClaimKind` → 'building' for farms reddens the crossing and spawn
// cases and leaves the house control green; (b) → 'farm' for houses reddens
// the control alone.

import { describe, expect, it } from 'vitest';
import type { Position } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { UnitTransformComponent } from '../../src/game/simulation/types';
import {
  BUILDER_VILLAGER,
  FARM_GAP_CELLS,
  FARM_MILITIA_GOAL,
  FARM_MILITIA_START,
  HOUSE_CELLS,
  HOUSE_MILITIA_GOAL,
  HOUSE_MILITIA_START,
  TOWN_CENTER,
  TOWN_CENTER_RING,
  WALL_X,
} from '../../src/game/simulation/fixtures/farmsAreWalkable';
import { selectOwnedBuildingDirect, selectOwnedUnitDirect } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const SEED = 'farms-are-walkable-fixture';
const MOVE_WINDOW_TICKS = 3000;
const TRAIN_WINDOW_TICKS = 600;

const sameCell = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
const cellOf = (bridge: Bridge, id: number): Position | null =>
  bridge.world.getComponent<Position>(id, 'position') ?? null;
const cellText = (cell: Position | null): string =>
  (cell ? `(${String(cell.x)},${String(cell.y)})` : 'nowhere');

function ownedUnitAt(bridge: Bridge, unitType: string, start: Position): number {
  const unit = bridge.getEconomyState().units.find((candidate) => {
    if (candidate.owner !== 1 || candidate.unitType !== unitType) return false;
    const cell = cellOf(bridge, candidate.id);
    return cell !== null && sameCell(cell, start);
  });
  expect(unit, `the fixture lost its ${unitType} at ${cellText(start)}`).toBeDefined();
  return unit!.id;
}

function orderMove(bridge: Bridge, unitId: number, target: Position): void {
  expect(bridge.world.submitWithResult('unit.move', {
    unitId, target: { x: target.x, y: target.y },
  }).accepted).toBe(true);
}

describe('farms are walkable ground', () => {
  it('seeds the map it claims to: every gap farm, every ring farm, both houses, both militia', () => {
    const bridge = createSimulationBridge(SEED);
    const buildings = bridge.getEconomyState().buildings;
    const farms = buildings.filter((building) => building.buildingType === 'farm');
    expect(farms).toHaveLength(FARM_GAP_CELLS.length + TOWN_CENTER_RING.length);
    expect(farms.every((farm) => farm.isComplete), 'every farm seeds complete').toBe(true);
    expect(buildings.filter((building) => building.buildingType === 'house')).toHaveLength(2);
    for (const cell of [...FARM_GAP_CELLS, ...TOWN_CENTER_RING]) {
      expect(farms.some((farm) => farm.x === cell.x && farm.y === cell.y),
        `no farm at ${cellText(cell)}`).toBe(true);
    }
    expect(TOWN_CENTER_RING).toHaveLength(20);
    ownedUnitAt(bridge, 'militia', FARM_MILITIA_START);
    ownedUnitAt(bridge, 'militia', HOUSE_MILITIA_START);
  });

  it('walks a militia THROUGH an enemy farm to the far side, holding a real slot on it', () => {
    const bridge = createSimulationBridge(SEED);
    const militia = ownedUnitAt(bridge, 'militia', FARM_MILITIA_START);
    orderMove(bridge, militia, FARM_MILITIA_GOAL);

    let farmCellEntered: Position | null = null;
    let transformOnFarm: UnitTransformComponent | null = null;
    let arrived = false;
    for (let tick = 0; tick < MOVE_WINDOW_TICKS; tick += 1) {
      bridge.step(100);
      const cell = cellOf(bridge, militia);
      if (!cell) break;
      if (farmCellEntered === null && FARM_GAP_CELLS.some((farm) => sameCell(cell, farm))) {
        farmCellEntered = { ...cell };
        transformOnFarm = bridge.world.getComponent<UnitTransformComponent>(militia, 'unitTransform') ?? null;
      }
      if (sameCell(cell, FARM_MILITIA_GOAL)) {
        arrived = true;
        break;
      }
    }

    expect(farmCellEntered, 'the militia never stood on a farm cell — the forest leaves no other way east')
      .not.toBeNull();
    // The point of deciding this as a CLAIM KIND: on the farm the unit holds a
    // real sub-cell slot. A predicate-only fix leaves the engine claim in
    // place, the engine refuses every slot, and the unit sits in overflow.
    expect(transformOnFarm?.occupancySlotOverflow, 'the militia stood on the farm as overflow').not.toBe(true);
    expect(Number.isFinite(transformOnFarm?.occupancySlotX), 'no slot was assigned on the farm').toBe(true);
    expect(arrived, 'the militia crossed the farm but never arrived').toBe(true);
  });

  it('control: the same order across a house-closed gap never enters a house cell and never arrives', () => {
    const bridge = createSimulationBridge(SEED);
    const militia = ownedUnitAt(bridge, 'militia', HOUSE_MILITIA_START);
    orderMove(bridge, militia, HOUSE_MILITIA_GOAL);

    let enteredHouseCell: Position | null = null;
    let crossedTheWall: Position | null = null;
    for (let tick = 0; tick < MOVE_WINDOW_TICKS; tick += 1) {
      bridge.step(100);
      const cell = cellOf(bridge, militia);
      if (!cell) break;
      if (enteredHouseCell === null && HOUSE_CELLS.some((house) => sameCell(cell, house))) {
        enteredHouseCell = { ...cell };
      }
      if (crossedTheWall === null && cell.x > WALL_X) crossedTheWall = { ...cell };
    }

    expect(enteredHouseCell, `a militia walked through a house at ${cellText(enteredHouseCell)}`).toBeNull();
    expect(crossedTheWall, `a militia reached the far side of a house-closed gap at ${cellText(crossedTheWall)}`)
      .toBeNull();
  });

  it('a Town Centre ringed by farms still trains a villager, and it appears on a farm cell', () => {
    const bridge = createSimulationBridge(SEED);
    const villagersBefore = new Set(
      bridge.getEconomyState().units
        .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
        .map((unit) => unit.id),
    );
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueTrainUnit('villager')).toBe(true);

    let trained: number | null = null;
    for (let tick = 0; tick < TRAIN_WINDOW_TICKS && trained === null; tick += 1) {
      bridge.step(100);
      const fresh = bridge.getEconomyState().units.find((unit) =>
        unit.owner === 1 && unit.unitType === 'villager' && !villagersBefore.has(unit.id));
      if (fresh) trained = fresh.id;
    }

    expect(trained, 'the Town Centre trained nothing — its farm ring was read as a wall').not.toBeNull();
    const cell = cellOf(bridge, trained!);
    expect(cell).not.toBeNull();
    expect(TOWN_CENTER_RING.some((farm) => sameCell(cell!, farm)),
      `the villager appeared at ${cellText(cell)}, which is not one of the ring farms`).toBe(true);
  });

  it('still refuses to build on a farm, and names the farm', () => {
    const bridge = createSimulationBridge(SEED);
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    // A 2x2 house anchored here covers two ring farms (y = TOWN_CENTER.y + 4 is
    // the ring's south row) and two open cells.
    const onFarm: Position = { x: TOWN_CENTER.x + 3, y: TOWN_CENTER.y + 4 };
    expect(TOWN_CENTER_RING.some((farm) => sameCell(farm, onFarm))).toBe(true);
    expect(bridge.getPlacementPreview(onFarm.x, onFarm.y)?.isValid).toBe(false);
    expect(bridge.confirmBuildingPlacement(onFarm.x, onFarm.y)).toBe(false);
    expect(bridge.consumeCommandRejection()).toContain('a farm (building)');
    // Positive control: open grass beside the builder is still buildable, so
    // the refusal above is the farm's and not a broken placement path.
    expect(bridge.getPlacementPreview(BUILDER_VILLAGER.x + 2, BUILDER_VILLAGER.y)?.isValid).toBe(true);
  });
});
