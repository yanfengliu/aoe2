import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import {
  CARRY_ON_BERRY_FISH,
  CARRY_ON_FISH_LAYOUT,
  CARRY_ON_KINDS,
  CARRY_ON_LAYOUT,
  CARRY_ON_RADIUS_LAYOUT,
  carryOnSeed,
  type CarryOnFixtureKind,
} from '../../src/game/simulation/fixtures/economyBasics/carryOn';
import type { GathererComponent, ResourceComponent, ResourceKind } from '../../src/game/simulation/types';

// What a villager does when the node it works runs out (work 131, spec §6.4
// "Carrying on when a resource runs out"). Definitive Edition's villager
// carries on to more of the SAME kind close by and works it; with none close
// by it stands idle, which is the player's cue. The 2026-10-14 play session
// saw the opposite: seven foragers whose berries ran out walked 10-20 cells to
// fish distant ponds and the idle count stayed 0, because a human villager
// with a gather order was handed whatever food ranked best anywhere in its
// home range, and re-ranked after every delivery.
//
// Each case drives the player's own command (select, right-click the node)
// on `carry-on-<kind>-fixture` and follows the villager every tick: A (a load
// and a half), back to A after its first delivery, then B — the same kind,
// 3.6 cells from A — with the partial load it held, then idle once B is gone.
// D is the same kind 5.4 cells from A, beside the Town Center, so any ranking
// by the walk home prefers it; C is another kind of the same stockpile
// resource inside the radius. Neither may ever be its target.
//
// Bound: one villager, open ground, nodes placed at the stated distances
// around a radius of 5 cells. It proves the rule on these layouts — the kind
// filter, the return after delivery and the idle at the end — and the radius
// from both sides (a bush exactly 5 cells away is close by, one 5.4 away is
// not; carry-on-radius-fixture). It
// does not prove the radius against every shipped map's patch shapes
// (work 131's plan records that measurement), it does not cover Fishing
// Ships (excluded from the rule), and hunting is huntCarryOn.test.ts.
const RADIUS = 5;

type Bridge = ReturnType<typeof createSimulationBridge>;

const distance = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.y - b.y);

function nodeIdAt(bridge: Bridge, at: Position, type: ResourceKind): number {
  const node = bridge.getEconomyState().resources
    .find((resource) => resource.resourceType === type && resource.x === at.x && resource.y === at.y);
  if (!node) throw new Error(`fixture premise: no ${type} at (${at.x},${at.y})`);
  return node.id;
}

function amountOf(bridge: Bridge, id: number, type: ResourceKind): number | null {
  const resource = bridge.world.getComponent<ResourceComponent>(id, 'resource');
  return resource && resource.resourceType === type ? resource.amount : null;
}

const DECOY: Partial<Record<CarryOnFixtureKind, ResourceKind>> = {
  'berry-bush': 'sheep',
  'gold-mine': 'stone-mine',
  'stone-mine': 'gold-mine',
  sheep: 'berry-bush',
  fish: 'berry-bush',
  farm: 'berry-bush',
};

const STOCKPILE: Record<CarryOnFixtureKind, 'food' | 'wood' | 'gold' | 'stone'> = {
  'berry-bush': 'food',
  tree: 'wood',
  'gold-mine': 'gold',
  'stone-mine': 'stone',
  sheep: 'food',
  fish: 'food',
  farm: 'food',
};

