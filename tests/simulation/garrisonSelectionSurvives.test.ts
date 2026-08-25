// A garrison must never touch a selection it does not own (v0.3.102). The old
// garrisonUnit called clearSelection() unconditionally, so EVERY garrison -
// including an AI sheltering its own archer on the other side of the map -
// wiped the HUMAN player's selection. Invisible until v0.3.89 widened
// garrison eligibility and AI archers started sheltering; the browser camel
// spec caught it as a flaky "No selection" panel.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

describe('garrisoning and other players’ selections', () => {
  it('an AI garrison far away leaves the human selection alone', () => {
    // ai-under-raid: the human's military stands at the AI's door, so its
    // defense phase shelters villagers in the Town Center within seconds.
    const bridge = createSimulationBridge('ai-under-raid-fixture');
    const mine = bridge
      .getEconomyState()
      .units.find((u) => u.owner === 1)!;
    expect(selectOwnedUnitDirect(bridge, 1, mine.unitType)).toBe(true);
    const selectedType = bridge.getSelectionState().selectedEntityType;
    let checked = 0;
    const aiGarrisoned = (): boolean => {
      checked += 1;
      if (checked % 20 !== 0) return false; // saveGame is heavy; poll sparsely
      const blob = asSchema2Blob(bridge.saveGame());
      const garrisons = worldStateOf(blob)['aoe2.garrisonedByBuilding'] as Array<[number, number[]]>;
      return (garrisons ?? []).some(([, units]) => units.length > 0);
    };
    expect(
      stepBridgeUntil(bridge, () => aiGarrisoned(), { maxSteps: 1600 }),
    ).toBe(true);
    // The human's selection survived the AI's garrison.
    expect(bridge.getSelectionState().selectedEntityType).toBe(selectedType);
    expect(bridge.getSelectionState().selectedCount).toBeGreaterThanOrEqual(1);
  });

  it('garrisoning ONE of several selected units keeps the rest selected', () => {
    const bridge = createSimulationBridge('civ-teutons-fixture');
    const tower = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'watch-tower')!;
    const militia = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'militia');
    // Select ALL militia, then send just the first into the tower.
    expect(
      bridge.selectOwnedUnitsByTypeInRect('militia', 20, 18, 40, 30),
    ).toBe(true);
    const before = bridge.getSelectionState().selectedCount;
    expect(before).toBeGreaterThanOrEqual(3);
    expect(bridge.selectEntityAtCell(militia[0]!.x, militia[0]!.y)).toBe(true);
    expect(bridge.issueContextCommand(tower.x, tower.y, true)).toBe(true);
    // Re-select the whole group, order the group into... simpler: order the
    // WHOLE group to garrison; capacity 5 takes five and the sixth+ stand by.
    expect(
      bridge.selectOwnedUnitsByTypeInRect('militia', 20, 18, 40, 30),
    ).toBe(true);
    expect(bridge.issueContextCommand(tower.x, tower.y, true)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const blob = asSchema2Blob(bridge.saveGame());
          const garrisons = worldStateOf(blob)['aoe2.garrisonedByBuilding'] as Array<[number, number[]]>;
          const entry = (garrisons ?? []).find(([id]) => id === tower.id);
          return (entry?.[1].length ?? 0) >= 5;
        },
        { maxSteps: 900 },
      ),
    ).toBe(true);
    // Five went in; the two left standing outside are STILL selected.
    expect(bridge.getSelectionState().selectedCount).toBe(2);
    expect(bridge.getSelectionState().selectedEntityType).toBe('militia');
  });
});
