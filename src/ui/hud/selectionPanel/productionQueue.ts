// Work 148 M1: Definitive Edition's production queue (spec §14.2; sources in
// docs/work/148_de-hud, DE never launched).
// - The queue is a row of icons, not a list of rows: DE's command panel holds a
//   `QueueButtons` anchor filled at run time, and each queued item is a button
//   with its own tooltip (strings 43104-43108: "Click to remove this unit from
//   the queue.", "Click to stop creating this unit.").
// - ONE progress bar, the item in production's: the panel's `ProgressBack` and
//   `Progress` (280x20) beside its `StatusLabel`, whose words are "Creating"
//   (IDS_ATTRIBUTE_TRAINING, 4310) and "Researching" (4309), with "%" (4328).
// - A unit that cannot start for want of houses is named so: "You need to build
//   more houses." (20607), and "Population limit reached." (20608) once more
//   houses would not help; DE's global queue draws such a unit red ("Red: Unit
//   cannot be created due to the population cap.", 300185).
// - Consecutive items of one kind stack into one icon with their count. DE's
//   global queue groups "the first consecutive group of units of the same type
//   in the same building" (forums.ageofempires.com t/284548, 2026-03-04); that
//   the building's own panel stacks the same way, and where the count is drawn,
//   are unsourced (docs/work/148_de-hud, "Unsourced").
// - DE removes an item on a click on its icon, with a refund (the strings above;
//   the AoK manual, p. 29). This game has no command that takes an item out of a
//   queue, so the icons here are not buttons, and their tooltips name the item
//   rather than offer a click that would do nothing (plan 106's card).

import type { PopulationState, ProductionQueueEntry } from '../../../game/simulation/types';
import { formatEntityName, formatTechnologyName } from '../displayNames';
import { researchGlyph } from '../icons/glyphs';
import { selectionGlyph } from '../icons/unitGlyphs';
import { POP_HARD_CAP } from '../../../game/simulation/bridge/bridgeConstants';
import { escapeHtml } from '../../utils/escapeHtml';

export type QueueStackState = 'active' | 'waiting' | 'blocked';

/** One icon of the queue: a run of consecutive items of one kind. */
export interface QueueStack {
  readonly kind: 'unit' | 'technology';
  /** The unit's or the technology's type. */
  readonly type: string;
  readonly name: string;
  readonly count: number;
  /** The index in the queue of the run's first item. */
  readonly firstIndex: number;
  readonly state: QueueStackState;
}

const typeOf = (entry: ProductionQueueEntry): string => entry.unitType ?? entry.technologyType ?? entry.label;

const nameOf = (entry: ProductionQueueEntry): string => {
  if (entry.kind === 'unit' && entry.unitType) return formatEntityName(entry.unitType);
  if (entry.kind === 'technology' && entry.technologyType) return formatTechnologyName(entry.technologyType);
  return entry.label;
};

/** Whether the queue's first item is a unit waiting for room in the population. */
export function headWaitsForHousing(
  queue: readonly ProductionQueueEntry[],
  population: PopulationState | null,
): boolean {
  const head = queue[0];
  return Boolean(head && head.kind === 'unit' && head.isBlocked
    && population && population.current >= population.cap);
}

/** The item the building is working on now: the first, unless it is a unit
 *  waiting for houses, when the first technology behind it is researched in its
 *  place (spec §6.10), or nothing. */
export function progressingEntryIndex(
  queue: readonly ProductionQueueEntry[],
  population: PopulationState | null,
): number {
  if (queue.length === 0) return -1;
  if (!headWaitsForHousing(queue, population)) return 0;
  return queue.findIndex((entry, index) => index > 0 && entry.kind === 'technology' && entry.technologyType);
}

/** How far an item has come, a whole percent from 0 to 100. */
export function queueEntryPercent(entry: ProductionQueueEntry): number {
  if (entry.totalTicks <= 0) return 100;
  // Times 100 before dividing: 145 of 250 ticks is 58%, where dividing first
  // gave 57.99999999999999 (review round 1).
  const percent = Math.floor(((entry.totalTicks - entry.remainingTicks) * 100) / entry.totalTicks);
  return Math.max(0, Math.min(100, percent));
}

/** The queue as its icons: each run of consecutive items of one kind is one
 *  icon with its count, the item in production counted in its run. A run takes
 *  its first item's state: the run at the head is active, or blocked while its
 *  unit waits for houses, and the technology researched behind a blocked head
 *  is active; every other run waits. */
