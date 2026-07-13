import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('selection render projection', () => {
  it('refreshes selected voxel state without advancing a paused simulation tick', () => {
    const bridge = createSimulationBridge('villager-selection-fixture');
    bridge.setPaused(true);
    const before = bridge.getRenderState();
    const villager = before.entities.find((entity) => (
      entity.kind === 'unit'
      && entity.owner === 1
      && entity.entityType === 'villager'
    ));
    expect(villager).toBeDefined();
    expect(villager?.selected).toBe(false);

    expect(bridge.selectEntityById(villager!.id)).toBe(true);
    const selected = bridge.getRenderState();
    expect(selected.tick).toBe(before.tick);
    expect(selected.entities.find((entity) => entity.id === villager!.id)?.selected).toBe(true);

    bridge.clearSelection();
    const cleared = bridge.getRenderState();
    expect(cleared.tick).toBe(before.tick);
    expect(cleared.entities.find((entity) => entity.id === villager!.id)?.selected).toBe(false);
  });
});
