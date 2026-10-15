// A relic in a Monk's hands stands on no ground (work 128; defect register
// 2026-10-15; spec §6.9).
//
// The defect: a carried relic kept its resource claim, and the follow step
// moved that claim to the carrying Monk's cell every tick. So the Monk stood on
// blocked ground, and every path search refuses a blocked start. The Monk could
// not walk anywhere. A move order was refused ("blocked ground blocks every
// route out from where the selected unit stands"; work 126 found it), and a
// deposit order out of reach was dropped the tick it was given. No test saw
// it: every test that carried a relic picked it up and stored it without
// taking a step (monastery.relic.test.ts, and the AI's case in
// aiPlayerMonksAndWonder.test.ts). In full matches the computer's Monks picked
// relics up and never brought one home (work 128's ledger in
// scripts/selfplay-audit.mjs).
//
// What these cases hold, all through the player's own controls (a right-click,
// the Delete key): a Monk carrying a relic walks where it is sent; it carries
// the relic to a Monastery out of reach and stores it; it still walks after a
// save and load, since the load rebuilds occupancy from the world and the rule
// must hold there too; a relic whose carrier dies lies on that cell and blocks
// it again, as a relic on the ground does; and a Monk that picks a relic up
// from the cell it stands on, where no follow step moves the relic, can still
// walk off with it.
//
// BOUND: one map of open grass, so the pathfinder's own rules are not under
// test. Whether a relic on the ground should block its cell at all is the
// game's existing rule; it is held here only so that a drop cannot quietly
// change it. A unit standing on the cell where a relic falls is on blocked
// ground until the relic is picked up; that was so before work 128 too. A
// carrier that leaves the map alive lets its relic go too (monkBehaviorSystem's
// follow step), but no order reaches that today: both context channels refuse
// a Monk outright ('monk_should_route_via_facade'), so it cannot garrison.

import { describe, expect, it } from 'vitest';

import {
  monkCarriedRelicCodec,
  relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  CARRIED_MONK_CELL,
  CARRIED_SECOND_MONK_CELL,
  MONK_CARRIED_RELIC_SEED,
} from '../../src/game/simulation/fixtures/monkRelics';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const OWNER = 1;
/** Open grass 14 cells from the Monk, where the player sends it. */
const WALK_TARGET: Cell = { x: 24, y: 16 };

function unitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id) ?? null;
}

function ownUnitAt(bridge: Bridge, unitType: string, cell: Cell) {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === OWNER && candidate.unitType === unitType
      && candidate.x === cell.x && candidate.y === cell.y);
  if (!unit) throw new Error(`The fixture holds no ${unitType} of owner 1 at ${cell.x},${cell.y}.`);
  return unit;
}

function relicById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().resources.find((resource) => resource.id === id) ?? null;
}

/** Monk -> relic, read from the world state the relic rules write. */
function carriedRelics(bridge: Bridge): Map<number, number> {
  return monkCarriedRelicCodec.deserialize(
    bridge.world.getState(monkCarriedRelicCodec.slot) as Array<[number, number]> | undefined,
  );
}

/** Monastery -> relics stored in it. */
function storedRelics(bridge: Bridge): Map<number, number> {
  return relicsInMonasteryCodec.deserialize(
    bridge.world.getState(relicsInMonasteryCodec.slot) as Array<[number, number]> | undefined,
  );
}

/** A right-click on the relic with `monkId` selected, and the wait until it carries it. */
function pickUpWith(bridge: Bridge, monkId: number, relicId: number): void {
  expect(bridge.selectUnitsByIds([monkId])).toBe(true);
  expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);
  expect(
    stepBridgeUntil(bridge, () => carriedRelics(bridge).get(monkId) === relicId, { maxSteps: 50 }),
    'the Monk never picked up the relic beside it',
  ).toBe(true);
}

/** The first Monk picks up the relic beside it. */
function pickUp(bridge: Bridge): { monkId: number; relicId: number } {
  const monk = ownUnitAt(bridge, 'monk', CARRIED_MONK_CELL);
  const relic = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'relic');
  if (!relic) throw new Error('The fixture holds no relic.');
  pickUpWith(bridge, monk.id, relic.id);
  return { monkId: monk.id, relicId: relic.id };
}

