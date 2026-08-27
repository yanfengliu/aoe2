// Human-input command surface. Wraps the bridge's lower-level command
// helpers (issueUnit*Command, issueSheepMoveCommand, ungarrisonBuilding)
// + Phase 1B commandified facades (queueTrainUnit / queueResearch /
// issueMarketAction submit through `world.submitWithResult`) with the
// match-running gate, the rally-point branch for selected own buildings,
// and the per-action affordability rejection messages.

import type { Position } from 'civ-engine';
import type { UnitStance } from '../unitStance';
import type { UnitFormation } from '../unitFormation';
import { createFormationPlanner } from './formationPlanning';
import { unitFormationsCodec } from './bridgeStateSerialize';
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
import { createIdleVillagerOps } from './idleVillagerOps';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { removePendingUnitCommands } from './pendingCommandQuery';
import {
  constructionStatesCodec,
  playerResourcesCodec,
} from './bridgeStateSerialize';

export interface HumanInputOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  state: import('./bridgeState').BridgeState;
  // Phase 2D: constructionStates migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  placementMode: { current: import('../types').BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  getSelectedEntityId: () => number | null;
  getSelectedEntityIds: () => number[];
  selectUnitsByIds: (ids: number[]) => boolean;
  isGarrisonedUnit: (id: number) => boolean;
  getSelectedOwnedSheepIds: () => number[];
  getSelectedHumanUnitIds: () => number[];
  isEntityVisibleToHuman: (id: number) => boolean;
  enqueueRejection: (reason: string) => void;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  issueUnitAttackMoveCommand: (unitId: number, target: Position) => boolean;
  issueUnitPatrolCommand: (unitId: number, target: Position) => boolean;
  issueUnitContextCommand: (unitId: number, target: Position, garrison?: boolean) => boolean;
  issueUnitContextCommandAtEntity: (unitId: number, targetEntityId: number, garrison?: boolean, forceAttack?: boolean) => boolean;
  issueSheepMoveCommand: (sheepId: number, target: Position) => boolean;
  // Spec §12.7 eager pre-reservation: when N units are commanded together to
  // a single target, allocate distinct cells via spiral fill so multiple
  // arrivals don't pile into the same cell and detour through lazy redirect.
  allocateGroupMoveTargets: (
    unitIds: ReadonlyArray<number>,
    targetCenter: Position,
    /** M6 formations (spec §9.5): one preferred cell per unit, same order. */
    preferredCells?: ReadonlyArray<Position> | null,
  ) => Position[];
}

export interface HumanInputOps {
  countIdleVillagers(): number;
  selectNextIdleVillager(): boolean;
  issueMoveCommand(x: number, y: number, options?: { queue?: boolean }): boolean;
  issueContextCommand(x: number, y: number, garrison?: boolean): boolean;
  issueContextCommandAtEntityInternal(entityId: number, garrison?: boolean, forceAttack?: boolean): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueAction(actionType: ActionType): boolean;
  setSelectionStance(stance: UnitStance): boolean;
  setSelectionFormation(formation: UnitFormation): boolean;
  issueAttackMoveCommand(x: number, y: number): boolean;
  issueAttackGroundCommand(x: number, y: number): boolean;
  issuePatrolCommand(x: number, y: number): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
}

