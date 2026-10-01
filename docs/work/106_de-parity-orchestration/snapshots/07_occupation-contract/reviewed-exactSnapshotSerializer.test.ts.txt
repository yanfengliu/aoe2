// Bound: the test-only serializer must match native World.serialize at all
// 120 commanded-worker simulation ticks in each world (240 comparisons).
// This prefix proves instrumentation equivalence, not gathering or deposit.
// Original mutation, transfer and error controls remain in the occupation test.
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { createExactSnapshotSerializer } from './exactSnapshotSerializer';

describe('exact snapshot serialization instrument', () => {
  it('matches native full snapshots at each of 120 commanded-worker simulation ticks', () => {
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
    const serialize = createExactSnapshotSerializer(counts);
    let comparedTicks = 0;
    for (let tick = 0; tick < 120; tick++) {
      modern.step(); legacy.step();
      for (const world of [modern, legacy]) {
        expect(isDeepStrictEqual(serialize(world), world.serialize()), `native full snapshot at tick ${tick + 1}`).toBe(true);
      }
      comparedTicks++;
    }
    expect(comparedTicks).toBe(120);
    expect(counts.requests).toBe(counts.cloned + counts.reused);
    expect(counts.cloned).toBeGreaterThan(0);
    expect(counts.reused).toBeGreaterThan(counts.cloned);
  });
});
