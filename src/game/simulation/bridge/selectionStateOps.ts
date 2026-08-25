// Selection-state assembly. Aggregates the slice of bridge state surfaced to
// the HUD when the human selects something: entity-kind / health / attack /
// armor / inventory / option menus / activity. Pure read-only over the
// bridge's side maps; the bridge owns the maps and passes them in.

import {
  getSelectionArmor as selectionArmor,
  getSelectionAttack as selectionAttack,
  getSelectionPierceArmor as selectionPierceArmor,
} from './selectionCombatStats';
import type { Position } from 'civ-engine';
import { UNIT_STANCES, defaultStanceFor, type UnitStance } from '../unitStance';
import {
  DEFAULT_FORMATION,
  UNIT_FORMATIONS,
  type UnitFormation,
} from '../unitFormation';
import { unitFormationsCodec, unitStancesCodec } from './bridgeStateSerialize';
import type {
  ActionType,
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  MarketActionType,
  ResearchableTechnologyType,
  ResourceComponent,
  SelectionState,
  TrainableUnitType,
  UnitComponent,
  UnitType,
} from '../types';
import {
  cloneQueue,
  defaultCivilizationName,
  economyResourceLabel,
  factionName,
  inventoryResourceName,
  type GameWorld,
} from './pureHelpers';
import {
  buildingGarrisonCapacity,
} from '../prototypeBuildingRules';
import { civGarrisonCapacityMultiplier, civHouseGarrisonCapacity } from '../civBuildingBonuses';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  monkCarriedRelicCodec,
  monkFaithCodec,
  monkTasksCodec,
  playerCivilizationsCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
  trebuchetPackStatesCodec,
  unitCommandsCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';
import { transportCapacity } from '../transportShip';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import {
  computeUnitActivity,
  getBuildingActivity,
  getSelectionActivityBreakdown,
  type SelectionActivitySources,
} from '../selectionActivity';

const FACTIONLESS_NATURAL_RESOURCES: ReadonlySet<ResourceComponent['resourceType']> = new Set([
  'berry-bush',
  'gold-mine',
  'stone-mine',
  'tree',
  'relic',
]);

function selectionFactionName(
  owner: number | null,
  resource: ResourceComponent | null,
): string | null {
  return resource && FACTIONLESS_NATURAL_RESOURCES.has(resource.resourceType)
    ? null
    : factionName(owner);
}

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
}

