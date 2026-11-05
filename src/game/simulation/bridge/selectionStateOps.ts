// Selection-state assembly. Aggregates the slice of bridge state surfaced to
// the HUD when the human selects something: entity-kind / health / attack /
// armor / inventory / option menus / activity. Pure read-only over the
// bridge's side maps; the bridge owns the maps and passes them in. The lines
// about one entity (faction, civilization, inventory) are in
// `selectionEntityDetails.ts`, and the stance and formation rows in
// `selectionUnitOrders.ts`.

import {
  getSelectionArmor as selectionArmor,
  getSelectionAttack as selectionAttack,
  getSelectionPierceArmor as selectionPierceArmor,
} from './selectionCombatStats';
import type { Position } from 'civ-engine';
import { areAllied } from '../alliances';
import type {
  ActionType,
  BuildableBuildingType,
  BuildingComponent,
  MarketActionType,
  ResearchableTechnologyType,
  ResourceComponent,
  SelectionState,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../types';
import { cloneQueue, type GameWorld } from './pureHelpers';
import {
  constructionStatesCodec,
  monkCarriedRelicCodec,
  monkFaithCodec,
  monkTasksCodec,
  playerTeamsCodec,
  productionQueuesCodec,
  trebuchetPackStatesCodec,
  unitCommandsCodec,
} from './bridgeStateSerialize';
import { createEntityReadProbes } from './entityReadProbes';
import {
  computeUnitActivity,
  getBuildingActivity,
  getSelectionActivityBreakdown,
  type SelectionActivitySources,
} from '../selectionActivity';
import {
  emptySelectionState,
  selectionCiv,
  selectionFactionName,
  selectionInventory,
} from './selectionEntityDetails';
import { selectionUnitOrders } from './selectionUnitOrders';

export interface SelectionStateOpsDeps {
  world: GameWorld;
  humanPlayerId: number;
  // Phase 2D — playerCivilizations read via accessor.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  placementMode: { current: BuildableBuildingType | null };
  getSelectedEntityIds: () => number[];
  resolveSelectionTile: (selectedEntityId: number, position: Position) => Position;
  getSelectableEntitiesAtCell: (x: number, y: number) => Array<{ id: number }>;
  getCurrentEntityId: (ref: import('civ-engine').EntityRef | null) => number | null;
  clearSelection: () => void;
  getActionOptions: (
    owner: number,
    buildingType: BuildingComponent['buildingType'],
    buildingId: number,
  ) => ActionType[];
  getTrainOptions: (owner: number, buildingType: BuildingComponent['buildingType']) => TrainableUnitType[];
  getMarketOptions: (owner: number, buildingType: BuildingComponent['buildingType']) => MarketActionType[];
  getBuildOptions: (owner: number, unitType: UnitType) => BuildableBuildingType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingComponent['buildingType'],
  ) => ResearchableTechnologyType[];
  getVisibleResearchOptions: (
    owner: number,
    buildingType: BuildingComponent['buildingType'],
  ) => ResearchableTechnologyType[];
  /** Why each drawn command is blocked (bridge/commandAvailability). The
   *  option lists say WHICH commands the card draws; this says what is
   *  missing from the ones it draws unusable. */
  unavailableCommands: (
    query: import('./commandAvailability').CommandAvailabilityQuery,
  ) => import('../types').UnavailableCommand[];
  /** What each drawn command costs the human, from the seam the charge reads. */
  commandCosts: (
    query: import('./commandAvailability').CommandAvailabilityQuery,
  ) => import('../types').CommandCost[];
}

export interface SelectionStateOps {
  getEntityHealth(id: number): { currentHp: number; maxHp: number } | null;
  getWildlifeAlive(id: number): boolean | undefined;
  getUnitActiveVerb(id: number): import('../types').UnitActiveVerb | undefined;
  getSelectionState(): SelectionState;
}

