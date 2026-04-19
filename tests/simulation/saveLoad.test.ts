import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { SAVE_SCHEMA_VERSION } from '../../src/game/simulation/saveSchema';

describe('Slice 9 — save/load round-trip', () => {
  it('produces a JSON-serializable save blob with the current schema version', () => {
    const bridge = createSimulationBridge();
    bridge.step(1000);

    const blob = bridge.saveGame();

    expect(blob.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(blob.seed).toBe('aoe2-prototype');
    // The world snapshot is engine-owned but must round-trip through JSON.
    const json = JSON.stringify(blob);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(parsed.worldSnapshot.tick).toBeGreaterThan(0);
    expect(Array.isArray(parsed.sideMaps.playerResources)).toBe(true);
    expect(parsed.matchState.outcome).toBe('running');
    // Visibility state is `{ width, height, players }` — verify we captured a map.
    expect(parsed.visibility.width).toBeGreaterThan(0);
    expect(parsed.visibility.height).toBeGreaterThan(0);
  });
});
