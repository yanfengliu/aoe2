// Conquest end-of-match check. Runs every postUpdate after the
// Wonder/Relic resolver. If only the human player has remaining presence,
// they win. If only enemies do, they lose. Mutual annihilation on the same
// tick is treated as a draw (Iter-3 V3-12).

import type { PlayerResources } from '../../types';
import type { GameWorld } from '../pureHelpers';

export interface ConquestOutcomeSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  playerResources: Map<number, PlayerResources>;
  playerHasConquestPresence: (owner: number) => boolean;
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
    playerHasConquestPresence,
    isMatchRunning,
    finalizeMatchEnd,
  } = deps;

  world.registerSystem({
    name: 'prototypeConquestOutcome',
    phase: 'postUpdate',
    after: ['prototypeWinConditionResolver'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }

      const humanAlive = playerHasConquestPresence(humanPlayerId);
      const enemyOwners = [...playerResources.keys()].filter((owner) => owner !== humanPlayerId);
      const allEnemiesEliminated = enemyOwners.every((owner) => !playerHasConquestPresence(owner));

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
