// An AI's foundation that loses the ground is cancelled cleanly, and the AI
// builds again (work 126; spec §8.1).
//
// An AI places by the true map, where an enemy's foundation nobody has started
// stands aside (update 185872), and the human may put a foundation over the
// AI's unstarted one the same way. Whoever starts first wins; the start check
// runs for every seat, so the AI's foundation is cancelled when its builder
// arrives and finds the human's started site, and refunded in full at the AI's
// price (hotfix 45185, update 46295). The AI's build order then finds that
// building missing again and puts it down elsewhere, rather than keep a builder
// on ground it cannot have (the coordinator's acceptance, 2026-10-14). DE's
// own AI note of update 185872 is the same idea for a site it cannot reach: "If
// an AI villager fails to path to a building foundation, the building will now
// be cancelled instead of indefinitely sitting in the build queue blocking
// further building."
//
// BOUND — what a green run here does NOT prove: one Dark-Age AI with the wood
// for exactly one Barracks and one villager, which places its Barracks at
// (37,11) on its first decision; the human's House over that site's west edge.
// Measured on the fixture on 2026-10-14: the AI's villager reaches the site at
// about tick 460, so the human's House, a few cells from its builder, starts
// first.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  AI_RACE_HUMAN_VILLAGER,
  UNBUILT_FOUNDATIONS_AI_SEED,
} from '../../src/game/simulation/fixtures/unbuiltFoundations';
import type { Bridge } from './hiddenUnstartedFoundation.helpers';

const AI = 2;
const BARRACKS_WOOD = 175;

function aiBarracks(bridge: Bridge) {
  return bridge.getEconomyState().buildings.filter((building) => building.owner === AI && building.buildingType === 'barracks');
}

/** The engine recycles entity ids, so the second Barracks may well carry the
 *  first one's id: a Barracks is told apart by where it stands. */
const sameSite = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => a.x === b.x && a.y === b.y;

describe('an AI that loses the ground builds again (work 126)', () => {
  it('its Barracks under the human\'s started House is cancelled, refunded, and placed again where it can stand', () => {
    const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_AI_SEED);
    for (let tick = 0; tick < 20 && aiBarracks(bridge).length === 0; tick += 1) bridge.step(100);
    const first = aiBarracks(bridge)[0];
    expect(first, 'the AI never placed its first Barracks').toBeDefined();
    expect(first!.buildProgressTicks).toBe(0);
    expect(bridge.getEconomyState().playerResources[AI]?.wood, 'the premise: the AI paid for it').toBe(0);

    // The human's House covers the Barracks' west column.
    const house = { x: first!.x - 1, y: first!.y };
    const villager = bridge.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.x === AI_RACE_HUMAN_VILLAGER.x && unit.y === AI_RACE_HUMAN_VILLAGER.y);
    expect(villager, 'the fixture moved: the human has no villager').toBeDefined();
    expect(bridge.selectUnitsByIds([villager!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(house.x, house.y), 'the House over the AI\'s unstarted Barracks was refused')
      .toBe(true);
    const humanHouse = () => bridge.getEconomyState().buildings
      .find((building) => building.owner === 1 && building.x === house.x && building.y === house.y);
    for (let tick = 0; tick < 300 && (humanHouse()?.buildProgressTicks ?? 0) === 0; tick += 1) bridge.step(100);
    expect(humanHouse()?.buildProgressTicks ?? 0, 'the human\'s House never started').toBeGreaterThan(0);
    expect(aiBarracks(bridge).find((building) => sameSite(building, first!))?.buildProgressTicks,
      'the premise: the AI\'s builder had not yet arrived').toBe(0);

    let refunded = false;
    let gone = false;
    for (let tick = 0; tick < 1500; tick += 1) {
      bridge.step(100);
      if (!aiBarracks(bridge).some((building) => sameSite(building, first!))) gone = true;
      if (gone && (bridge.getEconomyState().playerResources[AI]?.wood ?? 0) >= BARRACKS_WOOD) refunded = true;
      const again = aiBarracks(bridge).find((building) => !sameSite(building, first!));
      if (refunded && again && again.buildProgressTicks > 0) break;
    }
    expect(gone, 'the AI\'s Barracks was never cancelled').toBe(true);
    expect(refunded, 'the AI\'s Barracks was not refunded').toBe(true);
    expect(aiBarracks(bridge).some((building) => sameSite(building, first!)), 'a Barracks stands under the House')
      .toBe(false);
    const again = aiBarracks(bridge).find((building) => !sameSite(building, first!));
    expect(again, 'the AI never placed its Barracks again').toBeDefined();
    expect(again!.buildProgressTicks, 'the AI never built its second Barracks').toBeGreaterThan(0);
    expect(humanHouse(), 'the human\'s House lost its ground').toBeDefined();
  });
});
