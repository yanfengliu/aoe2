// Extracted from playerCommandsSystem's build-command loop: the "construction
// just completed" event — mark complete, snap HP to an integer, flip the
// renderable to the completed look, add the building's vision source + combat
// state, raise the owner's population supply, and fire the completion callback.
// Pulled out so the build/repair loop stays under the 500-LOC file cap.

import type { BuildingComponent, RenderableComponent, VisionSourceComponent } from '../types';
import { deriveCap } from './bridgeConstants';
import {
  buildingTint,
  buildingVisionRadius,
  createBuildingCombatState,
} from '../prototypeBuildingRules';
import {
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  constructionStatesCodec,
  populationCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { buildingVisionBonus } from '../visionTechEffects';
import { EMPTY_TECH_SET } from '../economyTechEffects';
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
}): void {
  const { world, accessor, buildingId, building } = params;
  const construction = accessor.get(constructionStatesCodec).get(buildingId);
  if (!construction) return;

  construction.buildProgressTicks = construction.totalBuildTicks;
  construction.isComplete = true;
  accessor.markDirty(constructionStatesCodec);

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

  const defaultVisionRadius = buildingVisionRadius(building.buildingType);
  let visionSourceAdded = false;
  if (
    defaultVisionRadius !== null
    && !world.getComponent<VisionSourceComponent>(buildingId, 'visionSource')
  ) {
    // Add the owner's DERIVED LoS bonus (Town Watch/Town Patrol) so a building
    // finished after the tech is researched sees as far as ones bumped live.
    const losBonus = buildingVisionBonus(
      accessor.get(researchedTechnologiesCodec).get(building.owner) ?? EMPTY_TECH_SET,
    );
    world.addComponent(buildingId, 'visionSource', {
      playerId: building.owner,
      radius: defaultVisionRadius + losBonus,
    });
    visionSourceAdded = true;
  }

  const buildingCombatState = createBuildingCombatState(building.buildingType);
  if (buildingCombatState) {
    accessor.mutate(buildingCombatStatesCodec, (m) => m.set(buildingId, buildingCombatState));
  }

  const populationState = accessor.get(populationCodec).get(building.owner);
  if (populationState && construction.populationProvided > 0) {
    // Raise the honest raw supply; cap is the derived 200-clamp of it.
    populationState.rawSupply += construction.populationProvided;
    populationState.cap = deriveCap(populationState.rawSupply);
    accessor.markDirty(populationCodec);
  }

  params.onComplete(buildingId, building.owner, building.buildingType, visionSourceAdded);
}