function runCarryOn(kind: CarryOnFixtureKind) {
  const bridge = createSimulationBridge(carryOnSeed(kind), { renderProjection: 'on-read' });
  const layout = kind === 'fish' ? CARRY_ON_FISH_LAYOUT : CARRY_ON_LAYOUT;
  // The geometry the rule is judged against.
  expect(distance(layout.A, layout.B)).toBeLessThanOrEqual(RADIUS);
  expect(distance(layout.A, layout.D)).toBeGreaterThan(RADIUS);
  expect(distance(layout.B, layout.D)).toBeGreaterThan(RADIUS);
  const a = nodeIdAt(bridge, layout.A, kind);
  const b = nodeIdAt(bridge, layout.B, kind);
  const d = nodeIdAt(bridge, layout.D, kind);
  const decoyType = DECOY[kind];
  const c = decoyType === undefined ? null : nodeIdAt(bridge, layout.C, decoyType);
  const fish = kind === 'berry-bush' ? nodeIdAt(bridge, CARRY_ON_BERRY_FISH, 'fish') : null;
  const untouched = [
    { id: d, type: kind as ResourceKind },
    ...(c === null || decoyType === undefined ? [] : [{ id: c, type: decoyType }]),
    ...(fish === null ? [] : [{ id: fish, type: 'fish' as ResourceKind }]),
  ].map((node) => ({ ...node, amount: amountOf(bridge, node.id, node.type) }));

  const villager = bridge.getEconomyState().units
    .find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')!.id;
  expect(bridge.selectUnitsByIds([villager])).toBe(true);
  expect(bridge.issueContextCommandAtEntity(a)).toBe(true);

  const gatherer = () => bridge.world.getComponent<GathererComponent>(villager, 'gatherer')!;
  const targets: number[] = [];
  const stockpile = () => bridge.getEconomyState().playerResources[HUMAN_PLAYER_ID]![STOCKPILE[kind]];
  const startStock = stockpile();
  let aGoneAt: number | null = null;
  let afterA: { task: string; target: number | null; carried: number } | null = null;
  let firstDeliveryWhileAStood: number | null = null;
  let targetAfterFirstDelivery: number | null = null;
  let lastCarried = 0;
  let idleSince: number | null = null;
  for (let tick = 1; tick <= 6_000; tick += 1) {
    bridge.step(100);
    const g = gatherer();
    if (g.targetResourceId !== null && targets[targets.length - 1] !== g.targetResourceId) {
      targets.push(g.targetResourceId);
    }
    const aStands = amountOf(bridge, a, kind) !== null;
    if (aStands && firstDeliveryWhileAStood === null && lastCarried > 0 && g.carriedAmount === 0) {
      firstDeliveryWhileAStood = tick;
    }
    if (firstDeliveryWhileAStood !== null && targetAfterFirstDelivery === null && g.targetResourceId !== null) {
      targetAfterFirstDelivery = g.targetResourceId;
    }
    lastCarried = g.carriedAmount;
    if (!aStands && aGoneAt === null) {
      aGoneAt = tick;
      afterA = { task: g.task, target: g.targetResourceId, carried: g.carriedAmount };
    }
    const done = amountOf(bridge, a, kind) === null
      && g.task === 'idle' && g.carriedAmount === 0
      && bridge.countIdleVillagers() === 1;
    if (done && idleSince === null) idleSince = tick;
    // Stay a while once idle: a villager that wanders off later fails too.
    if (idleSince !== null && tick - idleSince >= 300) break;
  }
  return {
    bridge, a, b, d, c, fish, targets, aGoneAt, afterA, idleSince,
    targetAfterFirstDelivery, untouched,
    gathered: stockpile() - startStock,
    endTask: gatherer().task,
    idleCount: bridge.countIdleVillagers(),
    amountB: amountOf(bridge, b, kind),
  };
}

