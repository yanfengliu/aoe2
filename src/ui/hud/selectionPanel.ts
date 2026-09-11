// Selection panel factory: signature-cached HTML render + per-tick
// command-button rebind. Render helpers live in `selectionPanel/render.ts`
// to keep this file under 500 LOC.

import type { UnitStance } from '../../game/simulation/unitStance';
import type { UnitFormation } from '../../game/simulation/unitFormation';
import type {
  ActionType,
  BuildableBuildingType,
  EconomyResourceKind,
  EconomyState,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  SelectionState,
  TrainableUnitType,
} from '../../game/simulation/types';

import { effectiveConstructionCost } from '../../game/simulation/civBonusEffects';
import {
  formatEntityName,
  formatQueueEntryName,
  formatQueueProgress,
  formatSelectionName,
} from './displayNames';
import {
  renderFormationButtons,
  renderStanceButtons,
  renderSelectionActivity,
  renderSelectionDetails,
  renderSelectionIcons,
} from './selectionPanel/render';
import {
  buildAvailabilitySignature,
  renderBuildButtons,
  renderBuildPageTabs,
  renderBuildSlots,
} from './selectionPanel/buildPalette';
import {
  isBuildPageId,
  partitionBuildOptions,
  resolveActiveBuildPage,
  type BuildPageId,
} from './selectionPanel/buildPages';
// Test surfaces use renderSelectionIcons directly; preserve the export
// path for backward compatibility with existing test imports.
export { renderSelectionIcons } from './selectionPanel/render';
// The build palette moved to `selectionPanel/buildPalette.ts` when DE's two
// build pages landed; the re-export keeps the import path tests already use.
export { renderBuildButtons } from './selectionPanel/buildPalette';
// The command-card button markup lives in `selectionPanel/buttons.ts`; the
// re-exports keep the import path tests and callers already use.
export {
  renderActionButtons,
  renderMarketButtons,
  renderResearchButtons,
  renderTrainButtons,
  renderTributeButtons,
} from './selectionPanel/buttons';
import {
  renderActionButtons,
  renderMarketButtons,
  renderResearchButtons,
  renderTrainButtons,
  renderTributeButtons,
} from './selectionPanel/buttons';

/**
 * The bridge's per-command "what is missing", indexed by the same
 * `data-command` hook the buttons carry. The simulation decides WHY a
 * command refuses; this only routes each sentence to its own control.
 */
function commandReasons(selectionState: SelectionState): ReadonlyMap<string, string> {
  return new Map(
    selectionState.unavailableCommands.map((entry) => [
      `${entry.kind}-${entry.id}`,
      entry.reason,
    ]),
  );
}

