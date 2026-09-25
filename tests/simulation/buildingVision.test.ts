// Every building gives its owner sight, from the middle of its footprint
// (2026-09-24, defect register "Only seven building types gave their owner any
// sight"). Seen in play: owner 2's Militia cut down a human House at (44,26)
// in `raid-warning-fixture`, and the human's render state never held the
// raiders or their swings, because a House — like the Barracks, every camp,
// the Mill, the Market and the walls — had no line of sight at all. In a real
// match a completed House's own footprint went dark the moment its builder
// walked away.
//
// The expected cells come from structures.csv (read through
// scripts/content-lib.mjs, not the game's table) and from the continuous
// definition of a circle around the footprint's centre, written out below. The
// footprints come from the game's footprint table, an input here rather than
// the thing under test.
//
// BOUNDS: one fixture per path. The seeded path covers every building type,
// each checked ALONE (in the fixture seven types' circles lie wholly inside a
// neighbour's, so a union of all of them could not see those seven); the
// construction path covers a House (2x2) and a Barracks (3x3), because the
// completion code is one function for every type and the table differential
// (tests/content/structureLineOfSight.test.ts) covers each type's radius. A
// foundation still gives no sight until it is complete; whether DE's does is
// unverified (spec §12.2).

import { describe, expect, it } from 'vitest';

import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS, getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BUILDING_VISION_BARRACKS_SITE,
  BUILDING_VISION_HOUSE_SITE,
} from '../../src/game/simulation/fixtures/buildingVision';
import { PLAYABLE_MAPS } from '../../src/game/simulation/mapGeneration/playableMaps';
import type { BuildingType } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const CSV_NAME: Record<BuildingType, string> = {
  'town-center': 'Town Center', house: 'House', mill: 'Mill', 'lumber-camp': 'Lumber Camp',
  'mining-camp': 'Mining Camp', barracks: 'Barracks', 'watch-tower': 'Watch Tower',
  'bombard-tower': 'Bombard Tower', stable: 'Stable', 'archery-range': 'Archery Range',
  blacksmith: 'Blacksmith', market: 'Market', 'siege-workshop': 'Siege Workshop',
  monastery: 'Monastery', university: 'University', castle: 'Castle', wonder: 'Wonder',
  'stone-wall': 'Stone Wall', 'palisade-wall': 'Palisade Wall', 'stone-gate': 'Gate',
  'palisade-gate': 'Palisade Gate', farm: 'Farm', dock: 'Dock', outpost: 'Outpost',
  'fish-trap': 'Fish Trap',
};

const csvRows = (buildContentBundle() as {
  structures: Array<{ name: string; lineOfSight: number | null }>;
}).structures;

function csvLineOfSight(buildingType: BuildingType): number {
  const row = csvRows.find((candidate) => candidate.name === CSV_NAME[buildingType]);
  if (!row || row.lineOfSight === null) {
    throw new Error(`structures.csv has no line_of_sight for ${CSV_NAME[buildingType]} (${buildingType})`);
  }
  return row.lineOfSight;
}

// Cells whose centre lies within `lineOfSight` of the footprint's centre, as
// "x,y" keys, clipped to the map.
function centredCircle(
  anchor: { x: number; y: number },
  buildingType: BuildingType,
  lineOfSight: number,
  map: { width: number; height: number },
): string[] {
  const { width, height } = getBuildingFootprint(buildingType);
  const cx = anchor.x + width / 2;
  const cy = anchor.y + height / 2;
  const cells: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= lineOfSight * lineOfSight) cells.push(`${String(x)},${String(y)}`);
    }
  }
  return cells;
}

function litCells(bridge: Bridge, owner: number, window?: { minX: number; minY: number; maxX: number; maxY: number }): Set<string> {
  const map = bridge.getMapSize();
  const lit = new Set<string>();
  for (let y = window?.minY ?? 0; y <= (window?.maxY ?? map.height - 1); y += 1) {
    for (let x = window?.minX ?? 0; x <= (window?.maxX ?? map.width - 1); x += 1) {
      if (bridge.isCellVisibleForOwner(owner, x, y)) lit.add(`${String(x)},${String(y)}`);
    }
  }
  return lit;
}

