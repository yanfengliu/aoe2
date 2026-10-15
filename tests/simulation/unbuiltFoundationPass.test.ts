// A builder standing on its own unstarted foundation in a pass does not count
// on the side it will be on when the foundation goes up (work 126, review round
// 0; spec §8.1; placementKnowledge.ts and builderReachability.ts,
// `reachesFromEvery`).
//
// A placement's route treats the placer's unstarted foundations as the walls
// they will be. A builder standing on one may walk off it on either side, or be
// put beside it on whichever side is nearest when it starts, so it cannot know
// which side it will be on. The first cut took the union, every component on
// every side, and so accepted a site behind the foundation in a pass it fills,
// which the start could strand (the review). The rule since: a site counts as
// reached only if it is reached from every side.
//
// On this map a House fills the only gap in a wall of water. The human's
// builder stands on it, so a House east of the pass is refused; stood east of
// the pass, the same builder is offered the same site. Through the human's
// explored-ground check; the true map's is builderReachabilityFutureWalls.test.ts.
//
// BOUND — what a green run here does NOT prove: one 2x2 House in a 2x2 gap,
// one builder, the human seat; a site that touches both sides of a pass, which
// would be reached from every side, is not built.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  PASS_BUILDER,
  PASS_HOUSE,
  UNBUILT_FOUNDATIONS_PASS_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import type { Bridge } from './hiddenUnstartedFoundation.helpers';

type Cell = { readonly x: number; readonly y: number };

/** East of the pass: reached from the west only through the gap. */
const EAST_SITE: Cell = { x: PASS_HOUSE.x + 4, y: PASS_HOUSE.y };

function builder(bridge: Bridge) {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.owner === 1 && candidate.unitType === 'villager');
  expect(unit, 'the fixture moved: the human has no villager').toBeDefined();
  return unit!;
}

function preview(bridge: Bridge, builderId: number, anchor: Cell): boolean {
  expect(bridge.selectUnitsByIds([builderId])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  return bridge.getPlacementPreview(anchor.x, anchor.y)?.isValid === true;
}

/** The human's House in the gap, nobody working it, and its builder walked to
 *  `stand`. */
function houseInThePass(stand: Cell): { bridge: Bridge; builderId: number } {
  const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_PASS_SEED);
  const builderId = builder(bridge).id;
  expect(preview(bridge, builderId, PASS_HOUSE), 'the premise: the House fits the gap').toBe(true);
  expect(bridge.confirmBuildingPlacement(PASS_HOUSE.x, PASS_HOUSE.y)).toBe(true);
  bridge.step(100);
  expect(bridge.world.submitWithResult('unit.move', { unitId: builderId, target: { ...stand } }).accepted).toBe(true);
  for (let tick = 0; tick < 300; tick += 1) {
    bridge.step(100);
    const unit = builder(bridge);
    if (unit.x === stand.x && unit.y === stand.y && unit.task === 'idle') break;
  }
  const unit = builder(bridge);
  expect({ x: unit.x, y: unit.y }, 'the builder never reached where it was sent').toEqual(stand);
  const house = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
  expect(house?.buildProgressTicks, 'the premise: nobody has started the House').toBe(0);
  return { bridge, builderId };
}

describe('a builder on its own unstarted foundation in a pass (work 126, review round 0)', () => {
  it('standing on the House that fills the pass, it is refused a site beyond it', () => {
    const { bridge, builderId } = houseInThePass(PASS_HOUSE);
    expect(preview(bridge, builderId, EAST_SITE), 'the site was taken as reached from one side of the pass only').toBe(false);
  });

  it('the control: standing east of the pass, the same builder is offered the same site', () => {
    const { bridge, builderId } = houseInThePass({ x: EAST_SITE.x - 1, y: EAST_SITE.y + 2 });
    expect(preview(bridge, builderId, EAST_SITE)).toBe(true);
  });

  it('the other control: standing west of the pass, it is refused, as its route would cross the House', () => {
    const { bridge, builderId } = houseInThePass(PASS_BUILDER);
    expect(preview(bridge, builderId, EAST_SITE)).toBe(false);
  });
});
