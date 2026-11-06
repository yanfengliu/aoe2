// Work 146 M2: the selection state lists each selected entity's own type, in
// the selection's order, which the group panel draws its icons from; read at
// a redraw from anything else, a unit that upgraded in place kept its old icon
// and its clicks acted on its old type (review round 1). Through the real
// bridge.
//
// BOUND: the selection-controls fixture's box of three villagers and a sheep,
// one villager alone, and nothing selected.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('the selection state\'s member types (work 146 M2)', () => {
  it('lists each selected entity\'s type in the selection\'s order', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectUnitsInBox(13, 7, 16, 9)).toBe(true);
    const state = bridge.getSelectionState();
    const economy = bridge.getEconomyState();
    const typeOf = (id: number): string | undefined => economy.units.find((unit) => unit.id === id)?.unitType
      ?? economy.resources.find((resource) => resource.id === id)?.resourceType;
    expect(state.selectedEntityIds).toHaveLength(4);
    expect(state.selectedEntityTypes).toEqual(state.selectedEntityIds.map(typeOf));
    expect([...state.selectedEntityTypes].sort()).toEqual(['sheep', 'villager', 'villager', 'villager']);
  });

  it('lists one type for one entity, and none for nothing selected', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    const villager = bridge.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!;
    expect(bridge.selectUnitsByIds([villager.id])).toBe(true);
    expect(bridge.getSelectionState().selectedEntityTypes).toEqual(['villager']);
    bridge.clearSelection();
    expect(bridge.getSelectionState().selectedEntityTypes).toEqual([]);
  });
});
