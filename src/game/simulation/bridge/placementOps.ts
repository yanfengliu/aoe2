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

import type { Position } from 'civ-engine';

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
  placementMode: PlacementModeHolder;
  // Collaborators. Thin wrappers around bridge-local helpers; the
  // factory defers to them so selection, match-running, and
  // occupancy / construction state stay centralized in createWorld.
  isMatchRunning: () => boolean;
  getSelectedHumanVillagerIds: () => number[];
  isPlacementBlocked: (x: number, y: number, width: number, height: number) => boolean;
  startConstruction: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
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
    state,
    placementMode,
    isMatchRunning,
    getSelectedHumanVillagerIds,
    isPlacementBlocked,
    startConstruction,
    enqueueRejection,
    humanPlayerId,
    mapWidth,
    mapHeight,
  } = deps;
  const { playerResources } = state;

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
    const didStartConstruction = startConstruction(selectedVillagerId, buildingType, anchor);
    if (didStartConstruction) {
      placementMode.current = null;
    } else {
      // Slice 11: report the most likely reason. Placement blocked by
      // terrain / units / existing buildings is the most common case; fall
      // back to resource shortage otherwise.
      const footprint = buildingFootprint(buildingType);
      if (isPlacementBlocked(anchor.x, anchor.y, footprint.width, footprint.height)) {
        enqueueRejection('Placement blocked.');
      } else {
        const stockpile = playerResources.get(humanPlayerId);
        if (stockpile) {
          const missing = resourcesMissing(stockpile, constructionCost(buildingType));
          if (missing) {
            enqueueRejection(`Not enough ${missing}.`);
          } else {
            enqueueRejection('Cannot build here.');
          }
        } else {
          enqueueRejection('Cannot build here.');
        }
      }
    }
    return didStartConstruction;
  }

  return {
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  };
}
