// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import type { MatchState } from '../../src/game/simulation/types';
import { renderMatchSummary } from '../../src/ui/hud/postGameSummary';
import { renderMatchResult } from '../../src/ui/hud/matchResultOverlay';

// A finished match must SAY which way it finished. Before this gate the HUD
// built its only end-of-match label out of `winCondition` alone
// (`formatWinConditionLabel`), so a loss and a win printed the same four
// characters: the owner played a match to conquest, lost it, and read
// "Conquest Victory" in a 13px translucent grey card. `matchState.outcome`
// was correct in the same object and rendered nowhere.
//
// This asserts on the TEXT the two surfaces render, never on `outcome`
// itself, because the defect is precisely that the field was right and
// unrendered.
//
// BOUND — what this proves and no more. It is a pure-render check over the
// text of `renderMatchSummary` (the footer card) and `renderMatchResult` (the
// end-of-match overlay), across every `outcome` x `winCondition` pair the
// union allows and four owner shapes (1v1, three players, a tie at the top,
// and absent scores). It proves nothing about MOUNTING, visibility, type
// size, contrast or reachability, and it never runs a match — a surface that
// is never appended, is `hidden` forever, or paints at 1px would pass every
// line here. `tests/browser/match-result-announcement.spec.ts` covers that in
// four real matches. Proved red at bcdc88c3: every `defeat` and `draw` case
// below reported "Conquest Victory" / "Score Victory", and `renderMatchResult`
// did not exist.

function textOf(html: string): string {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.textContent ?? '';
}

function matchState(over: Partial<MatchState>): MatchState {
  return {
    outcome: 'defeat',
    summary: 'All of your units and buildings have been destroyed.',
    winCondition: 'conquest',
    scores: { 1: 50, 2: 10 },
    wonderCountdownTicks: null,
    relicCountdownTicks: null,
    ...over,
  };
}

/** Both end-of-match surfaces, so neither can be fixed while the other lies. */
function surfaces(state: MatchState): Array<{ name: string; text: string }> {
  return [
    { name: 'footer card', text: textOf(renderMatchSummary(state, HUMAN_PLAYER_ID)) },
    { name: 'result overlay', text: textOf(renderMatchResult(state, HUMAN_PLAYER_ID)) },
  ];
}

const CONDITIONS = ['conquest', 'wonder', 'relic', 'score'] as const;

describe('the end-of-match announcement names the OUTCOME, not just the condition', () => {
  for (const winCondition of CONDITIONS) {
    it(`a ${winCondition} DEFEAT reads as a defeat and never as a victory`, () => {
      for (const { name, text } of surfaces(matchState({ outcome: 'defeat', winCondition }))) {
        expect(text, `${name}: a lost match must say so`).toMatch(/defeat/i);
        expect(
          text,
          `${name}: this match was LOST — the word "victory" must not appear anywhere in it. `
            + `Rendered: ${JSON.stringify(text)}`,
        ).not.toMatch(/victor/i);
      }
    });

    it(`a ${winCondition} VICTORY reads as a victory and never as a defeat`, () => {
      const state = matchState({
        outcome: 'victory',
        winCondition,
        summary: 'All enemy forces have been eliminated.',
      });
      for (const { name, text } of surfaces(state)) {
        expect(text, `${name}: a won match must say so`).toMatch(/victor/i);
        expect(text, `${name}: a won match must not say "defeat"`).not.toMatch(/defeat/i);
      }
    });

    it(`a ${winCondition} DRAW reads as a draw and as neither of the other two`, () => {
      const state = matchState({
        outcome: 'draw',
        winCondition,
        summary: "Mutual annihilation: every player's units and buildings were destroyed on the same tick.",
        scores: { 1: 180, 2: 180 },
      });
      for (const { name, text } of surfaces(state)) {
        expect(text, `${name}: a drawn match must say so`).toMatch(/draw/i);
        expect(text, `${name}: a drawn match is not a victory`).not.toMatch(/victor/i);
        expect(text, `${name}: a drawn match is not a defeat`).not.toMatch(/defeat/i);
      }
    });
  }

  it('keeps the win condition itself visible beside the outcome', () => {
    for (const winCondition of CONDITIONS) {
      const state = matchState({ outcome: 'defeat', winCondition });
      for (const { name, text } of surfaces(state)) {
        expect(text.toLowerCase(), `${name}: how the match was decided must still be readable`)
          .toContain(winCondition);
      }
    }
  });

  it('a running match announces nothing at all', () => {
    const state = matchState({ outcome: 'running', winCondition: null, scores: null, summary: '' });
    expect(textOf(renderMatchResult(state, HUMAN_PLAYER_ID)).trim()).toBe('');
  });
});

