// A completed building's line of sight, derived in one place (2026-09-24).
// Three sites give a building its vision source: seeding a scenario
// (buildingSeedVision), finishing construction (finalizeBuildingConstruction),
// and loading a save made before every building saw (bootScenarioOrLoad).
// Before this, the first two each derived the radius themselves — the seed
// path never added Town Watch or Town Patrol — and both skipped every
// building type outside a seven-entry table, so a House, a Barracks or a wall
// gave its owner no sight at all.

import { teamBuildingVisionBonus } from '../civBuildingBonuses';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import { buildingVisionRadius } from '../prototypeBuildingRules';
import type { BuildingComponent, BuildingType, VisionSourceComponent } from '../types';
import { buildingVisionBonus, outpostVisionRadiusForAge } from '../visionTechEffects';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

/**
 * The line of sight `owner`'s completed `buildingType` has right now: the
 * table (structures.csv), the Outpost's "+2 per age" for the owner's current
 * age, Town Watch and Town Patrol, and the Ethiopian team bonus. A building
 * that is already standing gets the age and technology steps as they happen
 * (technologyOps); this is the same total for one completed afterwards.
 */
export function completedBuildingVisionRadius(
  accessor: BridgeStateAccessor,
  owner: number,
  buildingType: BuildingType,
): number {
  const base = buildingType === 'outpost'
    ? outpostVisionRadiusForAge(
      accessor.get(playerAgesCodec).get(owner) ?? 'dark-age',
      buildingVisionRadius('outpost'),
    )
    : buildingVisionRadius(buildingType);
  return base
    + buildingVisionBonus(accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET)
    + teamBuildingVisionBonus(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      buildingType,
    );
}

/**
 * Gives every completed building without a vision source its own, and returns
 * how many it gave. A save made before 2026-09-24 holds such buildings: then
 * only seven types saw, so a loaded House would otherwise stay blind for the
 * rest of the match. A foundation stays without one until it is finished.
 */
export function restoreCompletedBuildingVision(
  world: GameWorld,
  accessor: BridgeStateAccessor,
): number {
  const constructions = accessor.get(constructionStatesCodec);
  let restored = 0;
  for (const id of world.query('building')) {
    if (world.getComponent<VisionSourceComponent>(id, 'visionSource')) continue;
    if (constructions.get(id)?.isComplete === false) continue;
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!building) continue;
    world.addComponent(id, 'visionSource', {
      playerId: building.owner,
      radius: completedBuildingVisionRadius(accessor, building.owner, building.buildingType),
    });
    restored += 1;
  }
  return restored;
}
