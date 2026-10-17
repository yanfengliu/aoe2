// Units standing on a foundation when its first builder starts (work 126; spec
// §8.1, §12.1).
//
// Units walk over a foundation nobody has started (update 185872), so some may
// stand on it when the first builder arrives. Definitive Edition moves its
// owner's units off: the AoE wiki's "Building (Age of Empires II)" (sentence
// added 2024-01-16) says "If there are Gaia animals or units of the player
// present at the location of a building foundation, they will move away
// automatically once the Villager reach the foundation", and forum 62959
// (2019) "Usually the units move out of the area before the vills start
// building". Allies' too: update 87863, "Own/ally units in 'Defensive' and
// 'Stand Ground' stance or with 'Guard' or 'Follow' order don't obstruct
// building foundations anymore, preventing construction". An enemy's unit is
// not moved: the same wiki paragraph says "Buildings can be constructed if
// there is no enemy building or unit present at the location of building
// foundation", so the builders wait beside the site until it leaves (the
// coordinator's decision of 2026-10-14 on the choice the sources left). A unit
// never cancels the start, whoever owns it: the start check cancels only for a
// structure, a foundation that blocks its owner, terrain or a resource.
//
// Here a unit moved off is placed on the nearest open cell outside the
// footprint, keeping its orders, in the tick the building starts; DE walks it
// off. Then the footprint becomes a wall.
//
// BOUND — what a green run here does NOT prove: one 2x2 House on flat grass,
// one villager of each relation standing on it, no AI. A unit with nowhere to
// go holds the start like an enemy's; that case is not driven here.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  CROSSER_START,
  ENEMY_AWAY,
  HUMAN_BUILDER,
  HUMAN_SITE,
  UNBUILT_FOUNDATIONS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import { economyBuilding, idsOf, type Bridge } from './hiddenUnstartedFoundation.helpers';

type Cell = { readonly x: number; readonly y: number };

const HUMAN = 1;
const HOUSE = 2;

function onSite(cell: Cell): boolean {
  return cell.x >= HUMAN_SITE.x && cell.x < HUMAN_SITE.x + HOUSE
    && cell.y >= HUMAN_SITE.y && cell.y < HUMAN_SITE.y + HOUSE;
}

function unitAt(bridge: Bridge, owner: number, cell: Cell): number {
  const unit = bridge.getEconomyState().units
    .find((candidate) => candidate.owner === owner && candidate.x === cell.x && candidate.y === cell.y);
  expect(unit, `the fixture moved: owner ${owner} has no unit at (${cell.x},${cell.y})`).toBeDefined();
  return unit!.id;
}

function cellOf(bridge: Bridge, id: number): Cell {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === id);
  expect(unit, `unit ${id} is gone`).toBeDefined();
  return { x: unit!.x, y: unit!.y };
}

function drain(bridge: Bridge): string {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages.join(' | ');
}

function move(bridge: Bridge, unitId: number, target: Cell): void {
  expect(bridge.world.submitWithResult('unit.move', { unitId, target: { ...target } }).accepted,
    `unit ${unitId} refused the move`).toBe(true);
}

function stepUntil(bridge: Bridge, done: () => boolean, maxTicks = 600): boolean {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (done()) return true;
    bridge.step(100);
  }
  return done();
}

/** The human founds its House at HUMAN_SITE and its builder steps back
 *  without working it; returns the House and the builder. */
function humanHouse(bridge: Bridge): { house: number; builder: number } {
  const builder = unitAt(bridge, HUMAN, HUMAN_BUILDER);
  expect(bridge.selectUnitsByIds([builder])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.confirmBuildingPlacement(HUMAN_SITE.x, HUMAN_SITE.y)).toBe(true);
  bridge.step(100);
  move(bridge, builder, HUMAN_BUILDER);
  bridge.step(100);
  const house = bridge.getEconomyState().buildings.find((building) => (
    building.owner === HUMAN && building.x === HUMAN_SITE.x && building.y === HUMAN_SITE.y
  ));
  expect(house, 'the House was not founded').toBeDefined();
  expect(house!.buildProgressTicks).toBe(0);
  return { house: house!.id, builder };
}

