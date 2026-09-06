import { describe, expect, it } from 'vitest';

import type { MatchState } from '../../src/game/simulation/types';
import { renderMatchSummary } from '../../src/ui/hud/postGameSummary';

// The post-game card must render a win-condition label for every member of the
// WinCondition union. Regression guard for the score-timer victory (spec §4.3):
// before the 'score' case existed, a score-timer outcome fell through the
// switch default and rendered a blank win-condition row.
//
// The label now carries the OUTCOME too — a defeat used to print the same
// "<Condition> Victory" as a win. The outcome half of the class lives in
// `tests/ui/matchResultAnnouncement.test.ts`; these cases stay pinned to
// victories because `game-combat-and-meta-meta.spec.ts` asserts the exact
// string "Wonder Victory" against a real match.
const HUMAN = 1;

function won(over: Partial<MatchState>): MatchState {
  return {
    outcome: 'victory',
    summary: 'summary',
    winCondition: 'conquest',
    scores: null,
    wonderCountdownTicks: null,
    relicCountdownTicks: null,
    ...over,
  };
}

describe('renderMatchSummary win-condition label', () => {
  it('renders "Score Victory" for a score-timer outcome', () => {
    const html = renderMatchSummary(
      won({ summary: 'The game timer expired.', winCondition: 'score', scores: { 1: 180, 2: 50 } }),
      HUMAN,
    );
    expect(html).toContain('data-hud="match-summary-win-condition"');
    expect(html).toContain('Score Victory');
  });

  it.each([
    ['wonder', 'Wonder Victory'],
    ['relic', 'Relic Victory'],
    ['conquest', 'Conquest Victory'],
    ['score', 'Score Victory'],
  ] as const)('labels %s outcomes as "%s"', (winCondition, label) => {
    expect(renderMatchSummary(won({ winCondition }), HUMAN)).toContain(label);
  });

  it('omits the win-condition row when there is no win condition', () => {
    expect(renderMatchSummary(won({ winCondition: null }), HUMAN))
      .not.toContain('match-summary-win-condition');
  });
});
