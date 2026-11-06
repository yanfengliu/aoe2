// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import type { EconomyState, PlayerResources, SelectionState } from '../../src/game/simulation/types';
import { createSelectionPanel, type SelectionPanelDeps } from '../../src/ui/hud/selectionPanel';

// Work 146 M2: Definitive Edition's group panel, mounted as the HUD mounts it
// (spec §14.2; sources in docs/work/146_de-selection). One icon per selected
// unit with its hit-point bar (Lesson 5), sorted by type; a click, Ctrl+click,
// Shift+click and Ctrl+Shift+click on an icon (strings 43121-43122); the bars
// follow the hit points without redrawing the icons; and a press inside the
// panel holds its redraws until the release, so the click lands.

const RESOURCES: PlayerResources = { food: 200, wood: 200, gold: 100, stone: 200 };

function unit(id: number, unitType: EconomyState['units'][number]['unitType']): EconomyState['units'][number] {
  return { id, owner: 1, unitType, x: 0, y: 0, task: 'idle', attackDamage: 3, attackRange: 1, reloadTicks: 20, armor: 0 };
}

function sheep(id: number): EconomyState['resources'][number] {
  return { id, resourceType: 'sheep', amount: 100, maxAmount: 100, owner: 1, baseOwner: 1, x: 0, y: 0 };
}

const ECONOMY: EconomyState = {
  ages: {}, playerResources: {}, population: {}, villagers: [],
  resources: [sheep(40), sheep(41)],
  units: [unit(11, 'villager'), unit(12, 'villager'), unit(13, 'villager'), ...Array.from({ length: 60 }, (_, index) => unit(100 + index, 'militia'))],
  buildings: [],
};

/** Each id's type as the bridge's selection state gives it, from ECONOMY. */
const typeOf = (id: number): SelectionState['selectedEntityTypes'][number] => (
  ECONOMY.units.find((candidate) => candidate.id === id)?.unitType
  ?? ECONOMY.resources.find((candidate) => candidate.id === id)?.resourceType
  ?? null
);

function group(ids: number[], overrides: Partial<SelectionState> = {}): SelectionState {
  return {
    selectedEntityId: ids[0] ?? null, selectedEntityIds: ids, selectedCount: ids.length, selectedKind: 'unit',
    selectedEntityType: null, selectedEntityTypes: ids.map(typeOf),
    owner: 1, health: null, attack: null, armor: null, pierceArmor: null, faction: null,
    civ: null, inventory: null, activity: null, activityBreakdown: { entries: [{ label: 'idle', count: ids.length }], overflow: 0 },
    x: 0, y: 0, tileX: 0, tileY: 0, tileEntityIndex: null, tileEntityCount: 0, resourceAmount: null, resourceMaxAmount: null,
    actionOptions: [], stanceOptions: [], formationOptions: [], formation: null, stance: null, buildOptions: [],
    marketOptions: [], trainOptions: [], visibleResearchOptions: [], researchOptions: [], unavailableCommands: [],
    commandCosts: [], queue: [], placementMode: null,
    ...overrides,
  };
}

function mount(hp: Map<number, number> = new Map()) {
  const host = document.createElement('div');
  document.body.append(host);
  const keepSelected = vi.fn();
  const deps: SelectionPanelDeps = {
    getEconomyState: () => ECONOMY,
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
    getEntityHealth: (id) => ({ currentHp: hp.get(id) ?? 25, maxHp: 25 }),
    getPopulation: () => null,
    keepSelected,
  };
  const panel = createSelectionPanel(host, deps);
  return { host, panel, keepSelected, hp };
}

const icons = (host: HTMLElement): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('[data-selection-member]')];
const iconOf = (host: HTMLElement, id: number): HTMLElement => host.querySelector<HTMLElement>(`[data-selection-member="${id}"]`)!;
const fillOf = (host: HTMLElement, id: number): HTMLElement => iconOf(host, id).querySelector<HTMLElement>('[data-selection-member-hp-fill]')!;

