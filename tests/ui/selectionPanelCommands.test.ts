// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import type {
  EconomyState,
  PlayerResources,
  SelectionState,
} from '../../src/game/simulation/types';
import {
  createSelectionPanel,
  renderBuildButtons,
} from '../../src/ui/hud/selectionPanel';

const POOR_RESOURCES: PlayerResources = { food: 200, wood: 174, gold: 100, stone: 200 };
const READY_RESOURCES: PlayerResources = { food: 200, wood: 175, gold: 100, stone: 200 };

function villagerSelection(overrides: Partial<SelectionState> = {}): SelectionState {
  return {
    selectedEntityId: 1,
    selectedEntityIds: [1],
    selectedCount: 1,
    selectedKind: 'unit',
    selectedEntityType: 'villager',
    owner: 1,
    health: { current: 25, max: 25 },
    attack: 3,
    armor: 0,
    pierceArmor: 0,
    faction: 'Player',
    civ: 'Britons',
    inventory: 'Empty',
    activity: { verb: 'idle', target: null },
    activityBreakdown: null,
    x: 10,
    y: 10,
    tileX: 10,
    tileY: 10,
    tileEntityIndex: 0,
    tileEntityCount: 1,
    resourceAmount: null,
    resourceMaxAmount: null,
    actionOptions: [],
    stanceOptions: [],
    formationOptions: [],
    formation: null,
    stance: null,
    buildOptions: ['house', 'barracks'],
    marketOptions: [],
    trainOptions: [],
    visibleResearchOptions: [],
    researchOptions: [],
    queue: [],
    placementMode: null,
    ...overrides,
  };
}

function economyState(resources: PlayerResources): EconomyState {
  return {
    ages: { 1: 'dark-age' },
    playerResources: { 1: resources },
    population: { 1: { current: 1, cap: 5, rawSupply: 5 } },
    villagers: [],
    resources: [],
    units: [{
      id: 1,
      owner: 1,
      unitType: 'villager',
      x: 10,
      y: 10,
      task: 'moving',
      attackDamage: 3,
      attackRange: 1,
      armor: 0,
    }],
    buildings: [],
  };
}

describe('villager build palette', () => {
  it('shows visible costs, live readiness, and the active placement without hiding labels', () => {
    const host = document.createElement('div');
    host.innerHTML = renderBuildButtons(
      ['house', 'barracks'],
      POOR_RESOURCES,
      'house',
    );

    const house = host.querySelector<HTMLButtonElement>('[data-command="build-house"]')!;
    const barracks = host.querySelector<HTMLButtonElement>('[data-command="build-barracks"]')!;
    expect(house.textContent).toContain('Build House');
    expect(house.querySelector('[data-build-cost-resource="wood"]')?.textContent).toContain('25');
    expect(house.dataset.commandAffordable).toBe('true');
    expect(house.getAttribute('aria-pressed')).toBe('true');
    expect(house.textContent).toContain('Ready');

    expect(barracks.textContent).toContain('Build Barracks');
    expect(barracks.querySelector('[data-build-cost-resource="wood"]')?.textContent).toContain('175');
    expect(barracks.dataset.commandAffordable).toBe('false');
    expect(barracks.textContent).toContain('Short');
    expect(barracks.disabled).toBe(false);
    expect(barracks.getAttribute('aria-label')).toMatch(/175 wood.*short/i);
  });

  it('groups build commands semantically and refreshes affordability for unchanged selection state', () => {
    const host = document.createElement('div');
    document.body.append(host);
    let economy = economyState(POOR_RESOURCES);
    const beginBuildingPlacement = vi.fn(() => true);
    const panel = createSelectionPanel(host, {
      getEconomyState: () => economy,
      issueAction: vi.fn(() => true),
    setSelectionStance: vi.fn(() => true),
    setSelectionFormation: vi.fn(() => true),
      queueTrainUnit: vi.fn(() => true),
      queueResearch: vi.fn(() => true),
      issueMarketAction: vi.fn(() => true),
      beginBuildingPlacement,
    });
    const selection = villagerSelection();

    panel.update(selection, POOR_RESOURCES);
    const group = host.querySelector<HTMLElement>('[data-command-group="build"]')!;
    expect(group).not.toBeNull();
    expect(group.getAttribute('aria-labelledby')).toBeTruthy();
    expect(group.textContent).toContain('Build');
    expect(group.dataset.commandGroupCount).toBe('2');
    expect(host.querySelector('[data-command-group="train"]')).toBeNull();

    const before = host.querySelector<HTMLButtonElement>('[data-command="build-barracks"]')!;
    expect(before.dataset.commandAffordable).toBe('false');
    before.focus();
    before.click();
    expect(beginBuildingPlacement).toHaveBeenCalledExactlyOnceWith('barracks');

    economy = economyState(READY_RESOURCES);
    panel.update(selection, READY_RESOURCES);
    const after = host.querySelector<HTMLButtonElement>('[data-command="build-barracks"]')!;
    expect(after.dataset.commandAffordable).toBe('true');
    expect(after.textContent).toContain('Ready');
    expect(document.activeElement).toBe(after);

    const surplusResources = { ...READY_RESOURCES, wood: 176 };
    economy = economyState(surplusResources);
    panel.update(selection, surplusResources);
    expect(host.querySelector('[data-command="build-barracks"]')).toBe(after);
    expect(document.activeElement).toBe(after);
  });
});
