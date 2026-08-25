// Control groups (v0.3.104; persisted v0.3.112): Ctrl+digit binds the CURRENT
// selection to that digit; digit recalls the survivors. The groups live in a
// codec, so a save carries them and a loaded game recalls the same digits —
// the DE behaviour. selectByRefs prunes the dead on recall (its generation
// check also drops members who died BEFORE the save), so a decimated group
// recalls whoever still stands.

import type { EntityRef } from 'civ-engine';

import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { controlGroupsCodec } from './bridgeStateSerialize';

export function createControlGroupOps(deps: {
  accessor: BridgeStateAccessor;
  getSelectedEntityRefs: () => readonly EntityRef[];
  selectByRefs: (refs: readonly EntityRef[]) => boolean;
}) {
  const { accessor } = deps;

  function assignControlGroup(digit: number): boolean {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false;
    const refs = deps.getSelectedEntityRefs();
    if (refs.length === 0) return false;
    accessor.get(controlGroupsCodec).set(digit, refs.slice());
    accessor.markDirty(controlGroupsCodec);
    return true;
  }

  function recallControlGroup(digit: number): boolean {
    const groups = accessor.get(controlGroupsCodec);
    const refs = groups.get(digit);
    if (!refs || refs.length === 0) return false;
    const selected = deps.selectByRefs(refs);
    if (!selected) {
      // Everyone in the group is dead — forget it, like AoE2 does.
      groups.delete(digit);
      accessor.markDirty(controlGroupsCodec);
    }
    return selected;
  }

  return { assignControlGroup, recallControlGroup };
}
