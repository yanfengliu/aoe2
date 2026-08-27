import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../../common';
export function createCamelVsCavalryFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('camel', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('knight', 2, 15, 17, { vision: 4 }),
      ownedSpawn('scout', 2, 14, 18, { vision: 4 }),
    ],
  };
}

// Castle-Age combat fixture: a player-1 Spearman next to an enemy (player 2)
// Camel, used to assert the Spearman's anti-cavalry bonus does NOT fire
// against Camels (Camels are anti-cavalry, not cavalry targets).
export function createSpearmanVsCamelFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('spearman', 1, 14, 17, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('camel', 2, 15, 17, { vision: 4 }),
    ],
  };
}

// FU2 fixture: a pre-upgraded player-1 Heavy Camel placed adjacent to a
// player-2 Knight so the anti-cavalry +9 bonus fires on the first hit.
// Spawning Heavy Camel directly (rather than upgrading at runtime) keeps
// the test a single tick away from verifying bonus damage and sidesteps
// long-path-and-survive issues seen when the Heavy Camel had to close
// the gap across the map during research.
export function createHeavyCamelVsKnightFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 28 },
        startingAge: 'imperial-age',
        // Bonus-free civ so the anti-cavalry DAMAGE test measures raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('heavy-camel', 1, 20, 18, { vision: 4 }),
      ownedSpawn('knight', 2, 22, 18, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
    ],
  };
}

// FU2 fixture: Imperial-Age player 1 with a Stable + Knight + Camel so both
// the Paladin upgrade (Knight → Cavalier → Paladin) and the Heavy Camel
// upgrade (Camel → Heavy Camel) can be exercised. The player-2 TC sits
// far from the action so no auto-combat fires during the research
// cadence; the Heavy Camel anti-cavalry bonus is exercised in the
// separate `heavy-camel-vs-knight-fixture` below.
export function createPaladinFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('stable', 1, 16, 6),
      ownedSpawn('knight', 1, 14, 14, { vision: 4 }),
      ownedSpawn('camel', 1, 20, 18, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 8, { vision: 7 }),
    ],
  };
}
