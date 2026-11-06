// Work 146: the selection changes behind DE's modifier clicks and drags (spec
// §9.4; sources in docs/work/146_de-selection).
// - Shift adds ("Learn to play", Lesson 1: "Holding down Shift allows you to
//   select multiple units at the same time through individual selection or
//   multiple selection boxes"). What joins is what a box takes, the player's
//   own units and livestock (`filterSelectableUnitIds`), after what is already
//   selected and up to the cap. A selection a box could not have made (a
//   building, another player's unit, a resource) is replaced, as a box
//   replaces it.
// - Ctrl takes selected units out (forums.ageofempires.com t/74555, 2020: "If
//   you hold ctrl when left clicking on selected units it deselects them").
// Both write through `selectUnitIds`, which keeps the selection limit.

export interface SelectionModifierOpsDeps {
  getSelectedEntityIds: () => number[];
  filterSelectableUnitIds: (ids: number[]) => number[];
  /** Replaces the selection, at most SELECTION_LIMIT, in this order. */
  selectUnitIds: (ids: number[]) => boolean;
}

export interface SelectionModifierOps {
  /** True when any unit joined; false when none could (already selected, at
   *  the cap, or nothing a box would take). */
  addUnitsToSelection(ids: number[]): boolean;
  /** True when any of `ids` was selected and is not now. */
  removeFromSelection(ids: number[]): boolean;
}

export function createSelectionModifierOps(deps: SelectionModifierOpsDeps): SelectionModifierOps {
  const { getSelectedEntityIds, filterSelectableUnitIds, selectUnitIds } = deps;

  function addUnitsToSelection(ids: number[]): boolean {
    const current = getSelectedEntityIds();
    // What is already selected never joins, so it never replaces the rest
    // either, whatever else is selected with it (review round 0).
    const alreadySelected = new Set(current);
    const joining = filterSelectableUnitIds(ids).filter((id) => !alreadySelected.has(id));
    if (joining.length === 0) return false;
    const base = filterSelectableUnitIds(current).length === current.length ? current : [];
    const kept = new Set(base);
    selectUnitIds([...base, ...joining]);
    return getSelectedEntityIds().some((id) => !kept.has(id));
  }

  function removeFromSelection(ids: number[]): boolean {
    const dropped = new Set(ids);
    const current = getSelectedEntityIds();
    const remaining = current.filter((id) => !dropped.has(id));
    if (remaining.length === current.length) return false;
    selectUnitIds(remaining);
    return true;
  }

  return { addUnitsToSelection, removeFromSelection };
}
