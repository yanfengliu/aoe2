import { describe, expect, it } from 'vitest';

import { CIV_FREE_TECHNOLOGIES } from '../../src/game/simulation/civBonusTable';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { playerCivilizationsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

// "X free" (spec §9.2): a civilization's free technologies research
// themselves the moment the owner could legally research them — same menu,
// same applier, zero cost. Twelve civilizations carry at least one.

function bootAs(civilization: string, seed = 'aoe2-prototype'): Bridge {
  const boot = createSimulationBridge(seed);
  const blob = asSchema2Blob(boot.saveGame());
  worldStateOf(blob)[playerCivilizationsCodec.slot] = [[1, civilization], [2, 'Franks']];
  return createSimulationBridge(seed, { savedGame: blob });
}

function researched(bridge: Bridge, owner: number): ReadonlySet<string> {
  const blob = asSchema2Blob(bridge.saveGame());
  const rows = worldStateOf(blob)['aoe2.researchedTechnologies'] as Array<[number, string[]]>;
  return new Set(rows.find(([id]) => id === owner)?.[1] ?? []);
}

describe('civilization free technologies', () => {
  it('gives the Aztecs Loom moments into the Dark Age, and costs nothing', () => {
    const bridge = bootAs('Aztecs');
    const goldBefore = bridge.getEconomyState().playerResources[1]!.gold;
    for (let step = 0; step < 30; step += 1) bridge.step(100);
    expect(researched(bridge, 1).has('loom')).toBe(true);
    // Loom costs 50 gold when bought; free means the stockpile never moved
    // for it (the opening economy earns no gold this early).
    expect(bridge.getEconomyState().playerResources[1]!.gold).toBe(goldBefore);
    // The other player is not an Aztec and researched nothing.
    expect(researched(bridge, 2).has('loom')).toBe(false);
  });

  it('gives the Slavs Tracking only once its Barracks stands', () => {
    const bridge = bootAs('Slavs');
    for (let step = 0; step < 30; step += 1) bridge.step(100);
    // No Barracks on the opening map: nothing to offer Tracking, nothing free.
    expect(researched(bridge, 1).has('tracking')).toBe(false);
  });

  it('waits for the age gate the menu itself enforces', () => {
    // Vikings: Wheelbarrow is a Feudal Town Center technology. In the Dark
    // Age the menu does not offer it, so the grant waits.
    const bridge = bootAs('Vikings');
    for (let step = 0; step < 30; step += 1) bridge.step(100);
    expect(researched(bridge, 1).has('wheelbarrow')).toBe(false);
  });

  it('names only real, researchable technology ids', () => {
    // The table is data; a typo here would silently never fire.
    for (const [civilization, technologies] of Object.entries(CIV_FREE_TECHNOLOGIES)) {
      expect(technologies.length, civilization).toBeGreaterThan(0);
      for (const technology of technologies) {
        expect(typeof technology, `${civilization}: ${technology}`).toBe('string');
      }
    }
  });
});
