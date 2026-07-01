import { describe, expect, it } from 'vitest';

import { renderMatchSummary } from '../../src/ui/hud/postGameSummary';

// The post-game card must render a win-condition label for every member of the
// WinCondition union. Regression guard for the score-timer victory (spec §4.3):
// before the 'score' case existed, a score-timer outcome fell through the
// switch default and rendered a blank win-condition row.
describe('renderMatchSummary win-condition label', () => {
  it('renders "Score Victory" for a score-timer outcome', () => {
    const html = renderMatchSummary('The game timer expired.', 'score', { 1: 180, 2: 50 });
    expect(html).toContain('data-hud="match-summary-win-condition"');
    expect(html).toContain('Score Victory');
  });

  it.each([
    ['wonder', 'Wonder Victory'],
    ['relic', 'Relic Victory'],
    ['conquest', 'Conquest Victory'],
    ['score', 'Score Victory'],
  ] as const)('labels %s outcomes as "%s"', (winCondition, label) => {
    expect(renderMatchSummary('summary', winCondition, null)).toContain(label);
  });

  it('omits the win-condition row when there is no win condition', () => {
    expect(renderMatchSummary('summary', null, null)).not.toContain('match-summary-win-condition');
  });
});
