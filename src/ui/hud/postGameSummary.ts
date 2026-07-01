import type { HudState, MatchState } from '../../game/simulation/types';
import { escapeHtml } from '../utils/escapeHtml';

// Slice 8: post-game summary card content. Summary text drives the
// existing browser-test assertions; adding winCondition + scores below
// it keeps the textContent backward-compatible in tests that only look
// for the leading status string via text match.
function formatWinConditionLabel(
  winCondition: MatchState['winCondition'],
): string {
  switch (winCondition) {
    case 'wonder':
      return 'Wonder Victory';
    case 'relic':
      return 'Relic Victory';
    case 'conquest':
      return 'Conquest Victory';
    case 'score':
      return 'Score Victory';
    case null:
    default:
      return '';
  }
}

// Slice 8: render the post-game summary markup. Preserves the
// `[data-hud="match-summary-text"]` / `-win-condition` / `-score`
// selectors so browser tests keep finding the status row via the
// leading text node.
export function renderMatchSummary(
  summary: string,
  winCondition: MatchState['winCondition'],
  scores: MatchState['scores'],
): string {
  const parts: string[] = [];
  parts.push(`<div data-hud="match-summary-text">${escapeHtml(summary)}</div>`);
  const label = formatWinConditionLabel(winCondition);
  if (label) {
    parts.push(
      `<div data-hud="match-summary-win-condition">${escapeHtml(label)}</div>`,
    );
  }
  if (scores) {
    const rows = Object.entries(scores)
      .sort(([leftOwner], [rightOwner]) => Number(leftOwner) - Number(rightOwner))
      .map(([owner, score]) =>
        `<div data-hud="match-summary-score">Player ${escapeHtml(owner)}: ${score}</div>`,
      )
      .join('');
    parts.push(rows);
  }
  return parts.join('');
}

export interface PostGameSummaryHandle {
  update(hudState: HudState): void;
}

// Slice 8: the summary host. Hides itself while the match is running and
// renders the three-part card (status text / win condition / per-owner
// score) once the match has an outcome.
export function createPostGameSummary(
  matchSummaryElement: HTMLElement | null,
): PostGameSummaryHandle {
  if (!matchSummaryElement) {
    return { update: () => {} };
  }

  function update(hudState: HudState): void {
    const el = matchSummaryElement;
    if (!el) {
      return;
    }
    const shouldShowSummary =
      hudState.matchState.outcome !== 'running'
      && hudState.matchState.summary.trim().length > 0;
    el.hidden = !shouldShowSummary;
    if (shouldShowSummary) {
      // Slice 8: extended post-game card. First line: summary text.
      // Second: win condition label. Subsequent rows: per-owner score.
      // The HUD pattern keeps everything inside the single footer element
      // so the existing `[data-hud="match-summary"]` selector in browser
      // tests still finds the status text.
      el.innerHTML = renderMatchSummary(
        hudState.matchState.summary,
        hudState.matchState.winCondition,
        hudState.matchState.scores,
      );
    } else {
      el.innerHTML = '';
    }
  }

  return { update };
}
