import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// The Teuton building-and-monk bonuses under one roof (civilizations.csv:
// "Town Centers have +1 attack and +5 line of sight", "Towers can garrison
// 2x units", "Monks have 2x healing range"). Booted twice by the tests —
// once with civilizationsByOwner Teutons, once without — so every distance
// and hit point here is chosen to make the two runs differ in exactly one
// observable number.
export function createCivTeutonsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 } },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      // A wounded enemy standing just clear of the TC footprint, well inside
      // its range 6: the first arrow that lands is the whole attack
      // assertion — 35-6 vs 35-5.
      ownedSpawn('militia', 2, 9, 6, { startHp: 35 }),
      // Heal range: monk to spearman is manhattan 7 — past the base range 4,
      // within the doubled Teuton range 8.
      ownedSpawn('monk', 1, 10, 14),
      ownedSpawn('spearman', 1, 17, 14, { startHp: 10 }),
      // Garrison: seven militia and a five-slot tower. A Teuton tower takes
      // all seven (capacity 10); a generic one stops at five.
      ownedSpawn('watch-tower', 1, 24, 20),
      ownedSpawn('militia', 1, 26, 22),
      ownedSpawn('militia', 1, 27, 22),
      ownedSpawn('militia', 1, 28, 22),
      ownedSpawn('militia', 1, 26, 23),
      ownedSpawn('militia', 1, 27, 23),
      ownedSpawn('militia', 1, 28, 23),
      ownedSpawn('militia', 1, 26, 24),
      ownedSpawn('town-center', 2, 52, 30, { vision: 7 }),
    ],
  };
}
