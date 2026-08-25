import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * A Vikings Castle and a Berserk that walked out of a fight at 10 of its 55
 * hit points.
 *
 * Self-healing (spec §10.6) is the only mechanic here whose effect a player
 * observes by DOING NOTHING, so the browser proof needs a unit that is already
 * wounded, and the test API has no "take damage" hook. `startHp` supplies the
 * wound directly. Staging the wound as a real fight was the first attempt and
 * it does not work: an owner with `disableAi: true` never retaliates by
 * design, so the enemy militia stood at `idle` and died at full Berserk health.
 *
 * Imperial Age and rich, because Berserkergang is an Imperial Castle
 * technology and the point of the fixture is the click, not the wait.
 */
export function createVikingsRegenerationFixture(seed: string): PrototypeScenario {
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
        civilization: 'Vikings',
        disableAi: true,
        startingResources: {
          food: 2000,
          wood: 1000,
          gold: 2000,
          stone: 500,
        },
      },
      {
        owner: 2,
        townCenter: { x: 44, y: 30 },
        startingAge: 'imperial-age',
        civilization: 'Franks',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6, { vision: 9 }),
      // Alone in the open, far from either town centre, so nothing but the
      // regeneration moves its health bar.
      ownedSpawn('berserk', 1, 24, 16, { vision: 5, startHp: 10 }),
      ownedSpawn('town-center', 2, 44, 30, { vision: 7 }),
      // Three enemy villagers: the Spies price is 200 gold per one of these,
      // so a fixture with none cannot tell the dynamic charge from the table.
      ownedSpawn('villager', 2, 48, 34, { vision: 4 }),
      ownedSpawn('villager', 2, 50, 34, { vision: 4 }),
      ownedSpawn('villager', 2, 52, 34, { vision: 4 }),
    ],
  };
}
