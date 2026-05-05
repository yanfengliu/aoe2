import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  asSchema2Blob,
  worldStateOf,
} from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findFirstOwnedUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

function findUnitById(bridge: Bridge, id: number) {
  return bridge.getEconomyState().units.find((unit) => unit.id === id);
}

describe('Slice 5 Monk conversion — flip-flop regression (review C-1)', () => {
  it('accumulates progress for the first-processed Monk when two enemy Monks share a target', () => {
    // Boot the fixture so we know the entity ids and EntityRefs the
    // loader expects. We then save, mutate the blob to inject monkTasks
    // for both Monks targeting the same neutral Militia, and re-load.
    // Without the fix, every tick the second-processed enemy Monk wipes
    // the first's progress to zero, so conversion never completes.
    const bootBridge = createSimulationBridge('monk-flip-flop-fixture');
    const monk1 = findFirstOwnedUnit(bootBridge, 1, 'monk');
    const monk2 = findFirstOwnedUnit(bootBridge, 2, 'monk');
    const militia = findFirstOwnedUnit(bootBridge, 3, 'militia');
    expect(monk1).toBeDefined();
    expect(monk2).toBeDefined();
    expect(militia).toBeDefined();

    const blob = asSchema2Blob(bootBridge.saveGame());
    const targetEntityRef = { id: militia!.id, generation: 0 };
    worldStateOf(blob)[monkTasksCodec.slot] = [
      [monk1!.id, { kind: 'convert', targetEntityRef }],
      [monk2!.id, { kind: 'convert', targetEntityRef }],
    ];
    const replayBridge = createSimulationBridge('monk-flip-flop-fixture', {
      savedGame: blob,
    });

    // 80 ticks well covers the 50-tick conversion threshold at one
    // progress per tick. With the bug present the Militia would still
    // belong to player 3.
    for (let index = 0; index < 80; index += 1) {
      replayBridge.step(100);
    }

    const finalMilitia = findUnitById(replayBridge, militia!.id);
    expect(finalMilitia).toBeDefined();
    expect(finalMilitia!.owner).toBe(1);
  }, 30_000);
});
