// Phase 3 placement subsystem. Three ops that together drive villager
// building placement: the live preview (`getPlacementPreview`), the
// mode-entry trigger (`beginBuildingPlacement`), and the anchor-commit
// call (`confirmBuildingPlacement`). Factored out of
// `createSimulationBridge.ts` so the placement surface lives in one
// file — the bridge retains the `placementMode` closure variable via a
// mutable holder, and every collaborator the ops mutate is routed
// through the dep-bag for parity with the other `bridge/` extractions.
//
// The holder shape (`{ current: BuildableBuildingType | null }`) lets
// these ops read and write the same placement-mode slot the bridge's
// selection / command paths clear on every other interaction, without
// widening this module to co-own selection state.
//
// `enqueueRejection` is passed in as a collaborator so rejections from
// `beginBuildingPlacement` / `confirmBuildingPlacement` enter the same
// command-rejection queue the rest of the bridge already populates.
//
// Note: the move is strictly logic-preserving; behavior matches the
// pre-extraction bridge byte-for-byte.

import { effectiveConstructionCost } from '../civBonusEffects';
import type {
  BuildableBuildingType,
  BuildingType,
  PlacementPreviewState,
  UnitComponent,
  UnitType,
} from '../types';
import type { GameWorld } from './pureHelpers';
import {
  buildingFootprint,
  clamp,
} from './pureHelpers';
import {
  resourcesMissing,
} from '../prototypeEconomyRules';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerCivilizationsCodec, playerResourcesCodec } from './bridgeStateSerialize';
import { removePendingUnitCommands } from './pendingCommandQuery';

export interface PlacementModeHolder {
  // Shared mutable slot. When non-null, the player is in "click a cell
  // to place this building" mode. Every non-placement interaction
  // clears it back to null from the bridge side; these ops flip it on
  // via `beginBuildingPlacement` and back to null on a successful
  // `confirmBuildingPlacement`.
  current: BuildableBuildingType | null;
}

export interface PlacementDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Phase 2D: playerResources migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  placementMode: PlacementModeHolder;
  // Collaborators. Thin wrappers around bridge-local helpers; the
  // factory defers to them so selection, match-running, and
  // occupancy / construction state stay centralized in createWorld.
  isMatchRunning: () => boolean;
  getSelectedHumanBuilderIds: () => number[];
  getBuildOptions: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
  isPlacementBlocked: (
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
  ) => boolean;
  enqueueRejection: (reason: string) => void;
  // Constants passed through as deps so tests could tweak them without
  // rewiring the module-level scenario-config imports here.
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
}

export interface PlacementOps {
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  confirmBuildingPlacement(x: number, y: number): boolean;
}

export function createPlacementOps(deps: PlacementDeps): PlacementOps {
  const {
    world,
    accessor,
    state,
    placementMode,
    isMatchRunning,
    getSelectedHumanBuilderIds,
    getBuildOptions,
    isPlacementBlocked,
    enqueueRejection,
    humanPlayerId,
    mapWidth,
    mapHeight,
  } = deps;

  function canBuild(unitId: number, buildingType: BuildableBuildingType): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.owner !== humanPlayerId) return false;
    return getBuildOptions(unit.owner, unit.unitType).includes(buildingType);
  }

  /** The first selected unit that can build `buildingType`, or null. */
  function builderForPendingType(buildingType: BuildableBuildingType): number | null {
    return getSelectedHumanBuilderIds().find((id) => canBuild(id, buildingType)) ?? null;
  }

  function getPlacementPreview(x: number, y: number): PlacementPreviewState | null {
    if (placementMode.current === null) {
      return null;
    }

    const builderId = builderForPendingType(placementMode.current);
    if (builderId === null) {
      return null;
    }

    const anchor = {
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
    };
    const footprint = buildingFootprint(placementMode.current);

    return {
      active: true,
      buildingType: placementMode.current,
      cellX: anchor.x,
      cellY: anchor.y,
      width: footprint.width,
      height: footprint.height,
      isValid: !isPlacementBlocked(
        anchor.x,
        anchor.y,
        footprint.width,
        footprint.height,
        placementMode.current,
      ),
    };
  }

  function beginBuildingPlacement(buildingType: BuildableBuildingType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    if (getSelectedHumanBuilderIds().length === 0) {
      enqueueRejection('Select a villager first.');
      return false;
    }
    if (builderForPendingType(buildingType) === null) {
      enqueueRejection(`None of the selected units can build a ${buildingType}.`);
      return false;
    }

    placementMode.current = buildingType;
    return true;
  }

  // Phase 1B (building.placeConfirm): bridge facade. Submits
  // `building.placeConfirm`; validator runs structural + placement +
  // affordability checks synchronously; handler delegates to
  // startConstructionDirect at start of next step's processCommands.
  // Translates validator codes to pre-1B toast strings.
  function confirmBuildingPlacement(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    if (placementMode.current === null) {
      return false;
    }
    const primaryId = builderForPendingType(placementMode.current);
    if (primaryId === null) {
      return false;
    }
    // Only builders that can put up THIS building help with it: a villager in a
    // mixed selection must not be enlisted onto a Fish Trap out at sea.
    const selectedVillagerIds = getSelectedHumanBuilderIds().filter(
      (id) => canBuild(id, placementMode.current as BuildableBuildingType),
    );

    const anchor = {
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
    };
    const buildingType = placementMode.current;
    const additionalBuilderIds = selectedVillagerIds.slice(1);
    const result = world.submitWithResult('building.placeConfirm', {
      builderId: primaryId,
      buildingType,
      position: anchor,
      ...(additionalBuilderIds.length > 0 ? { additionalBuilderIds } : {}),
    });
    if (result.accepted) {
      // Same-window supersession (auto-mine review iter-1 HIGH): an accepted
      // chain-build placement is an explicit PAID order for every listed
      // builder. Without eviction it raced the drained post-construction
      // autoGather intentions in the same processCommands pass and lost by
      // FIFO order — resources spent, foundation stranded, builders gone
      // mining. Placement now evicts pending system intentions exactly like
      // the move/context paths in humanInputOps.
      removePendingUnitCommands(state.pendingCommands, primaryId);
      for (const builderId of additionalBuilderIds) {
        removePendingUnitCommands(state.pendingCommands, builderId);
      }
      placementMode.current = null;
      return true;
    }
    // Translate validator codes to the pre-1B rejection toast strings.
    // agent-affordances A3: placement_blocked passes the validator's
    // actionable message (cause + cell + nearest-open-anchor) through to
    // the toast; the terse string stays as the fallback.
    if (result.code === 'placement_blocked') {
      enqueueRejection(result.message ?? 'Placement blocked.');
    } else if (result.code === 'insufficient_resources') {
      const stockpile = accessor.get(playerResourcesCodec).get(humanPlayerId);
      const missing = stockpile
        ? resourcesMissing(stockpile, effectiveConstructionCost(
            accessor.get(playerCivilizationsCodec).get(humanPlayerId), buildingType))
        : null;
      enqueueRejection(missing ? `Not enough ${missing}.` : 'Cannot build here.');
    } else {
      enqueueRejection('Cannot build here.');
    }
    return false;
  }

  return {
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  };
}
