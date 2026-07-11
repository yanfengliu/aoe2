import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

// Full-review iter-1 H1: wildlife HP / death mutations went through the
// accessor cache but never marked `wildlifeStatesCodec` dirty, so `flush()`
// (and therefore saveGame) persisted a STALE wildlife slot. The live game
// read the (correct) cache, so the bug was invisible until a save/load.
//
// The damage case is masked because a live boar retaliates every tick, and
// that retaliation (via wildlifeCombatSystem) re-dirties the shared slot,
// incidentally flushing the boar's own reduced HP. The KILL case is not
// masked: once dead the corpse boar stops acting, so its `isAlive=false`
// (set in killWildlifeEntity with no markDirty) never reaches world.state and
// the boar RESURRECTS on load. This drives a real 6-villager hunt to a kill
// and asserts the corpse stays dead across a genuine save -> load round-trip.

function boarEntity(bridge: ReturnType<typeof createSimulationBridge>) {
  return bridge
    .getRenderState()
    .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'boar');
}

describe('wildlife state persists across save/load (full-review H1)', () => {
  it('a killed corpse-persisting boar stays dead after a save + load round-trip', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boarCell = { x: 13, y: 8 };
    const villagerCells = [
      { x: 12, y: 7 },
      { x: 13, y: 7 },
      { x: 14, y: 7 },
      { x: 12, y: 9 },
      { x: 13, y: 9 },
      { x: 14, y: 9 },
    ];

    // Order the whole pack onto the boar.
    for (const cell of villagerCells) {
      expect(bridge.selectEntityAtCell(cell.x, cell.y)).toBe(true);
      bridge.issueContextCommand(boarCell.x, boarCell.y);
    }

    // Drive until the boar is dead — the LIVE bridge reads the correct cache.
    const boarDead = (): boolean => {
      const boar = boarEntity(bridge);
      return boar === undefined || (boar.currentHp ?? 0) <= 0;
    };
    expect(stepBridgeUntil(bridge, boarDead, { maxSteps: 400 })).toBe(true);

    // Save + restore, then read the boar via the RESTORED render state, which
    // reflects the persisted (formerly stale) wildlife slot.
    const blob = bridge.saveGame();
    const restored = createSimulationBridge(DEFAULT_SEED, {
      savedGame: JSON.parse(JSON.stringify(blob)) as typeof blob,
    });
    const restoredBoar = boarEntity(restored);

    // The corpse must stay dead: currentHp 0 (or the entity absent if the
    // corpse was consumed). Pre-fix it resurrects with HP > 0.
    expect(restoredBoar?.currentHp ?? 0).toBe(0);
  });
});
