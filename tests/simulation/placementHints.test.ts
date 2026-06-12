// agent-affordances A3/C: placement blocker descriptions + open-anchor
// search on cellPassability. Campaign-1 evidence: 19/27 rejections were
// blind house placements into unseen water with a bare "Placement
// blocked." — the describer names the cause+cell, the anchor search
// powers both the rejection suggestion and the snapshot's
// placementHints (fog-gated so nothing unseen leaks).

import { describe, expect, it } from 'vitest';

import { World } from 'civ-engine';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import { createCellPassability } from '../../src/game/simulation/bridge/cellPassability';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';

const SIZE = 12;

function makeFixture() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: SIZE,
    gridHeight: SIZE,
    seed: 'placement-hints',
    tps: 10,
  });
  world.registerComponent('terrain');
  world.registerComponent('building');
  world.registerComponent('resource');
  world.registerComponent('unit');

  const tiles: number[][] = [];
  for (let y = 0; y < SIZE; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      const id = world.createEntity();
      const isWater = (x === 5 || x === 6) && y === 5;
      world.addComponent(id, 'terrain', {
        kind: isWater ? 'water' : 'grass',
        buildable: !isWater,
        elevation: 0,
      });
      row.push(id);
    }
    tiles.push(row);
  }

  const occupancy = createWorldOccupancy(SIZE, SIZE);
  occupancy.blockTerrain([{ x: 5, y: 5 }, { x: 6, y: 5 }]);

  const tcId = world.createEntity();
  world.addComponent(tcId, 'building', { buildingType: 'town-center', owner: 1 });
  occupancy.syncBuilding(tcId, { x: 2, y: 2 }, { width: 2, height: 2 });

  const goldId = world.createEntity();
  world.addComponent(goldId, 'resource', {
    resourceType: 'gold',
    amount: 800,
    maxAmount: 800,
    owner: null,
    baseOwner: null,
  });
  occupancy.syncResource(goldId, { x: 8, y: 8 });

  const cellPassability = createCellPassability({
    world,
    humanPlayerId: 1,
    mapWidth: SIZE,
    mapHeight: SIZE,
    worldOccupancy: occupancy,
    tiles,
    accessor: new BridgeStateAccessor(() => world),
  });
  return { cellPassability };
}

describe('describePlacementBlockers', () => {
  it('returns null for an open footprint', () => {
    const { cellPassability } = makeFixture();
    expect(cellPassability.describePlacementBlockers(8, 1, 2, 2)).toBeNull();
  });

  it('names water with the blocking cell (the campaign-1 case)', () => {
    const { cellPassability } = makeFixture();
    const report = cellPassability.describePlacementBlockers(5, 5, 2, 2);
    expect(report).not.toBeNull();
    expect(report!.cause).toBe('water');
    expect(report!.firstBlockedCell).toEqual({ x: 5, y: 5 });
    expect(report!.blockedCellCount).toBe(2);
    expect(report!.totalCellCount).toBe(4);
  });

  it('names the blocking building type', () => {
    const { cellPassability } = makeFixture();
    const report = cellPassability.describePlacementBlockers(3, 3, 2, 2);
    expect(report!.cause).toBe('a town-center (building)');
    expect(report!.firstBlockedCell).toEqual({ x: 3, y: 3 });
  });

  it('names the blocking resource type', () => {
    const { cellPassability } = makeFixture();
    const report = cellPassability.describePlacementBlockers(8, 8, 1, 1);
    expect(report!.cause).toBe('a gold (resource)');
  });

  it('names the map edge for out-of-bounds footprints', () => {
    const { cellPassability } = makeFixture();
    const report = cellPassability.describePlacementBlockers(11, 11, 2, 2);
    expect(report!.cause).toBe('the map edge');
  });
});

describe('findOpenPlacementAnchors', () => {
  const allVisible = () => true;

  it('returns deterministic in-order anchors whose footprints are open', () => {
    const { cellPassability } = makeFixture();
    const a = cellPassability.findOpenPlacementAnchors(2, 2, 2, 2, {
      max: 4,
      isCellVisible: allVisible,
    });
    const b = cellPassability.findOpenPlacementAnchors(2, 2, 2, 2, {
      max: 4,
      isCellVisible: allVisible,
    });
    expect(a).toEqual(b);
    expect(a.length).toBe(4);
    for (const anchor of a) {
      expect(cellPassability.isPlacementBlocked(anchor.x, anchor.y, 2, 2)).toBe(false);
    }
    // The TC occupies (2,2)-(3,3); the nearest ring must not return a
    // footprint overlapping it.
    expect(a).not.toContainEqual({ x: 2, y: 2 });
  });

  it('never suggests anchors whose footprint is not fully visible', () => {
    const { cellPassability } = makeFixture();
    const onlyLeftHalf = (x: number) => x < 4;
    const anchors = cellPassability.findOpenPlacementAnchors(2, 2, 2, 2, {
      max: 8,
      isCellVisible: onlyLeftHalf,
    });
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      // every footprint cell (anchor + 2x2) stays within x<4
      expect(anchor.x + 1).toBeLessThan(4);
    }
  });

  it('returns an empty list when nothing visible is open', () => {
    const { cellPassability } = makeFixture();
    const anchors = cellPassability.findOpenPlacementAnchors(2, 2, 2, 2, {
      max: 4,
      isCellVisible: () => false,
    });
    expect(anchors).toEqual([]);
  });

  it('respects maxRadius', () => {
    const { cellPassability } = makeFixture();
    const anchors = cellPassability.findOpenPlacementAnchors(2, 2, 2, 2, {
      max: 64,
      maxRadius: 2,
      isCellVisible: allVisible,
    });
    for (const anchor of anchors) {
      expect(Math.max(Math.abs(anchor.x - 2), Math.abs(anchor.y - 2))).toBeLessThanOrEqual(2);
    }
  });
});
