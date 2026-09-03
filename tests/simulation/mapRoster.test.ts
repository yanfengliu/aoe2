import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createPrototypeScenario } from '../../src/game/simulation/prototypeScenario';

// §5.4's map roster. Every named map must BOOT — the fixture validator alone
// catches wall-on-resource collisions — and each script's identity is a
// checkable property of the generated world, not a vibe.

const NAMED_MAPS = ['arabia', 'arena', 'black-forest', 'coastal', 'fortress', 'gold-rush'] as const;

// Wood a player can actually reach. A house is 25 wood and every age-up
// prerequisite building costs wood, so a map with none is not a hard map — it
// is an unplayable one: the population cap never leaves 10, no second house is
// ever built, no age is ever reached, and the match cannot resolve.
//
// This is not hypothetical and it is why the bar is here. Measured 2026-09-03,
// FOUR of the nine playable maps shipped with zero tree resources — arena,
// coastal, fortress and gold-rush — and on arena both AI players sat in the
// Dark Age at population 10/10 for the full 75-minute audit, holding 701 food
// and 3,184 gold they could not spend, with `wood 0` at every sample from tick
// 4,000 onward. The roster gate above could not see it: booting and running
// fifty ticks is a horizon that ends long before the starting 200 wood does.
const STARTING_WOOD = 200;

describe('every playable map supplies wood', () => {
  for (const name of NAMED_MAPS) {
    it(`gives '${name}' a woodline each player can reach`, () => {
      const scenario = createPrototypeScenario(name);
      const trees = scenario.spawns.filter((spawn) => spawn.kind === 'tree');
      const wood = trees.reduce((total, tree) => total + (tree.amount ?? 0), 0);

      // Enough to matter: a player who spends the starting wood on the
      // opening must be able to keep building. The floor is deliberately low
      // — this is a playability bar, not a balance one.
      expect(wood, `${name} has ${String(trees.length)} trees`).toBeGreaterThan(STARTING_WOOD * 10);

      // ...and reachable from each start, because wood only one player can
      // walk to is the same defect wearing a map shape.
      for (const start of scenario.starts) {
        const near = trees.filter((tree) => (
          Math.hypot(tree.x - start.townCenter.x, tree.y - start.townCenter.y) <= 30
        ));
        expect(
          near.length,
          `${name}: no woodline within 30 tiles of the start at `
          + `${String(start.townCenter.x)},${String(start.townCenter.y)}`,
        ).toBeGreaterThan(8);
      }
    });
  }
});

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
