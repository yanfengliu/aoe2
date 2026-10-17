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
// must hold there too. When the carrier dies, the relic lands on the nearest
// cell nothing claims (relicGround.ts) and blocks it, as a relic on the ground
// does: so a unit that shared the carrier's cell is not stranded, and no relic
// lands on a Farm (review round 0, SF1). Recordings of a carry, and of that
// drop and the unit's walk away, re-simulate exactly. A Monk standing on a
// relic, which only a save made before work 128 can hold, picks it up and walks
// off with it. And no Monk takes a relic out of another Monk's hands, the
// player's or the computer's (SF6).
//
// BOUND: one map of open grass, so the pathfinder's own rules are not under
// test. Whether a relic on the ground should block its cell at all is the
// game's existing rule; it is held here only so that a drop cannot quietly
// change it. The recorded walks follow the one shortest route there is
// (STRAIGHT_WEST says why), and the walk onto the carrier's cell is played
// before the recording starts. A unit standing on a relic in a save made
// before work 128 is on blocked ground until the relic is picked up, as it was
// then. A carrier that leaves the map alive lets its relic go too
// (monkBehaviorSystem's follow step), but no order reaches that today: both
// context channels refuse a Monk outright ('monk_should_route_via_facade'), so
// it cannot garrison.

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import {
  monkCarriedRelicCodec,
  monkTasksCodec,
  relicsInMonasteryCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  CARRIED_FARM_CELL,
  CARRIED_MONK_CELL,
  CARRIED_SECOND_MONK_CELL,
  CROSS_COMPUTER_MONK_CELL,
  CROSS_PLAYER_MONK_CELL,
  MONK_CARRIED_RELIC_SEED,
  MONK_RELIC_CROSS_OWNER_SEED,
} from '../../src/game/simulation/fixtures/monkRelics';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { stepBridgeUntil } from './createSimulationBridge.helpers';
import { asSchema2Blob } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Cell = { x: number; y: number };

const OWNER = 1;
/** Open grass 14 cells from the Monk, where the player sends it. */
const WALK_TARGET: Cell = { x: 24, y: 16 };
/** Six cells due west of the carrier on open grass: one shortest route, so a
 *  recording of the walk re-simulates. A walk with routes of equal length can
 *  re-plan another way when a replay starts mid-walk, on main as here and with
 *  no relic anywhere (work 128's probe; the OPEN 2026-09-30 register entry). */
const STRAIGHT_WEST: Cell = { x: 26, y: 10 };

function unitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id) ?? null;
}

function ownUnitAt(bridge: Bridge, unitType: string, cell: Cell, owner = OWNER) {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === owner && candidate.unitType === unitType
      && candidate.x === cell.x && candidate.y === cell.y);
  if (!unit) throw new Error(`The fixture holds no ${unitType} of owner ${owner} at ${cell.x},${cell.y}.`);
  return unit;
}

function theRelic(bridge: Bridge) {
  const relic = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'relic');
  if (!relic) throw new Error('The fixture holds no relic.');
  return relic;
}

function relicById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().resources.find((resource) => resource.id === id) ?? null;
}

