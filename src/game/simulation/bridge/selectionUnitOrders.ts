// The stance and formation rows of a selection's card: which it offers, and
// the one the selected units share. Split by role from `selectionStateOps.ts`
// (work 142 M2b-2), which assembles the whole state; pure reads over the
// bridge's side maps.

import { isDeCivilianUnit } from '../deCivilianUnits';
import { UNIT_STANCES, defaultStanceFor, type UnitStance } from '../unitStance';
import {
  DEFAULT_FORMATION,
  UNIT_FORMATIONS,
  type UnitFormation,
} from '../unitFormation';
import { unitFormationsCodec, unitStancesCodec } from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { UnitComponent } from '../types';

export interface SelectionUnitOrders {
  stanceOptions: UnitStance[];
  stance: UnitStance | null;
  formationOptions: UnitFormation[];
  formation: UnitFormation | null;
}

/** `ownedSelectedUnits` are the selected units the player owns. */
export function selectionUnitOrders(
  accessor: BridgeStateAccessor,
  ownedSelectedUnits: ReadonlyArray<{ id: number; unit: UnitComponent }>,
): SelectionUnitOrders {
  // A civilian's card has neither stances nor formations: hotkeys.json files
  // both under "Military Units" (work 142, `deCivilianUnits.ts`). A military
  // unit in the group keeps them, since which card DE shows for a mix is unsourced.
  const offersStances = ownedSelectedUnits.some((entry) => !isDeCivilianUnit(entry.unit.unitType));
  const stanceOptions: UnitStance[] = offersStances ? [...UNIT_STANCES] : [];
  const stancesInSelection = new Set(ownedSelectedUnits.map((entry) => (
    accessor.get(unitStancesCodec).get(entry.id) ?? defaultStanceFor(entry.unit.unitType)
  )));
  const stance = stancesInSelection.size === 1
    ? [...stancesInSelection][0] ?? null
    : null;
  // Same shape for formations: a single value when the whole selection
  // agrees, null when it does not, so the panel can show "mixed" honestly.
  const formationOptions: UnitFormation[] = offersStances ? [...UNIT_FORMATIONS] : [];
  const formationsInSelection = new Set(ownedSelectedUnits.map((entry) => (
    accessor.get(unitFormationsCodec).get(entry.id) ?? DEFAULT_FORMATION
  )));
  const formation = formationsInSelection.size === 1
    ? [...formationsInSelection][0] ?? null
    : null;
  return { stanceOptions, stance, formationOptions, formation };
}
