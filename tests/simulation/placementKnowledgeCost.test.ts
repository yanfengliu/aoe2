// The player's placement preview floods its explored ground at most once a
// tick (work 122, review finding 3; spec §12.1).
//
// Whether a builder can walk to a site over explored ground needs a flood fill
// of that ground, and the preview asks on every mouse move in placement mode.
// Flooding afresh per ask made the player's preview 100 to 1,000 times the
// cost of the true-map preview it replaced: mean 0.142 ms against 0.004 ms per
// ask on the 60x36 boot map with everything explored, and 0.579 ms on 116x72
// (the reviewer's probe, tmp/probes/review122/previewCost.mts). So the
// labelling is kept until the world steps, the ground changes or the shared
// sight changes. This gate counts labellings with the module's own counter
// (`getDebugSnapshot().placementKnowledge`), never a clock: however many
// previews and refusals a tick asks, one labelling answers them, and a step
// builds at most one more.
//
// Bound: the open fixture, one villager (one owner, the land domain), a house
// and a palisade wall swept over the whole map at tick 0 and again after one
// step, and one refusal. A second owner or a water builder keys a labelling of
// its own and is not exercised; nor is a foundation going down mid-tick, which
// changes the ground and so rightly builds another.
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { UNEXPLORED_PLACEMENT_OPEN_SEED } from '../../src/game/simulation/fixtures/unexploredPlacement';

type Bridge = ReturnType<typeof createSimulationBridge>;

function sweep(bridge: Bridge, type: 'house' | 'palisade-wall'): number {
  expect(bridge.beginBuildingPlacement(type)).toBe(true);
  const { width, height } = bridge.getMapSize();
  let valid = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (bridge.getPlacementPreview(x, y)?.isValid === true) valid += 1;
  }
  return valid;
}

describe('the cost of the player\'s placement preview (work 122)', () => {
  it('every ask in a tick shares one labelling of explored ground, and a step builds at most one more', () => {
    const bridge = createSimulationBridge(UNEXPLORED_PLACEMENT_OPEN_SEED);
    const villager = bridge.getEconomyState().units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    const stats = () => {
      const snapshot = bridge.getDebugSnapshot().placementKnowledge;
      expect(snapshot, 'the bridge reports no placement-knowledge counters').toBeDefined();
      return snapshot!;
    };
    expect(stats().computed).toBe(0);

    // Over 4,000 previews, some of them valid: each valid one asked the route.
    const valid = sweep(bridge, 'house') + sweep(bridge, 'palisade-wall');
    expect(valid, 'no preview reached the route question').toBeGreaterThan(40);
    // A refusal composes its message from the same answers in the same tick.
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(0, 0)).toBe(false);
    const atBoot = stats();
    expect(atBoot.computed, 'one tick of asks flooded the explored ground more than once').toBe(1);
    expect(atBoot.served).toBeGreaterThanOrEqual(valid);

    bridge.step(100);
    sweep(bridge, 'house');
    sweep(bridge, 'palisade-wall');
    const afterStep = stats();
    // Exactly one: the old labelling is not reused across the step, and the
    // new one serves every ask after it.
    expect(afterStep.computed, 'after a step the asks must build exactly one new labelling').toBe(2);
    expect(afterStep.served).toBeGreaterThan(atBoot.served);
  });
});
