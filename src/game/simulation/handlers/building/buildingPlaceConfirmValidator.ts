// Validator for `building.placeConfirm` command (DESIGN v17 §6.2 / §6.4 B2).
// Best-effort placement + affordability checks. Handler re-checks
// authoritatively at start of next step's processCommands.

import { effectiveConstructionCost } from '../../civBonusEffects';
import type { Position, World } from 'civ-engine';

import type {
  BuildableBuildingType,
  BuildingType,
  UnitComponent,
  UnitType,
} from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import { canAfford, describeMissingResources } from '../../prototypeEconomyRules';
import { buildingFootprint } from '../../bridge/pureHelpers';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { playerCivilizationsCodec, playerResourcesCodec } from '../../bridge/bridgeStateSerialize';
import type { PlacementBlockReport } from '../../bridge/cellPassability';

export interface BuildingPlaceConfirmValidatorDeps {
  // Phase 2D: playerResources migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
  isPlacementBlocked: (
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
  ) => boolean;
  // agent-affordances A3: name the blocking cause + cell and suggest the
  // nearest open anchor the acting owner can see. The suggestion is
  // fog-gated through isCellVisibleToOwner so a rejection never reveals
  // unscouted terrain.
  describePlacementBlockers: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => PlacementBlockReport | null;
  findOpenPlacementAnchors: (
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
    },
  ) => Position[];
  isCellVisibleToOwner: (owner: number, x: number, y: number) => boolean;
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
    if (data.additionalBuilderIds !== undefined) {
      if (!Array.isArray(data.additionalBuilderIds)) {
        return { code: 'invalid_builder_id', message: 'additionalBuilderIds must be an array.' };
      }
      for (const extraId of data.additionalBuilderIds) {
        if (!Number.isInteger(extraId)) {
          return { code: 'invalid_builder_id', message: 'Additional builder id must be an integer.' };
        }
      }
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
    // What a unit may build is the build MENU's answer, not a unit-type test:
    // a Fishing Ship builds Fish Traps and nothing else, and a militia builds
    // nothing. Keeping the "builds nothing at all" case separate keeps the
    // message useful — "cannot build that" would be misleading for a soldier.
    if (deps.getBuildOptions(unit.owner, unit.unitType).length === 0) {
      return {
        code: 'not_a_builder',
        message: `A ${unit.unitType} cannot construct buildings; villagers build on land and Fishing Ships build Fish Traps.`,
      };
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
    if (deps.isPlacementBlocked(
      data.position.x,
      data.position.y,
      footprint.width,
      footprint.height,
      data.buildingType,
    )) {
      const report = deps.describePlacementBlockers(
        data.position.x,
        data.position.y,
        footprint.width,
        footprint.height,
      );
      const cause = report
        ? `${report.cause} at (${report.firstBlockedCell.x},${report.firstBlockedCell.y})`
        : 'an obstacle';
      const counts = report && report.totalCellCount > 1
        ? `; ${report.blockedCellCount} of ${report.totalCellCount} footprint cells are blocked`
        : '';
      const anchors = deps.findOpenPlacementAnchors(
        data.position.x,
        data.position.y,
        footprint.width,
        footprint.height,
        {
          max: 1,
          isCellVisible: (x, y) => deps.isCellVisibleToOwner(unit.owner, x, y),
        },
      );
      const suggestion = anchors.length > 0
        ? ` Nearest open ground you can see: (${anchors[0]!.x},${anchors[0]!.y}).`
        : '';
      return {
        code: 'placement_blocked',
        message:
          `Placement blocked for ${data.buildingType} `
          + `(${footprint.width}x${footprint.height}): blocked by ${cause}${counts}.${suggestion}`,
      };
    }
    const stockpile = deps.accessor.get(playerResourcesCodec).get(unit.owner);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the owner.' };
    }
    const cost = effectiveConstructionCost(
      deps.accessor.get(playerCivilizationsCodec).get(unit.owner),
      data.buildingType,
    );
    if (!canAfford(stockpile, cost)) {
      const detail = describeMissingResources(stockpile, cost);
      return {
        code: 'insufficient_resources',
        message: detail
          ? `Not enough resources to build a ${data.buildingType}: ${detail}.`
          : 'Not enough resources to construct.',
      };
    }
    return true;
  };
}
