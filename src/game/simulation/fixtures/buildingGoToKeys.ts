import type { PrototypeScenario } from '../prototypeScenario';
import { createBuildingShowcaseFixture } from './buildingShowcase';
import { ownedSpawn } from './common';

// Work 142 M2b-2b-2: DE's go-to (Ctrl+letter) and select-all (Ctrl+Shift+letter)
// building keys. The building showcase's grid (one completed building of the
// human's of every type, in the Imperial Age, AIs off) with a second Barracks
// and a second Town Center of the human's, so a go-to key has a next building
// to cycle to and a select-all key more than one to take, and a Barracks of
// player 2's inside the human's sight, which neither key may take. Its seed,
// 'building-go-to-keys-fixture', is registered in selectionControls.ts.

export function createBuildingGoToKeysFixture(seed: string): PrototypeScenario {
  const showcase = createBuildingShowcaseFixture(seed);
  return {
    ...showcase,
    spawns: [
      ...showcase.spawns,
      // Beside the showcase's Market (row 1) and Blacksmith (row 2).
      ownedSpawn('town-center', 1, 26, 3, { vision: 16 }),
      ownedSpawn('barracks', 1, 27, 10, { vision: 10 }),
      ownedSpawn('barracks', 2, 32, 10),
    ],
  };
}
