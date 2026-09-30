// Extracted from playerCommandsSystem's build-command loop: the "construction
// just completed" event — mark complete, snap HP to an integer, flip the
// renderable to the completed look, add the building's vision source + combat
// state, raise the owner's population supply, and fire the completion callback.
// Pulled out so the build/repair loop stays under the 500-LOC file cap.

import type { BuildingComponent, RenderableComponent, VisionSourceComponent } from '../types';
import { deriveCap } from './bridgeConstants';
import { ownerHardPopCap } from './ownerPopCap';
import {
  buildingTint,
  createBuildingCombatState,
} from '../prototypeBuildingRules';
import {
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  constructionStatesCodec,
  playerCivilizationsCodec,
  populationCodec,
} from './bridgeStateSerialize';
import { civBuildingBaseAttackBonus } from '../civBuildingBonuses';
import { completedBuildingVisionRadius } from './completedBuildingVision';
import { isGateBuilding } from '../gates';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { GameWorld } from './pureHelpers';

export function finalizeBuildingConstruction(params: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  buildingId: number;
  building: BuildingComponent;
  onComplete: (
    buildingId: number,
    owner: number,
    buildingType: BuildingComponent['buildingType'],
    visionSourceAdded: boolean,
  ) => void;
  markRender: () => void;
  /** Announce a passability change when the finished building is a gate.
   *  REQUIRED: omitting the bump is the defect the second half of v0.3.161
   *  fixes, and an optional parameter lets the next caller reintroduce it. */
  notePassabilityChange: () => void;
}): void {
  const { world, accessor, buildingId, building } = params;
  const construction = accessor.get(constructionStatesCodec).get(buildingId);
  if (!construction) return;

  construction.buildProgressTicks = construction.totalBuildTicks;
  construction.isComplete = true;
  accessor.markDirty(constructionStatesCodec);

  // A gate that finishes OPENS a route for its owner and their allies without
  // any cell being claimed or released, so the occupancy revision — which the
  // unreachable-plan cache keys on — would not otherwise move, and a unit that
  // found no path before the gate stood would keep refusing after it opened.
  // Only gates change passability on completion: every other building already
  // blocked its footprint as a foundation.
  if (isGateBuilding(building.buildingType)) params.notePassabilityChange();

  const buildingHealth = accessor.get(buildingHealthStatesCodec).get(buildingId);
  if (buildingHealth) {
    buildingHealth.currentHp = Math.min(buildingHealth.maxHp, Math.round(buildingHealth.currentHp));
    accessor.markDirty(buildingHealthStatesCodec);
  }

  const renderable = world.getComponent<RenderableComponent>(buildingId, 'renderable');
  if (renderable) {
    renderable.tint = buildingTint(building.buildingType, building.owner, true);
    renderable.visualVariant = 'complete';
    params.markRender();
  }

  // Every building sees once it is finished. The radius carries what the
  // owner has earned so far — Town Watch and Town Patrol, the Outpost's step
  // per age, the Ethiopian bonus — so a building finished late sees as far as
  // one that stood through the bumps (completedBuildingVision).
  let visionSourceAdded = false;
  if (!world.getComponent<VisionSourceComponent>(buildingId, 'visionSource')) {
    world.addComponent(buildingId, 'visionSource', {
      playerId: building.owner,
      radius: completedBuildingVisionRadius(accessor, building.owner, building.buildingType),
    });
    visionSourceAdded = true;
  }

  const buildingCombatState = createBuildingCombatState(building.buildingType);
  if (buildingCombatState) {
    // A civilization's attack bonus for the building: none in current DE (the
    // Teuton Town Center's +1 is DE-dead since v0.3.144; civBuildingBonuses.ts).
    buildingCombatState.attackDamage += civBuildingBaseAttackBonus(
      accessor.get(playerCivilizationsCodec).get(building.owner),
      building.buildingType,
    );
    accessor.mutate(buildingCombatStatesCodec, (m) => m.set(buildingId, buildingCombatState));
  }

  const populationState = accessor.get(populationCodec).get(building.owner);
  if (populationState && construction.populationProvided > 0) {
    // Raise the honest raw supply; cap is the derived 200-clamp of it.
    populationState.rawSupply += construction.populationProvided;
    populationState.cap = deriveCap(
      populationState.rawSupply,
      ownerHardPopCap(accessor, building.owner),
    );
    accessor.markDirty(populationCodec);
  }

  params.onComplete(buildingId, building.owner, building.buildingType, visionSourceAdded);
}
