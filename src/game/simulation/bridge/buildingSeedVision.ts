// The "give a seeded building its eyes and its weapon" step of
// addBuildingEntity, extracted from entityCreateOps for the 500-LOC budget.
// Mirrors finalizeBuildingConstruction's completion half: vision radius
// (default table or explicit fixture value, plus the Ethiopian tower/outpost
// and Teuton TC bonuses — applied to BOTH branches because the real map's
// starting Town Center arrives with an explicit radius) and the building's
// combat state (plus the Teuton TC "+1 attack").

import type { VisionSourceComponent } from '../types';
import type { BuildingType } from '../types';
import {
  buildingVisionRadius,
  createBuildingCombatState,
} from '../prototypeBuildingRules';
import {
  buildingCombatStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
} from './bridgeStateSerialize';
import { outpostVisionRadiusForAge } from '../visionTechEffects';
import {
  civBuildingBaseAttackBonus,
  teamBuildingVisionBonus,
} from '../civBuildingBonuses';
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

  const defaultVisionRadius = buildingVisionRadius(buildingType);
  const civVisionBonus = teamBuildingVisionBonus(
    accessor.get(playerTeamsCodec),
    accessor.get(playerCivilizationsCodec),
    owner,
    buildingType,
  );
  if (vision) {
    world.addComponent(
      entity,
      'visionSource',
      civVisionBonus > 0 ? { ...vision, radius: vision.radius + civVisionBonus } : vision,
    );
  } else if (isComplete && defaultVisionRadius !== null) {
    world.addComponent(entity, 'visionSource', {
      playerId: owner,
      // The Outpost's "+2 per age" (structures.csv): a fixture that seeds one
      // into a Castle-Age game gets the same radius the age-up bumps would
      // have produced.
      radius: (buildingType === 'outpost'
        ? outpostVisionRadiusForAge(
          accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
          defaultVisionRadius,
        )
        : defaultVisionRadius) + civVisionBonus,
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