export function queueStacks(
  queue: readonly ProductionQueueEntry[],
  population: PopulationState | null,
): QueueStack[] {
  const active = progressingEntryIndex(queue, population);
  const blockedHead = headWaitsForHousing(queue, population);
  const stacks: QueueStack[] = [];
  queue.forEach((entry, index) => {
    const last = stacks[stacks.length - 1];
    if (last && index !== active && last.kind === entry.kind && last.type === typeOf(entry)) {
      stacks[stacks.length - 1] = { ...last, count: last.count + 1 };
      return;
    }
    const state: QueueStackState = index === active
      ? 'active'
      : index === 0 && blockedHead ? 'blocked' : 'waiting';
    stacks.push({ kind: entry.kind, type: typeOf(entry), name: nameOf(entry), count: 1, firstIndex: index, state });
  });
  return stacks;
}

/** DE's status line for a unit that cannot start: string 20607 while a House
 *  would make room, 20608 at the population limit. */
export function housingMessage(population: PopulationState): string {
  return population.rawSupply > population.cap || population.cap >= POP_HARD_CAP
    ? 'Population limit reached.'
    : 'You need to build more houses.';
}

function stackTooltip(stack: QueueStack, percent: number, population: PopulationState | null): string {
  const queued = stack.count > 1 ? ` (${stack.count} in the queue)` : '';
  if (stack.state === 'active') {
    return `${stack.kind === 'unit' ? 'Creating' : 'Researching'} ${stack.name}: ${percent}%${queued}`;
  }
  if (stack.state === 'blocked' && population) return `${stack.name}${queued}: ${housingMessage(population)}`;
  return stack.count > 1 ? `${stack.name}: ${stack.count} in the queue` : `${stack.name}: in the queue`;
}

function renderStack(stack: QueueStack, percent: number, population: PopulationState | null): string {
  const glyph = stack.kind === 'unit'
    ? selectionGlyph(stack.type as Parameters<typeof selectionGlyph>[0])
    : researchGlyph('hud-queue-icon__glyph');
  // A saved game keeps each entry's label, the fallback name: text, never markup.
  const tooltip = escapeHtml(stackTooltip(stack, percent, population));
  const count = stack.count > 1
    ? `<span class="hud-queue-icon__count" data-queue-count="${stack.count}" aria-hidden="true">${stack.count}</span>`
    : '';
  const bar = stack.state === 'active'
    ? `<span class="hud-queue-icon__progress" aria-hidden="true"><span class="hud-queue-icon__progress-fill" style="width: ${percent}%"></span></span>`
    : '';
  return `<span class="hud-queue-icon" role="img" data-selection-queue-item="${stack.firstIndex}" data-queue-entry="${escapeHtml(stack.type)}" data-queue-kind="${stack.kind}" data-queue-stack-count="${stack.count}" data-queue-state="${stack.state}" data-tooltip="${tooltip}" aria-label="${tooltip}"><span class="hud-queue-icon__portrait">${glyph}</span>${count}${bar}</span>`;
}

/** The production queue as DE draws it: the status of the item in production
 *  with its one bar, then the queue's icons. Empty for an empty queue. */
export function renderProductionQueue(
  queue: readonly ProductionQueueEntry[],
  population: PopulationState | null,
): string {
  if (queue.length === 0) return '';
  const activeIndex = progressingEntryIndex(queue, population);
  const active = activeIndex >= 0 ? queue[activeIndex] : null;
  const percent = active ? queueEntryPercent(active) : 0;
  const waiting = headWaitsForHousing(queue, population) && population
    ? `<div class="hud-queue-status__housing" data-queue-housing>${housingMessage(population)}</div>`
    : '';
  const progress = active
    ? `<div class="hud-queue-status__label" data-queue-status-label>${active.kind === 'unit' ? 'Creating' : 'Researching'} ${escapeHtml(nameOf(active))}</div>
      <div class="hud-queue-status__line"><div class="hud-queue-progress" data-queue-progress="${percent}" aria-hidden="true"><div class="hud-queue-progress-fill" style="width: ${percent}%"></div></div><span class="hud-queue-status__percent" data-queue-percent>${percent}%</span></div>`
    : '';
  const icons = queueStacks(queue, population).map((stack) => renderStack(stack, percent, population)).join('');
  return `<div class="hud-queue-list" data-selection-queue-list role="group" aria-label="Production queue">
      <div class="hud-queue-status" data-queue-status>${waiting}${progress}</div>
      <div class="hud-queue-icons" data-queue-icons>${icons}</div>
    </div>`;
}
