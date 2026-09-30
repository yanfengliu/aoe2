import { describe, expect, it } from 'vitest';

import { CIV_FREE_TECHNOLOGIES } from '../../src/game/simulation/civBonusTable';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { playerCivilizationsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;

// "X free" (spec §9.2): a civilization's free technologies research
// themselves the moment the owner could legally research them — same menu,
// same applier, zero cost. The roster follows civilizations.csv.

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
  it('opens the Aztecs with +50 gold; the free Loom left with DE (sourced v0.3.144)', () => {
    // Opening resources are seeded from the civ at CREATION, so this boots
    // with the civ option (a blob-swapped civ rightly changes no history).
    const bridge = createSimulationBridge('aoe2-prototype', {
      civilizationsByOwner: new Map([[1, 'Aztecs'], [2, 'Franks']]),
    });
    const plain = createSimulationBridge('aoe2-prototype');
    expect(bridge.getEconomyState().playerResources[1]!.gold)
      .toBe(plain.getEconomyState().playerResources[1]!.gold + 50);
    for (let step = 0; step < 30; step += 1) bridge.step(100);
    expect(researched(bridge, 1).has('loom')).toBe(false);
  });

  it('does not grant retired Tracking to a Slavs opening', () => {
    const bridge = bootAs('Slavs');
    for (let step = 0; step < 30; step += 1) bridge.step(100);
    // Tracking is retired; the opening must not receive it as a free technology.
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
