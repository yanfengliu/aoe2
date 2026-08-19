import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { touchesWater } from '../../src/game/simulation/shorePlacement';
import type { TerrainKind } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';

// The naval layer is only worth anything if a player can reach it in an
// ordinary match. These tests guard the DEFAULT scenario, not a naval fixture:
// a map generator change that removed coastline would otherwise make every
// ship in the game unbuildable without a single test failing.
describe('naval play is reachable on the default map', () => {
  it('generates real water on the standard scenario', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const water = bridge.getRenderState().entities
      .filter((entity) => entity.layer === 'terrain' && entity.entityType === 'water');
    expect(water.length).toBeGreaterThan(50);
  });

  it('leaves somewhere a Dock could actually stand', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const terrain = new Map(
      bridge.getRenderState().entities
        .filter((entity) => entity.layer === 'terrain')
        .map((entity) => [`${String(entity.x)}:${String(entity.y)}`, entity.entityType as TerrainKind]),
    );
    const at = (x: number, y: number): TerrainKind | null =>
      terrain.get(`${String(x)}:${String(y)}`) ?? null;

    let anchors = 0;
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        if (touchesWater(x, y, 3, 3, at)) anchors += 1;
      }
    }
    expect(anchors).toBeGreaterThan(0);
  });

  it('offers the Dock to a villager in a normal match', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('dock');
  });
});
