import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * Every unit added since v0.3.45, standing behind the buildings that train it.
 *
 * The unit tests prove these exist and cost what units.csv says. This fixture
 * exists for the BROWSER suite, which proves the other half: that a player can
 * reach them with a mouse. A unit that is in the roster, in the validator and
 * in a passing simulation test, but never rendered as a button, is a unit
 * nobody can build — the same shape as the v0.3.20 finding, where nine
 * warships had stats and combat tests and no Dock menu ever offered one.
 *
 * The prerequisite technologies start researched so each new thing is one
 * click away rather than four: Chemistry for the gunpowder gate, and the tier
 * below each new tier so the line's menu entry resolves to it.
 */
export function createNewUnitReachFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResearchedTechnologies: [
          // Gates the Hand Cannoneer and the Bombard Cannon.
          'chemistry',
          // The tier below each tier added in v0.3.45, so the Siege Workshop
          // and Archery Range menus resolve to the new entries and the
          // research menu offers the step above them.
          'capped-ram-upgrade',
          'onager-upgrade',
          'elite-skirmisher-upgrade',
        ],
        startingResources: {
          food: 4000,
          wood: 4000,
          gold: 4000,
          stone: 1000,
        },
      },
      { owner: 2, townCenter: { x: 40, y: 8 }, startingAge: 'imperial-age' },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, 14, 6),
      ownedSpawn('archery-range', 1, 18, 6),
      ownedSpawn('siege-workshop', 1, 22, 6),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
