import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * Two Imperial-age AI seats wedged in OPPOSITE directions, each beside its own
 * completed Market — the geometry of the 2026-09-03 register entry, "the AI
 * hoards the resource it cannot spend and starves on the one that gates every
 * unit".
 *
 * WHY A FIXTURE AND NOT A SEED. Both halves need an owner to be lopsided, and
 * "seed X will be lopsided at tick Y" is a claim about the AI's luck rather than
 * about the rule under test. `movementTrafficReliefSelfPlay.test.ts` had to
 * abandon that premise twice — `aoe2-prototype` on 2026-09-02 and
 * `default-seed` on 2026-09-10 — as the AI improved out from under it. So the
 * lopsidedness is BUILT here and asserted to be present at tick 0, and what the
 * gate measures is whether the AI trades its way out of it.
 *
 * The numbers come from the coverage lab's own configuration at 45,000 ticks on
 * `b929d07d`, where both seats reached the Imperial age and both ended wedged:
 *
 *     owner 1   food  731  wood   10  gold    23  stone 1093
 *     owner 2   food   58  wood   18  gold  4681  stone  315
 *
 * Owner 1 here is that first shape and owner 2 the second, rounded and
 * exaggerated so the fixture starts unambiguously in violation.
 *
 * NO RESOURCES ON THE MAP AT ALL, deliberately: grass, and nothing to gather.
 * That is not an artificial squeeze — it is the late game this defect lives in.
 * The lab's map had ZERO gold left in the ground at that horizon (831 stone was
 * still there), so a villager moved onto gold gathers nothing and the Market is
 * the only way the AI can make any. Emptying the map here also removes gathering
 * as an explanation for any resource that moves: on this map a stockpile can
 * only change by being spent, or traded.
 *
 * NO CASTLE and NO SIEGE WORKSHOP, for the reason
 * `createAiImperialMilitaryFixture` gives: the Castle trains a unique unit
 * through a branch that never consults the unit mix, so one here would let an
 * owner field an army without ever answering the question this fixture asks.
 * Houses give both seats population headroom, so a full population can never be
 * mistaken for the block under test.
 */
export function createAiIdleSurplusFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        // GOLD-STARVED, commodity-rich. Every Imperial unit but the Halberdier
        // is priced in gold, so this seat can train the one gold-free unit
        // forever and nothing else — which is exactly what the lab measured:
        // 46 Spearmen out of an army of 93, beside 1,093 stone it could not
        // spend. Stone is the fat pile because stone buys the least: no unit
        // costs it and this fixture gives it no Castle to build.
        startingResources: { food: 600, wood: 600, gold: 0, stone: 2400 },
      },
      {
        owner: 2,
        townCenter: { x: 42, y: 26 },
        startingAge: 'imperial-age',
        // GOLD-RICH, commodity-starved: the same defect from the other side.
        // A Halberdier costs 35 food and 25 wood, so this seat cannot train
        // ANYTHING while holding 4,000 gold — the lab's owner 2 ended on 4,681
        // gold, its own peak for the whole match, meaning it never spent a
        // single one of them.
        startingResources: { food: 0, wood: 0, gold: 4000, stone: 0 },
      },
    ],
    spawns: [
      // Owner 1, top-left. Footprints: Town Centre and Market 4x4, Barracks /
      // Archery Range / Stable 3x3, House 2x2 — laid out on a 60x36 map with a
      // clear cell between every pair.
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('market', 1, 10, 4, { vision: 5 }),
      ownedSpawn('barracks', 1, 4, 12, { vision: 5 }),
      ownedSpawn('archery-range', 1, 9, 12, { vision: 5 }),
      ownedSpawn('stable', 1, 14, 12, { vision: 5 }),
      ownedSpawn('house', 1, 4, 18, { vision: 3 }),
      ownedSpawn('house', 1, 7, 18, { vision: 3 }),
      ownedSpawn('house', 1, 10, 18, { vision: 3 }),
      ownedSpawn('house', 1, 13, 18, { vision: 3 }),
      ownedSpawn('house', 1, 16, 18, { vision: 3 }),
      ownedSpawn('villager', 1, 16, 4, { vision: 4 }),
      ownedSpawn('villager', 1, 17, 4, { vision: 4 }),
      ownedSpawn('villager', 1, 18, 4, { vision: 4 }),

      // Owner 2, bottom-right, far enough away that neither base can reach the
      // other by accident.
      ownedSpawn('town-center', 2, 42, 26, { vision: 7 }),
      ownedSpawn('market', 2, 48, 26, { vision: 5 }),
      ownedSpawn('barracks', 2, 42, 22, { vision: 5 }),
      ownedSpawn('archery-range', 2, 47, 22, { vision: 5 }),
      ownedSpawn('stable', 2, 52, 22, { vision: 5 }),
      ownedSpawn('house', 2, 42, 18, { vision: 3 }),
      ownedSpawn('house', 2, 45, 18, { vision: 3 }),
      ownedSpawn('house', 2, 48, 18, { vision: 3 }),
      ownedSpawn('house', 2, 51, 18, { vision: 3 }),
      ownedSpawn('house', 2, 54, 18, { vision: 3 }),
      ownedSpawn('villager', 2, 54, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 55, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 56, 26, { vision: 4 }),
    ],
  };
}
