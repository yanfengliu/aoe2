import type { MatchState } from '../../game/simulation/types';
import { escapeHtml } from '../utils/escapeHtml';
import {
  formatOutcomeHeadline,
  formatOutcomeSentence,
  formatPlayerLabel,
  formatWinConditionLabel,
  isFinished,
  resolveMatchWinner,
} from './matchOutcomeText';

// The surface that tells the player the match is OVER. Sibling of
// `engineHaltNotice`: a stopped match and a finished one are the same kind of
// event — the world will not change again, and the player needs to be told
// where they stand and given one thing to do about it. It follows that file's
// shape deliberately (a dimmed full-screen root, one panel, one action,
// focused on open) rather than inventing a third modal idiom.
//
// Before this, the end of a match was a `hud-footer` in the bottom-left corner
// in 13px translucent grey: a player could finish a game without noticing it
// had ended. That footer still renders, as the record that stays after this
// overlay is dismissed.
//
// The trap `.hud-halt-notice` already paid for applies here too: an author
// `display: grid` outranks the user agent's `[hidden] { display: none }`, so
// the compound `.hud-match-result[hidden] { display: none }` in hudChrome.css
// is what keeps this off every frame of a LIVE match.

function scoreRows(matchState: MatchState, humanPlayerId: number, winners: readonly number[]): string {
  if (matchState.scores === null) {
    return '';
  }
  const rows = Object.entries(matchState.scores)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([owner, score]) => {
      const id = Number(owner);
      const won = winners.includes(id) ? ' data-match-result-winner="true"' : '';
      return `<div class="hud-match-result__score" data-hud="match-result-score"${won}>`
        + `<span>${escapeHtml(formatPlayerLabel(id, humanPlayerId))}</span>`
        + `<span>${String(score)}</span></div>`;
    })
    .join('');
  return `<div class="hud-match-result__scores">${rows}</div>`;
}

/** The overlay's markup for a finished match; the empty string while one runs. */
export function renderMatchResult(matchState: MatchState, humanPlayerId: number): string {
  const { outcome } = matchState;
  if (!isFinished(outcome)) {
    return '';
  }
  const winner = resolveMatchWinner(matchState, humanPlayerId);
  const condition = formatWinConditionLabel(matchState.winCondition, outcome);
  const summary = matchState.summary.trim();
  return `
      <div class="hud-match-result__panel">
        <div
          class="hud-match-result__outcome"
          data-hud="match-result-outcome"
          data-match-outcome="${outcome}"
        >${escapeHtml(formatOutcomeHeadline(outcome))}</div>
        <div class="hud-match-result__sentence">${escapeHtml(formatOutcomeSentence(outcome))}</div>
        ${condition
    ? `<div class="hud-match-result__condition" data-hud="match-result-condition">${escapeHtml(condition)}</div>`
    : ''}
        ${summary
    ? `<div class="hud-match-result__summary" data-hud="match-result-summary">${escapeHtml(summary)}</div>`
    : ''}
        <div class="hud-match-result__winner" data-hud="match-result-winner">${escapeHtml(winner?.line ?? '')}</div>
        ${scoreRows(matchState, humanPlayerId, winner?.owners ?? [])}
        <div class="hud-match-result__hint">Press Esc for the menu to restart or quit.</div>
        <button
          type="button"
          class="hud-match-result__action"
          data-hud="match-result-dismiss"
        >Close</button>
      </div>`;
}

export interface MatchResultOverlay {
  /** Called every frame; renders once per distinct result and no more. */
  update(matchState: MatchState): void;
  /** The element, for tests; null when there was no host to mount into. */
  element(): HTMLElement | null;
  destroy(): void;
}

export function createMatchResultOverlay(
  host: HTMLElement | null,
  humanPlayerId: number,
): MatchResultOverlay {
  if (!host) {
    return { update: () => {}, element: () => null, destroy: () => {} };
  }

  const root = host.ownerDocument.createElement('div');
  root.className = 'hud-match-result';
  root.dataset.hud = 'match-result';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-live', 'assertive');
  root.setAttribute('aria-label', 'The match has ended');
  root.hidden = true;
  host.append(root);

  // The result already on screen, so a per-frame update is a no-op once the
  // match has ended — and a dismissal is not undone by the next frame.
  let renderedKey: string | null = null;
  let dismissed = false;

  // Delegated once, so re-rendering the panel cannot leak listeners or lose
  // the binding.
  const onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-hud="match-result-dismiss"]')) {
      dismissed = true;
      root.hidden = true;
    }
  };
  root.addEventListener('click', onClick);

  function update(matchState: MatchState): void {
    if (!isFinished(matchState.outcome)) {
      // A new match (restart, load, quit-to-title) resets the surface, so the
      // next result announces itself even if the last one was dismissed.
      renderedKey = null;
      dismissed = false;
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const key = `${matchState.outcome}|${String(matchState.winCondition)}|${matchState.summary}`;
    if (key !== renderedKey) {
      renderedKey = key;
      dismissed = false;
      root.innerHTML = renderMatchResult(matchState, humanPlayerId);
      root.hidden = false;
      root
        .querySelector<HTMLButtonElement>('[data-hud="match-result-dismiss"]')
        ?.focus({ preventScroll: true });
      return;
    }
    root.hidden = dismissed;
  }

  return {
    update,
    element: () => root,
    destroy: () => {
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
