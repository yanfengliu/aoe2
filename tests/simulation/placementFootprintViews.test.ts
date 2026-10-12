// The footprint rule and its views (placementFootprint.ts, work 122).
//
// The rule moved out of cellPassability.ts when it gained a VIEW: the player's
// (read only explored cells) and the start check's (leave the foundation's own
// claims out). The unviewed path is the code every AI seat and every system
// reads, and it must not change, so the first case holds the EMPTY view — the
// same per-cell walk with nothing hidden and nothing ignored — to it on every
// anchor of a map holding every kind of claim. A drift between the two would
// make the player's verdict and the AI's disagree on ground both can see.
//
// Bound: one 16x16 map, built by hand, with water, forest, a mine, a building,
// a farm and a unit on it; five building types covering the land, shore and
// water rules. The views' effect on a real match is the bridge-level gate in
// placementUnexplored.test.ts.
import { describe, expect, it } from 'vitest';

import { World } from 'civ-engine';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import { createCellPassability } from '../../src/game/simulation/bridge/cellPassability';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { buildingFootprint } from '../../src/game/simulation/bridge/pureHelpers';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { BuildingType, TerrainKind } from '../../src/game/simulation/types';

const SIZE = 16;
const TYPES: readonly BuildingType[] = ['house', 'barracks', 'dock', 'fish-trap', 'farm'];

function terrainAt(x: number, y: number): TerrainKind {
  if (x >= 9 && x <= 12 && y >= 2 && y <= 6) return 'water';
  if (y === 12 && x >= 2 && x <= 6) return 'forest';
  if (x === 14 && y >= 10) return 'hill';
  return 'grass';
}

function makeWorld() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: SIZE,
    gridHeight: SIZE,
    seed: 'placement-footprint-views',
    tps: 10,
  });
  for (const component of ['terrain', 'building', 'resource', 'unit'] as const) world.registerComponent(component);
  const occupancy = createWorldOccupancy(SIZE, SIZE);
  occupancy.attachWorld(world);
  const tiles: number[][] = [];
  const blocked: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < SIZE; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      const kind = terrainAt(x, y);
      const id = world.createEntity();
      world.addComponent(id, 'terrain', { kind, buildable: kind === 'grass' || kind === 'hill', elevation: 0 });
      if (kind === 'water' || kind === 'forest') blocked.push({ x, y });
      row.push(id);
    }
    tiles.push(row);
  }
  occupancy.blockTerrain(blocked);

  const house = world.createEntity();
  world.addComponent(house, 'building', { buildingType: 'house', owner: 2 });
  occupancy.syncBuilding(house, { x: 2, y: 2 }, { width: 2, height: 2 });
  const farm = world.createEntity();
  world.addComponent(farm, 'building', { buildingType: 'farm', owner: 1 });
  occupancy.syncBuilding(farm, { x: 6, y: 8 }, { width: 1, height: 1 }, 'farm');
  const mine = world.createEntity();
  world.addComponent(mine, 'resource', { resourceType: 'gold-mine', amount: 800, maxAmount: 800, owner: null, baseOwner: null });
  occupancy.syncResource(mine, { x: 12, y: 13 });
  const militia = world.createEntity();
  world.addComponent(militia, 'unit', { unitType: 'militia', owner: 2 });
  occupancy.syncUnit(militia, { x: 4, y: 9 });
  const boat = world.createEntity();
  world.addComponent(boat, 'unit', { unitType: 'fishing-ship', owner: 1 });
  occupancy.syncUnit(boat, { x: 10, y: 4 });

  const passability = createCellPassability({
    world,
    humanPlayerId: 1,
    mapWidth: SIZE,
    mapHeight: SIZE,
    worldOccupancy: occupancy,
    tiles,
    accessor: new BridgeStateAccessor(() => world),
  });
  return { passability, house, farm, militia };
}

