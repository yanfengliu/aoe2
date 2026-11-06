// The selection panel's lines about ONE selected entity: whose it is (faction
// and civilization) and what it holds (inventory), plus the state of an empty
// selection. Split by role from `selectionStateOps.ts` (work 142 M2b-2), which
// assembles the whole state; pure reads over the bridge's side maps.

import type {
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  ResourceComponent,
  SelectionState,
  UnitComponent,
} from '../types';
import {
  defaultCivilizationName,
  economyResourceLabel,
  factionName,
  inventoryResourceName,
  type GameWorld,
} from './pureHelpers';
import { buildingGarrisonCapacity } from '../prototypeBuildingRules';
import { civGarrisonCapacityBonus, civHouseGarrisonCapacity } from '../civBuildingBonuses';
import {
  garrisonedByBuildingCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { transportCapacity } from '../transportShip';
import { EMPTY_TECH_SET } from '../economyTechEffects';

const FACTIONLESS_NATURAL_RESOURCES: ReadonlySet<ResourceComponent['resourceType']> = new Set([
  'berry-bush',
  'gold-mine',
  'stone-mine',
  'tree',
  'relic',
]);

// An ally's unit or building reads "Ally", not "Enemy": shared sight puts
// the ally's whole base on screen, one click away (register 2026-09-24).
export function selectionFactionName(
  owner: number | null,
  resource: ResourceComponent | null,
  isAlly: (owner: number) => boolean,
): string | null {
  if (resource && FACTIONLESS_NATURAL_RESOURCES.has(resource.resourceType)) return null;
  const faction = factionName(owner);
  return faction === 'Enemy' && owner !== null && isAlly(owner) ? 'Ally' : faction;
}

export function selectionCiv(
  accessor: BridgeStateAccessor,
  owner: number | null,
  kind: SelectionState['selectedKind'],
): string | null {
  if (kind === 'resource' || owner === null) {
    return null;
  }
  return accessor.get(playerCivilizationsCodec).get(owner) ?? defaultCivilizationName(owner);
}

export function selectionInventory(
  world: GameWorld,
  accessor: BridgeStateAccessor,
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
    // The entry check's own sum (garrisonOps): table capacity plus the flat
    // civ adds — Khmer houses 5, Teuton Town Centers +10 and towers +5
    // (v0.3.144) — so the HUD shows the number the garrison command enforces.
    const capacity = buildingGarrisonCapacity(building.buildingType)
      + civHouseGarrisonCapacity(
        accessor.get(playerCivilizationsCodec).get(building.owner),
        building.buildingType,
      )
      + civGarrisonCapacityBonus(
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

/** The state of an empty selection: nothing selected, nothing offered. */
export function emptySelectionState(placementMode: BuildableBuildingType | null): SelectionState {
  return {
    selectedEntityId: null,
    selectedEntityIds: [],
    selectedCount: 0,
    selectedKind: null,
    selectedEntityType: null,
    selectedEntityTypes: [],
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
    unavailableCommands: [],
    commandCosts: [],
    queue: [],
    placementMode,
  };
}
