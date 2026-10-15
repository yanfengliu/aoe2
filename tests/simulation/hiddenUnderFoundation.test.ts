// What the fog hid under a new foundation is never frozen there, and does not
// cancel it unless it is a structure, terrain or a lifeless resource (work 126;
// spec §8.1, §12.1; the register entry of 2026-10-12 "A unit hidden in the fog
// is frozen under a foundation the player places over it").
//
// Since work 122 the player may place a foundation partly over unexplored
// ground (update 44725, hotfix 45185), so it can go down over a unit or an
// animal the fog hides. A foundation was a wall from the tick it was placed, so
// a hidden unit under one could not leave: `findGridPath` refuses a blocked
// start cell. Work 122's reviewer reproduced it on this fixture with
// `trapProbe.mts`: a House at (20,9) over player 2's Militia, the villager
// recalled before it worked, and every move order the Militia was given
// accepted while it stood at (20,9) for 600 ticks. When a builder came, the
// start check cancelled the House for "a unit standing there" and refunded it
// whole, so the trap was free.
//
// Now a foundation nobody has started is open ground (update 185872), so the
// Militia leaves when it is ordered to; and the start check no longer cancels
// for a unit. An enemy's unit on the site holds the start until it has gone
// (foundationStartUnits.test.ts), and once it has gone the House starts. A
// living animal on the site is moved off when the builder starts, as the
// owner's units are: the AoE wiki's "If there are Gaia animals or units of the
// player present at the location of a building foundation, they will move away
// automatically once the Villager reach the foundation" (the coordinator's
// decision of 2026-10-14). A lifeless resource still cancels, as water and
// forest do (placementUnexplored.test.ts, foundationStartAnimals.test.ts).
//
// BOUND — what a green run here does NOT prove: one House, one hidden Militia,
// one hidden sheep. The Militia leaves into the explored disc; whether it may
// stand anywhere else is the movement code's, not this gate's. It is deleted by
// its own owner before the House is built, so no fight decides the start.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ENEMY_MILITIA_CELL,
  HOUSE_OVER_HIDDEN_UNIT,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
  VILLAGER_CELL,
} from '../../src/game/simulation/fixtures/unexploredPlacement';
import {
  ANIMAL_VILLAGER,
  HIDDEN_SHEEP,
  HOUSE_OVER_HIDDEN_SHEEP,
  UNBUILT_FOUNDATIONS_ANIMAL_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import type { Bridge } from './hiddenUnstartedFoundation.helpers';

type Cell = { readonly x: number; readonly y: number };

const HUMAN = 1;
/** South of the explored disc: the Militia's sight of 4 does not reach it from
 *  anywhere the Militia stands in these cases. */
const VILLAGER_ASIDE: Cell = { x: VILLAGER_CELL.x, y: VILLAGER_CELL.y + 4 };
/** Where the Militia is ordered: off the House, inside the explored disc. */
const MILITIA_OUT: Cell = { x: 20, y: 11 };

function onHouse(anchor: Cell, cell: Cell): boolean {
  return cell.x >= anchor.x && cell.x < anchor.x + 2 && cell.y >= anchor.y && cell.y < anchor.y + 2;
}

function humanVillager(bridge: Bridge): number {
  const villager = bridge.getEconomyState().units.find((unit) => unit.owner === HUMAN && unit.unitType === 'villager');
  expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
  return villager!.id;
}

function house(bridge: Bridge, anchor: Cell) {
  return bridge.getEconomyState().buildings.find((building) => (
    building.owner === HUMAN && building.buildingType === 'house' && building.x === anchor.x && building.y === anchor.y
  ));
}

function drain(bridge: Bridge): string {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages.join(' | ');
}

/** The human places a House at `anchor` over the fog and recalls its villager
 *  to `aside` before it strikes a blow. */
function placeAndRecall(bridge: Bridge, anchor: Cell, aside: Cell): number {
  const villager = humanVillager(bridge);
  expect(bridge.selectUnitsByIds([villager])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid, 'the ghost must not reveal what is under it').toBe(true);
  expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
  bridge.step(100);
  expect(bridge.world.submitWithResult('unit.move', { unitId: villager, target: { ...aside } }).accepted).toBe(true);
  bridge.step(100);
  const site = house(bridge, anchor);
  expect(site, 'the House was not founded').toBeDefined();
  expect(site!.buildProgressTicks).toBe(0);
  return site!.id;
}

function buildUntilStarted(bridge: Bridge, siteId: number, maxTicks = 600): { started: boolean; messages: string } {
  expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: humanVillager(bridge), targetEntityId: siteId })
    .accepted).toBe(true);
  let messages = '';
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const site = bridge.getEconomyState().buildings.find((building) => building.id === siteId);
    if (!site || site.buildProgressTicks > 0) break;
    bridge.step(100);
    messages += drain(bridge);
  }
  const site = bridge.getEconomyState().buildings.find((building) => building.id === siteId);
  return { started: (site?.buildProgressTicks ?? 0) > 0, messages };
}

