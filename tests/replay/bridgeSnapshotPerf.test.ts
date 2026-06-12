import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { TIER_1_CODECS } from '../../src/game/simulation/bridge/bridgeStateSerialize';

const ALL_SLOT_FLUSH_BUDGET_MS = 250;
const SCHEMA_2_SAVE_BUDGET_MS = 250;

function makeWarmedBridge(): ReturnType<typeof createSimulationBridge> {
  const bridge = createSimulationBridge('feudal-age-fixture');
  for (let i = 0; i < 5; i += 1) {
    bridge.step(100);
  }
  return bridge;
}

describe('Phase 2G — bridge snapshot performance gate', () => {
  it('flushes the full dirty Tier-1 registry within the Windows full-suite budget', () => {
    const bridge = makeWarmedBridge();
    const accessor = new BridgeStateAccessor(() => bridge.world);

    for (const codec of TIER_1_CODECS) {
      accessor.get(codec);
      accessor.markDirty(codec);
    }

    const start = performance.now();
    // civ-engine 1.0: strict mode gates between-tick setState — the raw
    // flush this perf gate measures now runs inside the maintenance
    // window, exactly like the production saveGame path it models.
    bridge.world.runMaintenance(() => {
      accessor.flush();
    });
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(ALL_SLOT_FLUSH_BUDGET_MS);
  });

  it('serializes schema-2 saves within the Windows full-suite budget', () => {
    const bridge = makeWarmedBridge();
    bridge.saveGame();

    const start = performance.now();
    const blob = bridge.saveGame();
    const durationMs = performance.now() - start;

    expect(blob.schema).toBe(2);
    expect(durationMs).toBeLessThan(SCHEMA_2_SAVE_BUDGET_MS);
  });
});
