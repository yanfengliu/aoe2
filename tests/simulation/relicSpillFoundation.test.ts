// A relic a lost Monastery spills lands on a foundation nobody has started as
// on open ground, and the foundation's start then cancels for it (work 126;
// spec §8.1; entityDestroyOps.ts).
//
// A foundation nobody has started is open ground now (update 185872), so
// `isCellBlockedByBuilding` is false on it. The spill keeps off Farms by hand
// and treats an unstarted foundation like any other open cell: steering around
// one would show where an enemy had put a foundation nobody may see (review
// round 0). A relic lying on a foundation's ground is a lifeless resource, so
// when the first builder comes the start cancels it and refunds it, as for a
// carcass or a tree, and the message names the relic without blaming the fog,
// since the relic may have come after the foundation went down.
//
// BOUND: one Monastery with one relic, deleted by its owner, and one unstarted
// House of the same owner's on the first cell of the spill's ring order; the
// rule reads no owner, so an enemy's House is not driven separately.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  RELIC_BUILDER,
  RELIC_HOUSE,
  RELIC_MONASTERY,
  UNBUILT_FOUNDATIONS_RELIC_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';

describe('a spilled relic and an unstarted foundation (work 126)', () => {
  it('lands on the House nobody has started as on open ground, and the House\'s start cancels for it', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_RELIC_SEED);
    const buildings = bridge.getEconomyState().buildings;
    const monastery = buildings.find((building) => building.buildingType === 'monastery' && building.owner === 1);
    const house = buildings.find((building) => building.buildingType === 'house' && building.owner === 1);
    expect(monastery, 'the fixture moved: no Monastery').toBeDefined();
    expect(house?.buildProgressTicks, 'the premise: nobody has started the House').toBe(0);
    expect(bridge.getEconomyState().resources.some((resource) => resource.resourceType === 'relic'),
      'the premise: the relic is inside the Monastery').toBe(false);

    expect(bridge.world.submitWithResult('entity.delete', { entityId: monastery!.id, requestedBy: 1 }).accepted).toBe(true);
    bridge.step(100);
    const relic = bridge.getEconomyState().resources.find((resource) => resource.resourceType === 'relic');
    expect(relic, 'the Monastery spilled no relic').toBeDefined();
    // Two cells north of the Monastery's anchor, the first cell of the spill's
    // ring order, which the House covers.
    expect({ x: relic!.x, y: relic!.y }, 'the spill stepped around the unstarted House')
      .toEqual({ x: RELIC_MONASTERY.x, y: RELIC_MONASTERY.y - 2 });
    const onHouse = relic!.x >= RELIC_HOUSE.x && relic!.x < RELIC_HOUSE.x + 2
      && relic!.y >= RELIC_HOUSE.y && relic!.y < RELIC_HOUSE.y + 2;
    expect(onHouse, 'the premise: the first cell of the ring is under the House').toBe(true);

    const builder = bridge.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.x === RELIC_BUILDER.x && unit.y === RELIC_BUILDER.y);
    expect(builder, 'the fixture moved: no builder').toBeDefined();
    const wood = bridge.getEconomyState().playerResources[1]?.wood ?? Number.NaN;
    expect(bridge.world.submitWithResult('unit.contextAtEntity', { unitId: builder!.id, targetEntityId: house!.id })
      .accepted).toBe(true);
    const messages: string[] = [];
    for (let tick = 0; tick < 400; tick += 1) {
      bridge.step(100);
      for (let m = bridge.consumeCommandRejection(); m !== null; m = bridge.consumeCommandRejection()) messages.push(m);
      if (!bridge.getEconomyState().buildings.some((building) => building.id === house!.id)) break;
    }
    expect(bridge.getEconomyState().buildings.some((building) => building.id === house!.id),
      'the House started on a relic lying on its ground').toBe(false);
    expect(bridge.getEconomyState().playerResources[1]?.wood, 'the House was not refunded').toBe(wood + 25);
    const message = messages.join(' | ');
    expect(message).toContain(`Your house at (${RELIC_HOUSE.x},${RELIC_HOUSE.y}) was cancelled`);
    expect(message).toContain(`a relic (resource) at (${relic!.x},${relic!.y})`);
    expect(message, 'the relic spilled in plain sight, after the House went down').not.toContain('fog of war');
  });
});
