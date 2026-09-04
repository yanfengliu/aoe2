import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// An enemy whose only surviving villagers are GARRISONED, which is the state a
// besieged AI reaches on its own: the town bell puts the villagers inside, and
// a garrisoned unit has NO position component.
//
// Owner 1 is the attacking AI, mustered well past its Castle-age attack-group
// threshold and standing beside owner 2's base. Owner 2 is inert (`disableAi`)
// and holds only buildings plus the two villagers the test garrisons, so the
// only question the fixture asks is whether owner 1 attacks at all.
//
// Measured on `gold-rush` at 60,000 ticks before the fix: owner 1 held 151
// units and owner 2 held 14 buildings and no unit on the map, and every one of
// owner 1's units was idle from tick 30,000 to the horizon. The AI's attack
// phase prefers the target enemy's villager, `findOwnedUnit` (now `findOwnedUnitOnMap`) returned the
// garrisoned one, and `setUnitAttackCommandDirect` no-ops silently on a target
// with no position — so the order was re-issued and dropped on every decision
// tick for 30,000 ticks and the match could not resolve.
// `-few-fixture` seats FOUR attackers instead of ten, which is UNDER the
// Castle-age attack-group threshold of seven. That is the harder half of the
// same defect and it was found by a critic, not by the author: `shouldPush`
// gates every fallback in the attack phase, including the last-resort branch
// added for "an enemy that still holds a BUILDING is still alive", so an army
// cut down below the threshold used to idle at its own base against an
// opponent that had nothing left to be caught by.
export function createAiGarrisonedDefenderFixture(seed: string): PrototypeScenario {
  const few = seed.includes('-few');
  const attackerCount = few ? 4 : 10;
  // At HOME, not on the enemy's doorstep. An army that starts beside its target
  // makes "did it march?" unanswerable — the distance it would have to cover is
  // the same either way. From owner 1's own base the two answers are 34 cells
  // apart.
  const attackers = Array.from({ length: attackerCount }, (_, index) =>
    ownedSpawn('man-at-arms', 1, 14 + (index % 5), 12 + Math.floor(index / 5), { vision: 5 }));
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
        // The `-few` arm is BROKE on purpose. With resources it trains its way
        // back over the attack-group threshold within a couple of thousand
        // ticks — measured: four attackers became eleven — and the case the
        // fixture exists for is never reached. There is nothing to gather on a
        // bare grass map, so zero stays zero.
        startingResources: few
          ? { food: 0, wood: 0, gold: 0, stone: 0 }
          : { food: 2000, wood: 2000, gold: 2000, stone: 500 },
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        // Inert: this fixture is about the ATTACKER. An owner 2 that trains
        // would give owner 1 an ungarrisoned unit to chase and hide the defect.
        disableAi: true,
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 13, 10, { vision: 4 }),
      ...attackers,
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      ownedSpawn('house', 2, 26, 18, { vision: 3 }),
      ownedSpawn('barracks', 2, 26, 22, { vision: 5 }),
      // The two the test garrisons. They are owner 2's only units, so once
      // they are inside the Town Centre nothing of owner 2's is on the map.
      ownedSpawn('villager', 2, 29, 19, { vision: 4 }),
      ownedSpawn('villager', 2, 29, 24, { vision: 4 }),
    ],
  };
}
