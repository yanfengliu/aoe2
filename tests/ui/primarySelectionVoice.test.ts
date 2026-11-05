import { describe, expect, it } from 'vitest';

import { primarySelectionRole } from '../../src/audio/primarySelectionRole';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { UnitComponent } from '../../src/game/simulation/types';

// Work 142 named a group of villagers and a sheep by its count, so the group's
// selection type became null, and the selection voice, which read that type,
// fell silent for it (review round 0). The voice is the PRIMARY unit's own.
// BOUND: the role the voice is chosen by, on the selection-controls fixture;
// the cue each role plays is tests/ui/gameAudio.test.ts.
describe('the selection voice is the primary unit\'s', () => {
  const unitTypeOf = (bridge: ReturnType<typeof createSimulationBridge>) => (id: number) =>
    bridge.world.getComponent<UnitComponent>(id, 'unit')?.unitType;

  it('speaks as a villager for three villagers and a sheep', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectUnitsInBox(13, 7, 15, 8)).toBe(true);
    const selection = bridge.getSelectionState();
    expect(selection).toMatchObject({ selectedCount: 4, selectedEntityType: null, selectedKind: 'unit' });
    expect(primarySelectionRole(selection, unitTypeOf(bridge))).toEqual({ id: selection.selectedEntityId, role: 'villager' });
  });

  it('stays silent for a sheep alone, which is no unit here', () => {
    const bridge = createSimulationBridge('selection-controls-fixture');
    expect(bridge.selectOwnedUnitsByTypeInRect('sheep', 0, 0, 20, 20)).toBe(true);
    expect(primarySelectionRole(bridge.getSelectionState(), unitTypeOf(bridge))).toBeNull();
  });
});