export function createHumanInputOps(deps: HumanInputOpsDeps): HumanInputOps {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    state,
    accessor,
    placementMode,
    isMatchRunning,
    getSelectedEntityId,
    getSelectedEntityIds,
    selectUnitsByIds,
    isGarrisonedUnit,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    isEntityVisibleToHuman,
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitAttackMoveCommand,
    issueUnitPatrolCommand,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
    allocateGroupMoveTargets,
  } = deps;

  // M3: an ACCEPTED explicit human command for a unit evicts any stale
  // auto-aggression intention queued for it, so the FIFO drain can't run the
  // command then clobber it with the pending attack in the same step ("unit
  // won't retreat"). Only drained ENGINE commands are recorded and replay
  // clears pendingCommands each tick, so this is determinism/replay-safe.
  function supersedeAutoAggression(unitId: number, accepted: boolean): boolean {
    if (accepted) removePendingUnitCommands(state.pendingCommands, unitId);
    return accepted;
  }

  function issueMoveCommand(x: number, y: number, options?: { queue?: boolean }): boolean {
    if (!isMatchRunning()) return false;

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) return false;

    placementMode.current = null;
    if (options?.queue) {
      // The append rides the RECORDED unit.move stream (queue flag): FIFO
      // processing lands the plain click first; replays reproduce the chain.
      const target: Position = { x: clamp(x, 0, mapWidth - 1), y: clamp(y, 0, mapHeight - 1) };
      let didQueue = false;
      for (const id of selectedUnitIds) {
        const accepted = world.submitWithResult('unit.move', {
          unitId: id, target, queue: true,
        }).accepted;
        didQueue = supersedeAutoAggression(id, accepted) || didQueue;
      }
      return didQueue;
    }
    let didIssue = false;
    if (selectedUnitIds.length === 1) {
      // Spec §12.7 single-unit move: issue the move directly. Pathfinding
      // handles blocked / resource targets ("stop at closest reachable
      // cell"); the move-arrival handler applies the lazy-redirect rule
      // when the unit lands in a cell with no free slot.
      const id = selectedUnitIds[0]!;
      didIssue = supersedeAutoAggression(id, issueUnitMoveCommand(id, { x, y })) || didIssue;
    } else if (selectedUnitIds.length > 1) {
      // Spec §12.7 group pre-reservation: one distinct spiral-fill cell per
      // unit, so a commanded band never piles into one cell and lazy-redirects.
      // The spiral skips whole-cell-blocked tiles; resource/building targets
      // route through `issueContextCommand`, never this path.
      const targetCenter: Position = {
        x: clamp(x, 0, mapWidth - 1),
        y: clamp(y, 0, mapHeight - 1),
      };
      const { orderedIds, preferredCells } = planFormation(selectedUnitIds, targetCenter);
      const allocations = allocateGroupMoveTargets(orderedIds, targetCenter, preferredCells);
      for (let i = 0; i < orderedIds.length; i += 1) {
        const target = allocations[i] ?? targetCenter;
        const id = orderedIds[i]!;
        didIssue = supersedeAutoAggression(id, issueUnitMoveCommand(id, target)) || didIssue;
      }
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, { x, y }) || didIssue;
    }
    return didIssue;
  }

  function issueContextCommand(x: number, y: number, garrison = false): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId !== null) {
      const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
      if (building && building.owner === humanPlayerId && getSelectedEntityIds().length === 1) {
        const construction = accessor.get(constructionStatesCodec).get(selectedEntityId);
        if (construction && !construction.isComplete) return false;

        // Phase 1B (building.setRallyPoint): submit instead of mutating
        // synchronously. Validator does the structural check; handler
        // applies the rallyPoints.set at start of next step.
        const result = world.submitWithResult('building.setRallyPoint', {
          buildingId: selectedEntityId,
          target: {
            x: clamp(x, 0, mapWidth - 1),
            y: clamp(y, 0, mapHeight - 1),
          },
        });
        if (result.accepted) {
          placementMode.current = null;
          return true;
        }
        return false;
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
      didIssue = supersedeAutoAggression(unitId, issueUnitContextCommand(unitId, target, garrison)) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, target) || didIssue;
    }
    return didIssue;
  }

  function issueContextCommandAtEntityInternal(entityId: number, garrison = false, forceAttack = false): boolean {
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
      const construction = accessor.get(constructionStatesCodec).get(selectedEntityId);
      if (construction && !construction.isComplete) return false;

      // Phase 1B (building.setRallyPoint): same shape as the cell-based
      // rally-point branch in issueContextCommand.
      const result = world.submitWithResult('building.setRallyPoint', {
        buildingId: selectedEntityId,
        target: {
          x: clamp(targetPosition.x, 0, mapWidth - 1),
          y: clamp(targetPosition.y, 0, mapHeight - 1),
        },
      });
      if (result.accepted) {
        placementMode.current = null;
        return true;
      }
      return false;
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) return false;

    placementMode.current = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue =
        supersedeAutoAggression(unitId, issueUnitContextCommandAtEntity(unitId, entityId, garrison, forceAttack)) || didIssue;
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
        const stockpile = accessor.get(playerResourcesCodec).get(humanPlayerId);
        // Base cost is fine here — this only names WHICH resource is short for
        // the toast (the authoritative gate already rejected using the effective
        // cost). Byte-identical for a non-Goths human; a Goths human still sees
        // the right resource named, just computed from the pre-discount amount.
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
        const stockpile = accessor.get(playerResourcesCodec).get(humanPlayerId);
        const missing = stockpile
          ? resourcesMissing(stockpile, researchCost(technologyType))
          : null;
        enqueueRejection(missing ? `Not enough ${missing}.` : 'Cannot research that here.');
      } else {
        // agent-affordances A1: pass the validator's actionable reason
        // (e.g. the age-up prerequisite count) through to the toast.
        enqueueRejection(result.message ?? 'Cannot research that here.');
      }
      return false;
    }
    return true;
  }

  // Phase 1B (building.action): bridge facade. HUD-side selection +
  // ownership guards (validator can't see humanPlayerId), then submits
  // building.action via submitWithResult. Handler delegates to the
  // action-specific direct helper.
  // M6 control: "go here and fight what you meet" for the whole selection.
  // Group targets are spiral-allocated exactly like a plain move, so a band
  // of units spreads out at the destination instead of stacking.
  // M6 control: "pace this line and fight what you meet". Unlike an
  // attack-move the ROUTE outlives the walk, so the unit keeps going after a
  // fight — see patrolRoute.ts.
  // Patrol and attack-move share the formation-planned group shape; attack-
  // ground converges every unit on the SAME cell (converging fire is the
  // point) and lets the validator skip ineligible units in a mixed selection.
  function issueFormationOrderToSelection(
    x: number,
    y: number,
    perUnit: (id: number, target: Position) => boolean,
  ): boolean {
    if (!isMatchRunning()) return false;
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (selectedUnitIds.length === 0) return false;
    const targetCenter: Position = {
      x: clamp(x, 0, mapWidth - 1),
      y: clamp(y, 0, mapHeight - 1),
    };
    const { orderedIds, preferredCells } = planFormation(selectedUnitIds, targetCenter);
    const allocations = allocateGroupMoveTargets(orderedIds, targetCenter, preferredCells);
    let didIssue = false;
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i]!;
      const target = allocations[i] ?? targetCenter;
      didIssue = supersedeAutoAggression(id, perUnit(id, target)) || didIssue;
    }
    return didIssue;
  }

  const issuePatrolCommand = (x: number, y: number): boolean =>
    issueFormationOrderToSelection(x, y, issueUnitPatrolCommand);

  const issueAttackMoveCommand = (x: number, y: number): boolean =>
    issueFormationOrderToSelection(x, y, issueUnitAttackMoveCommand);

  const issueAttackGroundCommand = (x: number, y: number): boolean =>
    issueFormationOrderToSelection(x, y, (id) =>
      world.submitWithResult('unit.attackGround', {
        unitId: id,
        target: { x: clamp(x, 0, mapWidth - 1), y: clamp(y, 0, mapHeight - 1) },
      }).accepted);

  const planFormation = createFormationPlanner({
    world,
    formationOf: (unitId) => accessor.get(unitFormationsCodec).get(unitId),
  });

  // M6 control: set the stance of every owned unit in the selection. Routes
  // through the recorded command channel so a replay reproduces the change.
  function setSelectionStance(stance: UnitStance): boolean {
    if (!isMatchRunning()) return false;
    const unitIds = getSelectedHumanUnitIds();
    if (unitIds.length === 0) return false;
    return world.submitWithResult('unit.stance', { unitIds, stance }).accepted;
  }

  // M6 control: set the formation of every owned unit in the selection. Same
  // recorded-command path as stance, for the same reason — it changes where
  // the unit stands on later orders, so a replay must see it.
  function setSelectionFormation(formation: UnitFormation): boolean {
    if (!isMatchRunning()) return false;
    const unitIds = getSelectedHumanUnitIds();
    if (unitIds.length === 0) return false;
    return world.submitWithResult('unit.formation', { unitIds, formation }).accepted;
  }

  function issueAction(actionType: ActionType): boolean {
    if (!isMatchRunning()) return false;

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) return false;

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== humanPlayerId) return false;
    const supported: ActionType[] = ['ungarrison', 'ring-town-bell', 'back-to-work'];
    if (!supported.includes(actionType)) return false;
    return world.submitWithResult('building.action', {
      buildingId: selectedEntityId,
      actionType,
    }).accepted;
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
      selectedEntityId !== null
        ? accessor.get(constructionStatesCodec).get(selectedEntityId)
        : undefined;
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

  const { countIdleVillagers, selectNextIdleVillager } = createIdleVillagerOps({
    world, accessor, humanPlayerId, isGarrisonedUnit, selectUnitsByIds,
  });

  return {
    countIdleVillagers,
    selectNextIdleVillager,
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    setSelectionStance,
    setSelectionFormation,
    issueAttackMoveCommand,
    issueAttackGroundCommand,
    issuePatrolCommand,
    issueMarketAction,
  };
}
