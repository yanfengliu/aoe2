// Control groups (v0.3.104; persisted v0.3.112; DE's twenty, work 142): Ctrl+digit
// binds the CURRENT selection to a group; the digit recalls the survivors. The
// groups live in a codec, so a save carries them and a loaded game recalls the
// same groups — the DE behaviour. selectByRefs prunes the dead on recall (its
// generation check also drops members who died BEFORE the save), so a
// decimated group recalls whoever still stands.
//
// A group is an index 0-19 (`controlGroupIndex`): the digit for DE's groups 1 to
// 10 (Ctrl+0 is group 10, index 0, as before work 142), and 10 plus the digit
// for groups 11 to 20, the same keys with Alt. A save written before work 142
// holds indexes 0-9 only, which mean what they meant (spec §15.3).
//
// A unit is in one group at a time, as DE's players report it (an appended unit
// leaves its old group; "each unit's assigned number"): binding or appending
// takes the selected entities out of every other group, and a group left empty
// is forgotten.

import type { EntityRef } from 'civ-engine';

import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { controlGroupsCodec } from './bridgeStateSerialize';

/** DE's twenty control groups (`GROUP_COMMAND_HOTKEYS`). */
export const CONTROL_GROUP_COUNT = 20;

/** The group a digit key reaches: 1-9 and 0 alone are groups 1-10 (index =
 *  digit), and with Alt groups 11-20 (index = 10 + digit). */
export function controlGroupIndex(digit: number, alt: boolean): number {
  return (alt ? 10 : 0) + digit;
}

const isGroup = (group: number): boolean => Number.isInteger(group) && group >= 0 && group < CONTROL_GROUP_COUNT;
const sameRef = (a: EntityRef, b: EntityRef): boolean => a.id === b.id && a.generation === b.generation;

export function createControlGroupOps(deps: {
  accessor: BridgeStateAccessor;
  getSelectedEntityRefs: () => readonly EntityRef[];
  selectByRefs: (refs: readonly EntityRef[]) => boolean;
}) {
  const { accessor } = deps;

  /** Takes these refs out of every group but `keep`; true when one changed. */
  function takeOutOfGroups(groups: Map<number, EntityRef[]>, refs: readonly EntityRef[], keep: number | null): boolean {
    let changed = false;
    for (const [group, members] of [...groups]) {
      if (group === keep) continue;
      const left = members.filter((member) => !refs.some((ref) => sameRef(ref, member)));
      if (left.length === members.length) continue;
      changed = true;
      if (left.length === 0) groups.delete(group); else groups.set(group, left);
    }
    return changed;
  }

  function assignControlGroup(group: number): boolean {
    if (!isGroup(group)) return false;
    const refs = deps.getSelectedEntityRefs();
    if (refs.length === 0) return false;
    const groups = accessor.get(controlGroupsCodec);
    takeOutOfGroups(groups, refs, group);
    groups.set(group, refs.slice());
    accessor.markDirty(controlGroupsCodec);
    return true;
  }

  /** DE's Append Group (Shift with the group's key): the selection joins the
   *  group, which is made if it has no members; the selection stays. */
  function appendToControlGroup(group: number): boolean {
    if (!isGroup(group)) return false;
    const refs = deps.getSelectedEntityRefs();
    if (refs.length === 0) return false;
    const groups = accessor.get(controlGroupsCodec);
    takeOutOfGroups(groups, refs, group);
    const members = groups.get(group) ?? [];
    groups.set(group, [...members, ...refs.filter((ref) => !members.some((member) => sameRef(member, ref)))]);
    accessor.markDirty(controlGroupsCodec);
    return true;
  }

  /** DE's Ungroup Control Group (U): the selection leaves its groups. */
  function ungroupSelection(): boolean {
    const refs = deps.getSelectedEntityRefs();
    if (refs.length === 0) return false;
    const groups = accessor.get(controlGroupsCodec);
    if (!takeOutOfGroups(groups, refs, null)) return false;
    accessor.markDirty(controlGroupsCodec);
    return true;
  }

  function recallControlGroup(group: number): boolean {
    if (!isGroup(group)) return false;
    const groups = accessor.get(controlGroupsCodec);
    const refs = groups.get(group);
    if (!refs || refs.length === 0) return false;
    const selected = deps.selectByRefs(refs);
    if (!selected) {
      // Everyone in the group is dead — forget it, like AoE2 does.
      groups.delete(group);
      accessor.markDirty(controlGroupsCodec);
    }
    return selected;
  }

  return { assignControlGroup, appendToControlGroup, ungroupSelection, recallControlGroup };
}
