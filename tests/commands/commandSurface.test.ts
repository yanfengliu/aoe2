// Phase 1A scaffolding test — verify command-surface scaffolding wires up
// without behavior change. Each Phase 1B commit will extend this test with
// per-command handler/validator coverage.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('command surface (Phase 1A scaffolding)', () => {
  it('builds a fresh bridge without throwing — registerCommandHandlers scaffolding is wired', () => {
    expect(() => createSimulationBridge('test-seed')).not.toThrow();
  });

  it('exposes a stable world reference (foundation for Phase 1B handlers)', () => {
    const bridge = createSimulationBridge('test-seed');
    expect(bridge.world).toBeDefined();
    // Phase 1A: no command handlers registered yet (they land in Phase 1B).
    // The scaffolding test just verifies wireBridgeOps + the new dispatcher
    // call don't break bridge construction.
    expect(bridge.world.tick).toBe(0);
  });
});
