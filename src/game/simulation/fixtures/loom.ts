import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Loom (v0.1.40) fixture. A Dark-Age human (owner 1) with a completed Town
// Center, one Villager (to observe the existing-villager +15 HP / +1 armor
// bump when Loom completes), and one Militia (a non-villager control that Loom
// must NOT affect). 100 gold so the 50-gold research is affordable; the AI is
// disabled so the only state change is the research the test drives. Owner 2 is
// a passive placeholder enemy. Loom has no building prerequisite beyond the
// standing Town Center, so no other buildings are needed.
export function createLoomFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 200,
          wood: 200,
          gold: 100,
          stone: 200,
        },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('militia', 1, 10, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Broke variant: identical layout but only 40 gold, so the 50-gold Loom
// research is unaffordable. Drives the validator's `insufficient_resources`
// rejection path (queueResearch returns false).
export function createLoomBrokeFixture(seed: string): PrototypeScenario {
  const base = createLoomFixture(seed);
  return {
    ...base,
    starts: base.starts.map((start) =>
      start.owner === 1
        ? {
            ...start,
            startingResources: { food: 200, wood: 200, gold: 40, stone: 200 },
          }
        : start,
    ),
  };
}

// Loom-already-researched variant: identical to the base Loom fixture but Loom
// is pre-applied on boot via `startingResearchedTechnologies`. Used to assert
// that a villager TRAINED after Loom is researched is created at the boosted
// 40 HP / +1 armor (the createCombatState path), and — combined with a
// save/load round-trip — that a loaded villager that had Loom still reads the
// boosted stats. The Dark-Age start lets the Town Center train more villagers.
export function createLoomResearchedFixture(seed: string): PrototypeScenario {
  const base = createLoomFixture(seed);
  return {
    ...base,
    starts: base.starts.map((start) =>
      start.owner === 1
        ? { ...start, startingResearchedTechnologies: ['loom'] }
        : start,
    ),
  };
}
