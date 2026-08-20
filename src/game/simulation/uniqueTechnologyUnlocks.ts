// Which units a civilization's researched unique technologies open at a
// building they are not normally trained at.
//
// Only the Goths' Anarchy does this today (Huskarls in the Barracks), but it is
// its own module rather than an inline check so optionsRules never grows a
// civilization name, and so the train menu and the research menu read the same
// table.

import { uniqueTechnologiesFor } from './uniqueTechnologies';
import type { BuildingType } from './types';
import type { ResearchableTechnologyType } from './technologyTypes';
import type { TrainableUnitType } from './unitTypes';

export function unlockedTrainingFor(
  civilization: string,
  buildingType: BuildingType,
  hasTechnology: (technology: ResearchableTechnologyType) => boolean,
): TrainableUnitType[] {
  const unlocked: TrainableUnitType[] = [];
  for (const technology of uniqueTechnologiesFor(civilization)) {
    const unlock = technology.unlocksTraining;
    if (!unlock || unlock.building !== buildingType) continue;
    if (!hasTechnology(technology.id)) continue;
    unlocked.push(unlock.unitType);
  }
  return unlocked;
}
