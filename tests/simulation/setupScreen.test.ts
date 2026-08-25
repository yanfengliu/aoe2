import { describe, expect, it } from 'vitest';

import {
  setupQueryString,
  shouldShowSetupScreen,
} from '../../src/app/bootstrap/setupScreen';
import { parseDifficultyParam } from '../../src/app/bootstrap/difficultyParam';
import { decisionIntervalTicks } from '../../src/game/simulation/ai';

// The setup screen's contract (spec §4.6): bare visits see it, configured
// visits never do, and the query it writes is exactly what the app reads.

describe('when the setup screen shows', () => {
  it('shows on a bare URL and never on a configured one', () => {
    expect(shouldShowSetupScreen('http://localhost/')).toBe(true);
    expect(shouldShowSetupScreen('http://localhost/?seed=aoe2-prototype')).toBe(false);
    expect(shouldShowSetupScreen('http://localhost/?players=4')).toBe(false);
    // ANY param counts — a harness flag must not open a menu over its run.
    expect(shouldShowSetupScreen('http://localhost/?disableAi=2')).toBe(false);
  });
});

describe('the query the screen writes', () => {
  it('carries every non-default choice and omits the defaults', () => {
    expect(setupQueryString({
      seed: 'arena', players: 4, civilization: 'Franks', teams: 'two-sides', difficulty: 'hard',
    })).toBe('seed=arena&players=4&civ=Franks&teams=1%2C1%2C2%2C2&difficulty=hard');
    // Defaults stay out of the URL, so the ordinary 1v1 link stays short.
    expect(setupQueryString({
      seed: 'aoe2-prototype', players: 2, civilization: 'Britons', teams: 'ffa', difficulty: 'standard',
    })).toBe('seed=aoe2-prototype&civ=Britons');
  });

  it('splits odd counts with the extra seat on the human side', () => {
    const query = setupQueryString({
      seed: 'aoe2-prototype', players: 5, civilization: 'Britons', teams: 'two-sides', difficulty: 'standard',
    });
    expect(new URLSearchParams(query).get('teams')).toBe('1,1,1,2,2');
  });
});

describe('the difficulty parameter', () => {
  it('parses the three levels and refuses anything else', () => {
    expect(parseDifficultyParam('http://localhost/?difficulty=easy')).toBe('easy');
    expect(parseDifficultyParam('http://localhost/?difficulty=HARD')).toBe('hard');
    expect(parseDifficultyParam('http://localhost/?difficulty=nightmare')).toBeUndefined();
    expect(parseDifficultyParam('http://localhost/')).toBeUndefined();
  });

  it('maps to the AI decision interval the tiers promise', () => {
    expect(decisionIntervalTicks('easy')).toBe(60);
    expect(decisionIntervalTicks('standard')).toBe(30);
    expect(decisionIntervalTicks('hard')).toBe(15);
  });
});
