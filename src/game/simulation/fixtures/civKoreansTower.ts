import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Korean tower range by age (civilizations.csv: "Towers (except bombard
// towers) have +1 range in Castle Age / +2 in Imperial Age"). Castle Age so
// the bonus is +1 and the free Korean Guard Tower CANNOT contaminate the
// range: there is deliberately no University, so the free-tech grant has no
// legal menu to fire from and the tower fires at its bare base profile.
// The enemy militia stands at manhattan 8 from the tower — one past the base
// range 7, exactly at the Korean Castle-Age reach. Tower vision 12 so sight
// never gates the shot.
export function createCivKoreansTowerFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('watch-tower', 1, 14, 14, { vision: 12 }),
      ownedSpawn('militia', 2, 22, 14, { startHp: 35 }),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
