import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import {
  SHARED_FAR,
  SHARED_FAR_SEED,
  SHARED_FARM,
  SHARED_FARM_SEED,
  SHARED_GATHERING_SEED,
  SHARED_KIND_LAYOUT,
  SHARED_KINDS,
  SHARED_OPENING,
  SHARED_TRAP,
  SHARED_TRAP_SEED,
  sharedKindSeed,
} from '../../src/game/simulation/fixtures/economyBasics/sharedGathering';
import type { GathererComponent, ResourceComponent, ResourceKind } from '../../src/game/simulation/types';

// Work 145: villagers share a node as Definitive Edition's do (spec §6.4,
// "Several villagers on one node"). DE's text names a worker limit for the
// Farm alone ("Only one Villager may work a Farm at a time", string 26149); a
// sheep, a carcass, a tree, a mine or a bush takes as many villagers as fit
// beside it, and when it runs out its shepherds, woodcutters, miners or
// foragers go on to the next one of its kind, all of them. Until work 145 a
// rule cap stood in for the room beside a node: a player's group was split
// when it walked more than 32 tiles to its node, and a node's gatherers were
// split 4 and the rest when it ran out.
//
// Every case is the player's own command: select the villagers, right-click
// the node. Bound: open grass, the fixture's stated cells, eight villagers at
// most per node (six on the sheep of the opening); a boar's carcass is
// huntCarryOn.test.ts's (six hunters gather the kill), and the campaign-4
// pile is villagerGatherPile.test.ts's.

type Bridge = ReturnType<typeof createSimulationBridge>;

function nodeAt(bridge: Bridge, at: Position, type: ResourceKind): number {
  const found = bridge.getEconomyState().resources
    .find((resource) => resource.resourceType === type && resource.x === at.x && resource.y === at.y);
  if (!found) throw new Error(`fixture premise: no ${type} at (${at.x},${at.y})`);
  return found.id;
}