export interface SelectionStateOps {
  getEntityHealth(id: number): { currentHp: number; maxHp: number } | null;
  getWildlifeAlive(id: number): boolean | undefined;
  getUnitActiveVerb(id: number): 'building' | undefined;
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
  } = deps;
  function getEntityHealth(id: number): { currentHp: number; maxHp: number } | null {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const combat = accessor.get(combatStatesCodec).get(id);
      if (!combat) {
        return null;
      }
      return { currentHp: combat.currentHp, maxHp: combat.maxHp };
    }

    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building) {
      const health = accessor.get(buildingHealthStatesCodec).get(id);
      if (!health) {
        return null;
      }
      return { currentHp: health.currentHp, maxHp: health.maxHp };
    }

    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (resource) {
      const wildlife = accessor.get(wildlifeStatesCodec).get(id);
      if (!wildlife || !wildlife.isAlive) {
        return null;
      }
      return { currentHp: wildlife.currentHp, maxHp: wildlife.maxHp };
    }

    return null;
  }

  // Spec §14.5 carcass: the renderer needs wildlife LIFE state explicitly.
  // `getEntityHealth` deliberately returns null for a corpse (no HP bar), so
  // it cannot answer "is this a carcass or a rock?" — this can.
  function getWildlifeAlive(id: number): boolean | undefined {
    if (!world.getComponent<ResourceComponent>(id, 'resource')) return undefined;
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive;
  }

  // Spec §14.5 construction animation: the smallest honest carrier for "this
  // villager is building" — the SAME `unitCommands` predicate the HUD's
  // selection panel reads (computeUnitActivity), so nothing new is recorded
  // or persisted and replay is identical by construction. The renderer gates
  // the work loop on stationarity, so this stays true through the approach.
  function getUnitActiveVerb(id: number): 'building' | undefined {
    return accessor.get(unitCommandsCodec).get(id)?.type === 'build' ? 'building' : undefined;
  }

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

  function getSelectionCiv(
    owner: number | null,
    kind: SelectionState['selectedKind'],
  ): string | null {
    if (kind === 'resource' || owner === null) {
      return null;
    }
    return accessor.get(playerCivilizationsCodec).get(owner) ?? defaultCivilizationName(owner);
  }

  function getSelectionInventory(
    id: number,
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
  ): string | null {
    if (resource) {
      if (resource.resourceType === 'wolf') {
        return null;
      }
      if (resource.resourceType === 'relic') {
        return 'Deposit in a Monastery for gold';
      }
      return `${resource.amount} / ${resource.maxAmount} ${inventoryResourceName(resource.resourceType)} remaining`;
    }

    if (unit) {
      // A transport's cargo is its inventory. Without this the number is
      // invisible, which matters more now that Careening and Dry Dock raise the
      // capacity: a player cannot see what a technology bought them.
      if (unit.unitType === 'transport-ship') {
        const aboard = accessor.get(garrisonedByBuildingCodec).get(id)?.length ?? 0;
        const techs = accessor.get(researchedTechnologiesCodec).get(unit.owner) ?? EMPTY_TECH_SET;
        return `${aboard} / ${transportCapacity(techs)} aboard`;
      }
      const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
      if (!gatherer) {
        return null;
      }
      if (!gatherer.carriedResource || gatherer.carriedAmount <= 0) {
        return 'Empty';
      }
      return `${gatherer.carriedAmount} ${economyResourceLabel(gatherer.carriedResource)}`;
    }

    if (building) {
      // Same Teuton 2x-tower multiplier the entry check applies, so the HUD
      // number is the number the garrison command actually enforces.
      const capacity = (buildingGarrisonCapacity(building.buildingType)
        + civHouseGarrisonCapacity(
          accessor.get(playerCivilizationsCodec).get(building.owner),
          building.buildingType,
        ))
        * civGarrisonCapacityMultiplier(
          accessor.get(playerCivilizationsCodec).get(building.owner),
          building.buildingType,
        );
      if (capacity <= 0) {
        return null;
      }
      return `${accessor.get(garrisonedByBuildingCodec).get(id)?.length ?? 0} / ${capacity} garrisoned`;
    }

    return null;
  }

  function getSelectionState(): SelectionState {
    const selectedEntityIds = getSelectedEntityIds();
    const selectedEntityId = selectedEntityIds[0] ?? null;
    if (selectedEntityId === null) {
      return {
        selectedEntityId: null,
        selectedEntityIds: [],
        selectedCount: 0,
        selectedKind: null,
        selectedEntityType: null,
        owner: null,
        health: null,
        attack: null,
        armor: null,
        pierceArmor: null,
        faction: null,
        civ: null,
        inventory: null,
        activity: null,
        activityBreakdown: null,
        x: null,
        y: null,
        tileX: null,
        tileY: null,
        tileEntityIndex: null,
        tileEntityCount: 0,
        resourceAmount: null,
        resourceMaxAmount: null,
        actionOptions: [],
        stanceOptions: [],
        formationOptions: [],
        formation: null,
        stance: null,
        buildOptions: [],
        marketOptions: [],
        trainOptions: [],
        visibleResearchOptions: [],
        researchOptions: [],
        queue: [],
        placementMode: placementMode.current,
      };
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
    const allSelectedUnitsShareType =
      selectedUnitsAndOwnedSheepCoverSelection
      && selectedUnits.length > 0
      && selectedUnits.every((entry) => entry.unit.unitType === selectedUnits[0].unit.unitType);
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
    const stanceOptions: UnitStance[] = ownedSelectedUnits.length > 0 ? [...UNIT_STANCES] : [];
    const stancesInSelection = new Set(ownedSelectedUnits.map((entry) => (
      accessor.get(unitStancesCodec).get(entry.id) ?? defaultStanceFor(entry.unit.unitType)
    )));
    const stance = stancesInSelection.size === 1
      ? [...stancesInSelection][0] ?? null
      : null;
    // Same shape for formations: a single value when the whole selection
    // agrees, null when it does not, so the panel can show "mixed" honestly.
    const formationOptions: UnitFormation[] = ownedSelectedUnits.length > 0
      ? [...UNIT_FORMATIONS]
      : [];
    const formationsInSelection = new Set(ownedSelectedUnits.map((entry) => (
      accessor.get(unitFormationsCodec).get(entry.id) ?? DEFAULT_FORMATION
    )));
    const formation = formationsInSelection.size === 1
      ? [...formationsInSelection][0] ?? null
      : null;
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
          ? selectionFactionName(owner, resource ?? null)
          : null,
      civ: selectedEntityIds.length === 1 ? getSelectionCiv(owner, selectedKind) : null,
      inventory:
        selectedEntityIds.length === 1
          ? getSelectionInventory(selectedEntityId, unit, building, resource)
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
      queue: building
        ? cloneQueue(accessor.get(productionQueuesCodec).get(selectedEntityId) ?? [])
        : [],
      placementMode: placementMode.current,
    };
  }

  return { getEntityHealth, getWildlifeAlive, getUnitActiveVerb, getSelectionState };
}