const toCell = (cell: string): [number, number] => cell.split(',').map(Number) as [number, number];

describe('every completed building gives its owner sight', () => {
  it('each building type, standing alone, lights exactly its own circle', () => {
    // Instrument: one completed building of EVERY type, and no unit of the
    // human's, or the comparison below would be about something else.
    const first = createSimulationBridge('building-vision-fixture');
    const roster = first.getEconomyState().buildings.filter((building) => building.owner === 1);
    expect([...new Set(roster.map((building) => building.buildingType))].sort())
      .toEqual(Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS).sort());
    expect(roster.filter((building) => !building.isComplete).map((building) => building.buildingType)).toEqual([]);
    expect(first.getEconomyState().units.filter((unit) => unit.owner === 1)).toEqual([]);
    const map = first.getMapSize();

    const problems: string[] = [];
    for (const target of roster) {
      // The same deterministic fixture, with every other human building's
      // sight taken away, so this one's circle is the whole of what is lit.
      const bridge = createSimulationBridge('building-vision-fixture');
      for (const building of bridge.getEconomyState().buildings) {
        if (building.owner === 1 && building.id !== target.id) bridge.world.removeComponent(building.id, 'visionSource');
      }
      bridge.step(100);
      const expected = new Set(centredCircle(target, target.buildingType, csvLineOfSight(target.buildingType), map));
      const lit = litCells(bridge, 1);
      const missing = [...expected].filter((cell) => !lit.has(cell));
      const extra = [...lit].filter((cell) => !expected.has(cell));
      if (missing.length > 0 || extra.length > 0) {
        problems.push(
          `${target.buildingType} at (${String(target.x)},${String(target.y)}): `
          + `${String(missing.length)} missing (${missing.slice(0, 4).join(' ')}), `
          + `${String(extra.length)} extra (${extra.slice(0, 4).join(' ')})`,
        );
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it('a House and a Barracks a villager builds keep seeing after it walks away', () => {
    const bridge = createSimulationBridge('building-vision-build-fixture');
    const map = bridge.getMapSize();
    const build = (buildingType: 'house' | 'barracks', site: { x: number; y: number }): void => {
      expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
      expect(bridge.beginBuildingPlacement(buildingType)).toBe(true);
      expect(bridge.confirmBuildingPlacement(site.x, site.y)).toBe(true);
      expect(stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.some(
          (building) => building.owner === 1 && building.buildingType === buildingType && building.isComplete,
        ),
        { maxSteps: 2_000 },
      ), `the ${buildingType} was never finished`).toBe(true);
    };
    build('house', BUILDING_VISION_HOUSE_SITE);
    build('barracks', BUILDING_VISION_BARRACKS_SITE);

    // Walk the builder to the far west, out of sight of both buildings.
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.issueMoveCommand(8, 16)).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => (bridge.getEconomyState().units.find((unit) => unit.owner === 1)?.x ?? 99) <= 12,
      { maxSteps: 2_000 },
    ), 'the builder never walked away').toBe(true);

    // Around the two buildings, the human sees their circles and nothing else.
    const window = { minX: 24, minY: 0, maxX: 52, maxY: 35 };
    const expected = new Set<string>();
    for (const [buildingType, site] of [['house', BUILDING_VISION_HOUSE_SITE], ['barracks', BUILDING_VISION_BARRACKS_SITE]] as const) {
      for (const cell of centredCircle(site, buildingType, csvLineOfSight(buildingType), map)) expected.add(cell);
    }
    const lit = litCells(bridge, 1, window);
    expect({
      missing: [...expected].filter((cell) => !lit.has(cell)),
      extra: [...lit].filter((cell) => !expected.has(cell)),
    }).toEqual({ missing: [], extra: [] });
  }, 60_000);
});

function orderRaidersOntoHouse(bridge: Bridge, houseId: number): void {
  for (const raider of bridge.getEconomyState().units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia')) {
    bridge.pendingCommands.push({
      type: 'unit.attack',
      data: { unitId: raider.id, targetEntityId: houseId, targetEntityKind: 'building' },
    });
  }
}

