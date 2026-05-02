// Phase 2B output-phase system: flushes the dirty Tier-1 slots from the
// per-tick `BridgeStateAccessor` cache back to `world.state.aoe2.*` via
// codecs. Runs LAST in the output phase (registered after `tier3SyncSystem`
// via `registerOutputTail`) so the recorder's diff-listener snapshot
// (fired AFTER the output phase per `civ-engine/world.ts:1746`) sees the
// flushed values.
//
// `accessor.flush()` is a no-op when no slots are dirty, so the per-tick
// overhead in steady-state is one `Set.size === 0` check.

import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

export function registerBridgeSnapshotSystem(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
}): void {
  const { world, accessor } = deps;
  world.registerSystem({
    name: 'aoe2BridgeSnapshot',
    phase: 'output',
    execute: () => {
      accessor.flush();
    },
  });
}
