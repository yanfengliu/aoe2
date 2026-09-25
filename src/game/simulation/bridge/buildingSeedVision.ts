// The "give a seeded building its eyes and its weapon" step of
// addBuildingEntity, extracted from entityCreateOps for the 500-LOC budget.
// Mirrors finalizeBuildingConstruction's completion half: every completed
// building sees (completedBuildingVision derives the radius both paths use),
// or a fixture names the radius itself, and the Ethiopian tower/outpost bonus
// applies to that branch too. Then the building's combat state (plus the
// Teuton TC "+1 attack").

import type { VisionSourceComponent } from '../types';
import type { BuildingType } from '../types';
import { createBuildingCombatState } from '../prototypeBuildingRules';
import {
  buildingCombatStatesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
} from './bridgeStateSerialize';
import {
  civBuildingBaseAttackBonus,
  teamBuildingVisionBonus,
} from '../civBuildingBonuses';
import { completedBuildingVisionRadius } from './completedBuildingVision';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';

export function attachBuildingVisionAndCombat(params: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  entity: number;
  owner: number;
  buildingType: BuildingType;
  isComplete: boolean;
  vision?: VisionSourceComponent;
}): void {
  const { world, accessor, entity, owner, buildingType, isComplete, vision } = params;

  if (vision) {
    const civVisionBonus = teamBuildingVisionBonus(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      buildingType,
    );
    world.addComponent(
      entity,
      'visionSource',
      civVisionBonus > 0 ? { ...vision, radius: vision.radius + civVisionBonus } : vision,
    );
  } else if (isComplete) {
    // A fixture that seeds an Outpost into a Castle-Age game gets the radius
    // the age-up bumps would have produced (the Outpost's "+2 per age").
    world.addComponent(entity, 'visionSource', {
      playerId: owner,
      radius: completedBuildingVisionRadius(accessor, owner, buildingType),
    });
  }

  const buildingCombatState = createBuildingCombatState(buildingType);
  if (isComplete && buildingCombatState) {
    // Teuton Town Centers hit for one more (civilizations.csv "+1 attack").
    buildingCombatState.attackDamage += civBuildingBaseAttackBonus(
      accessor.get(playerCivilizationsCodec).get(owner),
      buildingType,
    );
    accessor.mutate(buildingCombatStatesCodec, (m) => m.set(entity, buildingCombatState));
  }
}
