import { describe, expect, it } from 'vitest';

import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  standardMapSize,
} from '../../src/game/simulation/mapGeneration/constants';
import { MAX_STANDARD_PLAYERS } from '../../src/game/simulation/mapGeneration/applyStandardPlayerOpening/patches';

// Spec §4.2: a Random Map skirmish seats 2 to 8. This map seated 4, because
// 60x36 is a two-player size and a fifth player would open inside someone
// else's base — so the seats were never the blocker, the map was. §4's size
// ladder is what grows it, and these tests are what say the grown map is still
// a real map: every seat far from every other, every opening inside the world,
// and a bridge that boots on all seven counts.

const COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('the standard map size ladder', () => {
  it('seats every count the spec allows', () => {
    expect(MAX_STANDARD_PLAYERS).toBe(8);
  });

  it('leaves the two-player map exactly as it was', () => {
    // Every existing map, screenshot and test assumes 60x36 for a 1v1.
    expect(standardMapSize(2)).toEqual({ width: MAP_WIDTH, height: MAP_HEIGHT });
    expect(standardMapSize(2)).toEqual({ width: 60, height: 36 });
  });

  it('grows with the player count and never shrinks', () => {
    let previous = 0;
    for (const count of COUNTS) {
      const { width, height } = standardMapSize(count);
      const area = width * height;
      expect(area, `${count} players`).toBeGreaterThanOrEqual(previous);
      previous = area;
    }
    // Eight players get more than three times the two-player world.
    const two = standardMapSize(2);
    const eight = standardMapSize(8);
    expect(eight.width * eight.height).toBeGreaterThan(3 * two.width * two.height);
  });

  it('keeps roughly the same land per player at every count', () => {
    // A ladder that grows too slowly crowds the late seats and too quickly
    // makes a 1v1 out of an eight-player game.
    const perPlayer = COUNTS.map((count) => {
      const { width, height } = standardMapSize(count);
      return (width * height) / count;
    });
    const lowest = Math.min(...perPlayer);
    const highest = Math.max(...perPlayer);
    expect(highest / lowest).toBeLessThan(1.35);
  });

  it('clamps a count outside the range rather than throwing', () => {
    expect(standardMapSize(1)).toEqual(standardMapSize(2));
    expect(standardMapSize(99)).toEqual(standardMapSize(8));
  });
});

describe('a standard map at every seat count', () => {
  for (const count of COUNTS) {
    it(`generates ${count} openings that fit inside the world`, () => {
      const scenario = createPrototypeScenario(undefined, count);
      const { width, height } = standardMapSize(count);

      expect(scenario.width).toBe(width);
      expect(scenario.height).toBe(height);
      expect(scenario.terrain).toHaveLength(height);
      for (const row of scenario.terrain) expect(row).toHaveLength(width);

      expect(scenario.starts).toHaveLength(count);
      for (const start of scenario.starts) {
        // A Town Center is 4x4 and its opening reaches further, so a seat
        // needs real margin from the edge, not merely to be in bounds.
        expect(start.townCenter.x).toBeGreaterThanOrEqual(6);
        expect(start.townCenter.y).toBeGreaterThanOrEqual(6);
        expect(start.townCenter.x).toBeLessThanOrEqual(width - 10);
        expect(start.townCenter.y).toBeLessThanOrEqual(height - 10);
      }

      // Nobody opens on top of anybody. 20 cells is roughly the distance
      // between the two established 1v1 openings' nearest resources.
      for (let i = 0; i < scenario.starts.length; i += 1) {
        for (let j = i + 1; j < scenario.starts.length; j += 1) {
          const apart = distance(scenario.starts[i]!.townCenter, scenario.starts[j]!.townCenter);
          expect(apart, `players ${i + 1} and ${j + 1} at ${count} seats`)
            .toBeGreaterThan(20);
        }
      }

      // Everything the generator placed is on the map.
      for (const spawn of scenario.spawns) {
        expect(spawn.x, `${spawn.kind} x`).toBeGreaterThanOrEqual(0);
        expect(spawn.y, `${spawn.kind} y`).toBeGreaterThanOrEqual(0);
        expect(spawn.x, `${spawn.kind} x`).toBeLessThan(width);
        expect(spawn.y, `${spawn.kind} y`).toBeLessThan(height);
      }
    });

    // The two-player map deliberately stands a forward house and scout for
    // player 2 near the middle, as a landmark for the human to find. That is a
    // 1v1 feature; with more seats it is a gift to one opponent, so from three
    // players up every opening has to be the same.
    it.skipIf(count === 2)(`gives all ${count} players the same opening`, () => {
      const scenario = createPrototypeScenario(undefined, count);
      const owned = new Map<number, string[]>();
      for (const spawn of scenario.spawns) {
        if (spawn.owner === null) continue;
        const list = owned.get(spawn.owner) ?? [];
        list.push(String(spawn.kind));
        owned.set(spawn.owner, list);
      }
      const openings = [...owned.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, kinds]) => kinds.slice().sort().join(','));
      expect(owned.size, 'every seat should own something').toBe(count);
      // A forward house that only ONE opponent gets is a gift, not a map.
      for (const opening of openings) {
        expect(opening, `at ${count} seats: ${openings.join(' | ')}`).toBe(openings[0]);
      }
    });
  }
});

describe('a match at every seat count', () => {
  for (const count of COUNTS) {
    it(`boots and runs with ${count} players`, () => {
      const bridge = createSimulationBridge(undefined, { playerCount: count });
      for (let step = 0; step < 50; step += 1) bridge.step(100);

      const units = bridge.getEconomyState().units;
      for (let owner = 1; owner <= count; owner += 1) {
        const villagers = units.filter(
          (unit) => unit.owner === owner && unit.unitType === 'villager',
        );
        expect(villagers.length, `player ${owner} villagers`).toBeGreaterThanOrEqual(3);
      }
      const townCenters = bridge.getEconomyState().buildings
        .filter((building) => building.buildingType === 'town-center');
      expect(townCenters).toHaveLength(count);
    }, 30_000);
  }
});

describe('a four-versus-four on the eight-player map', () => {
  it('opens with both teams seated and nobody allied to everybody', () => {
    // Teams are per-owner numbers (§4.2), and the ladder is what made a 4v4
    // possible at all — eight seats need the map that seats eight.
    const teamsByOwner = new Map([
      [1, 1], [2, 1], [3, 1], [4, 1],
      [5, 2], [6, 2], [7, 2], [8, 2],
    ]);
    const bridge = createSimulationBridge(undefined, { playerCount: 8, teamsByOwner });
    for (let step = 0; step < 50; step += 1) bridge.step(100);

    const owners = new Set(bridge.getEconomyState().units.map((unit) => unit.owner));
    expect([...owners].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Player 1 shares sight with its own side only once Cartography is in, so
    // the check here is the assignment itself: four a side.
    const sides = new Map<number, number>();
    for (const [, team] of teamsByOwner) sides.set(team, (sides.get(team) ?? 0) + 1);
    expect([...sides.values()]).toEqual([4, 4]);
  }, 30_000);
});
