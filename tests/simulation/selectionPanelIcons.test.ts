import { describe, expect, it } from 'vitest';

import { renderSelectionIcons } from '../../src/ui/hud/selectionPanel';
import type {
  EconomyState,
  SelectionState,
} from '../../src/game/simulation/types';

// Minimal EconomyState shaped for the icon-rendering contract. Fields not
// read by renderSelectionIcons are filled with zero-ish values.
function economyStateWith(
  units: EconomyState['units'],
  resources: EconomyState['resources'] = [],
): EconomyState {
  return {
    ages: {},
    playerResources: {},
    population: {},
    villagers: [],
    resources,
    units,
    buildings: [],
  };
}

function baseSelectionState(overrides: Partial<SelectionState>): SelectionState {
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
    placementMode: null,
    ...overrides,
  };
}

function villagerUnit(id: number): EconomyState['units'][number] {
  return {
    id,
    owner: 1,
    unitType: 'villager',
    x: 0,
    y: 0,
    task: 'idle',
    attackDamage: 3,
    attackRange: 1,
    reloadTicks: 20,
  armor: 0,
  };
}

function sheepResource(id: number): EconomyState['resources'][number] {
  return {
    id,
    resourceType: 'sheep',
    amount: 100,
    maxAmount: 100,
    owner: 1,
    baseOwner: 1,
    x: 0,
    y: 0,
  };
}

describe('renderSelectionIcons — sheep in multi-selection', () => {
  it('renders a sheep icon in the compact grid when 4 sheep are box-selected', () => {
    const sheepIds = [100, 101, 102, 103];
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: sheepIds,
        selectedCount: sheepIds.length,
        selectedKind: 'resource',
        selectedEntityType: 'sheep',
        owner: 1,
      }),
      economyStateWith([], sheepIds.map(sheepResource)),
    );

    expect(html).toContain('data-selection-unit-icon="sheep"');
    expect(html).toContain('data-selection-unit-count="sheep"');
    expect(html).toContain('x4');
  });

  it('renders both villager and sheep chips in the compact grid when a mixed set is selected', () => {
    const villagerIds = [1, 2];
    const sheepIds = [100, 101, 102];
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [...villagerIds, ...sheepIds],
        selectedCount: villagerIds.length + sheepIds.length,
        selectedKind: 'unit',
        selectedEntityType: 'villager',
        owner: 1,
      }),
      economyStateWith(villagerIds.map(villagerUnit), sheepIds.map(sheepResource)),
    );

    expect(html).toContain('data-selection-unit-icon="villager"');
    expect(html).toContain('data-selection-unit-count="villager"');
    expect(html).toContain('data-selection-unit-icon="sheep"');
    expect(html).toContain('data-selection-unit-count="sheep"');
    expect(html).toContain('x2');
    expect(html).toContain('x3');
  });

  it('keeps the single-sheep selection on the entity-icon big-chip path (existing HUD contract)', () => {
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: [100],
        selectedCount: 1,
        selectedKind: 'resource',
        selectedEntityType: 'sheep',
        owner: 1,
      }),
      economyStateWith([], [sheepResource(100)]),
    );

    // Single non-unit selection routes through renderSingleSelectionIcon,
    // which uses `data-selection-entity-icon` (not `data-selection-unit-icon`).
    expect(html).toContain('data-selection-entity-icon="sheep"');
    expect(html).not.toContain('data-selection-unit-count="sheep"');
  });

  it('keeps the existing 3-villager case stable (regression guard for the compact grid)', () => {
    const villagerIds = [1, 2, 3];
    const html = renderSelectionIcons(
      baseSelectionState({
        selectedEntityIds: villagerIds,
        selectedCount: villagerIds.length,
        selectedKind: 'unit',
        selectedEntityType: 'villager',
        owner: 1,
      }),
      economyStateWith(villagerIds.map(villagerUnit)),
    );

    expect(html).toContain('data-selection-unit-icon="villager"');
    expect(html).toContain('data-selection-unit-count="villager"');
    expect(html).toContain('x3');
  });
});