function cellOf(unit: { x: number; y: number }): Cell {
  return { x: unit.x, y: unit.y };
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Monk -> relic, read from the world state the relic rules write. */
function carriedRelics(bridge: Bridge): Map<number, number> {
  return monkCarriedRelicCodec.deserialize(
    bridge.world.getState(monkCarriedRelicCodec.slot) as Array<[number, number]> | undefined,
  );
}

/** The errand each Monk is on, read from the world state. */
function monkTaskKind(bridge: Bridge, monkId: number): string | undefined {
  return monkTasksCodec.deserialize(
    bridge.world.getState(monkTasksCodec.slot) as Parameters<typeof monkTasksCodec.deserialize>[0],
  ).get(monkId)?.kind;
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
  const relic = theRelic(bridge);
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

/** Deletes the carrier with the Delete key, and returns the cell its relic lands on. */
function carrierDies(bridge: Bridge, monkId: number, relicId: number): Cell {
  expect(bridge.selectUnitsByIds([monkId])).toBe(true);
  expect(bridge.deleteSelectedEntity()).toBe(true);
  bridge.step(100);
  expect(unitById(bridge, monkId)).toBeNull();
  expect(carriedRelics(bridge).size).toBe(0);
  const relic = relicById(bridge, relicId);
  if (!relic) throw new Error('The relic left the map when its carrier died.');
  return cellOf(relic);
}

/** The carrier picks the relic up and stands still; `unitId` steps onto its
 *  cell; the carrier is deleted. Returns the shared cell and where the relic lands. */
function dropOnSharedCell(bridge: Bridge, unitId: number): { shared: Cell; landed: Cell } {
  const { monkId, relicId } = pickUp(bridge);
  const shared = cellOf(unitById(bridge, monkId)!);
  expect(walkTo(bridge, unitId, shared, false), 'the unit never reached the carrier\'s cell').toBe(true);
  return { shared, landed: carrierDies(bridge, monkId, relicId) };
}

/** Records what `play` does from here on, and re-simulates the recording. */
function recordAndSelfCheck(bridge: Bridge, play: () => void) {
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: 20,
    terminalSnapshot: true,
    sourceKind: 'session',
    sourceLabel: 'monk-carried-relic-test',
  });
  recorder.connect();
  try {
    play();
  } finally {
    recorder.disconnect();
  }
  const bundle = recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;
  return SessionReplayer.fromBundle(bundle, {
    worldFactory: (start) => createReplayWorldOnly(start),
    skipRegistrationCheck: true,
  }).selfCheck();
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
    const carrier = cellOf(unitById(bridge, monkId)!);
    const dropCell = carrierDies(bridge, monkId, relicId);
    expect(dropCell, 'nothing else stood on the carrier\'s cell, so the relic lands there').toEqual(carrier);

    // A walk order onto the relic's cell ends at the nearest cell a unit can
    // stand on (moveDestinationSearch.ts), which is beside it.
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === OWNER && unit.unitType === 'villager');
    if (!villager) throw new Error('The fixture holds no villager of owner 1.');
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.issueMoveCommand(dropCell.x, dropCell.y)).toBe(true);
    const settled = stepBridgeUntil(bridge, () => {
      const unit = unitById(bridge, villager.id);
      return unit !== null && unit.task === 'idle' && manhattan(unit, dropCell) <= 1;
    }, { maxSteps: 400 });
    const at = unitById(bridge, villager.id)!;
    expect(settled, `the villager never came to rest beside the dropped relic; it stands at ${at.x},${at.y}`).toBe(true);
    expect(cellOf(at), 'the villager stands on the dropped relic\'s cell').not.toEqual(dropCell);
  });

  it('lands the relic beside a unit that shared its carrier\'s cell, and that unit walks away', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === OWNER && unit.unitType === 'villager')!;
    const { shared, landed } = dropOnSharedCell(bridge, villager.id);

    expect(landed, 'the relic landed on the cell a unit stands on').not.toEqual(shared);
    expect(manhattan(landed, shared), 'the relic did not land beside the carrier\'s cell').toBe(1);
    expect(walkTo(bridge, villager.id, WALK_TARGET, false), 'the unit that shared the carrier\'s cell is stranded').toBe(true);
  });

  it('does not drop a relic on a Farm, which stays walkable ground', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    expect(walkTo(bridge, monkId, CARRIED_FARM_CELL, false), 'the carrier never reached the Farm').toBe(true);

    const landed = carrierDies(bridge, monkId, relicId);
    expect(landed, 'the relic landed on the Farm').not.toEqual(CARRIED_FARM_CELL);
    expect(manhattan(landed, CARRIED_FARM_CELL)).toBe(1);
  });

  it('re-simulates a recorded carry exactly', () => {
    // Until work 128 the carried relic's claim stood on the carrier's cell, and
    // a recording of a carry diverged at the carrier's first step.
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const check = recordAndSelfCheck(bridge, () => {
      const { monkId } = pickUp(bridge);
      expect(walkTo(bridge, monkId, STRAIGHT_WEST, true), 'the Monk carrying a relic never reached the cell it was sent to').toBe(true);
    });
    expect(check, JSON.stringify(check.stateDivergences.slice(0, 3).map((diff) => diff.firstDifferingPath)))
      .toMatchObject({ ok: true, skippedSegments: [] });
    expect(check.checkedSegments).toBeGreaterThan(1);
  }, 60_000);

  it('re-simulates a recorded drop beside a unit, and that unit\'s walk away, exactly', () => {
    // The reviewer's recording (review round 0, SF1): before the landing rule
    // the relic fell under the villager, the live game stranded it, and the
    // replay, whose load rebuilds occupancy in its own order, let it walk.
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === OWNER && unit.unitType === 'villager')!;
    const { monkId, relicId } = pickUp(bridge);
    const shared = cellOf(unitById(bridge, monkId)!);
    expect(walkTo(bridge, villager.id, shared, false), 'the villager never reached the carrier\'s cell').toBe(true);
    const check = recordAndSelfCheck(bridge, () => {
      expect(carrierDies(bridge, monkId, relicId)).not.toEqual(shared);
      expect(walkTo(bridge, villager.id, STRAIGHT_WEST, false), 'the villager that shared the carrier\'s cell is stranded').toBe(true);
    });
    expect(check, JSON.stringify(check.stateDivergences.slice(0, 3).map((diff) => diff.firstDifferingPath)))
      .toMatchObject({ ok: true, skippedSegments: [] });
    expect(check.checkedSegments).toBeGreaterThan(1);
  }, 60_000);

  it('picks up a relic it stands on in a save made before work 128, and walks off with it', () => {
    // Until work 128 a relic fell on its carrier's cell whoever else stood
    // there, and a Monastery spilled its relics without looking for units, so
    // an old save can hold a relic under a Monk. The save is staged so.
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const monk = ownUnitAt(bridge, 'monk', CARRIED_MONK_CELL);
    const relic = theRelic(bridge);
    const blob = asSchema2Blob(bridge.saveGame());
    const components = (blob.worldSnapshot as unknown as {
      components: Record<string, Array<[number, Record<string, unknown>]>>;
    }).components;
    const relicPosition = components.position!.find(([entity]) => entity === relic.id)![1];
    relicPosition.x = CARRIED_MONK_CELL.x;
    relicPosition.y = CARRIED_MONK_CELL.y;
    const loaded = createSimulationBridge(MONK_CARRIED_RELIC_SEED, { savedGame: blob });
    expect(relicById(loaded, relic.id)).toMatchObject(CARRIED_MONK_CELL);
    // The premise: on the relic's cell the Monk stands on blocked ground.
    expect(loaded.selectUnitsByIds([monk.id])).toBe(true);
    expect(loaded.issueMoveCommand(WALK_TARGET.x, WALK_TARGET.y)).toBe(true);
    expect(loaded.consumeCommandRejection(), 'the staged save did not put the Monk on blocked ground').not.toBeNull();

    pickUpWith(loaded, monk.id, relic.id);
    expect(walkTo(loaded, monk.id, WALK_TARGET, true), 'the Monk that picked up the relic under it never reached the cell it was sent to').toBe(true);
    expect(carriedRelics(loaded).get(monk.id)).toBe(relic.id);
  });

  it('does not let another of the player\'s Monks take the relic from its carrier\'s hands', () => {
    const bridge = createSimulationBridge(MONK_CARRIED_RELIC_SEED);
    const { monkId, relicId } = pickUp(bridge);
    const second = ownUnitAt(bridge, 'monk', CARRIED_SECOND_MONK_CELL);
    expect(bridge.selectUnitsByIds([second.id])).toBe(true);
    // The right-click is a walk to where the relic is, as on any unit.
    expect(bridge.issueContextCommandAtEntity(relicId)).toBe(true);
    for (let tick = 0; tick < 200; tick += 1) bridge.step(100);
    expect(carriedRelics(bridge).get(monkId), 'the relic left its carrier\'s hands').toBe(relicId);
    expect(carriedRelics(bridge).has(second.id)).toBe(false);
    expect(manhattan(unitById(bridge, second.id)!, unitById(bridge, monkId)!), 'the second Monk did not walk to the carrier').toBeLessThanOrEqual(1);
  });

  it('does not let the computer\'s Monk take the relic from the player\'s Monk', () => {
    // The reviewer's probe (review round 0, SF6), made a fixture.
    const bridge = createSimulationBridge(MONK_RELIC_CROSS_OWNER_SEED, { renderProjection: 'on-read' });
    const mine = ownUnitAt(bridge, 'monk', CROSS_PLAYER_MONK_CELL);
    const theirs = ownUnitAt(bridge, 'monk', CROSS_COMPUTER_MONK_CELL, 2);
    const relic = theRelic(bridge);
    // The computer decides first, while the relic lies on the ground, so both
    // Monks are sent for it; the player's, beside it, gets it.
    expect(
      stepBridgeUntil(bridge, () => monkTaskKind(bridge, theirs.id) === 'pickup', { maxSteps: 20 }),
      'the premise: the computer never sent its Monk for the relic',
    ).toBe(true);
    pickUpWith(bridge, mine.id, relic.id);
    // The computer's Monk, six cells off and walking, gives up the errand the
    // tick the relic leaves the ground, rather than walking on to the carrier.
    bridge.step(100);
    expect(monkTaskKind(bridge, theirs.id), 'the computer\'s Monk walked on for a relic in the player\'s hands').not.toBe('pickup');
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    expect(unitById(bridge, mine.id), 'the player\'s Monk died, the only way to lose a carried relic').not.toBeNull();
    expect(carriedRelics(bridge).get(mine.id), 'the computer\'s Monk took the relic from the player\'s hands').toBe(relic.id);
    expect(carriedRelics(bridge).has(theirs.id)).toBe(false);
  });
});