type CommandGroupKind =
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
function renderCommandGroup(
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

// M7 UI-icons (v0.1.72): the command-card "Train <Name>" buttons get a per-role
// procedural UNIT glyph before the label (reusing the v0.1.44 selection-panel
// art), mirroring renderBuildButtons. Augment-not-replace: the
// `data-command="train-<type>"` hook and the "Train <Name>" text are preserved
// (the text sits in a `hud-command-label` span so textContent is unchanged).
// Exported so it is unit-testable in isolation.
// M7 UI-icons (v0.1.74): the command-card "Research <Name>" buttons get the
// generic procedural RESEARCH glyph before the label. Augment-not-replace:
// the `data-command="research-<tech>"` hook, the "Research <Name>" text, and
// the visible-but-locked disabled state (a tech shown greyed until its
// prerequisites are met) are all preserved. `visibleResearchOptions` is the
// full set of buttons to draw; `availableResearchOptions` is the subset that
// is researchable right now (the rest render locked).
export interface SelectionPanelDeps {
  getEconomyState(): EconomyState;
  issueAction(actionType: ActionType): boolean;
  setSelectionStance(stance: UnitStance): boolean;
  setSelectionFormation(formation: UnitFormation): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  /** Tribute (spec §6.8): send 100 of a resource to another player. */
  sendTribute(toOwner: number, resource: EconomyResourceKind): boolean;
  /** The other players a tribute could go to, and the human's current fee. */
  getTributeTargets(): { owners: number[]; feeRate: number };
  /** The human's real building price — civ AND team discounts included,
   *  so the card never quotes more than the charge. */
  getConstructionCost?(buildingType: BuildableBuildingType): Partial<PlayerResources>;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  /** Puts an armed placement away again, leaving the builders selected. */
  cancelBuildingPlacement(): boolean;
}

export interface SelectionPanelHandle {
  update(selectionState: SelectionState, playerResources: PlayerResources): void;
}

// Renders the left-side selection panel: icons, detail rows, production
// queue items, active placement-mode hint, and the per-command button
// grid (train / action / market / research / build). Skips re-render
// when the `selectionState` signature is unchanged across frames so the
// HUD stays cheap in the common no-change case.
export function createSelectionPanel(
  selectionPanel: HTMLElement | null,
  deps: SelectionPanelDeps,
): SelectionPanelHandle {
  if (!selectionPanel) {
    return { update: () => {} };
  }

  let lastSelectionSignature = '';
  // Which of DE's two build pages the player last chose. UI state, so it lives
  // in the closure rather than in the simulation's selection state — but it is
  // part of the render signature, because a page change has to redraw a
  // selection that has not otherwise moved.
  // Null until the player presses a page tab. A selection change resets it, so
  // a new unit's palette opens on its own first page rather than on whatever
  // the last one was left showing (DE opens on page 1).
  let chosenBuildPage: BuildPageId | null = null;
  let lastSelectionKey = '';
  let lastSelectionState: SelectionState | null = null;
  let lastPlayerResources: PlayerResources | null = null;

  function update(selectionState: SelectionState, playerResources: PlayerResources): void {
    const el = selectionPanel;
    if (!el) {
      return;
    }
    lastSelectionState = selectionState;
    lastPlayerResources = playerResources;

    const costOf = (buildingType: BuildableBuildingType): Partial<PlayerResources> =>
      deps.getConstructionCost?.(buildingType)
        ?? effectiveConstructionCost(undefined, buildingType);
    const buildPages = partitionBuildOptions(selectionState.buildOptions);
    const selectionKey = JSON.stringify([
      selectionState.selectedEntityIds, selectionState.selectedEntityType,
    ]);
    if (selectionKey !== lastSelectionKey) {
      lastSelectionKey = selectionKey;
      chosenBuildPage = null;
    }
    const activeBuildPage = resolveActiveBuildPage(
      chosenBuildPage,
      buildPages,
      selectionState.placementMode,
    );
    const signature = JSON.stringify([
      selectionState,
      selectionState.buildOptions.length > 0
        ? buildAvailabilitySignature(
            selectionState.buildOptions, playerResources, costOf)
        : null,
      activeBuildPage,
    ]);
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;

    const focusedElement = el.contains(document.activeElement)
      && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusedCommand = focusedElement?.dataset.command ?? null;
    const focusedBuildPage = focusedElement?.dataset.buildPage ?? null;

    const economyState = deps.getEconomyState();
    const selectionIcons = renderSelectionIcons(selectionState, economyState);
    const selectionDetails = renderSelectionDetails(selectionState);

    // The production queue is drawn AFTER the command deck (see the template
    // below), because as the bar's MIDDLE child — summary, queue, deck, with a
    // fixed 300px summary and a deck taking what was left — the first card slid
    // the whole deck right by its own width the instant production started.
    // Measured at 1600x900 on b929d07d: Ring Town Bell 363 -> 503, Train
    // Villager 520 -> 660, so a player repeating DE's commonest click put their
    // next two on the bell and garrisoned their own villagers (play-test
    // 2026-09-11, `M1-07-queue.png`). Local rule "The HUD holds its shape"
    // already names "a queue filling up": nothing ahead of the deck may grow on
    // a simulation event.
    const queueItems = selectionState.queue.length > 0
      ? selectionState.queue
        .map((entry, index) => {
          const progress = entry.totalTicks <= 0
            ? 100
            : Math.max(
              0,
              Math.min(
                100,
                Math.round(((entry.totalTicks - entry.remainingTicks) / entry.totalTicks) * 100),
              ),
            );
          return `
            <div class="hud-queue-item" data-selection-queue-item="${index}">
              <div class="hud-queue-name">${formatQueueEntryName(entry)}</div>
              <div class="hud-queue-meta">${formatQueueProgress(progress)}</div>
              <div class="hud-queue-progress">
                <div class="hud-queue-progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          `;
        })
        .join('')
      : '';
    // Placement mode is announced INSIDE the Build group's heading, never as a
    // sibling section of the bar. As a third flex sibling between the summary
    // and the deck it took its width out of the build palette — the only thing
    // in the bar allowed to shrink — and a 269px palette became a 31px sliver
    // at 1280x720 (defect register, 2026-09-02).
    const placementMarkup = selectionState.placementMode
      ? `<div class="hud-placement-status" data-placement-status>
          <span class="hud-placement-status__mode" data-placement-mode>Placing: ${formatEntityName(selectionState.placementMode)}</span>
          <span class="hud-placement-status__hint">Choose a clear map tile</span>
        </div>`
      : '';

    // DE's command card shows ONE build page at a time (spec §14.1), so only
    // the active page's cards are drawn; the toggle in the heading is what
    // reaches the other page.
    const reasons = commandReasons(selectionState);
    const activePageOptions = buildPages[activeBuildPage];
    // Both pages fill the same number of slots, so the palette keeps its height
    // and the page toggle above it does not move when the player switches.
    const widestPage = Math.max(
      buildPages.economic.length,
      buildPages.military.length,
    );
    const buildButtons = activePageOptions.length > 0
      ? renderBuildButtons(
        activePageOptions,
        playerResources,
        selectionState.placementMode,
        costOf,
        reasons,
      ) + renderBuildSlots(widestPage - activePageOptions.length)
      : '';
    const buildPageTabs = selectionState.buildOptions.length > 0
      ? renderBuildPageTabs(buildPages, activeBuildPage)
      : '';
    // Only a selection with a build palette can be placing; the fallback keeps
    // the status visible if that ever stops being true.
    const placementOutsideDeck = buildButtons ? '' : placementMarkup;
    const actionButtons = renderActionButtons(selectionState.actionOptions);
    const trainButtons = renderTrainButtons(selectionState.trainOptions, reasons);
    const marketButtons = renderMarketButtons(selectionState.marketOptions, reasons);
    // Tribute rides the Market card: buttons exist only while a completed own
    // Market is selected, which is exactly when marketOptions is non-empty.
    const tribute = selectionState.marketOptions.length > 0
      ? deps.getTributeTargets()
      : { owners: [], feeRate: 0 };
    const tributeTargetCount = tribute.owners.length * 4;
    const tributeButtons = renderTributeButtons(tribute.owners, tribute.feeRate);
    const researchButtons = renderResearchButtons(
      selectionState.visibleResearchOptions,
      selectionState.researchOptions,
      reasons,
    );

    const commandGroups = [
      renderCommandGroup('action', 'Orders', actionButtons, selectionState.actionOptions.length),
      renderCommandGroup(
        'stance',
        'Stance',
        renderStanceButtons(selectionState.stanceOptions, selectionState.stance),
        selectionState.stanceOptions.length,
      ),
      renderCommandGroup(
        'formation',
        'Formation',
        renderFormationButtons(selectionState.formationOptions, selectionState.formation),
        selectionState.formationOptions.length,
      ),
      renderCommandGroup('train', 'Train', trainButtons, selectionState.trainOptions.length),
      renderCommandGroup('market', 'Trade', marketButtons, selectionState.marketOptions.length),
      renderCommandGroup('tribute', 'Tribute', tributeButtons, tributeTargetCount),
      renderCommandGroup(
        'research',
        'Research',
        researchButtons,
        selectionState.visibleResearchOptions.length,
      ),
      renderCommandGroup(
        'build',
        'Build',
        buildButtons,
        activePageOptions.length,
        placementMarkup,
        buildPageTabs,
        `data-build-page="${activeBuildPage}"`,
      ),
    ].join('');

    // Who is selected and what they are — one block, so the command deck beside
    // it gets the rest of the bar. Grouping these three was what let the build
    // palette fit on screen at all once the panel became a bottom bar.
    el.innerHTML = `
      <div class="hud-selection-summary">
        <div class="hud-selection-heading">
          <div class="hud-label">Selection</div>
          <div class="hud-selection-name" data-selection-name>${formatSelectionName(selectionState)}</div>
          ${renderSelectionActivity(selectionState)}
        </div>
        ${selectionIcons}
        ${selectionDetails}
      </div>
      ${placementOutsideDeck}
      ${commandGroups ? `<div class="hud-command-deck" data-command-deck>${commandGroups}</div>` : ''}
      ${queueItems ? `<div class="hud-queue-list" data-selection-queue-list>${queueItems}</div>` : ''}
    `;

    el.querySelectorAll<HTMLButtonElement>('[data-command^="train-"]').forEach((button) => {
      const unitType = button.dataset.command?.replace('train-', '') as TrainableUnitType | undefined;
      if (!unitType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.queueTrainUnit(unitType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="action-"]').forEach((button) => {
      const actionType = button.dataset.command?.replace('action-', '') as ActionType | undefined;
      if (!actionType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.issueAction(actionType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="stance-"]').forEach((button) => {
      const stance = button.dataset.command?.replace('stance-', '') as UnitStance | undefined;
      if (!stance) {
        return;
      }
      button.addEventListener('click', () => {
        deps.setSelectionStance(stance);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="formation-"]').forEach((button) => {
      const formation = button.dataset.command
        ?.replace('formation-', '') as UnitFormation | undefined;
      if (!formation) {
        return;
      }
      button.addEventListener('click', () => {
        deps.setSelectionFormation(formation);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="market-"]').forEach((button) => {
      const actionType = button.dataset.command?.replace('market-', '') as MarketActionType | undefined;
      if (!actionType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.issueMarketAction(actionType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="tribute-"]').forEach((button) => {
      // data-command="tribute-<owner>-<resource>".
      const parts = button.dataset.command?.split('-');
      const toOwner = Number(parts?.[1]);
      const resource = parts?.[2] as EconomyResourceKind | undefined;
      if (!Number.isInteger(toOwner) || !resource) return;
      button.addEventListener('click', () => {
        deps.sendTribute(toOwner, resource);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="research-"]').forEach((button) => {
      const technologyType = button.dataset.command?.replace(
        'research-',
        '',
      ) as ResearchableTechnologyType | undefined;
      if (!technologyType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.queueResearch(technologyType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="build-"]').forEach((button) => {
      const buildingType = button.dataset.command?.replace('build-', '') as BuildableBuildingType | undefined;
      if (!buildingType) {
        return;
      }
      button.addEventListener('click', () => {
        // A second click on the card that armed it puts it away again — DE's
        // own toggle, and one of the three ways out of placement mode this
        // panel had none of before v0.3.223.
        if (selectionState.placementMode === buildingType) {
          deps.cancelBuildingPlacement();
          return;
        }
        deps.beginBuildingPlacement(buildingType);
      });
    });

    el.querySelectorAll<HTMLButtonElement>('button[data-build-page]').forEach((button) => {
      const page = button.dataset.buildPage;
      if (!isBuildPageId(page)) {
        return;
      }
      button.addEventListener('click', () => {
        if (chosenBuildPage === page) {
          return;
        }
        chosenBuildPage = page;
        // The signature carries the page, so re-running update() with the same
        // selection redraws exactly the palette and nothing else.
        if (lastSelectionState && lastPlayerResources) {
          update(lastSelectionState, lastPlayerResources);
        }
      });
    });

    if (focusedCommand) {
      const replacement = [...el.querySelectorAll<HTMLButtonElement>('[data-command]')]
        .find((button) => button.dataset.command === focusedCommand);
      replacement?.focus({ preventScroll: true });
    } else if (focusedBuildPage) {
      // Switching pages replaces the tab that was clicked; keyboard focus has
      // to survive it or a Tab-driven player is thrown back to the top.
      el.querySelector<HTMLButtonElement>(`button[data-build-page="${focusedBuildPage}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  return { update };
}
