// Score-timer end-of-match check (spec §4.3). Runs every postUpdate LAST
// (after conquest), so it only fires when no other win condition has ended the
// match. Once world.tick reaches the configured game length, the match ends
// with the highest-score player winning — outcome from the human's perspective
// (sole top = victory, tied for top = draw, otherwise defeat). Opt-in: with no
// game length the system is not registered, so the match can run indefinitely
// (conquest/wonder/relic only, the AoE2 default).

import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerResourcesCodec } from '../bridgeStateSerialize';
import type { WinCondition } from '../../types';

export interface ScoreTimerSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  accessor: BridgeStateAccessor;
  isMatchRunning: () => boolean;
  computePlayerScore: (owner: number) => number;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: WinCondition,
    summary: string,
  ) => void;
  gameLength: number | undefined;
}

export function registerScoreTimerSystem(deps: ScoreTimerSystemDeps): void {
  const {
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    computePlayerScore,
    finalizeMatchEnd,
    gameLength,
  } = deps;
  if (gameLength === undefined) return; // score timer disabled (conquest-only)

  world.registerSystem({
    name: 'prototypeScoreTimer',
    phase: 'postUpdate',
    after: ['prototypeConquestOutcome'],
    execute(activeWorld) {
      if (!isMatchRunning() || activeWorld.tick < gameLength) {
        return;
      }

      let maxScore = -Infinity;
      let humanScore = 0;
      let topCount = 0;
      for (const owner of accessor.get(playerResourcesCodec).keys()) {
        const score = computePlayerScore(owner);
        if (owner === humanPlayerId) humanScore = score;
        if (score > maxScore) {
          maxScore = score;
          topCount = 1;
        } else if (score === maxScore) {
          topCount += 1;
        }
      }

      const summary = `The game timer expired at tick ${gameLength}; highest score wins (top score ${maxScore}).`;
      if (humanScore === maxScore && topCount === 1) {
        finalizeMatchEnd('victory', 'score', summary);
      } else if (humanScore === maxScore) {
        finalizeMatchEnd('draw', 'score', summary);
      } else {
        finalizeMatchEnd('defeat', 'score', summary);
      }
    },
  });
}
