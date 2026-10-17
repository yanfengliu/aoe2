// The open ground an AI seat's refusal offers treats an enemy's unstarted
// foundation as open, and its own or an ally's as taken (work 126, review round
// 0; builderReachability.ts `withBuilderReachability`).
//
// A placement's suggested anchors come from the true-map wrapper for every
// seat that places by the true map (the human seat's own come from
// placementKnowledge.ts, held word for word by unbuiltFoundationPlacement.test.ts).
// The wrapper hands the occupancy's anchor scan what stands aside for the
// builders' owner (foundationClaims.ts), as its footprint rule does, so an
// anchor over an enemy's hidden foundation is offered as over open ground.
//
// BOUND: the real occupancy, footprint rule and claim rules on a hand-built
// 10x10 grass map with one 2x2 House foundation nobody has started, every
// route taken as walkable (the reachability half is builderReachability's own
// gates); one builder of owner 1, owner 3 its ally and owner 2 its enemy.

import { describe, expect, it } from 'vitest';

import { World } from 'civ-engine';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import { createCellPassability } from '../../src/game/simulation/bridge/cellPassability';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { constructionStatesCodec, playerTeamsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { withBuilderReachability } from '../../src/game/simulation/bridge/builderReachability';
import { createFoundationClaimRules } from '../../src/game/simulation/bridge/foundationClaims';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

const SIZE = 10;
const SITE = { x: 4, y: 4 };

function offeredAnchor(foundationOwner: number): { x: number; y: number } | undefined {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: SIZE, gridHeight: SIZE, seed: 'unbuilt-foundation-anchors', tps: 10,
  });
  for (const component of ['terrain', 'building', 'resource', 'unit', 'position'] as const) {
    world.registerComponent(component);
  }
  const occupancy = createWorldOccupancy(SIZE, SIZE);
  occupancy.attachWorld(world);
  const tiles: number[][] = [];
  for (let y = 0; y < SIZE; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      const id = world.createEntity();
      world.addComponent(id, 'terrain', { kind: 'grass', buildable: true, elevation: 0 });
      row.push(id);
    }
    tiles.push(row);
  }
  const accessor = new BridgeStateAccessor(() => world as unknown as GameWorld);
  accessor.mutate(playerTeamsCodec, (teams) => {
    teams.set(1, 1);
    teams.set(3, 1);
    teams.set(2, 2);
  });
  const foundation = world.createEntity();
  world.addComponent(foundation, 'building', { buildingType: 'house', owner: foundationOwner });
  world.addComponent(foundation, 'position', { ...SITE });
  occupancy.syncBuilding(foundation, SITE, { width: 2, height: 2 }, 'foundation');
  accessor.mutate(constructionStatesCodec, (states) => {
    states.set(foundation, {
      isComplete: false, buildProgressTicks: 0, totalBuildTicks: 250, populationProvided: 5, width: 2, height: 2,
    });
  });
  const builder = world.createEntity();
  world.addComponent(builder, 'unit', { unitType: 'villager', owner: 1 });
  world.addComponent(builder, 'position', { x: 0, y: 0 });
  occupancy.syncUnit(builder, { x: 0, y: 0 });

  const passability = createCellPassability({
    world: world as unknown as GameWorld,
    humanPlayerId: 1,
    mapWidth: SIZE,
    mapHeight: SIZE,
    worldOccupancy: occupancy,
    tiles,
    accessor,
  });
  const ops = withBuilderReachability(
    passability,
    { canAnyBuilderReachFootprint: () => true, stats: { computed: 0, served: 0, computeMs: 0 } },
    world as unknown as GameWorld,
    createFoundationClaimRules(world as unknown as GameWorld, accessor).standsAsideFor,
  );
  return ops.findOpenPlacementAnchors(SITE.x, SITE.y, 2, 2, {
    max: 1, maxRadius: 3, isCellVisible: () => true, builderIds: [builder],
  })[0];
}

describe('the open ground an AI seat\'s refusal offers (work 126, review round 0)', () => {
  it('offers the ground of an enemy\'s unstarted foundation as open ground', () => {
    expect(offeredAnchor(2), 'the anchor scan counted the enemy\'s hidden foundation').toEqual(SITE);
  });

  for (const [who, owner] of [['its own', 1], ['an ally\'s', 3]] as const) {
    it(`does not offer the ground of ${who} unstarted foundation`, () => {
      const anchor = offeredAnchor(owner);
      expect(anchor).toBeDefined();
      expect(anchor, `the anchor scan offered ${who} foundation's ground`).not.toEqual(SITE);
    });
  }
});
