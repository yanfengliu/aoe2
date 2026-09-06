import type { HudState, MatchState } from '../../game/simulation/types';
import { escapeHtml } from '../utils/escapeHtml';
import {
  formatOutcomeHeadline,
  formatPlayerLabel,
  formatWinConditionLabel,
  isFinished,
  resolveMatchWinner,
} from './matchOutcomeText';
import { createMatchResultOverlay, type MatchResultOverlay } from './matchResultOverlay';

// The post-game footer card: the RECORD of how the match ended, which stays in
// the corner after the result overlay (`matchResultOverlay`) is dismissed.
//
// Until 2026-09-06 it was the only thing a finished match produced, and it
// built its label out of `winCondition` alone — so a player who had just lost
// by conquest read "Conquest Victory". The outcome is now the first thing it
// renders and every label below it is derived with the outcome in hand
// (`matchOutcomeText`), so a win and a loss cannot print the same string.

// Slice 8: render the post-game summary markup. Preserves the
// `[data-hud="match-summary-text"]` / `-win-condition` / `-score` selectors
// so browser tests keep finding the status row via the leading text node.
export function renderMatchSummary(matchState: MatchState, humanPlayerId: number): string {
  const { outcome } = matchState;
  if (!isFinished(outcome)) {
    return '';
  }
  const parts: string[] = [];
  parts.push(
    `<div data-hud="match-summary-outcome" data-match-outcome="${outcome}">`
    + `${escapeHtml(formatOutcomeHeadline(outcome))}</div>`,
  );
  parts.push(`<div data-hud="match-summary-text">${escapeHtml(matchState.summary)}</div>`);
  const label = formatWinConditionLabel(matchState.winCondition, outcome);
  if (label) {
    parts.push(
      `<div data-hud="match-summary-win-condition">${escapeHtml(label)}</div>`,
    );
  }
  const winner = resolveMatchWinner(matchState, humanPlayerId);
  if (winner) {
    parts.push(`<div data-hud="match-summary-winner">${escapeHtml(winner.line)}</div>`);
  }
  if (matchState.scores) {
    const rows = Object.entries(matchState.scores)
      .sort(([leftOwner], [rightOwner]) => Number(leftOwner) - Number(rightOwner))
      .map(([owner, score]) => {
        const id = Number(owner);
        const won = winner?.owners.includes(id) ? ' data-match-result-winner="true"' : '';
        return `<div data-hud="match-summary-score"${won}>`
          + `${escapeHtml(formatPlayerLabel(id, humanPlayerId))}: ${String(score)}</div>`;
      })
      .join('');
    parts.push(rows);
  }
  return parts.join('');
}

export interface PostGameSummaryHandle {
  update(hudState: HudState): void;
  destroy(): void;
}

// Slice 8: the summary host. Hides itself while the match is running and
// renders the card (outcome / status text / win condition / winner / per-owner
// score) once the match has an outcome. It also owns the result overlay, which
// is the surface the player actually notices; both read the same
// `matchOutcomeText` helpers so they cannot disagree about the same match.
export function createPostGameSummary(
  matchSummaryElement: HTMLElement | null,
  hudRoot: HTMLElement | null,
  humanPlayerId: number,
): PostGameSummaryHandle {
  const overlay: MatchResultOverlay = createMatchResultOverlay(hudRoot, humanPlayerId);
  if (!matchSummaryElement) {
    return {
      update: (hudState: HudState) => { overlay.update(hudState.matchState); },
      destroy: () => { overlay.destroy(); },
    };
  }

  function update(hudState: HudState): void {
    const el = matchSummaryElement;
    overlay.update(hudState.matchState);
    if (!el) {
      return;
    }
    const shouldShowSummary =
      isFinished(hudState.matchState.outcome)
      && hudState.matchState.summary.trim().length > 0;
    el.hidden = !shouldShowSummary;
    if (shouldShowSummary) {
      // The HUD pattern keeps everything inside the single footer element so
      // the existing `[data-hud="match-summary"]` selector in browser tests
      // still finds the status text.
      el.innerHTML = renderMatchSummary(hudState.matchState, humanPlayerId);
    } else {
      el.innerHTML = '';
    }
  }

  return { update, destroy: () => { overlay.destroy(); } };
}
