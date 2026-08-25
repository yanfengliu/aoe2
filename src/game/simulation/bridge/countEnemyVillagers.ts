// The Spies price base: every living villager belonging to anybody else.
// Teams do not discount it — AoE2 counts all non-self villagers, and so does
// the CSV's own wording ("Enemy Villager": every villager you cannot task).

import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';

export function countEnemyVillagers(world: GameWorld, owner: number): number {
  let count = 0;
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit && unit.owner !== owner && unit.unitType === 'villager') count += 1;
  }
  return count;
}
