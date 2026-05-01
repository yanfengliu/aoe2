// Validator for `building.placeConfirm` command (DESIGN v17 §6.2 / §6.4 B2).
// Best-effort placement + affordability checks. Handler re-checks
// authoritatively at start of next step's processCommands.

import type { World } from 'civ-engine';

import type {
  BuildableBuildingType,
  PlayerResources,
  UnitComponent,
  UnitType,
} from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canAfford, constructionCost } from '../../prototypeEconomyRules';
import { buildingFootprint } from '../../bridge/pureHelpers';

export interface BuildingPlaceConfirmValidatorDeps {
  playerResources: Map<number, PlayerResources>;
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
  isPlacementBlocked: (x: number, y: number, width: number, height: number) => boolean;
  mapWidth: number;
  mapHeight: number;
}

export type BuildingPlaceConfirmValidator = (
  data: GameCommands['building.placeConfirm'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeBuildingPlaceConfirmValidator(
  deps: BuildingPlaceConfirmValidatorDeps,
): BuildingPlaceConfirmValidator {
  return (data, world) => {
    if (!Number.isInteger(data.builderId)) {
      return { code: 'invalid_builder_id', message: 'Builder id must be an integer.' };
    }
    if (
      !Number.isInteger(data.position?.x)
      || !Number.isInteger(data.position?.y)
    ) {
      return { code: 'invalid_position', message: 'Position coordinates must be integers.' };
    }
    if (!world.isAlive(data.builderId)) {
      return { code: 'builder_not_found', message: 'Builder no longer exists.' };
    }
    const unit = world.getComponent<UnitComponent>(data.builderId, 'unit');
    if (!unit) {
      return { code: 'not_a_unit', message: 'Entity is not a unit.' };
    }
    if (unit.unitType !== 'villager') {
      return { code: 'not_a_villager', message: 'Only villagers can construct buildings.' };
    }
    if (!deps.getBuildOptions(unit.owner, unit.unitType).includes(data.buildingType)) {
      return { code: 'cannot_build', message: 'Cannot construct that building here.' };
    }
    // Reject OOB positions explicitly (impl-12 review F2 — both bridge facade
    // and startConstructionDirect clamp internally, but if a non-bridge
    // submitter sends OOB the validator's silent clamp would mask the
    // actual failure mode).
    if (
      data.position.x < 0
      || data.position.x >= deps.mapWidth
      || data.position.y < 0
      || data.position.y >= deps.mapHeight
    ) {
      return { code: 'out_of_bounds', message: 'Position is out of map bounds.' };
    }
    const footprint = buildingFootprint(data.buildingType);
    if (deps.isPlacementBlocked(data.position.x, data.position.y, footprint.width, footprint.height)) {
      return { code: 'placement_blocked', message: 'Placement blocked.' };
    }
    const stockpile = deps.playerResources.get(unit.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    if (!canAfford(stockpile, constructionCost(data.buildingType))) {
      return { code: 'insufficient_resources', message: 'Not enough resources to construct.' };
    }
    return true;
  };
}
