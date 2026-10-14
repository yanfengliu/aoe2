// What the start check tells the player when it cancels a foundation (work
// 122, review finding 8; spec §12.1, Definitive Edition update 46295).
//
// The toast named the first blocked cell of the footprint, kind and place,
// whether or not the player could see it. A builder standing beside a 3x3 or
// 4x4 foundation does not see its far corner, so the toast mapped ground the
// fog still hid. It now names the first blocked cell the player sees, and
// otherwise says only that the builders found the ground blocked.
//
// Bound: one hand-built 12x12 map, one 3x3 Barracks foundation of the human's,
// water hidden in its far corner and a gold mine in another; which cells the
// player sees is given, not walked. The bridge-level cancel cases, with real
// sight, are in placementUnexplored.test.ts.
import { describe, expect, it } from 'vitest';

import { World } from 'civ-engine';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import { createCellPassability } from '../../src/game/simulation/bridge/cellPassability';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerResourcesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createFoundationStart } from '../../src/game/simulation/bridge/foundationStart';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

const SIZE = 12;
const ANCHOR = { x: 4, y: 4 };
const HIDDEN_WATER = { x: 6, y: 6 };
const HIDDEN_GOLD = { x: 6, y: 4 };

function makeSite(options: { gold: boolean }) {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: SIZE,
    gridHeight: SIZE,
    seed: 'foundation-start-message',
    tps: 10,
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
      const kind = x === HIDDEN_WATER.x && y === HIDDEN_WATER.y ? 'water' : 'grass';
      const id = world.createEntity();
      world.addComponent(id, 'terrain', { kind, buildable: kind === 'grass', elevation: 0 });
      row.push(id);
    }
    tiles.push(row);
  }
  occupancy.blockTerrain([HIDDEN_WATER]);
  if (options.gold) {
    const mine = world.createEntity();
    world.addComponent(mine, 'resource', {
      resourceType: 'gold-mine', amount: 800, maxAmount: 800, owner: null, baseOwner: null,
    });
    occupancy.syncResource(mine, HIDDEN_GOLD);
  }
  const accessor = new BridgeStateAccessor(() => world as unknown as GameWorld);
  const site = world.createEntity();
  world.addComponent(site, 'building', { buildingType: 'barracks', owner: 1 });
  world.addComponent(site, 'position', { ...ANCHOR });
  occupancy.syncBuilding(site, ANCHOR, { width: 3, height: 3 });
  accessor.mutate(constructionStatesCodec, (states) => {
    states.set(site, {
      isComplete: false,
      buildProgressTicks: 0,
      totalBuildTicks: 500,
      populationProvided: 0,
      width: 3,
      height: 3,
    });
  });
  accessor.mutate(playerResourcesCodec, (stockpiles) => {
    stockpiles.set(1, { food: 0, wood: 0, gold: 0, stone: 0 });
  });
  const passability = createCellPassability({
    world: world as unknown as GameWorld,
    humanPlayerId: 1,
    mapWidth: SIZE,
    mapHeight: SIZE,
    worldOccupancy: occupancy,
    tiles,
    accessor,
  });
  return { world, accessor, passability, site };
}

function cancelMessage(gold: boolean, isCellSeen: (x: number, y: number) => boolean) {
  const { world, accessor, passability, site } = makeSite({ gold });
  const messages: string[] = [];
  const destroyed: number[] = [];
  const start = createFoundationStart({
    world: world as unknown as GameWorld,
    accessor,
    humanPlayerId: 1,
    isPlacementBlocked: passability.isPlacementBlocked,
    describePlacementBlockers: passability.describePlacementBlockers,
    isCellSeen: (owner, x, y) => owner === 1 && isCellSeen(x, y),
    isEntityDrawn: () => true,
    enqueueRejection: (message) => messages.push(message),
  });
  const allowed = start.mayBegin(site, (id) => destroyed.push(id));
  return {
    allowed,
    destroyed,
    message: messages.join(' | '),
    wood: accessor.get(playerResourcesCodec).get(1)?.wood,
    site,
  };
}

describe('the start check\'s message names only what the player sees (work 122)', () => {
  it('a hidden cell the player still cannot see is not named, kind or place', () => {
    // The builder at the north-west corner sees all but the far row and column.
    const result = cancelMessage(false, (x, y) => x < HIDDEN_WATER.x && y < HIDDEN_WATER.y);
    expect(result.allowed).toBe(false);
    expect(result.destroyed).toEqual([result.site]);
    expect(result.wood, 'the Barracks was not refunded').toBe(175);
    expect(result.message).toContain('Your barracks at (4,4) was cancelled');
    expect(result.message).toContain('its builders found its ground blocked by something the fog of war hid');
    expect(result.message).not.toContain('water');
    expect(result.message).not.toContain(`(${HIDDEN_WATER.x},${HIDDEN_WATER.y})`);
  });

  it('a hidden cell the player now sees is named, kind and place', () => {
    const result = cancelMessage(false, () => true);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain(`its builders found water at (${HIDDEN_WATER.x},${HIDDEN_WATER.y}), hidden under the fog of war`);
  });

  it('of two hidden cells it names the one the player sees, though the other comes first', () => {
    // The gold mine at (6,4) comes first in the footprint; only the bottom row is seen.
    const result = cancelMessage(true, (_x, y) => y === HIDDEN_WATER.y);
    expect(result.message).toContain(`its builders found water at (${HIDDEN_WATER.x},${HIDDEN_WATER.y})`);
    expect(result.message).not.toContain('gold');
    expect(result.message).not.toContain(`(${HIDDEN_GOLD.x},${HIDDEN_GOLD.y})`);
  });
});
