// Human-input command surface. Wraps the bridge's lower-level command
// helpers (issueUnit*Command, issueSheepMoveCommand, ungarrisonBuilding)
// + Phase 1B commandified facades (queueTrainUnit / queueResearch /
// issueMarketAction submit through `world.submitWithResult`) with the
// match-running gate, the rally-point branch for selected own buildings,
// and the per-action affordability rejection messages.

import type { Position } from 'civ-engine';
import type {
  ActionType,
  BuildingComponent,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../types';
import { clamp, type GameWorld } from './pureHelpers';
import {
  researchCost,
  resourcesMissing,
  trainingCost,
} from '../prototypeEconomyRules';

export interface HumanInputOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  state: import('./bridgeState').BridgeState;
  placementMode: { current: import('../types').BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  getSelectedEntityId: () => number | null;
  getSelectedEntityIds: () => number[];
  getSelectedOwnedSheepIds: () => number[];
  getSelectedHumanUnitIds: () => number[];
  isEntityVisibleToHuman: (id: number) => boolean;
  enqueueRejection: (reason: string) => void;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  issueUnitContextCommand: (unitId: number, target: Position) => boolean;
  issueUnitContextCommandAtEntity: (unitId: number, targetEntityId: number) => boolean;
  issueSheepMoveCommand: (sheepId: number, target: Position) => boolean;
  ungarrisonBuilding: (buildingId: number) => boolean;
}

export interface HumanInputOps {
  issueMoveCommand(x: number, y: number): boolean;
  issueContextCommand(x: number, y: number): boolean;
  issueContextCommandAtEntityInternal(entityId: number): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueAction(actionType: ActionType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
}

export function createHumanInputOps(deps: HumanInputOpsDeps): HumanInputOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    state,
    placementMode,
    isMatchRunning,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    isEntityVisibleToHuman,
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
    ungarrisonBuilding,
  } = deps;
  const { playerResources, rallyPoints, constructionStates } = state;

  function issueMoveCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) return false;

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) return false;

    placementMode.current = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitMoveCommand(unitId, { x, y }) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, { x, y }) || didIssue;
    }
    return didIssue;
  }

  function issueContextCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId !== null) {
      const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
      if (building && building.owner === humanPlayerId && getSelectedEntityIds().length === 1) {
        const construction = constructionStates.get(selectedEntityId);
        if (construction && !construction.isComplete) return false;

        rallyPoints.set(selectedEntityId, {
          x: clamp(x, 0, mapWidth - 1),
          y: clamp(y, 0, mapHeight - 1),
        });
        placementMode.current = null;
        return true;
      }
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) return false;

    const target = {
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
    };
    placementMode.current = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitContextCommand(unitId, target) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, target) || didIssue;
    }
    return didIssue;
  }

  function issueContextCommandAtEntityInternal(entityId: number): boolean {
    if (!isMatchRunning()) return false;

    const targetPosition = world.getComponent<Position>(entityId, 'position');
    if (!targetPosition) return false;

    if (!isEntityVisibleToHuman(entityId)) {
      enqueueRejection('Target not visible.');
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (building && building.owner === humanPlayerId && getSelectedEntityIds().length === 1) {
      const construction = constructionStates.get(selectedEntityId);
      if (construction && !construction.isComplete) return false;

      rallyPoints.set(selectedEntityId, {
        x: clamp(targetPosition.x, 0, mapWidth - 1),
        y: clamp(targetPosition.y, 0, mapHeight - 1),
      });
      placementMode.current = null;
      return true;
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) return false;

    placementMode.current = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitContextCommandAtEntity(unitId, entityId) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, targetPosition) || didIssue;
    }
    return didIssue;
  }

  // Phase 1B (queue.train): bridge facade. Submits `queue.train`; the
  // validator runs synchronously and rejects with a code that the facade
  // translates to the same toast string the pre-1B body produced. The
  // handler runs at start of next step's processCommands and re-checks
  // affordability authoritatively (B2 fix).
  function queueTrainUnit(unitType: TrainableUnitType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    // The validator does not know `humanPlayerId`, so the ownership check
    // stays at HUD time. Pre-1B parity: a non-owned building selection
    // returns false silently (no toast).
    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;

    const result = world.submitWithResult('queue.train', {
      buildingId: selectedEntityId,
      unitType,
    });
    if (!result.accepted) {
      if (result.code === 'under_construction') {
        enqueueRejection('Building is still under construction.');
      } else if (result.code === 'insufficient_resources') {
        const stockpile = playerResources.get(humanPlayerId);
        const missing = stockpile
          ? resourcesMissing(stockpile, trainingCost(unitType))
          : null;
        enqueueRejection(missing ? `Not enough ${missing}.` : 'Cannot train that unit here.');
      } else {
        enqueueRejection('Cannot train that unit here.');
      }
      return false;
    }
    return true;
  }

  // Phase 1B (queue.research): bridge facade. Submits `queue.research`;
  // validator runs synchronously and rejects with a code that the facade
  // translates to the same toast string the pre-1B body produced.
  function queueResearch(technologyType: ResearchableTechnologyType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;

    const result = world.submitWithResult('queue.research', {
      buildingId: selectedEntityId,
      technologyType,
    });
    if (!result.accepted) {
      if (result.code === 'under_construction') {
        enqueueRejection('Building is still under construction.');
      } else if (result.code === 'insufficient_resources') {
        const stockpile = playerResources.get(humanPlayerId);
        const missing = stockpile
          ? resourcesMissing(stockpile, researchCost(technologyType))
          : null;
        enqueueRejection(missing ? `Not enough ${missing}.` : 'Cannot research that here.');
      } else {
        enqueueRejection('Cannot research that here.');
      }
      return false;
    }
    return true;
  }

  function issueAction(actionType: ActionType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;

    switch (actionType) {
      case 'ungarrison':
        return ungarrisonBuilding(selectedEntityId);
      default:
        return false;
    }
  }

  // Phase 1B (market.action): bridge facade. Submits `market.action`;
  // validator runs structural + affordability checks, handler re-checks
  // at start of next step's processCommands.
  //
  // Pre-1B parity: a non-market selection (or no selection) emits the
  // same 'Market trade rejected. ...' toast via the rejection queue.
  // Existing test `commandRejection.test.ts` "drains FIFO" exercises this
  // path with a no-selection click.
  function issueMarketAction(actionType: MarketActionType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    const building =
      selectedEntityId !== null
        ? world.getComponent<BuildingComponent>(selectedEntityId, 'building')
        : undefined;
    const construction =
      selectedEntityId !== null ? constructionStates.get(selectedEntityId) : undefined;
    const selectionIsMarket =
      !!building
      && building.owner === humanPlayerId
      && building.buildingType === 'market'
      && (!construction || construction.isComplete);
    if (!selectionIsMarket) {
      enqueueRejection('Market trade rejected. Check resources and selection.');
      return false;
    }

    const result = world.submitWithResult('market.action', {
      playerId: humanPlayerId,
      actionType,
    });
    if (!result.accepted) {
      enqueueRejection('Market trade rejected. Check resources and selection.');
      return false;
    }
    return true;
  }

  return {
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    issueMarketAction,
  };
}