describe('the end-of-match announcement names the WINNER', () => {
  it('names the player themselves when they won', () => {
    const state = matchState({ outcome: 'victory', summary: 'All enemy forces have been eliminated.' });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: the winner is the player, and it should say so in the second person`)
        .toMatch(/winner:\s*you/i);
    }
  });

  it('names the surviving opponent when the player lost a two-player match', () => {
    // conquest-defeat-fixture: the human is eliminated holding the HIGHER score
    // (50 vs 10), so score cannot be used to pick a conquest winner.
    const state = matchState({ outcome: 'defeat', winCondition: 'conquest', scores: { 1: 50, 2: 10 } });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: the other player won and must be named`).toMatch(/winner:\s*player 2/i);
    }
  });

  it('names the top scorer when a score-timer defeat had several opponents', () => {
    // score-timer-defeat-fixture: P1 (human) 50 < P3 100 < P2 180. The score
    // condition's own rule is "highest score wins", so P2 is nameable here.
    const state = matchState({
      outcome: 'defeat',
      winCondition: 'score',
      summary: 'The game timer expired at tick 30; highest score wins (top score 180).',
      scores: { 1: 50, 2: 180, 3: 100 },
    });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: the sole top scorer won`).toMatch(/winner:\s*player 2/i);
      expect(text, `${name}: P3 did not win`).not.toMatch(/winner:\s*player 3/i);
    }
  });

  it('claims no single winner it cannot know, and says so rather than guessing', () => {
    // Conquest with three players: the human is out, and which of the two
    // survivors won is not recorded anywhere the HUD can read. Naming one
    // would be a lie; naming none would repeat the defect.
    const state = matchState({ outcome: 'defeat', winCondition: 'conquest', scores: { 1: 50, 2: 10, 3: 30 } });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: the winning SIDE is still named`).toMatch(/winner:\s*your opponents/i);
      expect(text, `${name}: no individual opponent may be named on a guess`)
        .not.toMatch(/winner:\s*player [23]/i);
    }
  });

  it('says a draw has no winner', () => {
    const state = matchState({
      outcome: 'draw',
      winCondition: 'score',
      summary: 'The game timer expired at tick 30; highest score wins (top score 180).',
      scores: { 1: 180, 2: 180 },
    });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: a draw has no winner and must not name one`).toMatch(/no winner/i);
      expect(text, `${name}: a draw must not name a winning player`).not.toMatch(/winner:\s*player/i);
    }
  });

  it("marks the player's own score row so the table is readable at a glance", () => {
    const state = matchState({ outcome: 'defeat', scores: { 1: 50, 2: 10 } });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: which row is the player's must be obvious`).toMatch(/player 1 \(you\)/i);
    }
  });

  it('still renders an outcome when the match end recorded no scores', () => {
    const state = matchState({ outcome: 'defeat', scores: null });
    for (const { name, text } of surfaces(state)) {
      expect(text, `${name}: a missing score table must not swallow the result`).toMatch(/defeat/i);
    }
  });
});

describe('the overlay offers a way out of itself', () => {
  it('renders exactly one dismiss control, and it is a real button', () => {
    const host = document.createElement('div');
    host.innerHTML = renderMatchResult(matchState({}), HUMAN_PLAYER_ID);
    const buttons = host.querySelectorAll('button[data-hud="match-result-dismiss"]');
    expect(buttons.length).toBe(1);
    expect((buttons[0] as HTMLButtonElement).textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
