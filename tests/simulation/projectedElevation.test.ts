import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { TerrainComponent } from '../../src/game/simulation/types';

describe('projected entity elevation', () => {
  it('copies terrain elevation and grounds non-terrain entities', () => {
    const bridge = createSimulationBridge('projected-elevation-test');
    const entities = bridge.getRenderState().entities;
    const elevatedTile = entities.find((entity) => {
      if (entity.kind !== 'tile') {
        return false;
      }
      return bridge.world.getComponent<TerrainComponent>(entity.id, 'terrain')?.elevation === 1;
    });
    const nonTerrainEntity = entities.find((entity) => entity.kind !== 'tile');

    expect(elevatedTile).toBeDefined();
    expect(elevatedTile?.elevation).toBe(1);
    expect(nonTerrainEntity).toBeDefined();
    expect(nonTerrainEntity?.elevation).toBe(0);
  });
});
