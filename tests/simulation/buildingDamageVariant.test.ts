// Building damage states (v0.3.97): a completed building under 40% HP wears
// the 'damaged' variant (the recipe layer adds fire); repairing back over the
// threshold restores 'complete'. Scaffolds never flip.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

function variantAt(bridge: Bridge, x: number, y: number): string | undefined {
  return bridge
    .getRenderState()
    .entities.find((e) => e.layer !== 'terrain' && e.x === x && e.y === y && e.entityType !== 'villager')
    ?.visualVariant;
}

describe('building damage variants', () => {
  it('wounded buildings render damaged; the healthy control stays complete', () => {
    const bridge = createSimulationBridge('damage-showcase-fixture');
    bridge.step(100); bridge.step(100); // two ticks for the variant sweep to land in render state
    expect(variantAt(bridge, 8, 10)).toBe('damaged'); // TC at 700/2400
    expect(variantAt(bridge, 16, 12)).toBe('damaged'); // house at 150
    expect(variantAt(bridge, 20, 10)).toBe('damaged'); // tower at 300/1020
    expect(variantAt(bridge, 16, 16)).toBe('complete'); // untouched house
  });

  it('healing back over the threshold restores the clean look', () => {
    const bridge = createSimulationBridge('damage-showcase-fixture');
    bridge.step(100); bridge.step(100);
    expect(variantAt(bridge, 16, 12)).toBe('damaged');
    // A villager repair would take minutes; heal through a save/mutate/reload
    // round-trip — the same world state a save carries — then let the system
    // sweep on the reloaded bridge.
    const house = bridge
      .getEconomyState()
      .buildings.find((b) => b.buildingType === 'house' && b.x === 16 && b.y === 12)!;
    const blob = asSchema2Blob(bridge.saveGame());
    const healths = worldStateOf(blob)['aoe2.buildingHealthStates'] as Array<[number, { currentHp: number; maxHp: number }]>;
    const entry = healths.find(([id]) => id === house.id)!;
    entry[1].currentHp = entry[1].maxHp;
    const healed = createSimulationBridge('damage-showcase-fixture', { savedGame: blob });
    healed.step(100); healed.step(100);
    expect(variantAt(healed, 16, 12)).toBe('complete');
  });
});
