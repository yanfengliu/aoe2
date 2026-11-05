import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { formatSelectionName } from '../../src/ui/hud/displayNames';

// Work 142: a group is named after a type only when every member is of it.
// DE shows a group as the number of units selected and one icon per unit
// ("Learn to play", Lesson 5); nothing names a mixed group after one member.
// Before work 142 the shared-type test skipped sheep, so three villagers and a
// sheep read "4 Villagers Selected" (the coordinator's play, 2026-11-04).
// BOUND: the selection-controls fixture's box group, through the bridge's
// selection state and the HUD's name for it; the real page is
// tests/browser/selection-controls.spec.ts.
describe('the selection names a group after a type only when every member shares it', () => {
  it('calls three villagers and a sheep four units', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectUnitsInBox(13, 7, 15, 8)).toBe(true);
    const state = bridge.getSelectionState();
    expect(state.selectedCount).toBe(4);
    expect(state.selectedEntityType).toBeNull();
    expect(formatSelectionName(state)).toBe('4 Units Selected');
  });

  it('calls the three villagers alone three villagers, and the two sheep alone two sheep', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectUnitsInBox(13, 7, 15, 7)).toBe(true);
    expect(formatSelectionName(bridge.getSelectionState())).toBe('3 Villagers Selected');
    expect(bridge.selectOwnedUnitsByTypeInRect('sheep', 0, 0, 20, 20)).toBe(true);
    const sheep = bridge.getSelectionState();
    expect(sheep).toMatchObject({ selectedCount: 2, selectedEntityType: 'sheep' });
    expect(formatSelectionName(sheep)).toBe('2 Sheep Selected');
  });
});