describe('the footprint rule and its views (work 122)', () => {
  it('the empty view gives the unviewed verdict on every anchor, for every rule', () => {
    const { passability } = makeWorld();
    const disagreements: string[] = [];
    let blockedSeen = 0;
    let openSeen = 0;
    for (const type of TYPES) {
      const { width, height } = buildingFootprint(type);
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const unviewed = passability.isPlacementBlocked(x, y, width, height, type);
          const viewed = passability.isPlacementBlocked(x, y, width, height, type, {});
          if (unviewed !== viewed) disagreements.push(`${type} at (${x},${y}): ${String(unviewed)} unviewed, ${String(viewed)} viewed`);
          if (unviewed) blockedSeen += 1;
          else openSeen += 1;
          const report = passability.describePlacementBlockers(x, y, width, height);
          const viewedReport = passability.describePlacementBlockers(x, y, width, height, {});
          expect(viewedReport, `${type} at (${x},${y})`).toEqual(report);
        }
      }
    }
    expect(disagreements).toEqual([]);
    // Every kind of answer occurs, so agreement is not two constants agreeing.
    expect(blockedSeen).toBeGreaterThan(300);
    expect(openSeen).toBeGreaterThan(300);
    for (const type of ['dock', 'fish-trap'] as const) {
      const { width, height } = buildingFootprint(type);
      let open = 0;
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) if (!passability.isPlacementBlocked(x, y, width, height, type)) open += 1;
      }
      expect(open, `${type} is open nowhere: the fixture no longer exercises its rule`).toBeGreaterThan(0);
    }
  });

  it('a cell the player has not explored neither blocks the footprint nor holds the water a Dock needs', () => {
    const { passability } = makeWorld();
    // Everything east of x = 8 is unexplored; the pond starts at x = 9.
    const isCellKnown = (x: number, _y: number): boolean => x <= 8;
    // The enemy house stands wholly on explored ground, and still refuses.
    expect(passability.isPlacementBlocked(2, 2, 2, 2, 'house', { isCellKnown })).toBe(true);
    // Straddling the line onto the pond: the water under the east half is unseen.
    expect(passability.isPlacementBlocked(8, 3, 2, 2, 'house')).toBe(true);
    expect(passability.isPlacementBlocked(8, 3, 2, 2, 'house', { isCellKnown })).toBe(false);
    // A Dock against the pond's west shore touches unseen water only.
    expect(passability.isPlacementBlocked(5, 3, 3, 3, 'dock')).toBe(true);
    expect(passability.isPlacementBlocked(6, 3, 3, 3, 'dock')).toBe(false);
    expect(passability.isPlacementBlocked(6, 3, 3, 3, 'dock', { isCellKnown })).toBe(true);
    // The map edge is known to everyone.
    expect(passability.isPlacementBlocked(SIZE - 1, 0, 2, 2, 'house', { isCellKnown: () => false })).toBe(true);
    // A refusal names and counts only explored cells: the farm, one of two.
    const report = passability.describePlacementBlockers(6, 8, 2, 2, { isCellKnown: (x) => x <= 6 });
    expect(report).toMatchObject({
      firstBlockedCell: { x: 6, y: 8 },
      cause: 'a farm (building)',
      blockedCellCount: 1,
      knownCellCount: 2,
    });
  });

  it('the start check leaves the foundation\'s own claims out, and only its own', () => {
    const { passability, house, farm } = makeWorld();
    expect(passability.isPlacementBlocked(2, 2, 2, 2, 'house')).toBe(true);
    expect(passability.isPlacementBlocked(2, 2, 2, 2, 'house', { ignoredEntityId: house })).toBe(false);
    // Only that entity is left out: the enemy house still refuses another's start.
    expect(passability.isPlacementBlocked(2, 2, 2, 2, 'house', { ignoredEntityId: farm })).toBe(true);
    expect(passability.isPlacementBlocked(6, 8, 1, 1, 'farm', { ignoredEntityId: farm })).toBe(false);
    // A unit standing on the ground counts: inside a wall's foundation it was
    // there when the foundation went down.
    expect(passability.isPlacementBlocked(4, 9, 1, 1, 'house', { ignoredEntityId: house })).toBe(true);
  });
});