function click(element: HTMLElement, modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {}): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...modifiers }));
}

describe('the group panel (work 146 M2)', () => {
  it('draws one icon per selected unit, sorted by type, each with its hit-point bar', () => {
    const { host, panel } = mount(new Map([[12, 10]]));
    panel.update(group([11, 40, 12, 13, 41]), RESOURCES);
    expect(icons(host).map((icon) => [icon.dataset.selectionMember, icon.dataset.selectionMemberType])).toEqual([
      ['11', 'villager'], ['12', 'villager'], ['13', 'villager'], ['40', 'sheep'], ['41', 'sheep'],
    ]);
    expect(host.querySelector('[data-selection-unit-count]'), 'no per-type count is drawn').toBeNull();
    expect(fillOf(host, 11).style.width).toBe('100%');
    expect(fillOf(host, 12).style.width).toBe('40%');
    expect(iconOf(host, 12).querySelector('[data-selection-member-hp]')?.getAttribute('data-selection-member-hp')).toBe('10/25');
    expect(iconOf(host, 12).getAttribute('aria-label')).toBe('Villager, 10 of 25 hit points');
  });

  it('draws all 60 of a full selection', () => {
    const { host, panel } = mount();
    const militia = Array.from({ length: 60 }, (_, index) => 100 + index);
    panel.update(group(militia, { selectedEntityType: 'militia' }), RESOURCES);
    expect(icons(host).map((icon) => Number(icon.dataset.selectionMember))).toEqual(militia);
  });

  it('a click selects only the unit; Ctrl, Shift and Ctrl+Shift drop it, keep its type and drop its type', () => {
    const { host, panel, keepSelected } = mount();
    panel.update(group([11, 40, 12, 13, 41]), RESOURCES);
    click(iconOf(host, 12));
    expect(keepSelected).toHaveBeenLastCalledWith([12]);
    click(iconOf(host, 12), { ctrlKey: true });
    expect(keepSelected).toHaveBeenLastCalledWith([11, 40, 13, 41]);
    click(iconOf(host, 41), { shiftKey: true });
    expect(keepSelected).toHaveBeenLastCalledWith([40, 41]);
    click(iconOf(host, 41), { ctrlKey: true, shiftKey: true });
    expect(keepSelected).toHaveBeenLastCalledWith([11, 12, 13]);
    expect(keepSelected).toHaveBeenCalledTimes(4);
  });

  it('a click that would keep the whole selection asks for nothing', () => {
    const { host, panel, keepSelected } = mount();
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager' }), RESOURCES);
    click(iconOf(host, 12), { shiftKey: true });
    expect(keepSelected).not.toHaveBeenCalled();
  });

  it('follows each unit\'s hit points on every frame without drawing its icon again', () => {
    const { host, panel, hp } = mount();
    const state = group([11, 12, 13], { selectedEntityType: 'villager' });
    panel.update(state, RESOURCES);
    const drawn = iconOf(host, 13);
    hp.set(13, 5);
    panel.update(state, RESOURCES);
    expect(iconOf(host, 13), 'the icon was drawn again for a change of hit points').toBe(drawn);
    expect(fillOf(host, 13).style.width).toBe('20%');
    expect(iconOf(host, 13).querySelector('[data-selection-member-hp]')?.getAttribute('data-selection-member-hp')).toBe('5/25');
    // ...and writes nothing on a frame where no hit points changed. The records
    // are taken before the observer is disconnected, which drops what it holds
    // (review round 2), and a frame that does change hit points is the control.
    const observer = new MutationObserver(() => {});
    observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    panel.update(state, RESOURCES);
    panel.update(state, RESOURCES);
    const still = observer.takeRecords();
    hp.set(13, 7);
    panel.update(state, RESOURCES);
    const moved = observer.takeRecords();
    observer.disconnect();
    expect(still.map((record) => `${record.type} ${record.attributeName ?? ''}`), 'a still frame wrote to the panel').toEqual([]);
    expect(moved.length, 'the observer saw no write when hit points changed').toBeGreaterThan(0);
  });

  it('draws a member that upgraded in place as its new type, and its clicks act on that type (review round 1)', () => {
    const { host, panel, keepSelected } = mount();
    // A Scout, a villager and two Militia; then the villager's slot is a Militia too.
    panel.update(group([100, 11, 101, 102], { selectedEntityTypes: ['scout', 'villager', 'militia', 'militia'] }), RESOURCES);
    expect(icons(host).map((icon) => icon.dataset.selectionMemberType)).toEqual(['scout', 'villager', 'militia', 'militia']);
    panel.update(group([100, 11, 101, 102], { selectedEntityTypes: ['scout', 'militia', 'militia', 'militia'] }), RESOURCES);
    expect(icons(host).map((icon) => icon.dataset.selectionMemberType), 'the upgraded member kept its old icon')
      .toEqual(['scout', 'militia', 'militia', 'militia']);
    click(iconOf(host, 101), { shiftKey: true });
    expect(keepSelected).toHaveBeenLastCalledWith([11, 101, 102]);
  });

  it('a press does not hold the redraw a key asks for, so the key finds the card of the selection now (review round 1)', () => {
    const { host, panel } = mount();
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager' }), RESOURCES);
    host.querySelector('[data-selection-member]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    const withStances = group([11, 12, 13], { selectedEntityType: 'villager', stanceOptions: ['aggressive', 'defensive'], stance: 'aggressive' });
    panel.update(withStances, RESOURCES);
    expect(host.querySelector('[data-command="stance-defensive"]'), 'a frame under the press redrew the card').toBeNull();
    panel.update(withStances, RESOURCES, { force: true });
    expect(host.querySelector('[data-command="stance-defensive"]'), 'the key\'s redraw was held by the press').not.toBeNull();
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
  });

  it('keeps the keyboard focus on a member\'s icon across a redraw (review round 1)', () => {
    const { host, panel } = mount();
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager' }), RESOURCES);
    iconOf(host, 12).focus();
    expect(document.activeElement).toBe(iconOf(host, 12));
    const drawn = iconOf(host, 12);
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager', activityBreakdown: { entries: [{ label: 'moving', count: 3 }], overflow: 0 } }), RESOURCES);
    expect(iconOf(host, 12), 'the panel did not redraw').not.toBe(drawn);
    expect(document.activeElement, 'the focus left the member\'s icon').toBe(iconOf(host, 12));
  });

  it('holds its redraws while a press inside it lasts, so the release lands on the button it pressed', () => {
    const { host, panel } = mount();
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager' }), RESOURCES);
    const pressed = iconOf(host, 12);
    pressed.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    // The group's work changes (a redraw), and the button stays the one pressed.
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager', activityBreakdown: { entries: [{ label: 'moving', count: 3 }], overflow: 0 } }), RESOURCES);
    expect(iconOf(host, 12), 'the panel redrew under the press').toBe(pressed);
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager', activityBreakdown: { entries: [{ label: 'moving', count: 3 }], overflow: 0 } }), RESOURCES);
    expect(iconOf(host, 12), 'the panel did not redraw after the release').not.toBe(pressed);
    expect(host.querySelector('[data-selection-activity-multi]')?.textContent).toBe('3 moving');
  });

  it('redraws at once under a press when the selection itself changes', () => {
    const { host, panel } = mount();
    panel.update(group([11, 12, 13], { selectedEntityType: 'villager' }), RESOURCES);
    iconOf(host, 12).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    panel.update(group([11, 13], { selectedEntityType: 'villager' }), RESOURCES);
    expect(icons(host).map((icon) => icon.dataset.selectionMember)).toEqual(['11', '13']);
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
  });
});
