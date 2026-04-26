// Human-input command surface. Wraps the bridge's lower-level command
// helpers (issueUnit*Command, issueSheepMoveCommand, enqueueTraining /
// enqueueResearch / executeMarketAction / ungarrisonBuilding) with the
// match-running gate, the rally-point branch for selected own buildings,
// and the per-action affordability rejection messages. Mirrors the pre-
// extraction inline implementation byte-for-byte.

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
  enqueueTraining: (buildingId: number, unitType: TrainableUnitType) => boolean;
  enqueueResearch: (buildingId: number, technologyType: ResearchableTechnologyType) => boolean;
  executeMarketAction: (actionType: MarketActionType) => boolean;
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
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
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

  function queueTrainUnit(unitType: TrainableUnitType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;
    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) {
      enqueueRejection('Building is still under construction.');
      return false;
    }

    const didEnqueue = enqueueTraining(selectedEntityId, unitType);
    if (!didEnqueue) {
      const stockpile = playerResources.get(humanPlayerId);
      if (stockpile) {
        const missing = resourcesMissing(stockpile, trainingCost(unitType));
        if (missing) {
          enqueueRejection(`Not enough ${missing}.`);
          return false;
        }
      }
      enqueueRejection('Cannot train that unit here.');
    }
    return didEnqueue;
  }

  function queueResearch(technologyType: ResearchableTechnologyType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;

    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) {
      enqueueRejection('Building is still under construction.');
      return false;
    }

    const didEnqueue = enqueueResearch(selectedEntityId, technologyType);
    if (!didEnqueue) {
      const stockpile = playerResources.get(humanPlayerId);
      if (stockpile) {
        const missing = resourcesMissing(stockpile, researchCost(technologyType));
        if (missing) {
          enqueueRejection(`Not enough ${missing}.`);
          return false;
        }
      }
      enqueueRejection('Cannot research that here.');
    }
    return didEnqueue;
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

  function issueMarketAction(actionType: MarketActionType): boolean {
    if (!isMatchRunning()) return false;

    const didTrade = executeMarketAction(actionType);
    if (!didTrade) {
      enqueueRejection('Market trade rejected. Check resources and selection.');
    }
    return didTrade;
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