describe('a gatherer carries on to the same kind close by, or stands idle (DE)', () => {
  for (const kind of CARRY_ON_KINDS.filter((candidate) => candidate !== 'farm')) {
    it(`${kind}: back to A after a delivery, on to B with its load, then idle — never D, never another kind`, () => {
      const run = runCarryOn(kind);
      expect(run.targetAfterFirstDelivery, 'after its first delivery the villager went somewhere other than its own node')
        .toBe(run.a);
      expect(run.targets, `targets in order (A=${run.a}, B=${run.b}, D=${run.d}, C=${run.c}, fish=${run.fish})`)
        .toEqual([run.a, run.b]);
      expect(run.afterA, 'when A ran out the villager did not walk straight on to B with its partial load')
        .toEqual({ task: 'to-resource', target: run.b, carried: expect.any(Number) });
      expect(run.afterA!.carried).toBeGreaterThan(0);
      expect(run.amountB, 'B was not finished').toBeNull();
      expect(run.idleSince, 'the villager never stood idle once its kind ran out within reach').not.toBeNull();
      expect(run.endTask).toBe('idle');
      expect(run.idleCount).toBe(1);
      expect(run.gathered, 'every unit of A and B reached the stockpile').toBe(15 + 8);
      for (const node of run.untouched) {
        expect(amountOf(run.bridge, node.id, node.type), `${node.type} #${node.id} was gathered`).toBe(node.amount);
      }
    }, 60_000);
  }

  it('farm: an expired Farm with no wood to reseed it leaves its farmer idle — no other Farm, no other food', () => {
    const run = runCarryOn('farm');
    expect(run.targets, `targets in order (A=${run.a}, B=${run.b}, D=${run.d}, C=${run.c})`).toEqual([run.a]);
    expect(run.idleSince, 'the farmer never stood idle').not.toBeNull();
    expect(run.idleCount).toBe(1);
    expect(run.gathered).toBe(15);
    expect(run.amountB).toBe(8);
    for (const node of run.untouched) {
      expect(amountOf(run.bridge, node.id, node.type), `${node.type} #${node.id} was gathered`).toBe(node.amount);
    }
  }, 60_000);

  it('the computer keeps its own villager working as each node runs out', () => {
    // Its own idle villagers are the AI's to re-task (spec §6.4): the carry-on
    // rule is the unit's, and when it finds nothing an AI owner still hands
    // the villager work rather than leaving it to stand. A guard, green before
    // and after work 131: it goes red if the computer stops re-tasking.
    const bridge = createSimulationBridge(carryOnSeed('berry-bush'), {
      renderProjection: 'on-read',
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    });
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')!.id;
    const foodNodes = () => bridge.getEconomyState().resources
      .filter((resource) => ['berry-bush', 'sheep', 'fish'].includes(resource.resourceType)).length;
    const startNodes = foodNodes();
    let nodesLeft = startNodes;
    let idleRun = 0;
    let longestIdleRun = 0;
    // Until the map's food is gone: every node the villager finishes is a
    // moment the computer has to re-task it (A and B run out within reach,
    // then D, the sheep and the fish need the AI's own assignment).
    for (let tick = 1; tick <= 12_000 && nodesLeft > 0; tick += 1) {
      bridge.step(100);
      nodesLeft = foodNodes();
      const g = bridge.world.getComponent<GathererComponent>(villager, 'gatherer');
      const standing = g?.task === 'idle' && !bridge.getDebugSnapshot().unitPaths.some((path) => path.id === villager);
      idleRun = standing && nodesLeft > 0 ? idleRun + 1 : 0;
      longestIdleRun = Math.max(longestIdleRun, idleRun);
    }
    expect(longestIdleRun, 'the computer left its own villager standing idle beside food').toBeLessThan(50);
    expect(startNodes - nodesLeft, 'premise: the AI villager finished several nodes').toBeGreaterThanOrEqual(3);
  }, 120_000);
  it('the radius: a bush 5 cells from the one that ran out is close by, one 5.4 cells away is not', () => {
    const bridge = createSimulationBridge('carry-on-radius-fixture', { renderProjection: 'on-read' });
    const { inside, outside } = CARRY_ON_RADIUS_LAYOUT;
    expect(distance(inside.first, inside.second)).toBe(RADIUS);
    expect(distance(outside.first, outside.second)).toBeGreaterThan(RADIUS);
    expect(distance(outside.first, outside.second)).toBeLessThan(RADIUS + 0.5);
    const villagerAt = (at: Position) => bridge.getEconomyState().units
      .find((unit) => unit.unitType === 'villager' && unit.x === at.x && unit.y === at.y)!.id;
    const pairs = [inside, outside].map((pair) => ({
      villager: villagerAt(pair.villager),
      first: nodeIdAt(bridge, pair.first, 'berry-bush'),
      second: nodeIdAt(bridge, pair.second, 'berry-bush'),
      targets: new Set<number>(),
    }));
    for (const pair of pairs) {
      expect(bridge.selectUnitsByIds([pair.villager])).toBe(true);
      expect(bridge.issueContextCommandAtEntity(pair.first)).toBe(true);
    }
    for (let tick = 1; tick <= 2_500; tick += 1) {
      bridge.step(100);
      for (const pair of pairs) {
        const target = bridge.world.getComponent<GathererComponent>(pair.villager, 'gatherer')?.targetResourceId;
        if (target !== null && target !== undefined) pair.targets.add(target);
      }
    }
    const [inPair, outPair] = pairs;
    expect(amountOf(bridge, inPair!.first, 'berry-bush'), 'premise: the inside forager finished its first bush').toBeNull();
    expect(amountOf(bridge, outPair!.first, 'berry-bush'), 'premise: the outside forager finished its first bush').toBeNull();
    expect(inPair!.targets.has(inPair!.second), 'a bush exactly 5 cells away was not close by').toBe(true);
    expect(amountOf(bridge, inPair!.second, 'berry-bush'), 'the inside forager did not work its second bush').toBeNull();
    expect(outPair!.targets.has(outPair!.second), 'a bush 5.4 cells away was taken as close by').toBe(false);
    expect(amountOf(bridge, outPair!.second, 'berry-bush')).toBe(8);
    expect(bridge.countIdleVillagers(), 'both foragers stand idle once nothing is close by').toBe(2);
  }, 60_000);
});