function villagersOf(bridge: Bridge): number[] {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === HUMAN_PLAYER_ID && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

const gathererOf = (bridge: Bridge, id: number): GathererComponent => (
  bridge.world.getComponent<GathererComponent>(id, 'gatherer')!
);

const stands = (bridge: Bridge, id: number): boolean => {
  const resource = bridge.world.getComponent<ResourceComponent>(id, 'resource');
  return resource !== undefined && resource.amount > 0;
};

function order(bridge: Bridge, villagers: readonly number[], node: number): void {
  expect(bridge.selectUnitsByIds([...villagers])).toBe(true);
  expect(bridge.issueContextCommandAtEntity(node)).toBe(true);
}

/** How many of `villagers` are swinging at `node` this tick. */
const workingOn = (bridge: Bridge, villagers: readonly number[], node: number): number => villagers
  .filter((id) => {
    const g = gathererOf(bridge, id);
    return g.task === 'gathering' && g.targetResourceId === node;
  }).length;

/** Steps until `node` is gone, and returns each villager's target the tick it went. */
function runOut(bridge: Bridge, villagers: readonly number[], node: number, ticks: number): Array<number | null> | null {
  for (let tick = 0; tick < ticks; tick += 1) {
    bridge.step(100);
    if (!stands(bridge, node)) return villagers.map((id) => gathererOf(bridge, id).targetResourceId);
  }
  return null;
}

describe('villagers share a node as in DE (work 145)', () => {
  it('six villagers eat one sheep under the Town Center together, and all six go on to the next sheep', () => {
    const bridge = createSimulationBridge(SHARED_GATHERING_SEED, { renderProjection: 'on-read' });
    const villagers = villagersOf(bridge);
    expect(villagers).toHaveLength(6);
    const a = nodeAt(bridge, SHARED_OPENING.A, 'sheep');
    const b = nodeAt(bridge, SHARED_OPENING.B, 'sheep');
    const c = nodeAt(bridge, SHARED_OPENING.C, 'sheep');
    order(bridge, villagers, a);

    let mostAtOnce = 0;
    for (let tick = 0; tick < 300; tick += 1) {
      bridge.step(100);
      mostAtOnce = Math.max(mostAtOnce, workingOn(bridge, villagers, a));
    }
    expect(mostAtOnce, 'the six never ate the sheep at the same time').toBe(6);

    const next = runOut(bridge, villagers, a, 2_000);
    expect(next, 'sheep A was never eaten').not.toBeNull();
    expect(next, 'every shepherd goes on to the nearest sheep, B').toEqual(villagers.map(() => b));
    let onB = 0;
    for (let tick = 0; tick < 300; tick += 1) {
      bridge.step(100);
      onB = Math.max(onB, workingOn(bridge, villagers, b));
      for (const id of villagers) expect(gathererOf(bridge, id).targetResourceId).not.toBe(c);
    }
    expect(onB, 'the six never ate sheep B together').toBe(6);
  });

  for (const kind of SHARED_KINDS) {
    it(`eight villagers work one ${kind} at once at a lone villager's rate, and all go on to the nearest one`, () => {
      const bridge = createSimulationBridge(sharedKindSeed(kind), { renderProjection: 'on-read' });
      const villagers = villagersOf(bridge);
      expect(villagers).toHaveLength(8);
      const n = nodeAt(bridge, SHARED_KIND_LAYOUT.N, kind);
      const n2 = nodeAt(bridge, SHARED_KIND_LAYOUT.N2, kind);
      order(bridge, villagers, n);

      // Sharing is no stacking bonus: over the same window from the first
      // swing, each of the eight takes what one villager alone takes.
      const shared = watchNode(bridge, villagers, n, 4_000);
      const lone = createSimulationBridge(sharedKindSeed(kind), { renderProjection: 'on-read' });
      const [first] = villagersOf(lone);
      const loneNode = nodeAt(lone, SHARED_KIND_LAYOUT.N, kind);
      order(lone, [first!], loneNode);
      const alone = watchNode(lone, [first!], loneNode, 600);
      expect(shared.together, `the eight never all worked the ${kind} at once`).toBe(8);
      expect(alone.taken[0], 'the lone villager took nothing').toBeGreaterThan(0);
      for (const taken of shared.taken) expect(Math.abs(taken - alone.taken[0]!)).toBeLessThanOrEqual(1);

      expect(shared.targetsWhenGone, `the ${kind} never ran out`).not.toBeNull();
      expect(shared.targetsWhenGone, `every gatherer goes on to the nearest ${kind}`).toEqual(villagers.map(() => n2));
    });
  }

  it('a group ordered onto a gold pile 36 cells away all mine it, none split off on the way', () => {
    const bridge = createSimulationBridge(SHARED_FAR_SEED, { renderProjection: 'on-read' });
    const villagers = villagersOf(bridge);
    expect(villagers).toHaveLength(5);
    const gold = nodeAt(bridge, SHARED_FAR.gold, 'gold-mine');
    const gold2 = nodeAt(bridge, SHARED_FAR.gold2, 'gold-mine');
    order(bridge, villagers, gold);
    let together = 0;
    for (let tick = 0; tick < 900; tick += 1) {
      bridge.step(100);
      together = Math.max(together, workingOn(bridge, villagers, gold));
      for (const id of villagers) {
        expect(gathererOf(bridge, id).targetResourceId, `villager ${id} was sent to the other pile`).not.toBe(gold2);
      }
    }
    expect(together, 'the five never mined the clicked pile together').toBe(5);
  });

  it('a Farm takes one villager: of three ordered onto one, one farms it, one takes the free Farm beside it, one stands idle', () => {
    const bridge = createSimulationBridge(SHARED_FARM_SEED, { renderProjection: 'on-read' });
    const villagers = villagersOf(bridge);
    expect(villagers).toHaveLength(3);
    const f1 = nodeAt(bridge, SHARED_FARM.F1, 'farm');
    const f2 = nodeAt(bridge, SHARED_FARM.F2, 'farm');
    order(bridge, villagers, f1);
    let mostOnF1 = 0;
    let mostOnF2 = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      bridge.step(100);
      mostOnF1 = Math.max(mostOnF1, workingOn(bridge, villagers, f1));
      mostOnF2 = Math.max(mostOnF2, workingOn(bridge, villagers, f2));
    }
    expect(mostOnF1, 'two farmers worked one Farm at once').toBe(1);
    expect(mostOnF2, 'the second farmer did not take the free Farm beside it').toBe(1);
    const idle = villagers.filter((id) => {
      const g = gathererOf(bridge, id);
      return g.task === 'idle' && g.targetResourceId === null && !g.hasExplicitGatherOrder;
    });
    expect(idle, 'the third, with no free Farm close by, did not stand idle').toHaveLength(1);
  });

  it('a villager a sheep has walked onto still gathers when ordered', () => {
    const bridge = createSimulationBridge(SHARED_TRAP_SEED, { renderProjection: 'on-read' });
    const [villager] = villagersOf(bridge);
    const walker = nodeAt(bridge, SHARED_TRAP.walker, 'sheep');
    const food = nodeAt(bridge, SHARED_TRAP.food, 'sheep');
    // The sheep walks onto the villager's cell, as a boxed sheep does when the
    // box's villagers are ordered onto another sheep.
    expect(bridge.selectUnitsByIds([walker])).toBe(true);
    expect(bridge.issueMoveCommand(SHARED_TRAP.villager.x, SHARED_TRAP.villager.y)).toBe(true);
    const at = (id: number) => bridge.world.getComponent<Position>(id, 'position')!;
    let underSheep = false;
    for (let tick = 0; tick < 300 && !underSheep; tick += 1) {
      bridge.step(100);
      underSheep = at(walker).x === at(villager!).x && at(walker).y === at(villager!).y;
    }
    expect(underSheep, 'fixture premise: the sheep never stood on the villager\'s cell').toBe(true);

    order(bridge, [villager!], food);
    let ate = false;
    for (let tick = 0; tick < 400 && !ate; tick += 1) {
      bridge.step(100);
      ate = workingOn(bridge, [villager!], food) === 1;
    }
    expect(ate, 'the villager under the sheep never reached the sheep it was ordered onto').toBe(true);
  });
});

