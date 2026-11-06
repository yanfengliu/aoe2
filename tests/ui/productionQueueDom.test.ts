// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import type {
  EconomyState,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  SelectionState,
} from '../../src/game/simulation/types';
import { createSelectionPanel, type SelectionPanelDeps } from '../../src/ui/hud/selectionPanel';

// Work 148 M1: Definitive Edition's production queue, mounted as the HUD mounts
// it (spec §14.2; sources in docs/work/148_de-hud). The queue is a row of icons,
// consecutive items of one kind stacked into one icon with their count, and ONE
// bar for the item in production (commandpanel.json's `QueueButtons`,
// `ProgressBack` and `Progress`), whose status reads "Creating" or "Researching"
// (strings 4310 and 4309); a unit waiting for houses says so (20607, 20608).
// Before this the panel drew one card per item, each "Training: Villager 0%
// complete", of which three fit (plan 106's HUD card).

const RESOURCES: PlayerResources = { food: 200, wood: 200, gold: 100, stone: 200 };

function economy(population: PopulationState): EconomyState {
  return {
    ages: {}, playerResources: {}, population: { 1: population }, villagers: [],
    resources: [], units: [], buildings: [],
  };
}

const unitEntry = (unitType: 'villager' | 'militia', remainingTicks = 250, isBlocked = false): ProductionQueueEntry => (
  { kind: 'unit', label: unitType, unitType, remainingTicks, totalTicks: 250, isBlocked }
);
const research = (technologyType: 'loom' | 'feudal-age', remainingTicks = 250): ProductionQueueEntry => (
  { kind: 'technology', label: technologyType, technologyType, remainingTicks, totalTicks: 250, isBlocked: false }
);

function townCenter(queue: ProductionQueueEntry[]): SelectionState {
  return {
    selectedEntityId: 7, selectedEntityIds: [7], selectedCount: 1, selectedKind: 'building',
    selectedEntityType: 'town-center', selectedEntityTypes: ['town-center'],
    owner: 1, health: { current: 2400, max: 2400 }, attack: null, armor: null, pierceArmor: null, faction: null,
    civ: null, inventory: null, activity: null, activityBreakdown: null,
    x: 0, y: 0, tileX: 0, tileY: 0, tileEntityIndex: null, tileEntityCount: 0, resourceAmount: null, resourceMaxAmount: null,
    actionOptions: [], stanceOptions: [], formationOptions: [], formation: null, stance: null, buildOptions: [],
    marketOptions: [], trainOptions: ['villager'], visibleResearchOptions: [], researchOptions: [], unavailableCommands: [],
    commandCosts: [], queue, placementMode: null,
  };
}

function mount(initial: PopulationState = { current: 4, cap: 5, rawSupply: 5 }) {
  const world = { population: initial };
  const host = document.createElement('div');
  document.body.append(host);
  const deps: SelectionPanelDeps = {
    getEconomyState: () => economy(world.population),
    issueAction: vi.fn(() => true),
    setSelectionStance: vi.fn(() => true),
    setSelectionFormation: vi.fn(() => true),
    queueTrainUnit: vi.fn(() => true),
    queueResearch: vi.fn(() => true),
    issueMarketAction: vi.fn(() => true),
    sendTribute: vi.fn(() => true),
    getTributeTargets: vi.fn(() => ({ owners: [], feeRate: 0 })),
    beginBuildingPlacement: vi.fn(() => true),
    cancelBuildingPlacement: vi.fn(() => true),
    getEntityHealth: () => null,
    getPopulation: () => world.population,
    keepSelected: vi.fn(),
  };
  return { host, world, panel: createSelectionPanel(host, deps) };
}

