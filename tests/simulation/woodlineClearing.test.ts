// AoE2's forest IS its trees: chopping one opens its tile, so a woodline is cut
// from the outside in. Here a tree stood on a permanently impassable forest
// tile, so only a woodline's rim was ever workable. Measured on the default map
// at tick 6000: 18 of the 27 surviving trees had no walkable neighbour at all,
// 83 of their blocked faces were forest terrain, and the AI's entire villager
// force had given up on wood and piled onto one gold mine.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { TerrainComponent } from '../../src/game/simulation/types';

function terrainKindAt(
  bridge: ReturnType<typeof createSimulationBridge>,
  x: number,
  y: number,
): string | undefined {
  for (const id of bridge.world.query('terrain', 'position')) {
    const position = bridge.world.getComponent<{ x: number; y: number }>(id, 'position');
    if (position?.x !== x || position.y !== y) continue;
    return bridge.world.getComponent<TerrainComponent>(id, 'terrain')?.kind;
  }
  return undefined;
}

describe('an exhausted tree clears its forest tile', () => {
  it('opens the woodline so the tree behind it can be worked', () => {
    const bridge = createSimulationBridge('woodline-clearing-fixture');
    expect(terrainKindAt(bridge, 10, 10)).toBe('forest');
    const before = bridge.getEconomyState();
    const farBefore = before.resources.find((r) => r.x === 11 && r.y === 10);
    expect(farBefore?.amount).toBe(100);

    for (let i = 0; i < 900; i += 1) bridge.step(100);

    const after = bridge.getEconomyState();
    // The near tree is gone...
    expect(after.resources.find((r) => r.x === 10 && r.y === 10)).toBeUndefined();
    // ...and its tile is open ground, which is what AoE2 leaves behind.
    expect(terrainKindAt(bridge, 10, 10)).toBe('grass');
    // The discriminator: the far tree, walled in by forest on every other side,
    // was worked. Its wood is the only wood beyond the near tree's twelve, so
    // the stockpile alone proves the villager got through — pre-fix it stops at
    // the starting 200 plus that twelve.
    const woodBefore = before.playerResources[2]?.wood ?? 0;
    expect(after.playerResources[2]?.wood ?? 0).toBeGreaterThan(woodBefore + 12);
    const farAfter = after.resources.find((r) => r.x === 11 && r.y === 10);
    expect(farAfter?.amount ?? 0).toBeLessThan(100);
  }, 60_000);

  it('the cleared ground survives a save and a load', () => {
    const bridge = createSimulationBridge('woodline-clearing-fixture');
    // Long enough to fell the near tree, short enough that the far one still
    // has wood left to prove the reload with.
    for (let i = 0; i < 400; i += 1) bridge.step(100);
    expect(terrainKindAt(bridge, 10, 10)).toBe('grass');
    const farAtSave = bridge.getEconomyState().resources.find((r) => r.x === 11 && r.y === 10);
    expect(farAtSave?.amount ?? 0).toBeGreaterThan(0);

    const loaded = createSimulationBridge('woodline-clearing-fixture', {
      savedGame: JSON.parse(JSON.stringify(bridge.saveGame())) as ReturnType<typeof bridge.saveGame>,
    });
    // The terrain component rides the saved world...
    expect(terrainKindAt(loaded, 10, 10)).toBe('grass');
    // ...and the occupancy grid, which is rebuilt from that world on load and
    // holds its own static terrain blockers, agrees: the far tree is still
    // workable, so the cleared ground is not silently a wall again.
    const woodBefore = loaded.getEconomyState().playerResources[2]?.wood ?? 0;
    for (let i = 0; i < 300; i += 1) loaded.step(100);
    expect(loaded.getEconomyState().playerResources[2]?.wood ?? 0).toBeGreaterThan(woodBefore);
  }, 60_000);
});
