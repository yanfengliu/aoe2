import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

// Slice 12 Task B: minimal all-grass fixtures for the scenario-validation
// pass. Each seed wires in exactly one mistake; the `-ok-fixture` variant
// is the positive control. The `starts` entry is required because the
// bridge's score + age helpers key on it, but the minimal single-TC
// human-only setup is enough to test the validator.
export function createScenarioValidationFixture(seed: string): PrototypeScenario {
  const baseSpawns: ScenarioSpawnSpec[] = [
    ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
  ];

  switch (seed) {
    case 'slice12-validation-ok-fixture':
      break;
    case 'slice12-validation-out-of-bounds-fixture':
      // A 4x4 Town Center anchored at x = MAP_WIDTH - 1 extends past
      // the right edge (x = MAP_WIDTH + 2).
      baseSpawns.push(ownedSpawn('town-center', 2, MAP_WIDTH - 1, 5));
      break;
    case 'slice12-validation-overlap-fixture':
      // A 2x2 house placed inside the human TC's 4x4 footprint (TC
      // covers x=[4,7], y=[4,7]; house at (5,5) covers x=[5,6], y=[5,6]).
      baseSpawns.push(ownedSpawn('house', 1, 5, 5));
      break;
    case 'slice12-validation-unit-in-building-fixture':
      // A Spearman anchored at (5, 5) sits inside the TC footprint with
      // no `requiresSafeSpawn` escape. Validation should catch that the
      // unit cannot legally live inside a building.
      baseSpawns.push(ownedSpawn('spearman', 1, 5, 5));
      break;
    case 'slice12-validation-resource-on-building-fixture':
      // Gold mine placed on a town-center footprint cell.
      baseSpawns.push(gaiaSpawn('gold-mine', 5, 5, { amount: 500 }));
      break;
    case 'slice12-validation-resource-on-resource-fixture':
      // Tree and stone-mine placed on the same cell. Validation should
      // catch the resource-on-resource overlap.
      baseSpawns.push(gaiaSpawn('tree', 12, 4, { amount: 100 }));
      baseSpawns.push(gaiaSpawn('stone-mine', 12, 4, { amount: 350 }));
      break;
    default:
      // Unknown validation seed — fall through to the ok scenario so
      // the switch is exhaustive at runtime.
      break;
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
      },
    ],
    spawns: baseSpawns,
  };
}