const icons = (host: HTMLElement): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('[data-queue-icons] [data-queue-entry]')];
const describeIcons = (host: HTMLElement): string[] => icons(host).map(
  (icon) => `${icon.dataset.queueEntry} x${icon.dataset.queueStackCount} ${icon.dataset.queueState}`,
);
const text = (host: HTMLElement, selector: string): string => host.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('the production queue as DE draws it (work 148 M1)', () => {
  it('stacks consecutive items of one kind into one icon with their count, in the queue\'s order', () => {
    const { host, panel } = mount();
    panel.update(townCenter([
      unitEntry('villager', 150), unitEntry('villager'), unitEntry('villager'), research('loom'),
      unitEntry('villager'), unitEntry('villager'), unitEntry('militia'),
    ]), RESOURCES);
    expect(describeIcons(host)).toEqual([
      'villager x3 active', 'loom x1 waiting', 'villager x2 waiting', 'militia x1 waiting',
    ]);
    // The count is drawn on the icon only where there is more than one.
    expect(icons(host).map((icon) => icon.querySelector('[data-queue-count]')?.textContent ?? '')).toEqual(['3', '', '2', '']);
    // Every icon draws its kind's glyph.
    for (const icon of icons(host)) expect(icon.querySelector('svg')).not.toBeNull();
  });

  it('draws one bar, the item in production\'s, with DE\'s status words and its percent', () => {
    const { host, panel } = mount();
    panel.update(townCenter([unitEntry('villager', 150), unitEntry('villager'), research('loom')]), RESOURCES);
    expect(text(host, '[data-queue-status-label]')).toBe('Creating Villager');
    expect(text(host, '[data-queue-percent]')).toBe('40%');
    expect(host.querySelectorAll('[data-queue-progress]')).toHaveLength(1);
    expect(host.querySelector<HTMLElement>('[data-queue-progress] .hud-queue-progress-fill')!.style.width).toBe('40%');
    // The active icon carries the same progress; a waiting one carries none.
    const [active, loom] = icons(host);
    expect(active!.querySelector<HTMLElement>('.hud-queue-icon__progress-fill')!.style.width).toBe('40%');
    expect(loom!.querySelector('.hud-queue-icon__progress-fill')).toBeNull();
    expect(active!.dataset.tooltip).toBe('Creating Villager: 40% (2 in the queue)');
    expect(loom!.dataset.tooltip).toBe('Loom: in the queue');

    panel.update(townCenter([research('feudal-age', 25)]), RESOURCES);
    expect(text(host, '[data-queue-status-label]')).toBe('Researching Feudal Age');
    expect(text(host, '[data-queue-percent]')).toBe('90%');
  });

  it('no longer draws a card per item, nor "% complete"', () => {
    const { host, panel } = mount();
    panel.update(townCenter([unitEntry('villager', 150), unitEntry('villager'), unitEntry('villager'), research('loom')]), RESOURCES);
    const queue = text(host, '[data-selection-queue-list]');
    expect(queue).not.toContain('% complete');
    expect(queue).not.toContain('Training:');
    expect(host.querySelectorAll('.hud-queue-item')).toHaveLength(0);
  });

  it('names a unit that waits for houses, draws it blocked, and shows the research it lets through', () => {
    const { host, panel } = mount({ current: 5, cap: 5, rawSupply: 5 });
    panel.update(townCenter([unitEntry('villager', 250, true), unitEntry('villager'), research('loom', 200)]), RESOURCES);
    expect(text(host, '[data-queue-housing]')).toBe('You need to build more houses.');
    expect(describeIcons(host)).toEqual(['villager x2 blocked', 'loom x1 active']);
    expect(icons(host)[0]!.dataset.tooltip).toBe('Villager (2 in the queue): You need to build more houses.');
    // The one bar is the research's, which the simulation advances in its place (spec §6.10).
    expect(text(host, '[data-queue-status-label]')).toBe('Researching Loom');
    expect(text(host, '[data-queue-percent]')).toBe('20%');
  });

  it('says the population limit is reached once houses would not help', () => {
    const atLimit = mount({ current: 200, cap: 200, rawSupply: 230 });
    atLimit.panel.update(townCenter([unitEntry('militia', 250, true)]), RESOURCES);
    expect(text(atLimit.host, '[data-queue-housing]')).toBe('Population limit reached.');
    expect(atLimit.host.querySelector('[data-queue-progress]')).toBeNull();

    const housed = mount({ current: 60, cap: 60, rawSupply: 60 });
    housed.panel.update(townCenter([unitEntry('militia', 250, true)]), RESOURCES);
    expect(text(housed.host, '[data-queue-housing]')).toBe('You need to build more houses.');
  });

  it('a unit held for another reason is not said to want houses', () => {
    // isBlocked is also set while a unit has nowhere to appear (productionQueueSystem).
    const { host, panel } = mount({ current: 4, cap: 5, rawSupply: 5 });
    panel.update(townCenter([unitEntry('villager', 0, true)]), RESOURCES);
    expect(host.querySelector('[data-queue-housing]')).toBeNull();
    expect(describeIcons(host)).toEqual(['villager x1 active']);
  });

  it('follows the population with the queue unchanged (review round 1)', () => {
    // A held queue does not change while the houses go up, so the panel must
    // redraw for the population alone.
    const { host, world, panel } = mount({ current: 200, cap: 195, rawSupply: 195 });
    const held = townCenter([unitEntry('militia', 250, true)]);
    panel.update(held, RESOURCES);
    expect(text(host, '[data-queue-housing]')).toBe('You need to build more houses.');
    world.population = { current: 200, cap: 200, rawSupply: 200 };
    panel.update(held, RESOURCES);
    expect(text(host, '[data-queue-housing]')).toBe('Population limit reached.');
  });

  it('draws a label as text, never as markup (review round 1)', () => {
    // A saved game keeps each entry's label, which the queue falls back to.
    const { host, panel } = mount();
    const label = 'x" data-injected="yes <b>bold</b>';
    panel.update(townCenter([{ kind: 'unit', label, remainingTicks: 10, totalTicks: 20, isBlocked: false }]), RESOURCES);
    expect(host.querySelector('[data-injected]')).toBeNull();
    expect(host.querySelector('[data-selection-queue-list] b')).toBeNull();
    expect(icons(host)[0]!.dataset.queueEntry).toBe(label);
    expect(text(host, '[data-queue-status-label]')).toBe(`Creating ${label}`);
  });

  it('counts whole percents exactly (review round 1)', () => {
    // 145 of 250 ticks is 58%; dividing first gave 57.99999999999999, so 57.
    const { host, panel } = mount();
    panel.update(townCenter([unitEntry('villager', 105)]), RESOURCES);
    expect(text(host, '[data-queue-percent]')).toBe('58%');
  });

  it('draws nothing for an empty queue', () => {
    const { host, panel } = mount();
    panel.update(townCenter([]), RESOURCES);
    expect(host.querySelector('[data-selection-queue-list]')).toBeNull();
  });
});
