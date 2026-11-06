// Work 146 M2: Definitive Edition's group panel, the icons of a selection of
// several units (spec §14.2; sources in docs/work/146_de-selection, DE never
// launched).
// - One icon per selected unit with its hit-point bar: "When you select multiple
//   units, the UI will display the number of units selected, the selected
//   unit's icons and current Hit Point bar" ("Learn to play", Lesson 5).
// - Sorted by type: "Currently they are sorted by type, but those types are
//   sorted randomly" (a DE player, forums.ageofempires.com t/72939, 2020-03-01).
//   Which type comes first is unsourced: here the order the selection first
//   lists them, and each type in the selection's order.
// - Every selected unit is drawn: a selection holds at most 60
//   (`SELECTION_LIMIT`), and DE's panel holds 60 (t/72939, 2020: "the only
//   issue is fitting more than 60 thumbnails of selected units into UI").
// - A click on an icon selects only that unit, Ctrl+click takes it out,
//   Shift+click keeps every unit of its type and Ctrl+Shift+click takes every
//   unit of its type out: DE's tooltips 43121 and 43122, and AoK/HD's
//   "Selection queue actions" (openage's reverse engineering: "SHIFT +
//   MOUSE-BUTTON: Keep only units of the same type in the queue").
// - Which of 43121 and 43122 DE shows when is unsourced: here 43122, with the
//   type clauses, for a group of several types, and 43121 for a group of one.
// - The bar's tones are the ones the bars over the units use
//   (`aoeVoxelOverlayParts.ts`: above 60% green, above 30% yellow, else red);
//   DE's own panel colours are unsourced.

import type { BuildingType, SelectionState, UnitType } from '../../../game/simulation/types';
import { formatEntityIconAccent, formatEntityName, isUnitType } from '../displayNames';
import { writeAttribute, writeData } from '../hudDomWrites';
import { isBuildableBuildingType } from '../icons/glyphs';
import { selectionGlyph } from '../icons/unitGlyphs';

/** What an icon stands for: a unit's type, an owned sheep, or a building's type
 *  (DE's select-all building keys put several buildings in one selection). */
export type GroupMemberKind = UnitType | 'sheep' | BuildingType;

export interface GroupMember {
  readonly id: number;
  readonly kind: GroupMemberKind;
}

export type GroupPanelGesture = 'select-only' | 'drop' | 'keep-type' | 'drop-type';

export type GroupHealthReader = (id: number) => { currentHp: number; maxHp: number } | null;

export interface GroupMemberHealth {
  /** Whole hit points, as the single unit's Health line shows them. */
  readonly current: number;
  readonly max: number;
  /** The share of the bar the hit points fill, 0-100. */
  readonly percent: number;
  readonly tone: 'high' | 'mid' | 'low';
}

/** DE's four clicks on an icon; Ctrl and Shift together are Ctrl+Shift's. */
export function groupPanelGesture(modifiers: { readonly ctrlKey: boolean; readonly shiftKey: boolean }): GroupPanelGesture {
  if (modifiers.ctrlKey) return modifiers.shiftKey ? 'drop-type' : 'drop';
  return modifiers.shiftKey ? 'keep-type' : 'select-only';
}

/** The ids that stay selected after a click on `clickedId`'s icon, in the
 *  selection's order. A click on a unit no longer in the selection keeps it. */
export function selectionAfterGroupPanelClick(
  members: readonly GroupMember[],
  clickedId: number,
  gesture: GroupPanelGesture,
): number[] {
  const clicked = members.find((member) => member.id === clickedId);
  if (!clicked) return members.map((member) => member.id);
  const keep = {
    'select-only': (member: GroupMember) => member.id === clicked.id,
    drop: (member: GroupMember) => member.id !== clicked.id,
    'keep-type': (member: GroupMember) => member.kind === clicked.kind,
    'drop-type': (member: GroupMember) => member.kind !== clicked.kind,
  }[gesture];
  return members.filter(keep).map((member) => member.id);
}

/** The icons' order: by type, each type where the selection first lists it. */
export function inGroupPanelOrder(members: readonly GroupMember[]): GroupMember[] {
  const byKind = new Map<GroupMemberKind, GroupMember[]>();
  for (const member of members) {
    const run = byKind.get(member.kind);
    if (run) run.push(member);
    else byKind.set(member.kind, [member]);
  }
  return [...byKind.values()].flat();
}

