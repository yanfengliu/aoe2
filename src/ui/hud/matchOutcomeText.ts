import type { MatchState, WinCondition } from '../../game/simulation/types';

// The words a finished match is announced with. Both end-of-match surfaces —
// the footer record (`postGameSummary`) and the result overlay
// (`matchResultOverlay`) — build their text here so neither can say a
// different thing about the same match.
//
// Before this module the HUD's only label came from `winCondition` alone, so
// "Conquest Victory" was printed to the player who had just LOST by conquest:
// `matchState.outcome` sat correct and unrendered in the same object. Every
// function here therefore takes the outcome, and there is no way to format the
// condition without it.

export type FinishedOutcome = Exclude<MatchState['outcome'], 'running'>;

const OUTCOME_WORD: Record<FinishedOutcome, string> = {
  victory: 'Victory',
  defeat: 'Defeat',
  draw: 'Draw',
};

const CONDITION_WORD: Record<WinCondition, string> = {
  conquest: 'Conquest',
  wonder: 'Wonder',
  relic: 'Relic',
  score: 'Score',
};

export function isFinished(outcome: MatchState['outcome']): outcome is FinishedOutcome {
  return outcome !== 'running';
}

/** The one word the player scans for: Victory, Defeat or Draw. */
export function formatOutcomeHeadline(outcome: FinishedOutcome): string {
  return OUTCOME_WORD[outcome];
}

/** How the match was decided AND which way it went — "Conquest Defeat". */
export function formatWinConditionLabel(
  winCondition: MatchState['winCondition'],
  outcome: MatchState['outcome'],
): string {
  if (winCondition === null || !isFinished(outcome)) {
    return '';
  }
  return `${CONDITION_WORD[winCondition]} ${OUTCOME_WORD[outcome]}`;
}

/** One plain sentence about the player's own result, in the second person. */
export function formatOutcomeSentence(outcome: FinishedOutcome): string {
  switch (outcome) {
    case 'victory':
      return 'You won this match.';
    case 'defeat':
      return 'You lost this match.';
    case 'draw':
    default:
      return 'Nobody won this match.';
  }
}

/** "Player 2", or "Player 1 (you)" for the slot the player is sitting in. */
export function formatPlayerLabel(owner: number, humanPlayerId: number): string {
  return owner === humanPlayerId ? `Player ${owner} (you)` : `Player ${owner}`;
}

export interface MatchWinner {
  /** The owners that won. Empty when nobody did, or when nobody can be named. */
  readonly owners: readonly number[];
  /** The line the player reads. Never empty for a finished match. */
  readonly line: string;
}

function ownersOf(scores: MatchState['scores']): number[] {
  return scores === null
    ? []
    : Object.keys(scores).map(Number).sort((left, right) => left - right);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * Who won, said honestly.
 *
 * `MatchState` records the outcome from the HUMAN's point of view and never
 * stores a winner, so this derives one only where the derivation is sound:
 *
 *  - a victory is the player's own, so the player is the winner;
 *  - a draw has no winner, and says so rather than picking the top score;
 *  - a `score` defeat was decided by that condition's own published rule
 *    ("highest score wins", `scoreTimerSystem`), so the top scorer is named
 *    however many players there were;
 *  - a conquest / wonder / relic defeat against ONE opponent leaves only one
 *    player who can have won, so that player is named.
 *
 * Anything else — a conquest defeat with several opponents — records only
 * THAT an opponent won and never which. Score cannot stand in for it:
 * `conquest-defeat-fixture` eliminates the human while they hold the higher
 * score (50 against 10). So the winning SIDE is named and no individual is
 * guessed at.
 */
export function resolveMatchWinner(
  matchState: MatchState,
  humanPlayerId: number,
): MatchWinner | null {
  const { outcome, winCondition, scores } = matchState;
  if (!isFinished(outcome)) {
    return null;
  }
  if (outcome === 'draw') {
    return { owners: [], line: 'No winner — the match was a draw.' };
  }
  if (outcome === 'victory') {
    return { owners: [humanPlayerId], line: `Winner: you (Player ${humanPlayerId})` };
  }
  const owners = ownersOf(scores);
  if (winCondition === 'score' && scores !== null && owners.length > 0) {
    const top = Math.max(...owners.map((owner) => scores[owner]));
    const winners = owners.filter((owner) => scores[owner] === top && owner !== humanPlayerId);
    if (winners.length > 0) {
      const labels = winners.map((owner) => formatPlayerLabel(owner, humanPlayerId));
      return {
        owners: winners,
        line: `${winners.length > 1 ? 'Winners' : 'Winner'}: ${joinLabels(labels)}`,
      };
    }
  }
  const opponents = owners.filter((owner) => owner !== humanPlayerId);
  if (opponents.length === 1) {
    return {
      owners: opponents,
      line: `Winner: ${formatPlayerLabel(opponents[0], humanPlayerId)}`,
    };
  }
  return { owners: [], line: 'Winner: your opponents' };
}