describe('a raid on a lone House is seen by the House’s owner', () => {
  it('on every blow the human sees the Militia beside its House, and a swing (raid-warning-fixture)', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    const economy = bridge.getEconomyState();
    const house = economy.buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(house, 'raid-warning-fixture must give the human a House').toBeDefined();
    expect(economy.units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia').length).toBe(2);
    orderRaidersOntoHouse(bridge, house!.id);

    // A melee attacker hits from a cell that shares an edge with the House.
    const footprint = getBuildingFootprint('house');
    const besideHouse = (x: number, y: number): boolean => {
      const dx = x < house!.x ? house!.x - x : x > house!.x + footprint.width - 1 ? x - (house!.x + footprint.width - 1) : 0;
      const dy = y < house!.y ? house!.y - y : y > house!.y + footprint.height - 1 ? y - (house!.y + footprint.height - 1) : 0;
      return dx + dy === 1;
    };
    const houseHp = (): number => bridge.getRenderState().entities.find((entity) => entity.id === house!.id)?.currentHp ?? Number.NaN;
    let lastHp = houseHp();
    let blows = 0;
    const unseenRaiders: string[] = [];
    const blowsWithNoSwingDrawn: number[] = [];
    for (let step = 0; step < 400; step += 1) {
      bridge.step(100);
      const hp = houseHp();
      if (hp < lastHp) {
        blows += 1;
        const tick = bridge.getRenderState().tick;
        const drawn = new Map(bridge.getRenderState().entities.map((entity) => [entity.id, entity]));
        const hitters = bridge.getEconomyState().units.filter(
          (unit) => unit.owner === 2 && unit.unitType === 'militia' && besideHouse(unit.x, unit.y),
        );
        for (const raider of hitters) {
          if (!drawn.has(raider.id)) {
            unseenRaiders.push(`tick ${String(tick)}: militia ${String(raider.id)} at (${String(raider.x)},${String(raider.y)})`);
          }
        }
        if (!hitters.some((raider) => drawn.get(raider.id)?.attackAnimation !== undefined)) {
          blowsWithNoSwingDrawn.push(tick);
        }
      }
      lastHp = hp;
    }
    // Instrument: the raid really happened, many blows over the window.
    expect(blows).toBeGreaterThan(20);
    expect({
      raidersBesideTheHouseNotDrawn: unseenRaiders.slice(0, 8),
      blowsWithNoSwingDrawn: blowsWithNoSwingDrawn.slice(0, 8),
    }).toEqual({ raidersBesideTheHouseNotDrawn: [], blowsWithNoSwingDrawn: [] });
  }, 60_000);
});

describe('an even building’s four sources come and go together', () => {
  // A 2x2 or 4x4 building is four map sources (buildingVisionSources.ts). A
  // conversion flips its owner in place and a destruction removes it; either
  // way all four must follow, or the old owner keeps three quarters of a circle.
  const houseCircle = (bridge: Bridge, house: { x: number; y: number }): Array<[number, number]> =>
    centredCircle(house, 'house', csvLineOfSight('house'), bridge.getMapSize()).map(toCell);

  it('a House that changes owner lights its circle for the new owner and none of it for the old', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!;
    // Owner 2's Militia stand beside the House and see it themselves; blind
    // them, so the House is owner 2's only eye there and the new-owner half
    // below can fail.
    for (const raider of bridge.getEconomyState().units.filter((unit) => unit.owner === 2)) {
      bridge.world.removeComponent(raider.id, 'visionSource');
    }
    bridge.step(100);
    const circle = houseCircle(bridge, house);
    expect({
      unlitForOwner: circle.filter(([x, y]) => !bridge.isCellVisibleForOwner(1, x, y)),
      litForOwner2: circle.filter(([x, y]) => bridge.isCellVisibleForOwner(2, x, y)),
    }, 'the premise: the House lights its circle, and nothing of owner 2 sees any of it').toEqual({ unlitForOwner: [], litForOwner2: [] });
    // What a Monk's conversion does to a building's sight (monkBuildingConversion).
    bridge.world.getComponent<{ playerId: number }>(house.id, 'visionSource')!.playerId = 2;
    bridge.step(100);
    expect({
      stillLitForOldOwner: circle.filter(([x, y]) => bridge.isCellVisibleForOwner(1, x, y)),
      unlitForNewOwner: circle.filter(([x, y]) => !bridge.isCellVisibleForOwner(2, x, y)),
    }).toEqual({ stillLitForOldOwner: [], unlitForNewOwner: [] });
  }, 60_000);

  it('a House cut down by raiders takes its sight with it', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!;
    orderRaidersOntoHouse(bridge, house.id);
    expect(stepBridgeUntil(
      bridge,
      () => !bridge.getEconomyState().buildings.some((building) => building.id === house.id),
      { maxSteps: 6_000 },
    ), 'the raiders never destroyed the House').toBe(true);
    bridge.step(100);
    expect(houseCircle(bridge, house).filter(([x, y]) => bridge.isCellVisibleForOwner(1, x, y))).toEqual([]);
  }, 120_000);
});