export function groupMemberHealth(health: { currentHp: number; maxHp: number } | null): GroupMemberHealth | null {
  if (!health || !(health.maxHp > 0)) return null;
  const ratio = Math.max(0, Math.min(1, health.currentHp / health.maxHp));
  return {
    current: Math.floor(Math.max(0, Math.min(health.maxHp, health.currentHp))),
    max: health.maxHp,
    percent: Math.round(ratio * 100),
    tone: ratio > 0.6 ? 'high' : ratio > 0.3 ? 'mid' : 'low',
  };
}

/** DE's tooltip on an icon: string 43121, or 43122 when the group holds
 *  several types and the type clauses mean something. */
export function groupMemberTooltip(kind: GroupMemberKind, kindsInSelection: number): string {
  const only = `Click to select only this ${formatEntityName(kind)}. Hold down CTRL and click to unselect this unit.`;
  return kindsInSelection > 1
    ? `${only} Hold down SHIFT and click to select all units of this type. Hold down CTRL+SHIFT and click to unselect all units of this type.`
    : only;
}

/** The selection's members with their kinds, in the selection's order, from
 *  the selection state's own types (review round 1: read from the economy
 *  state at a redraw, a member that upgraded in place kept its old type, and
 *  so its old icon and clicks, until something else redrew the panel). A
 *  member of no kind an icon stands for is left out. */
export function selectionGroupMembers(selectionState: SelectionState): GroupMember[] {
  const members: GroupMember[] = [];
  selectionState.selectedEntityIds.forEach((id, index) => {
    const type = selectionState.selectedEntityTypes[index] ?? null;
    if (type !== null && (isUnitType(type) || type === 'sheep' || type === 'town-center' || isBuildableBuildingType(type))) {
      members.push({ id, kind: type });
    }
  });
  return members;
}

const hpText = (health: GroupMemberHealth | null): string => (health ? `${health.current}/${health.max}` : '');
const memberLabel = (kind: GroupMemberKind, health: GroupMemberHealth | null): string => (
  health ? `${formatEntityName(kind)}, ${health.current} of ${health.max} hit points` : formatEntityName(kind)
);

function renderMember(member: GroupMember, kinds: number, health: GroupMemberHealth | null): string {
  return `
    <button
      type="button"
      class="hud-selection-member"
      data-selection-member="${member.id}"
      data-selection-member-type="${member.kind}"
      data-tooltip="${groupMemberTooltip(member.kind, kinds)}"
      aria-label="${memberLabel(member.kind, health)}"
      style="--unit-icon-accent: ${formatEntityIconAccent(member.kind)}"
    ><span class="hud-selection-member__portrait">${selectionGlyph(member.kind)}</span><span
      class="hud-selection-member__hp"
      data-selection-member-hp="${hpText(health)}"
      data-selection-member-hp-tone="${health?.tone ?? 'none'}"
      aria-hidden="true"
    ><span class="hud-selection-member__hp-fill" data-selection-member-hp-fill style="width: ${health?.percent ?? 0}%"></span></span></button>
  `;
}

/** The group's icons, one a member, in the panel's order. */
export function renderGroupPanel(members: readonly GroupMember[], health: GroupHealthReader): string {
  const kinds = new Set(members.map((member) => member.kind)).size;
  const icons = inGroupPanelOrder(members)
    .map((member) => renderMember(member, kinds, groupMemberHealth(health(member.id))))
    .join('');
  return `<div class="hud-selection-group" data-selection-unit-icons data-selection-group role="group" aria-label="Selected units">${icons}</div>`;
}

/** Brings every drawn icon's bar to its unit's hit points now, writing only
 *  what changed, so the panel follows a fight without drawing its icons again. */
export function refreshGroupPanelHealth(root: ParentNode, health: GroupHealthReader): void {
  for (const icon of root.querySelectorAll<HTMLElement>('[data-selection-member]')) {
    const view = groupMemberHealth(health(Number(icon.dataset.selectionMember)));
    const track = icon.querySelector<HTMLElement>('[data-selection-member-hp]');
    const fill = track?.querySelector<HTMLElement>('[data-selection-member-hp-fill]');
    if (!track || !fill) continue;
    writeAttribute(track, 'data-selection-member-hp', hpText(view));
    writeData(track, 'selectionMemberHpTone', view?.tone ?? 'none');
    const width = `${view?.percent ?? 0}%`;
    if (fill.style.width !== width) fill.style.width = width;
    writeAttribute(icon, 'aria-label', memberLabel(icon.dataset.selectionMemberType as GroupMemberKind, view));
  }
}