describe('nothing the fog hid is frozen under a new foundation (work 126)', () => {
  it('the hidden Militia leaves when ordered, and the House starts once it has gone', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    const woodBefore = bridge.getHudState().playerResources.wood;
    const site = placeAndRecall(bridge, HOUSE_OVER_HIDDEN_UNIT, VILLAGER_ASIDE);
    const militia = bridge.getEconomyState().units
      .find((unit) => unit.owner === 2 && unit.x === ENEMY_MILITIA_CELL.x && unit.y === ENEMY_MILITIA_CELL.y);
    expect(militia, 'the fixture moved: no Militia under the House').toBeDefined();

    expect(bridge.world.submitWithResult('unit.move', { unitId: militia!.id, target: { ...MILITIA_OUT } }).accepted)
      .toBe(true);
    let left = false;
    for (let tick = 0; tick < 300 && !left; tick += 1) {
      bridge.step(100);
      const unit = bridge.getEconomyState().units.find((candidate) => candidate.id === militia!.id);
      left = unit !== undefined && !onHouse(HOUSE_OVER_HIDDEN_UNIT, unit);
    }
    expect(left, 'the Militia is frozen under the unstarted House').toBe(true);
    expect(house(bridge, HOUSE_OVER_HIDDEN_UNIT)?.buildProgressTicks).toBe(0);

    // Its owner takes it off the map, so no fight decides the start.
    expect(bridge.world.submitWithResult('entity.delete', { entityId: militia!.id, requestedBy: 2 }).accepted).toBe(true);
    bridge.step(100);
    const { started, messages } = buildUntilStarted(bridge, site);
    expect(started, 'the House never started once the Militia had gone').toBe(true);
    expect(messages).not.toContain('cancelled');
    expect(bridge.getHudState().playerResources.wood, 'the House was refunded').toBeLessThan(woodBefore);
  });

  it('the control: the same House on the open variant starts the same way', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    const site = placeAndRecall(bridge, HOUSE_OVER_HIDDEN_UNIT, VILLAGER_ASIDE);
    const { started, messages } = buildUntilStarted(bridge, site);
    expect(started).toBe(true);
    expect(messages).not.toContain('cancelled');
  });

  it('a hidden sheep under a new House is moved off when the builder starts, and does not cancel it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_ANIMAL_SEED);
    const sheep = bridge.getEconomyState().resources
      .find((resource) => resource.resourceType === 'sheep' && resource.x === HIDDEN_SHEEP.x && resource.y === HIDDEN_SHEEP.y);
    expect(sheep, 'the fixture moved: no sheep under the House').toBeDefined();
    const site = placeAndRecall(bridge, HOUSE_OVER_HIDDEN_SHEEP, ANIMAL_VILLAGER);
    const { started, messages } = buildUntilStarted(bridge, site);
    expect(messages).not.toContain('cancelled');
    expect(started, 'the House never started over the sheep').toBe(true);
    const moved = bridge.getEconomyState().resources.find((resource) => resource.id === sheep!.id);
    expect(moved, 'the sheep is gone').toBeDefined();
    expect(onHouse(HOUSE_OVER_HIDDEN_SHEEP, moved!), `the sheep still stands on the House at (${moved!.x},${moved!.y})`)
      .toBe(false);
  });
});