/** Stands `unitId` on the House's site, then sends the human's builder to
 *  start it. */
function standThenBuild(bridge: Bridge, unitId: number, house: number, builder: number): void {
  const spot = { x: HUMAN_SITE.x + 1, y: HUMAN_SITE.y + 1 };
  move(bridge, unitId, spot);
  expect(stepUntil(bridge, () => {
    const cell = cellOf(bridge, unitId);
    return cell.x === spot.x && cell.y === spot.y;
  }), 'the unit never reached the unstarted House\'s ground').toBe(true);
  expect(economyBuilding(bridge, house)?.buildProgressTicks).toBe(0);
  expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: builder, targetEntityId: house }).accepted)
    .toBe(true);
}

const progress = (bridge: Bridge, house: number): number => economyBuilding(bridge, house)?.buildProgressTicks ?? 0;

describe('units on a foundation when its first builder starts (work 126)', () => {
  for (const { who, owner, from } of [
    { who: 'the human\'s own villager', owner: 1, from: CROSSER_START },
    { who: 'an ally\'s villager', owner: 3, from: null },
  ] as const) {
    it(`${who} is moved off, keeps its feet beside the site, and the House starts`, () => {
      const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
      const { house, builder } = humanHouse(bridge);
      const stander = from === null ? idsOf(bridge, owner, 'villager')[0]! : unitAt(bridge, owner, from);
      standThenBuild(bridge, stander, house, builder);
      expect(stepUntil(bridge, () => progress(bridge, house) > 0), 'the House never started').toBe(true);
      const cell = cellOf(bridge, stander);
      expect(onSite(cell), `the unit still stands on the started House at (${cell.x},${cell.y})`).toBe(false);
      expect(Math.max(
        Math.max(HUMAN_SITE.x - cell.x, cell.x - (HUMAN_SITE.x + HOUSE - 1)),
        Math.max(HUMAN_SITE.y - cell.y, cell.y - (HUMAN_SITE.y + HOUSE - 1)),
      ), 'the unit was moved further than the nearest open cell beside the site').toBeLessThanOrEqual(1);
      expect(drain(bridge)).not.toContain('cancelled');
      // And it can walk away: it is not frozen beside the wall.
      move(bridge, stander, ENEMY_AWAY);
      const before = cellOf(bridge, stander);
      for (let tick = 0; tick < 60; tick += 1) bridge.step(100);
      const after = cellOf(bridge, stander);
      expect(after.x !== before.x || after.y !== before.y, 'the moved unit cannot walk').toBe(true);
    });
  }

  it('an enemy\'s villager holds the start, nothing is cancelled, and the House starts once it has gone', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const { house, builder } = humanHouse(bridge);
    const enemy = idsOf(bridge, 2, 'villager')[0]!;
    standThenBuild(bridge, enemy, house, builder);
    // The builder arrives and waits: no progress, no cancel, the enemy unmoved.
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    expect(economyBuilding(bridge, house), 'the House was cancelled for a unit standing on it').toBeDefined();
    expect(progress(bridge, house), 'the House started under an enemy\'s unit').toBe(0);
    expect(onSite(cellOf(bridge, enemy)), 'the enemy\'s unit was moved off').toBe(true);
    const waiting = bridge.getEconomyState().units.find((unit) => unit.id === builder);
    expect(waiting?.task, 'the builder gave up on the House').toBe('building');
    expect(drain(bridge)).not.toContain('cancelled');

    move(bridge, enemy, ENEMY_AWAY);
    expect(stepUntil(bridge, () => progress(bridge, house) > 0), 'the House never started once the enemy left').toBe(true);
    expect(drain(bridge)).not.toContain('cancelled');
  });
});
