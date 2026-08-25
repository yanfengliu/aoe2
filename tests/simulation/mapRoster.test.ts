import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';

// §5.4's map roster. Every named map must BOOT — the fixture validator alone
// catches wall-on-resource collisions — and each script's identity is a
// checkable property of the generated world, not a vibe.

const NAMED_MAPS = ['arabia', 'arena', 'black-forest', 'coastal', 'fortress', 'gold-rush'] as const;

describe('the named map roster', () => {
  for (const name of NAMED_MAPS) {
    it(`boots '${name}' and runs fifty ticks`, () => {
      const bridge = createSimulationBridge(name);
      for (let step = 0; step < 50; step += 1) bridge.step(100);
      const townCenters = bridge.getEconomyState().buildings.filter(
        (building) => building.buildingType === 'town-center',
      );
      expect(townCenters).toHaveLength(2);
    }, 60_000);
  }

  it('arabia IS the standard generator under its AoE2 name', () => {
    // Same generator, own seed: the terrain differs by noise, the SHAPE of
    // the match (two seated openings, standard spawn roster) is identical.
    const arabia = createPrototypeScenario('arabia');
    expect(arabia.width).toBe(createPrototypeScenario('aoe2-prototype').width);
    expect(arabia.starts).toHaveLength(2);
    const kinds = new Set(arabia.spawns.map((spawn) => spawn.kind));
    for (const kind of ['town-center', 'villager', 'sheep', 'boar', 'berry-bush', 'gold-mine', 'stone-mine', 'tree']) {
      expect(kinds.has(kind as never), kind).toBe(true);
    }
  });

  it('coastal runs one sea along the southern edge and a dry interior', () => {
    const scenario = createPrototypeScenario('coastal');
    for (let x = 0; x < scenario.width; x += 1) {
      expect(scenario.terrain[scenario.height - 1]![x]!.kind).toBe('water');
    }
    const interiorWater = scenario.terrain
      .slice(0, scenario.height - 6)
      .flat()
      .filter((cell) => cell.kind === 'water');
    expect(interiorWater).toEqual([]);
  });

  it('fortress opens every player behind stone walls with a Castle standing', () => {
    const scenario = createPrototypeScenario('fortress');
    for (const owner of [1, 2]) {
      const walls = scenario.spawns.filter(
        (spawn) => spawn.owner === owner && spawn.kind === 'stone-wall',
      );
      const castles = scenario.spawns.filter(
        (spawn) => spawn.owner === owner && spawn.kind === 'castle',
      );
      // A corner start's square is clipped by the map edge — the edge IS the
      // wall there — so the floor is what the in-bounds perimeter holds.
      expect(walls.length, `player ${owner} walls`).toBeGreaterThan(30);
      expect(castles).toHaveLength(1);
    }
  });

  it('gold rush stakes a rich neutral goldfield at the map centre', () => {
    const scenario = createPrototypeScenario('gold-rush');
    const centreGold = scenario.spawns.filter(
      (spawn) => spawn.kind === 'gold-mine'
        && spawn.owner === null
        && Math.abs(spawn.x - scenario.width / 2) <= 3
        && Math.abs(spawn.y - scenario.height / 2) <= 3,
    );
    expect(centreGold.length).toBeGreaterThanOrEqual(9);
    for (const mine of centreGold) expect(mine.amount).toBe(1600);
  });
});
