import { describe, expect, it } from 'vitest';

import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';
import {
  MAX_STANDARD_PLAYERS,
  createPlayerStarts,
} from '../../src/game/simulation/mapGeneration/applyStandardPlayerOpening/patches';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { parsePlayersParam } from '../../src/app/bootstrap/playersParam';

// §2.2 puts "AI opponents" and "optional AI allies" in scope, and the default
// map placed exactly two starts at fixed cells — so there was no way to ASK for
// a third player, whatever the rest of the game could handle.

describe('createPlayerStarts', () => {
  it('still gives the established 1v1 when asked for two', () => {
    const starts = createPlayerStarts(2);
    expect(starts).toHaveLength(2);
    expect(starts[0]).toMatchObject({ owner: 1, townCenter: { x: 8, y: 8 }, civilization: 'Britons' });
    expect(starts[1]).toMatchObject({ owner: 2, townCenter: { x: 48, y: 24 }, civilization: 'Franks' });
  });

  it('defaults to two, so every existing caller is unchanged', () => {
    expect(createPlayerStarts()).toEqual(createPlayerStarts(2));
  });

  it('numbers owners from one, without gaps, up to the count asked for', () => {
    for (let count = 2; count <= MAX_STANDARD_PLAYERS; count += 1) {
      const owners = createPlayerStarts(count).map((start) => start.owner);
      expect(owners).toEqual(Array.from({ length: count }, (_unused, index) => index + 1));
    }
  });

  it('keeps every town centre on the map with room for its footprint', () => {
    for (let count = 2; count <= MAX_STANDARD_PLAYERS; count += 1) {
      for (const start of createPlayerStarts(count)) {
        expect(start.townCenter.x).toBeGreaterThanOrEqual(4);
        expect(start.townCenter.y).toBeGreaterThanOrEqual(4);
        // A Town Center is 4x4 and its opening needs room around it.
        expect(start.townCenter.x).toBeLessThanOrEqual(MAP_WIDTH - 8);
        expect(start.townCenter.y).toBeLessThanOrEqual(MAP_HEIGHT - 8);
      }
    }
  });

  it('keeps players far enough apart that nobody starts in a neighbour’s base', () => {
    for (let count = 2; count <= MAX_STANDARD_PLAYERS; count += 1) {
      const starts = createPlayerStarts(count);
      for (let i = 0; i < starts.length; i += 1) {
        for (let j = i + 1; j < starts.length; j += 1) {
          const a = starts[i]!.townCenter;
          const b = starts[j]!.townCenter;
          const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
          expect(distance, `starts ${i + 1} and ${j + 1} of ${count}`).toBeGreaterThanOrEqual(16);
        }
      }
    }
  });

  it('gives each player a civilization', () => {
    for (const start of createPlayerStarts(MAX_STANDARD_PLAYERS)) {
      expect(typeof start.civilization).toBe('string');
      expect(start.civilization!.length).toBeGreaterThan(0);
    }
  });
});

describe('a three-player match on the real map', () => {
  it('boots, and each player has a base of its own', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { playerCount: 3 });
    const eco = bridge.getEconomyState();
    for (const owner of [1, 2, 3]) {
      const townCenters = eco.buildings.filter(
        (building) => building.owner === owner && building.buildingType === 'town-center',
      );
      expect(townCenters, `owner ${owner}`).toHaveLength(1);
      expect(
        eco.units.filter((unit) => unit.owner === owner && unit.unitType === 'villager').length,
        `owner ${owner} villagers`,
      ).toBeGreaterThan(0);
    }
  }, 60_000);

  it('runs a thousand ticks with three economies moving', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { playerCount: 3 });
    const before = [1, 2, 3].map(
      (owner) => bridge.getEconomyState().playerResources[owner]!.food,
    );
    for (let step = 0; step < 1_500; step += 1) bridge.step(100);
    const after = [1, 2, 3].map(
      (owner) => bridge.getEconomyState().playerResources[owner]!.food,
    );
    // Two of the three are AI; the human slot idles unless driven, so this
    // asserts the OTHERS are alive rather than all three.
    expect(after.filter((food, index) => food !== before[index]).length)
      .toBeGreaterThanOrEqual(2);
  }, 60_000);
});

describe('the ?players= URL parameter', () => {
  it('reads a usable count', () => {
    expect(parsePlayersParam('http://localhost/?players=3')).toBe(3);
    expect(parsePlayersParam('http://localhost/?players=4')).toBe(4);
    expect(parsePlayersParam('http://localhost/?players=2')).toBe(2);
  });

  it('opens the ordinary game for anything unusable, rather than refusing', () => {
    for (const url of [
      'http://localhost/',
      'http://localhost/?players=',
      'http://localhost/?players=one',
      'http://localhost/?players=1',
      'http://localhost/?players=9',
      'http://localhost/?players=2.5',
      'http://localhost/?players=-3',
    ]) {
      expect(parsePlayersParam(url), url).toBeUndefined();
    }
  });
});