/** Selects `unitId`, orders it to `cell` and waits until it stands there. */
function walkTo(bridge: Bridge, unitId: number, cell: Cell, rightClick: boolean): boolean {
  expect(bridge.selectUnitsByIds([unitId])).toBe(true);
  expect(rightClick ? bridge.issueContextCommand(cell.x, cell.y) : bridge.issueMoveCommand(cell.x, cell.y)).toBe(true);
  expect(bridge.consumeCommandRejection(), 'the move order was refused').toBeNull();
  return stepBridgeUntil(bridge, () => {
    const unit = unitById(bridge, unitId);
    return unit !== null && unit.x === cell.x && unit.y === cell.y;
  }, { maxSteps: 400 });
}

/** Deletes the carrier with the Delete key, and returns the cell its relic lies on. */
function carrierDies(bridge: Bridge, monkId: number, relicId: number): Cell {
  expect(bridge.selectUnitsByIds([monkId])).toBe(true);
  expect(bridge.deleteSelectedEntity()).toBe(true);
  bridge.step(100);
  expect(unitById(bridge, monkId)).toBeNull();
  expect(carriedRelics(bridge).size).toBe(0);
  const relic = relicById(bridge, relicId);
  if (!relic) throw new Error('The relic left the map when its carrier let go of it.');
  return { x: relic.x, y: relic.y };
}

describe('a relic in a Monk\'s hands stands on no ground (work 128)', () => {
  it('walks where the player sends it, with the relic in its hands', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);

    expect(walkTo(bridge, monkId, WALK_TARGET, true), 'the Monk carrying a relic never reached the cell it was sent to').toBe(true);
    expect(carriedRelics(bridge).get(monkId)).toBe(relicId);
    expect(relicById(bridge, relicId)).toMatchObject(WALK_TARGET);
  });

  it('carries the relic to its Monastery out of reach and stores it', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    const monastery = bridge.getEconomyState().buildings
      .find((building) => building.owner === OWNER && building.buildingType === 'monastery');
    if (!monastery) throw new Error('The fixture holds no Monastery of owner 1.');

    expect(bridge.selectUnitsByIds([monkId])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(monastery.id)).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => relicById(bridge, relicId) === null, { maxSteps: 900 }),
      'the Monk never brought the relic to its Monastery',
    ).toBe(true);
    expect(storedRelics(bridge).get(monastery.id)).toBe(1);
  });

  it('still walks after the game is saved and loaded with the relic in its hands', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    const blob = bridge.saveGame();
    const loaded = createSimulationBridge(MONK_CARRIED_RELIC_SEED, {
      savedGame: JSON.parse(JSON.stringify(blob)) as typeof blob,
    });

    expect(walkTo(loaded, monkId, WALK_TARGET, true), 'after a load the Monk carrying a relic never reached the cell it was sent to').toBe(true);
    expect(carriedRelics(loaded).get(monkId)).toBe(relicId);
  });

  it('drops the relic where its carrier dies, and the relic blocks that cell as one on the ground does', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    const dropCell = carrierDies(bridge, monkId, relicId);

    // A walk order onto the relic's cell ends at the nearest cell a unit can
    // stand on (moveDestinationSearch.ts), which is beside it.
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === OWNER && unit.unitType === 'villager');
    if (!villager) throw new Error('The fixture holds no villager of owner 1.');
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.issueMoveCommand(dropCell.x, dropCell.y)).toBe(true);
    const settled = stepBridgeUntil(bridge, () => {
      const unit = unitById(bridge, villager.id);
      return unit !== null && unit.task === 'idle'
        && Math.abs(unit.x - dropCell.x) + Math.abs(unit.y - dropCell.y) <= 1;
    }, { maxSteps: 400 });
    const at = unitById(bridge, villager.id)!;
    expect(settled, `the villager never came to rest beside the dropped relic; it stands at ${at.x},${at.y}`).toBe(true);
    expect({ x: at.x, y: at.y }, 'the villager stands on the dropped relic\'s cell').not.toEqual(dropCell);
  });

  it('lets a Monk pick a dropped relic up from the cell it stands on, and walk off with it', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    const carrier = unitById(bridge, monkId)!;
    const shared = { x: carrier.x, y: carrier.y };
    const second = ownUnitAt(bridge, 'monk', CARRIED_SECOND_MONK_CELL);
    expect(walkTo(bridge, second.id, shared, false), 'the second Monk never reached the carrier\'s cell').toBe(true);

    expect(carrierDies(bridge, monkId, relicId)).toEqual(shared);
    pickUpWith(bridge, second.id, relicId);
    expect(walkTo(bridge, second.id, WALK_TARGET, true), 'the Monk that picked the relic up from its own cell never reached the cell it was sent to').toBe(true);
    expect(carriedRelics(bridge).get(second.id)).toBe(relicId);
  });
});
