// Conquest end-of-match check. Runs every postUpdate after the
// Wonder/Relic resolver. If only the human player has remaining presence,
// they win. If only enemies do, they lose. Mutual annihilation on the same
// tick is treated as a draw (Iter-3 V3-12).

import type { BuildingComponent, PlayerResources, UnitComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';

export interface ConquestOutcomeSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  playerResources: Map<number, PlayerResources>;
  isMatchRunning: () => boolean;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ) => void;
}

export function registerConquestOutcomeSystem(deps: ConquestOutcomeSystemDeps): void {
  const {
    world,
    humanPlayerId,
    playerResources,
    isMatchRunning,
    finalizeMatchEnd,
  } = deps;

  world.registerSystem({
    name: 'prototypeConquestOutcome',
    phase: 'postUpdate',
    after: ['prototypeWinConditionResolver'],
    execute(activeWorld) {
      if (!isMatchRunning()) {
        return;
      }

      // V4-11: build presence-by-owner via a single reverse scan instead
      // of calling playerHasConquestPresence(owner) per player (which
      // walks units + buildings each call). Start with every registered
      // owner in `remaining`, iterate units + buildings deleting seen
      // owners, early-exit when the set empties. Worst case is one full
      // unit + building scan — same as a single playerHasConquestPresence
      // call but covers all players in one pass.
      const remainingOwners = new Set(playerResources.keys());
      for (const id of activeWorld.query('unit')) {
        if (remainingOwners.size === 0) break;
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (unit) {
          remainingOwners.delete(unit.owner);
        }
      }
      if (remainingOwners.size > 0) {
        for (const id of activeWorld.query('building')) {
          if (remainingOwners.size === 0) break;
          const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
          if (building) {
            remainingOwners.delete(building.owner);
          }
        }
      }
      const humanAlive = !remainingOwners.has(humanPlayerId);
      let allEnemiesEliminated = true;
      for (const owner of playerResources.keys()) {
        if (owner === humanPlayerId) continue;
        if (!remainingOwners.has(owner)) {
          allEnemiesEliminated = false;
          break;
        }
      }

      if (!humanAlive && allEnemiesEliminated) {
        finalizeMatchEnd(
          'draw',
          'conquest',
          "Mutual annihilation: every player's units and buildings were destroyed on the same tick.",
        );
        return;
      }
      if (!humanAlive) {
        finalizeMatchEnd('defeat', 'conquest', 'All of your units and buildings have been destroyed.');
        return;
      }
      if (allEnemiesEliminated) {
        finalizeMatchEnd('victory', 'conquest', 'All enemy forces have been eliminated.');
      }
    },
  });
}
