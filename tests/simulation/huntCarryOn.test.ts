import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { CARRY_ON_HUNT } from '../../src/game/simulation/fixtures/economyBasics/carryOn';
import type { GathererComponent, ResourceComponent } from '../../src/game/simulation/types';
import { wildlifeStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';

// Hunters in Definitive Edition gather the animal they killed, and once its
// carcass is eaten they carry on to more hunt close by — never to a LIVE boar,
// which they do not attack on their own (Update 108769 hotfix 109739: "After
// depleting a Boar, Hunters will no longer automatically hunt another live
// Boar"; Update 111772: hunters no longer attack "nearby violent huntable
// animals upon depleting the one they are currently working on"). The
// 2026-10-14 play session saw five villagers with Loom kill the boar and go
// idle at once, leaving its 340 food on the ground until the player ordered
// them again.
//
// Every case is the player's own command: select the villagers, right-click
// the boar. Bound: six villagers with Loom on open ground, boars that only
// fight back; it does not cover deer (no shipped map places any) or a kill by
// a Town Center's arrows alone, and the carry-on radius itself is
// gatherCarryOn.test.ts's.

type Bridge = ReturnType<typeof createSimulationBridge>;

function villagerIds(bridge: Bridge): number[] {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

function boarAt(bridge: Bridge, at: { x: number; y: number }): number {
  const boar = bridge.getEconomyState().resources
    .find((resource) => resource.resourceType === 'boar' && resource.x === at.x && resource.y === at.y);
  if (!boar) throw new Error(`fixture premise: no boar at (${at.x},${at.y})`);
  return boar.id;
}

const amountOf = (bridge: Bridge, id: number): number | null => {
  const resource = bridge.world.getComponent<ResourceComponent>(id, 'resource');
  return resource?.resourceType === 'boar' ? resource.amount : null;
};
const gathererOf = (bridge: Bridge, id: number) => bridge.world.getComponent<GathererComponent>(id, 'gatherer');
// Read from the world's own wildlife slot: the render state leaves out what
// the player cannot see, and a boar out of sight is not a dead one.
const isAlive = (bridge: Bridge, id: number): boolean => wildlifeStatesCodec
  .deserialize(bridge.world.getState(wildlifeStatesCodec.slot) as Parameters<typeof wildlifeStatesCodec.deserialize>[0])
  .get(id)?.isAlive === true;
const commandOf = (bridge: Bridge, id: number) => bridge.getDebugSnapshot().unitPaths.find((path) => path.id === id);

function huntOrder(bridge: Bridge, boarId: number): void {
  expect(bridge.selectUnitsByIds(villagerIds(bridge))).toBe(true);
  expect(bridge.issueContextCommandAtEntity(boarId)).toBe(true);
}

function stepUntil(bridge: Bridge, done: () => boolean, maxTicks: number): number | null {
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    bridge.step(100);
    if (done()) return tick;
  }
  return null;
}

describe('hunters gather what they kill, and carry on only to more hunt (DE)', () => {
  it('every hunter gathers the boar it killed, and the food reaches the stockpile', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture', { renderProjection: 'on-read' });
    const boar = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'boar')!.id;
    huntOrder(bridge, boar);
    const killedAfter = stepUntil(bridge, () => !isAlive(bridge, boar), 600);
    expect(killedAfter, 'six villagers never killed the boar').not.toBeNull();
    const food = () => bridge.getEconomyState().playerResources[HUMAN_PLAYER_ID]!.food;
    const foodAtKill = food();

    // One tick later every surviving hunter is on the carcass: none idle.
    bridge.step(100);
    const hunters = villagerIds(bridge);
    expect(hunters.length).toBeGreaterThanOrEqual(4);
    for (const id of hunters) {
      expect(gathererOf(bridge, id)?.targetResourceId, `hunter #${id} left the carcass it killed`).toBe(boar);
    }
    expect(bridge.countIdleVillagers(), 'hunters stood idle beside their kill').toBe(0);

    // And they work it: a minute of game time eats into it and banks food.
    for (let tick = 0; tick < 600; tick += 1) bridge.step(100);
    expect(amountOf(bridge, boar)).toBeLessThan(340 - 60);
    expect(food() - foodAtKill, 'no load reached the Town Center').toBeGreaterThanOrEqual(40);
    expect(bridge.countIdleVillagers()).toBe(0);
  }, 60_000);

  it('once the carcass is eaten, hunters never attack the live boar beside it and stand idle', () => {
    const bridge = createSimulationBridge('carry-on-hunt-fixture', { renderProjection: 'on-read' });
    const first = boarAt(bridge, CARRY_ON_HUNT.firstBoar);
    const second = boarAt(bridge, CARRY_ON_HUNT.secondBoar);
    huntOrder(bridge, first);
    expect(stepUntil(bridge, () => !isAlive(bridge, first), 600), 'the first boar never died').not.toBeNull();

    let secondTouched = false;
    const eaten = stepUntil(bridge, () => {
      for (const id of villagerIds(bridge)) {
        const command = commandOf(bridge, id);
        if (command?.commandType === 'attack' && command.toX === CARRY_ON_HUNT.secondBoar.x) secondTouched = true;
      }
      return amountOf(bridge, first) === null;
    }, 4_000);
    expect(eaten, 'the first carcass was never eaten').not.toBeNull();
    // Walk any last loads home, then stand: everyone idle, the live boar whole.
    const idle = stepUntil(bridge, () => bridge.countIdleVillagers() === villagerIds(bridge).length, 1_000);
    expect(idle, 'the hunters did not all stand idle once the hunt within reach was gone').not.toBeNull();
    for (let tick = 0; tick < 300; tick += 1) bridge.step(100);
    expect(bridge.countIdleVillagers(), 'a hunter found work after the carcass').toBe(villagerIds(bridge).length);
    expect(secondTouched, 'a hunter went for the live boar on its own').toBe(false);
    expect(isAlive(bridge, second), 'the live boar beside the carcass was killed').toBe(true);
    expect(amountOf(bridge, second)).toBe(CARRY_ON_HUNT.secondBoarFood);
    const sheep = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'sheep')!;
    expect(sheep.amount, 'a hunter went on to the sheep').toBe(100);
    expect(bridge.getEconomyState().playerResources[HUMAN_PLAYER_ID]!.food).toBe(CARRY_ON_HUNT.firstBoarFood);
  }, 60_000);

  it('once the carcass is eaten, hunters carry on to the other carcass close by', () => {
    const bridge = createSimulationBridge('carry-on-hunt-fixture', { renderProjection: 'on-read' });
    const first = boarAt(bridge, CARRY_ON_HUNT.firstBoar);
    const second = boarAt(bridge, CARRY_ON_HUNT.secondBoar);
    // The player kills the second boar, then sends the party at the first.
    huntOrder(bridge, second);
    expect(stepUntil(bridge, () => !isAlive(bridge, second), 900), 'the second boar never died').not.toBeNull();
    huntOrder(bridge, first);
    expect(stepUntil(bridge, () => !isAlive(bridge, first), 900), 'the first boar never died').not.toBeNull();
    expect(stepUntil(bridge, () => amountOf(bridge, first) === null, 4_000), 'the first carcass was never eaten')
      .not.toBeNull();
    expect(amountOf(bridge, second), 'premise: the second carcass still has food').toBeGreaterThan(0);
    bridge.step(100);
    for (const id of villagerIds(bridge)) {
      expect(gathererOf(bridge, id)?.targetResourceId, `hunter #${id} did not carry on to the other carcass`).toBe(second);
    }
    expect(stepUntil(bridge, () => amountOf(bridge, second) === null, 4_000), 'the second carcass was never eaten')
      .not.toBeNull();
    expect(
      bridge.getEconomyState().playerResources[HUMAN_PLAYER_ID]!.food
        + villagerIds(bridge).reduce((sum, id) => sum + (gathererOf(bridge, id)?.carriedAmount ?? 0), 0),
    ).toBe(CARRY_ON_HUNT.firstBoarFood + CARRY_ON_HUNT.secondBoarFood);
  }, 60_000);
});
