// One group of the command card (Orders, Train, Research...): its section
// markup, and the refusal sentence routed to each of its buttons. Split by
// role from selectionPanel.ts, which owns the panel's state and render loop.

import type { SelectionState } from '../../../game/simulation/types';

/**
 * The bridge's per-command "what is missing", indexed by the same
 * `data-command` hook the buttons carry. The simulation decides WHY a
 * command refuses; this only routes each sentence to its own control.
 */
export function commandReasons(selectionState: SelectionState): ReadonlyMap<string, string> {
  return new Map(
    selectionState.unavailableCommands.map((entry) => [
      `${entry.kind}-${entry.id}`,
      entry.reason,
    ]),
  );
}

export type CommandGroupKind =
  | 'action'
  | 'stance'
  | 'formation'
  | 'train'
  | 'market'
  | 'tribute'
  | 'research'
  | 'build';

// `headingControls` is optional markup that LEADS the heading row — the Build
// group's page toggle — and `headingStatus` sits between the title and the
// count: the Build group's "Placing: …" pill. Both live in the heading so a
// mode or a page can be offered without adding a section to the bar (a sibling
// of the bar takes its width out of the palette; a row of its own takes its
// height). The toggle leads because the title and the count step aside for the
// pill on a narrow group, and a control that moves when a mode starts is the
// defect the pill itself was moved here to avoid.
export function renderCommandGroup(
  kind: CommandGroupKind,
  label: string,
  content: string,
  count: number,
  headingStatus = '',
  headingControls = '',
  sectionAttributes = '',
): string {
  if (!content) {
    return '';
  }
  const headingId = `hud-command-group-${kind}`;
  const listClass = kind === 'build' ? 'hud-build-menu' : 'hud-command-list';
  return `
    <section
      class="hud-command-group hud-command-group--${kind}"
      data-command-group="${kind}"
      data-command-group-count="${count}"
      ${sectionAttributes}
      aria-labelledby="${headingId}"
    >
      <div class="hud-command-group__heading">
        ${headingControls}
        <span class="hud-command-group__title" id="${headingId}">${label}</span>
        ${headingStatus}
        <span class="hud-command-group__count" aria-hidden="true">${count}</span>
      </div>
      <div class="${listClass}">${content}</div>
    </section>`;
}
