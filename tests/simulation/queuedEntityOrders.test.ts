// SHIFT-QUEUED ENTITY ORDERS (spec §9.3, v0.3.141): AoE2's other half of the
// waypoint chain. Shift+right-click on an ENTITY appends a context order that
// fires when the current one COMPLETES — gather after gather, kill after
// kill — where v0.3.125/126 only chained ground legs and construction sites.
// A plain order replaces the whole chain, as in AoE2.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Bridge = ReturnType<typeof createSimulationBridge>;

function run(bridge: Bridge, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) bridge.step(100);
}

function resourceAmount(bridge: Bridge, id: number): number {
  const resource = bridge.getEconomyState().resources.find((entry) => entry.id === id);
  return resource?.amount ?? 0;
}

function findResource(bridge: Bridge, x: number, y: number) {
  const resource = bridge.getEconomyState().resources.find(
    (entry) => entry.x === x && entry.y === y,
  );
  if (!resource) throw new Error(`no resource at ${x},${y}`);
  return resource;
}

function villagers(bridge: Bridge) {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .sort((a, b) => a.id - b.id);
}

function selectVillager(bridge: Bridge): void {
  const villager = villagers(bridge)[0];
  if (!villager) throw new Error('no villager');
  expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
}

describe('shift-queued gather chain', () => {
  it('switches to the QUEUED tree when the bush exhausts, beating the same-type auto-rotate', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const smallBush = findResource(bridge, 13, 12);
    const bigBush = findResource(bridge, 15, 12);
    const tree = findResource(bridge, 12, 14);

    selectVillager(bridge);
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree.id, { queue: true })).toBe(true);

    // The 20-food bush exhausts, the carry banks at the mill, and the QUEUED
    // tree order must fire — auto-rotate alone would walk to the second bush.
    run(bridge, 1200);
    expect(resourceAmount(bridge, smallBush.id)).toBe(0);
    expect(resourceAmount(bridge, tree.id)).toBeLessThan(150);
    expect(resourceAmount(bridge, bigBush.id)).toBe(200);
  }, 60_000);

  it('a plain order wipes the queued chain', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const smallBush = findResource(bridge, 13, 12);
    const tree = findResource(bridge, 12, 14);

    selectVillager(bridge);
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree.id, { queue: true })).toBe(true);
    // The plain re-order to the SAME bush replaces the whole chain.
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);

    run(bridge, 1200);
    expect(resourceAmount(bridge, smallBush.id)).toBe(0);
    // The tree order died with the chain; auto-rotate (same type) may take the
    // villager to the second bush, but the tree must stand untouched.
    expect(resourceAmount(bridge, tree.id)).toBe(150);
  }, 60_000);
});

describe('shift-queued attack chain', () => {
  it('kills the first militia, then the QUEUED second, unprompted', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const victims = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'militia')
      .sort((a, b) => a.x - b.x);
    expect(victims).toHaveLength(2);

    const archer = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    );
    if (!archer) throw new Error('no archer');
    expect(bridge.selectUnitsByIds([archer.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(victims[0].id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(victims[1].id, { queue: true })).toBe(true);

    run(bridge, 5000);
    // The far militia is out of auto-aggression's reach: only the queued
    // order can march the archer there. Both dead = the chain fired.
    const survivors = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    );
    expect(survivors).toHaveLength(0);
  }, 60_000);

  it('queueing on an IDLE unit acts immediately', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const victims = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'militia')
      .sort((a, b) => a.x - b.x);
    const archer = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    );
    expect(bridge.selectUnitsByIds([archer!.id])).toBe(true);
    // Shift on an idle unit is a normal order in AoE2 — no dead click.
    expect(bridge.issueContextCommandAtEntity(victims[0].id, { queue: true })).toBe(true);
    run(bridge, 1500);
    const remaining = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    );
    expect(remaining).toHaveLength(1);
  }, 60_000);
});

describe('the chain survives a save', () => {
  it('fires the queued order after load', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const smallBush = findResource(bridge, 13, 12);
    const tree = findResource(bridge, 12, 14);
    selectVillager(bridge);
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(tree.id, { queue: true })).toBe(true);
    run(bridge, 50);

    const blob = bridge.saveGame();
    const restored = createSimulationBridge('queued-orders-fixture', { savedGame: blob });
    const restoredTree = findResource(restored, 12, 14);
    const restoredBush = findResource(restored, 13, 12);
    run(restored, 1200);
    expect(resourceAmount(restored, restoredBush.id)).toBe(0);
    expect(resourceAmount(restored, restoredTree.id)).toBeLessThan(150);
  }, 60_000);
});

describe('critic regressions (the multi-unit world)', () => {
  it('the chain fires even when a CO-GATHERER lands the depleting swing', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const smallBush = findResource(bridge, 13, 12);
    const farTree = findResource(bridge, 20, 14);
    const [first, second] = villagers(bridge);

    // The co-gatherer starts first, so it plausibly lands the last swing
    // while the chained villager is mid-walk or mid-carry.
    expect(bridge.selectUnitsByIds([second.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);
    run(bridge, 30);
    expect(bridge.selectUnitsByIds([first.id])).toBe(true);
    expect(bridge.issueContextCommandAtEntity(smallBush.id)).toBe(true);
    // The queued target is the FAR tree: idle auto-assign is nearest-first
    // (and type-agnostic), so nothing but a fired chain ever works it.
    expect(bridge.issueContextCommandAtEntity(farTree.id, { queue: true })).toBe(true);

    run(bridge, 2500);
    expect(resourceAmount(bridge, smallBush.id)).toBe(0);
    expect(resourceAmount(bridge, farTree.id)).toBeLessThan(150);
  }, 60_000);

  it('an AUTO-AGGRESSION engagement during attack-move does not wipe the chain', () => {
    const bridge = createSimulationBridge('queued-orders-fixture');
    const victims = bridge.getEconomyState().units
      .filter((unit) => unit.owner === 2 && unit.unitType === 'militia')
      .sort((a, b) => a.x - b.x);
    const archer = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    );
    expect(bridge.selectUnitsByIds([archer!.id])).toBe(true);
    // Attack-move PAST the near militia (the guard reaction will engage it),
    // with the far militia queued behind the sweep.
    expect(bridge.issueAttackMoveCommand(18, 19)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(victims[1].id, { queue: true })).toBe(true);

    run(bridge, 6000);
    const survivors = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    );
    expect(survivors).toHaveLength(0);
  }, 60_000);
});
