// BOUND: schema-1 and schema-2 saves of one fixture. Only the saved House's
// visionSource.radius changes. Huge finite input must cover the finite map
// without changing the persisted radius; invalid input must name the bad
// value and the allowed range. The helper's geometry is checked separately.
import { describe, expect, it, vi } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import { legacySchema1FromBridge } from './saveBlobTestUtils';

function saveWithSight(schema: 1 | 2, radius: unknown): { blob: SaveBlob; houseId: number } {
  const bridge = createSimulationBridge('raid-warning-fixture');
  const house = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!;
  const blob = schema === 1 ? legacySchema1FromBridge(bridge) : bridge.saveGame();
  const snapshot = blob.worldSnapshot as unknown as {
    components: { visionSource: Array<[number, { playerId: number; radius: unknown }]> };
  };
  snapshot.components.visionSource.find(([id]) => id === house.id)![1].radius = radius;
  return { blob, houseId: house.id };
}

describe.each([1, 2] as const)('building sight input in save schema %s', (schema) => {
  it.each([NaN, Infinity, -1, null, '100000'])('rejects invalid saved sight %s with an input-specific error', (radius) => {
    const { blob, houseId } = saveWithSight(schema, radius);
    // The engine rejects non-finite JSON components before aoe2 sees them.
    // Finite/wrong-type corruption reaches the building-specific boundary.
    const error = typeof radius === 'number' && !Number.isFinite(radius)
      ? `component ${String(houseId)}.radius must be a finite JSON number`
      : `Building sight radius ${String(radius)} must be a finite non-negative number.`;
    expect(() => createSimulationBridge('ignored-on-load', { savedGame: blob })).toThrow(
      error,
    );
  });

  it.each([100000, 1e200])('loads finite saved sight %s and keeps it while revealing the finite map', (radius) => {
    const { blob, houseId } = saveWithSight(schema, radius);
    // Genuine JSON round-trip. Neither overflow-sized finite number is lost.
    const jsonBlob = JSON.parse(JSON.stringify(blob)) as SaveBlob;
    const max = Math.max;
    let steps = 0;
    const guard = vi.spyOn(Math, 'max').mockImplementation((...values: number[]) => {
      // Prevent a reintroduced nested scan from hanging the entire gate.
      if (++steps > 10000) throw new Error('Saved sight exceeded the finite map work guard');
      return max(...values);
    });
    try {
      const loaded = createSimulationBridge('ignored-on-load', { savedGame: jsonBlob });
      loaded.step(100);
      expect(loaded.world.getComponent<{ radius: number }>(houseId, 'visionSource')?.radius).toBe(radius);
      const map = loaded.getMapSize();
      const missing: string[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!loaded.isCellVisibleForOwner(1, x, y)) missing.push(`${x},${y}`);
        }
      }
      expect(missing).toEqual([]);
      const resaved = loaded.saveGame().worldSnapshot as unknown as {
        components: { visionSource: Array<[number, { radius: number }]> };
      };
      expect(resaved.components.visionSource.find(([id]) => id === houseId)![1].radius).toBe(radius);
    } finally {
      guard.mockRestore();
    }
  });
});
