import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

// Visual-only showcase scenario (M7 units-beyond-circles slice 1). Places one
// human-owned unit of EVERY render role — villager, infantry, archer, cavalry,
// cavalry-archer, siege, monk — in a tidy, all-visible row beside a Town
// Center, so the AGENTS.md visual-change protocol can capture a single
// before/after frame that exercises every unit silhouette. Not referenced by
// gameplay tests; purely a capture target (lives in the fixtures tree, which is
// the sanctioned home for scenario data). Imperial age + generous vision so
// every unit is fog-visible to player 1 at boot.
export function createUnitShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 6 },
        startingAge: 'imperial-age',
        startingResources: { food: 1000, wood: 1000, gold: 1000, stone: 500 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 6,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 12 },
      },
      // One unit per render role, spaced 3 cells apart on a single row so each
      // silhouette is isolated and legible.
      { kind: 'villager', x: 5, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      { kind: 'champion', x: 8, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      { kind: 'arbalest', x: 11, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      { kind: 'knight', x: 14, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
      {
        kind: 'cavalry-archer',
        x: 17,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      { kind: 'mangonel', x: 20, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 9 } },
      { kind: 'monk', x: 23, y: 12, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 9 } },
    ],
  };
}
