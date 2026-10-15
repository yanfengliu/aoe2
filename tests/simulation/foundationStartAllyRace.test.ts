// Two allies' foundations on the same ground: whoever starts first wins, as
// between enemies (work 126, review round 0; spec §8.1).
//
// No seat may place over an own or allied foundation it can know about
// (foundationClaims.ts), so allied foundations overlap only through the fog:
// the human puts a House partly over unexplored ground where its ally has
// already placed one. The start check used to excuse only an enemy's unstarted
// foundation, so whichever ally's builder came first found the other's and was
// cancelled, and the later one then started unopposed (the review's
// allyOverlap probe: the ally's House was cancelled and refunded when
// its builder came first). The rule since (the coordinator, review round 0): at
// the start any other seat's unstarted foundation stands aside, an ally's as
// well as an enemy's; the first to start wins, and the other is cancelled and
// refunded when its own builders arrive (hotfix 45185, update 46295).
//
// BOUND — what a green run here does NOT prove: one House of each ally, the
// human's one column west of the ally's and partly over unexplored ground,
// on flat grass with no AI.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  ALLY_AWAY,
  HUMAN_BUILDER,
  UNBUILT_FOUNDATIONS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import type { Bridge } from './hiddenUnstartedFoundation.helpers';

type Cell = { x: number; y: number };

const HUMAN = 1;
const ALLY = 3;
const HUMAN_ASIDE: Cell = { x: 10, y: 30 };

function drain(bridge: Bridge): string {
  const messages: string[] = [];
  for (let message = bridge.consumeCommandRejection(); message !== null; message = bridge.consumeCommandRejection()) {
    messages.push(message);
  }
  return messages.join(' | ');
}

/** The ally's House wholly on ground the human has not explored, and the
 *  human's one column west of it, overlapping it, with at least one explored
 *  cell; both placed, neither started, both builders away. */
function overlappingAllySites(bridge: Bridge) {
  const { width } = bridge.getMapSize();
  const explored = new Set(bridge.getRenderState().frame?.exploredCells ?? []);
  const known = (x: number, y: number): boolean => explored.has(y * width + x);
  let allySite: Cell | null = null;
  for (let y = 14; y < 28 && !allySite; y += 1) {
    for (let x = 26; x < 36 && !allySite; x += 1) {
      if ([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].some(([cx, cy]) => known(cx!, cy!))) continue;
      if (!(known(x - 1, y) || known(x - 1, y + 1))) continue;
      allySite = { x, y };
    }
  }
  expect(allySite, 'the fixture moved: no ally site wholly unexplored beside explored ground').not.toBeNull();
  const humanSite = { x: allySite!.x - 1, y: allySite!.y };
  const allyBuilder = bridge.getEconomyState().units.find((unit) => unit.owner === ALLY && unit.unitType === 'villager')!.id;
  expect(bridge.world.submitWithResult('building.placeConfirm', {
    builderId: allyBuilder, buildingType: 'house', position: { ...allySite! },
  }).accepted).toBe(true);
  expect(bridge.world.submitWithResult('unit.move', { unitId: allyBuilder, target: { ...ALLY_AWAY } }).accepted).toBe(true);
  bridge.step(100);
  const humanBuilder = bridge.getEconomyState().units
    .find((unit) => unit.owner === HUMAN && unit.x === HUMAN_BUILDER.x && unit.y === HUMAN_BUILDER.y)!.id;
  expect(bridge.selectUnitsByIds([humanBuilder])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.confirmBuildingPlacement(humanSite.x, humanSite.y), 'the premise: the human may place over the unexplored ally site')
    .toBe(true);
  bridge.step(100);
  expect(bridge.world.submitWithResult('unit.move', { unitId: humanBuilder, target: { ...HUMAN_ASIDE } }).accepted).toBe(true);
  bridge.step(100);
  const houseOf = (owner: number) => bridge.getEconomyState().buildings
    .find((building) => building.owner === owner && building.buildingType === 'house');
  expect(houseOf(ALLY)?.buildProgressTicks, 'the premise: the ally\'s House stands unstarted').toBe(0);
  expect(houseOf(HUMAN)?.buildProgressTicks, 'the premise: the human\'s House stands unstarted').toBe(0);
  drain(bridge);
  return { allySite: allySite!, humanSite, allyBuilder, humanBuilder, ally: houseOf(ALLY)!.id, human: houseOf(HUMAN)!.id };
}

function stepUntil(bridge: Bridge, done: () => boolean, maxTicks = 1500): boolean {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (done()) return true;
    bridge.step(100);
  }
  return done();
}

describe('the first allied foundation started wins the ground (work 126, review round 0)', () => {
  it('the ally\'s builder comes first: the ally\'s House starts, and the human\'s is cancelled and refunded when its builder comes', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const sites = overlappingAllySites(bridge);
    const building = (id: number) => bridge.getEconomyState().buildings.find((candidate) => candidate.id === id);
    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: sites.allyBuilder, targetEntityId: sites.ally })
      .accepted).toBe(true);
    expect(stepUntil(bridge, () => building(sites.ally) === undefined || (building(sites.ally)?.buildProgressTicks ?? 0) > 0))
      .toBe(true);
    expect(building(sites.ally)?.buildProgressTicks ?? 0, 'the ally\'s House, first to its ground, was cancelled').toBeGreaterThan(0);

    const humanWood = bridge.getEconomyState().playerResources[HUMAN]?.wood ?? Number.NaN;
    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: sites.humanBuilder, targetEntityId: sites.human })
      .accepted).toBe(true);
    let messages = '';
    expect(stepUntil(bridge, () => {
      messages += drain(bridge);
      return building(sites.human) === undefined;
    }), 'the human\'s House was never cancelled').toBe(true);
    messages += drain(bridge);
    expect(bridge.getEconomyState().playerResources[HUMAN]?.wood, 'the human\'s House was not refunded').toBe(humanWood + 25);
    expect(messages).toContain(`Your house at (${sites.humanSite.x},${sites.humanSite.y}) was cancelled`);
    // By the time the human's builder comes the ally may have finished it.
    expect(messages).toMatch(/which another player has (started building|built)\./);
    expect(messages, 'the ally\'s House went up after the human\'s was placed').not.toContain('fog of war');
  });

  it('the human\'s builder comes first: the human\'s House starts, and the ally\'s is cancelled and refunded when its builder comes', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_SEED);
    const sites = overlappingAllySites(bridge);
    const building = (id: number) => bridge.getEconomyState().buildings.find((candidate) => candidate.id === id);
    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: sites.humanBuilder, targetEntityId: sites.human })
      .accepted).toBe(true);
    expect(stepUntil(bridge, () => building(sites.human) === undefined || (building(sites.human)?.buildProgressTicks ?? 0) > 0))
      .toBe(true);
    expect(building(sites.human)?.buildProgressTicks ?? 0, 'the human\'s House, first to its ground, was cancelled').toBeGreaterThan(0);

    const allyWood = bridge.getEconomyState().playerResources[ALLY]?.wood ?? Number.NaN;
    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: sites.allyBuilder, targetEntityId: sites.ally })
      .accepted).toBe(true);
    expect(stepUntil(bridge, () => building(sites.ally) === undefined), 'the ally\'s House was never cancelled').toBe(true);
    expect(bridge.getEconomyState().playerResources[ALLY]?.wood, 'the ally\'s House was not refunded').toBe(allyWood + 25);
    expect(building(sites.human)?.buildProgressTicks ?? 0, 'the human\'s House lost its ground').toBeGreaterThan(0);
  });
});
