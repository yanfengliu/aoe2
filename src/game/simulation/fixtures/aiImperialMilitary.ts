import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// An AI (owner 2) in the IMPERIAL age with military buildings, plenty of every
// resource, and NO unit upgrades researched — which is the state a real match
// reaches, because reaching the age does not research anything.
//
// `pickUnitMix('imperial-age')` names the top of every line (Halberdier,
// Arbalest, Cavalier, Siege Ram, Onager) while a producer offers only the tier
// its owner has researched, so this owner is offered Pikemen and Knights and
// asked for Halberdiers and Cavaliers. Measured on `fortress` at 60,000 ticks
// before the fix: five military buildings, idle in 100% of samples, armies of
// 2 and 0, holding 1,231 wood and 595 food.
//
// NO CASTLE and NO SIEGE WORKSHOP, deliberately. The Castle trains its civilization's unique unit
// through a separate branch that never consults the unit mix, so a Castle here
// would train a unique unit, leave the owner with an army, and hide exactly the
// defect this fixture exists to expose.
export function createAiImperialMilitaryFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingAge: 'imperial-age',
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'imperial-age',
        // ZERO GOLD is the whole trap, and it is the ONLY constraint here.
        //
        // Every unit upgrade in the game costs gold except the Onager's and
        // the Capped Ram's, so gold 0 pins the Barracks to its base tier: this
        // owner is offered a Spearman while the Imperial mix asks for a
        // Halberdier. Nothing else in the game trains a Spearman.
        //
        // CORRECTED v0.3.222. This comment used to add "and the Market cannot
        // make gold in the Imperial age because the AI's market planning only
        // fires against a next-age cost, of which there is none" — which was
        // true when it was written and is the defect
        // `marketActionForUnaffordableWant` exists to fix. There is no Market
        // spawned here, so the trap holds anyway; and if the AI ever builds one
        // out of the 4,000 wood below and trades its way to a Pikeman, the
        // assertion this fixture serves names the SPEAR LINE, which a Pikeman
        // satisfies. Stone 0 still blocks the Castle.
        //
        // Food and wood are DELIBERATELY GENEROUS, and an earlier version of
        // this fixture was wrong to squeeze them. It held 600 wood, of which
        // the AI spent 545 on buildings, leaving exactly two Spearmen and 5
        // wood — one wood-spending change anywhere in the build order would
        // have dropped it to one and turned this gate red in a way that reads
        // identically to the defect. The escapes those thin numbers were
        // sealing (a self-built Siege Workshop, the gold-free Onager upgrade)
        // do not matter, because the assertion names the SPEAR LINE and an
        // Onager cannot satisfy it.
        startingResources: { food: 4000, wood: 4000, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('barracks', 2, 28, 20, { vision: 5 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ownedSpawn('stable', 2, 32, 26, { vision: 5 }),
      // Population headroom, so a full population can never be mistaken for the
      // training block this fixture is about.
      ownedSpawn('house', 2, 42, 20, { vision: 3 }),
      ownedSpawn('house', 2, 42, 22, { vision: 3 }),
      ownedSpawn('house', 2, 42, 24, { vision: 3 }),
      ownedSpawn('house', 2, 42, 26, { vision: 3 }),
      ownedSpawn('house', 2, 44, 20, { vision: 3 }),
      ownedSpawn('villager', 2, 45, 30, { vision: 4 }),
      ownedSpawn('villager', 2, 46, 30, { vision: 4 }),
      ownedSpawn('villager', 2, 47, 30, { vision: 4 }),
    ],
  };
}