/** Steps up to `ticks`: each villager's take over the 250 ticks after its
 *  first swing at `node`, the most that worked it at once, and every
 *  villager's target the tick it ran out (null while it stands). */
function watchNode(bridge: Bridge, villagers: readonly number[], node: number, ticks: number) {
  const startedAt = new Map<number, number>();
  const taken = new Map<number, number>(villagers.map((id) => [id, 0]));
  const last = new Map<number, number>(villagers.map((id) => [id, 0]));
  let together = 0;
  let targetsWhenGone: Array<number | null> | null = null;
  for (let tick = 0; tick < ticks && targetsWhenGone === null; tick += 1) {
    bridge.step(100);
    together = Math.max(together, workingOn(bridge, villagers, node));
    for (const id of villagers) {
      const g = gathererOf(bridge, id);
      if (!startedAt.has(id) && g.task === 'gathering' && g.targetResourceId === node) startedAt.set(id, tick);
      const since = startedAt.get(id);
      if (since !== undefined && tick - since < 250 && g.carriedAmount > last.get(id)!) {
        taken.set(id, taken.get(id)! + g.carriedAmount - last.get(id)!);
      }
      last.set(id, g.carriedAmount);
    }
    if (!stands(bridge, node)) targetsWhenGone = villagers.map((id) => gathererOf(bridge, id).targetResourceId);
  }
  return { together, taken: villagers.map((id) => taken.get(id)!), targetsWhenGone };
}