describe('building sight across a save and a load', () => {
  const houseOf = (bridge: Bridge) =>
    bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!;
  const reload = (bridge: Bridge): Bridge => createSimulationBridge('raid-warning-fixture', {
    savedGame: JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<Bridge['saveGame']>,
  });

  it('a sightless House in a saved game sees again once the game is loaded', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    const house = houseOf(bridge);
    // What a save from before this change holds: a finished House with no sight.
    bridge.world.removeComponent(house.id, 'visionSource');
    bridge.step(100);
    expect(bridge.isCellVisibleForOwner(1, house.x, house.y), 'the save under test must hold a sightless House').toBe(false);

    const loaded = reload(bridge);
    loaded.step(100);
    const circle = centredCircle(house, 'house', csvLineOfSight('house'), loaded.getMapSize());
    expect(circle.filter((cell) => {
      const [x, y] = toCell(cell);
      return !loaded.isCellVisibleForOwner(1, x, y);
    })).toEqual([]);
  }, 60_000);

  it('a building that already sees keeps the radius it was saved with, and a save from this build loads unchanged', () => {
    // The repair gives sight only to a building that has none. A saved radius
    // carries the technology and civilization bonuses of whoever owned the
    // building when they were researched, which cannot be told apart from its
    // base, so it is never re-derived on a load.
    const bridge = createSimulationBridge('raid-warning-fixture');
    const house = houseOf(bridge);
    bridge.world.getComponent<{ radius: number }>(house.id, 'visionSource')!.radius = 1;
    bridge.step(100);
    const radii = (b: Bridge) => new Map(b.getEconomyState().buildings.map((building) => [
      building.id,
      b.world.getComponent<{ playerId: number; radius: number }>(building.id, 'visionSource') ?? null,
    ]));
    const before = radii(bridge);
    const loaded = reload(bridge);
    expect([...radii(loaded)]).toEqual([...before]);
    expect(loaded.world.getComponent<{ radius: number }>(house.id, 'visionSource')?.radius).toBe(1);
  }, 60_000);
});

describe('the real maps take building sight from the table', () => {
  it('every building every seat starts with sees what structures.csv says, on every playable map', () => {
    const problems: string[] = [];
    const checked = new Map<string, number>();
    for (const { seed } of PLAYABLE_MAPS) {
      const bridge = createSimulationBridge(seed);
      for (const building of bridge.getEconomyState().buildings) {
        if (!building.isComplete) continue;
        const radius = bridge.world.getComponent<{ radius: number }>(building.id, 'visionSource')?.radius;
        const expected = csvLineOfSight(building.buildingType);
        checked.set(seed, (checked.get(seed) ?? 0) + 1);
        if (radius !== expected) {
          problems.push(`${seed}: owner ${String(building.owner)}'s ${building.buildingType} at (${String(building.x)},${String(building.y)}) sees ${String(radius)}, csv says ${String(expected)}`);
        }
      }
    }
    // Instrument: every map that starts with buildings was read. Nomad starts
    // with none, as in DE.
    expect([...checked.keys()].sort(), 'maps whose starting buildings were read')
      .toEqual(PLAYABLE_MAPS.map(({ seed }) => seed).filter((seed) => seed !== 'nomad').sort());
    expect(problems).toEqual([]);
  }, 120_000);
});
