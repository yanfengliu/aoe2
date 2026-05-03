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

import type {
  BuildableBuildingType,
  PlacementPreviewState,
  UnitComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';
import {
  buildingFootprint,
  clamp,
} from './pureHelpers';
import {
  constructionCost,
  resourcesMissing,
} from '../prototypeEconomyRules';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerResourcesCodec } from './bridgeStateSerialize';

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
  getSelectedHumanVillagerIds: () => number[];
  isPlacementBlocked: (x: number, y: number, width: number, height: number) => boolean;
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
    placementMode,
    isMatchRunning,
    getSelectedHumanVillagerIds,
    isPlacementBlocked,
    enqueueRejection,
    humanPlayerId,
    mapWidth,
    mapHeight,
  } = deps;

  function getPlacementPreview(x: number, y: number): PlacementPreviewState | null {
    if (placementMode.current === null) {
      return null;
    }

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (selectedVillagerId === null) {
      return null;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== humanPlayerId || unit.unitType !== 'villager') {
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
      isValid: !isPlacementBlocked(anchor.x, anchor.y, footprint.width, footprint.height),
    };
  }

  function beginBuildingPlacement(buildingType: BuildableBuildingType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (selectedVillagerId === null) {
      enqueueRejection('Select a villager first.');
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== humanPlayerId || unit.unitType !== 'villager') {
      enqueueRejection('Only villagers can build.');
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

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (placementMode.current === null || selectedVillagerId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== humanPlayerId || unit.unitType !== 'villager') {
      return false;
    }

    const anchor = {
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
    };
    const buildingType = placementMode.current;
    const result = world.submitWithResult('building.placeConfirm', {
      builderId: selectedVillagerId,
      buildingType,
      position: anchor,
    });
    if (result.accepted) {
      placementMode.current = null;
      return true;
    }
    // Translate validator codes to the pre-1B rejection toast strings.
    if (result.code === 'placement_blocked') {
      enqueueRejection('Placement blocked.');
    } else if (result.code === 'insufficient_resources') {
      const stockpile = accessor.get(playerResourcesCodec).get(humanPlayerId);
      const missing = stockpile
        ? resourcesMissing(stockpile, constructionCost(buildingType))
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
