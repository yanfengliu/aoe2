import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';

// Review H-3 (`docs/reviews/full/2026-04-25/1/REVIEW.md`). The two
// garrison side maps are structurally redundant: every entry in
// `garrisonedByBuilding[b] = [u, ...]` must mirror
// `garrisonedUnitToBuilding[u] === b`. Loading a blob with a partial
// (corrupted, truncated, drifted) cross-reference must throw with a
// descriptive error rather than booting into an inconsistent state.

describe('Save-load garrison side-map cross-reference (review H-3)', () => {
  it('throws when a unit appears in garrisonedByBuilding but not in garrisonedUnitToBuilding', () => {
    const bridge = createSimulationBridge();
    const blob = bridge.saveGame();
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        garrisonedByBuilding: [[9001, [9002]]],
        garrisonedUnitToBuilding: [],
      },
    };

    expect(() => createSimulationBridge('aoe2-prototype', { savedGame: corrupt })).toThrow(
      /garrison cross-reference/i,
    );
  });

  it('throws when garrisonedUnitToBuilding points to a building whose list lacks the unit', () => {
    const bridge = createSimulationBridge();
    const blob = bridge.saveGame();
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        garrisonedByBuilding: [[9001, []]],
        garrisonedUnitToBuilding: [[9002, 9001]],
      },
    };

    expect(() => createSimulationBridge('aoe2-prototype', { savedGame: corrupt })).toThrow(
      /garrison cross-reference/i,
    );
  });

  it('throws when garrisonedUnitToBuilding points to a building absent from garrisonedByBuilding', () => {
    const bridge = createSimulationBridge();
    const blob = bridge.saveGame();
    const corrupt: SaveBlob = {
      ...blob,
      sideMaps: {
        ...blob.sideMaps,
        garrisonedByBuilding: [],
        garrisonedUnitToBuilding: [[9002, 9001]],
      },
    };

    expect(() => createSimulationBridge('aoe2-prototype', { savedGame: corrupt })).toThrow(
      /garrison cross-reference/i,
    );
  });
});