export function createSelectionStateOps(deps: SelectionStateOpsDeps): SelectionStateOps {
  const {
    world,
    humanPlayerId,
    accessor,
    placementMode,
    getSelectedEntityIds,
    resolveSelectionTile,
    getSelectableEntitiesAtCell,
    getCurrentEntityId,
    clearSelection,
    getActionOptions,
    getTrainOptions,
    getMarketOptions,
    getBuildOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    unavailableCommands,
    commandCosts,
  } = deps;
  const { getEntityHealth, getWildlifeAlive, getUnitActiveVerb } =
    createEntityReadProbes({ world, accessor });

  function getSelectionHealth(id: number): SelectionState['health'] {
    const health = getEntityHealth(id);
    if (!health) {
      return null;
    }
    return { current: health.currentHp, max: health.maxHp };
  }

  const getSelectionAttack = (
    id: number,
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
  ) => selectionAttack(accessor, id, unit, building, resource);
  const getSelectionArmor = (
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
    id: number,
  ) => selectionArmor(accessor, unit, building, resource, id);
  const getSelectionPierceArmor = (
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
    id: number,
  ) => selectionPierceArmor(accessor, unit, building, resource, id);

  function getSelectionState(): SelectionState {
    const selectedEntityIds = getSelectedEntityIds();
    const selectedEntityId = selectedEntityIds[0] ?? null;
    if (selectedEntityId === null) {
      return emptySelectionState(placementMode.current);
    }

    const position = world.getComponent<Position>(selectedEntityId, 'position');
    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    const resource = world.getComponent<ResourceComponent>(selectedEntityId, 'resource');
    if (!position || (!unit && !building && !resource)) {
      clearSelection();
      return getSelectionState();
    }

    const selectionTile = resolveSelectionTile(selectedEntityId, position);
    const tileEntities =
      selectedEntityIds.length === 1
        ? getSelectableEntitiesAtCell(selectionTile.x, selectionTile.y)
        : [];
    const tileEntityIndex =
      selectedEntityIds.length === 1
        ? (() => {
          const index = tileEntities.findIndex((candidate) => candidate.id === selectedEntityId);
          return index >= 0 ? index + 1 : null;
        })()
        : null;

    const selectedUnits = selectedEntityIds
      .map((id) => ({
        id,
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter((entry): entry is { id: number; unit: UnitComponent } => entry.unit !== undefined);
    const ownedSheepCountInSelection = selectedEntityIds.filter((id) => {
      const r = world.getComponent<ResourceComponent>(id, 'resource');
      return (
        r !== undefined
        && r.resourceType === 'sheep'
        && r.owner === humanPlayerId
      );
    }).length;
    const nonSheepNonUnitMembers =
      selectedEntityIds.length - selectedUnits.length - ownedSheepCountInSelection;
    const selectedUnitsAndOwnedSheepCoverSelection = nonSheepNonUnitMembers === 0;
    const allSelectedUnitsAreHumanVillagers =
      selectedUnitsAndOwnedSheepCoverSelection
      && selectedUnits.length > 0
      && selectedUnits.every((entry) => entry.unit.owner === humanPlayerId && entry.unit.unitType === 'villager');
    // A group is named after a type only when EVERY member is of it, a sheep
    // included: three villagers and a sheep are four units, not four villagers
    // (work 142; DE shows a group by its count, "Learn to play", Lesson 5).
    const memberTypes = new Set(selectedEntityIds.map((id) => (
      world.getComponent<UnitComponent>(id, 'unit')?.unitType
      ?? world.getComponent<BuildingComponent>(id, 'building')?.buildingType
      ?? world.getComponent<ResourceComponent>(id, 'resource')?.resourceType
    )));
    const allSelectedUnitsShareType = memberTypes.size === 1;
    const trainOptions: TrainableUnitType[] =
      building?.owner === humanPlayerId
        ? getTrainOptions(building.owner, building.buildingType)
        : [];
    const actionOptions: ActionType[] =
      building?.owner === humanPlayerId
        ? getActionOptions(building.owner, building.buildingType, selectedEntityId)
        : [];
    const marketOptions: MarketActionType[] =
      building?.owner === humanPlayerId
        ? getMarketOptions(building.owner, building.buildingType)
        : [];
    // M6 control: stances apply to the player's OWN units. The shared stance
    // is null for a mixed selection, so the HUD highlights nothing rather
    // than lying about one of them.
    const ownedSelectedUnits = selectedUnits.filter(
      (entry) => entry.unit.owner === humanPlayerId,
    );
    const { stanceOptions, stance, formationOptions, formation } =
      selectionUnitOrders(accessor, ownedSelectedUnits);
    const buildOptions: BuildableBuildingType[] =
      allSelectedUnitsAreHumanVillagers
        ? getBuildOptions(humanPlayerId, 'villager')
        : selectedEntityIds.length === 1 && unit && unit.owner === humanPlayerId
        ? getBuildOptions(unit.owner, unit.unitType)
        : [];
    const researchOptions: ResearchableTechnologyType[] =
      building?.owner === humanPlayerId
        ? getResearchOptions(building.owner, building.buildingType)
        : [];
    const visibleResearchOptions: ResearchableTechnologyType[] =
      building?.owner === humanPlayerId
        ? getVisibleResearchOptions(building.owner, building.buildingType)
        : [];
    // Only the HUMAN's own commands are ever drawn as buttons, so an enemy
    // building's card asks for nothing and gets nothing.
    const commandQuery = {
      owner: humanPlayerId,
      buildingType: building?.owner === humanPlayerId ? building.buildingType : null,
      visibleResearchOptions, researchOptions, trainOptions, marketOptions, buildOptions,
    };
    const selectedKind = unit ? 'unit' : building ? 'building' : 'resource';
    const owner = unit?.owner ?? building?.owner ?? resource?.owner ?? null;

    const activitySources: SelectionActivitySources = {
      world,
      humanPlayerId,
      unitCommands: accessor.get(unitCommandsCodec),
      monkTasks: accessor.get(monkTasksCodec),
      monkFaith: accessor.get(monkFaithCodec),
      monkCarriedRelic: accessor.get(monkCarriedRelicCodec),
      trebuchetPackStates: accessor.get(trebuchetPackStatesCodec),
      productionQueues: accessor.get(productionQueuesCodec),
      constructionStates: accessor.get(constructionStatesCodec),
      getCurrentEntityId,
    };

    return {
      selectedEntityId,
      selectedEntityIds,
      selectedCount: selectedEntityIds.length,
      selectedKind,
      selectedEntityType:
        selectedEntityIds.length > 1 && !allSelectedUnitsShareType
          ? null
          : unit?.unitType ?? building?.buildingType ?? resource?.resourceType ?? null,
      owner,
      health: selectedEntityIds.length === 1 ? getSelectionHealth(selectedEntityId) : null,
      attack: selectedEntityIds.length === 1 ? getSelectionAttack(selectedEntityId, unit, building, resource) : null,
      armor: selectedEntityIds.length === 1 ? getSelectionArmor(unit, building, resource, selectedEntityId) : null,
      pierceArmor:
        selectedEntityIds.length === 1
          ? getSelectionPierceArmor(unit, building, resource, selectedEntityId)
          : null,
      faction:
        selectedEntityIds.length === 1
          ? selectionFactionName(owner, resource ?? null, (other) =>
            areAllied(accessor.get(playerTeamsCodec), humanPlayerId, other))
          : null,
      civ: selectedEntityIds.length === 1 ? selectionCiv(accessor, owner, selectedKind) : null,
      inventory:
        selectedEntityIds.length === 1
          ? selectionInventory(world, accessor, selectedEntityId, unit, building, resource)
          : null,
      activity:
        selectedEntityIds.length === 1 && unit && unit.owner === humanPlayerId
          ? computeUnitActivity(activitySources, selectedEntityId, unit)
          : selectedEntityIds.length === 1 && building && building.owner === humanPlayerId
          ? getBuildingActivity(activitySources, selectedEntityId)
          : null,
      activityBreakdown:
        selectedEntityIds.length > 1 ? getSelectionActivityBreakdown(activitySources, selectedEntityIds) : null,
      x: position.x,
      y: position.y,
      tileX: selectionTile.x,
      tileY: selectionTile.y,
      tileEntityIndex,
      tileEntityCount: tileEntities.length,
      resourceAmount: resource?.amount ?? null,
      resourceMaxAmount: resource?.maxAmount ?? null,
      actionOptions,
      stanceOptions,
      formationOptions,
      formation,
      stance,
      buildOptions,
      marketOptions,
      trainOptions,
      visibleResearchOptions,
      researchOptions,
      unavailableCommands: unavailableCommands(commandQuery),
      // The price every drawn command quotes, from the seam its charge reads.
      commandCosts: commandCosts(commandQuery),
      queue: building
        ? cloneQueue(accessor.get(productionQueuesCodec).get(selectedEntityId) ?? [])
        : [],
      placementMode: placementMode.current,
    };
  }

  return { getEntityHealth, getWildlifeAlive, getUnitActiveVerb, getSelectionState };
}
