// Bound: the test-only serializer must match native World.serialize at all
// 120 commanded-worker simulation ticks in each world (240 comparisons).
// This prefix proves instrumentation equivalence, not gathering or deposit.
// Original mutation, transfer and error controls remain in the occupation test.
import { isDeepStrictEqual } from 'node:util';
import { describe, expect } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { createExactSnapshotSerializer } from './exactSnapshotSerializer';
import { describeTickChunks } from './tickChunks';

describe('exact snapshot serialization instrument', () => {
  // The 120 ticks run as six consecutive 20-tick cases over the same two worlds
  // (tickChunks.ts): all 240 comparisons and the clone-count checks are the
  // ones this case always made. As one case it ran up to 20.6 s of its 30 s
  // limit on windows-latest and 35 s inside a loaded local suite (work 123).
  describeTickChunks('matches native full snapshots at each of 120 commanded-worker simulation ticks', 120, 20, {
    setup: () => {
      const bridge = createSimulationBridge('aoe2-prototype', { disableAiForOwners: new Set([1, 2]) });
      const unit = bridge.getEconomyState().units.find((row) => row.owner === 1 && row.unitType === 'villager')!;
      const tree = bridge.getEconomyState().resources.find((row) => row.baseOwner === 1 && row.resourceType === 'tree')!;
      const modern = createReplayWorldOnly(bridge.saveGame().worldSnapshot);
      const old = bridge.saveGame().worldSnapshot;
      delete (old as unknown as { state: Record<string, unknown> }).state['aoe2.resourceOccupationVersion'];
      for (const [, unit] of old.components.unit) delete (unit as { resourceOccupation?: unknown }).resourceOccupation;
      const legacy = createReplayWorldOnly(old);
      for (const world of [modern, legacy]) {
        expect(world.submitWithResult('unit.gather', { unitId: unit.id, resourceId: tree.id }).accepted).toBe(true);
      }
      const counts = { requests: 0, cloned: 0, reused: 0 };
      return { modern, legacy, counts, serialize: createExactSnapshotSerializer(counts), comparedTicks: 0 };
    },
    tick: (run, tick) => {
      const { modern, legacy, serialize } = run;
      modern.step(); legacy.step();
      for (const world of [modern, legacy]) {
        expect(isDeepStrictEqual(serialize(world), world.serialize()), `native full snapshot at tick ${tick + 1}`).toBe(true);
      }
      run.comparedTicks++;
    },
    finish: ({ comparedTicks, counts }) => {
      expect(comparedTicks).toBe(120);
      expect(counts.requests).toBe(counts.cloned + counts.reused);
      expect(counts.cloned).toBeGreaterThan(0);
      expect(counts.reused).toBeGreaterThan(counts.cloned);
    },
  });
});
