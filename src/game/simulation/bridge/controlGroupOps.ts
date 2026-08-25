// Control groups (v0.3.104): Ctrl+digit binds the CURRENT selection to that
// digit; digit recalls the survivors. Session-transient by scope (groups are
// UI state like the selection itself and do not enter saves — spec §9 notes
// it). selectByRefs prunes the dead on recall, so a decimated group recalls
// whoever still stands.

import type { EntityRef } from 'civ-engine';

export function createControlGroupOps(deps: {
  getSelectedEntityRefs: () => readonly EntityRef[];
  selectByRefs: (refs: readonly EntityRef[]) => boolean;
}) {
  const groups = new Map<number, readonly EntityRef[]>();

  function assignControlGroup(digit: number): boolean {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false;
    const refs = deps.getSelectedEntityRefs();
    if (refs.length === 0) return false;
    groups.set(digit, refs.slice());
    return true;
  }

  function recallControlGroup(digit: number): boolean {
    const refs = groups.get(digit);
    if (!refs || refs.length === 0) return false;
    const selected = deps.selectByRefs(refs);
    if (!selected) {
      // Everyone in the group is dead — forget it, like AoE2 does.
      groups.delete(digit);
    }
    return selected;
  }

  return { assignControlGroup, recallControlGroup };
}
