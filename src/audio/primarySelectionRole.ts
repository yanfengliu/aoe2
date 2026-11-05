import type { SelectionState, UnitType } from '../game/simulation/types';
import { unitRole } from '../rendering/roles/unitRole';

/**
 * The selection voice's role: that of the PRIMARY selected unit's own type.
 * A group's type is null when its members differ, and since work 142 a group
 * of villagers and a sheep is such a group, so the group's type would leave it
 * silent; the voice is the first unit's, as it is for any group. Null when the
 * primary selection is not a unit.
 */
export function primarySelectionRole(
  selection: Pick<SelectionState, 'selectedEntityId' | 'selectedKind'>,
  unitTypeOf: (id: number) => UnitType | undefined,
): { id: number; role: string } | null {
  const id = selection.selectedEntityId;
  if (id === null || selection.selectedKind !== 'unit') return null;
  const unitType = unitTypeOf(id);
  const role = unitType === undefined ? null : unitRole(unitType);
  return role ? { id, role } : null;
}
