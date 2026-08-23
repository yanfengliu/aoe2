// The Outpost is the cheapest thing in Age of Empires II that sees for you:
// 25 wood and 10 stone for a 1x1 post with 500 hit points, a long line of
// sight, and no attack at all (structures.csv "Outpost", Dark Age). It is how
// you watch ground you do not hold, and it completes the building roster.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import {
  buildingArrowCount,
  buildingMaxHp,
  buildingVisionRadius,
} from '../../src/game/simulation/prototypeBuildingRules';
import { getBuildingFootprint } from '../../src/game/content/buildingFootprints';
import { outpostVisionRadiusForAge } from '../../src/game/simulation/visionTechEffects';

describe('Outpost', () => {
  it('is a Dark-Age villager build costing 25 wood and 10 stone', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    // Available from the very first age, unlike every other defensive building.
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('outpost');
    expect(constructionCost('outpost')).toEqual({ wood: 25, stone: 10 });
    expect(getBuildingFootprint('outpost')).toEqual({ width: 1, height: 1 });
  });

  it('sees far and does not shoot', () => {
    expect(buildingVisionRadius('outpost')).toBe(6);
    expect(buildingMaxHp('outpost')).toBe(500);
    // The whole point: an Outpost is an eye, not a tower. A Watch Tower shoots.
    expect(buildingArrowCount('outpost', 0, 0)).toBe(0);
    expect(buildingArrowCount('watch-tower', 0, 0)).toBeGreaterThan(0);
  });
});

describe('Outpost line of sight grows with the age', () => {
  it('reads +2 per age off the base 6', () => {
    // structures.csv "Outpost": line_of_sight 6, special "+2 Line of sight per
    // age" — so an Outpost is worth keeping instead of being out-seen by the
    // Town Watch technologies alone.
    expect(outpostVisionRadiusForAge('dark-age')).toBe(6);
    expect(outpostVisionRadiusForAge('feudal-age')).toBe(8);
    expect(outpostVisionRadiusForAge('castle-age')).toBe(10);
    expect(outpostVisionRadiusForAge('imperial-age')).toBe(12);
  });

  it('bumps an Outpost already standing when its owner advances', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture');
    const owner = 1;
    const outpostId = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === owner && b.buildingType === 'outpost')?.id;
    expect(outpostId).toBeDefined();
    const radius = (): number | undefined => bridge.world.getComponent<{ radius: number }>(
      outpostId as number,
      'visionSource',
    )?.radius;
    expect(radius()).toBe(6);

    // Advancing the age is what moves it — nothing else in the fixture does.
    expect(selectOwnedBuildingDirect(bridge, owner, 'town-center')).toBe(true);
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().ages[owner] === 'feudal-age',
        { maxSteps: 3000 },
      ),
    ).toBe(true);
    expect(radius()).toBe(8);
  }, 60_000);

  it('an Outpost BUILT after the age-up starts at the age radius, not the base', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture');
    const owner = 1;
    expect(selectOwnedBuildingDirect(bridge, owner, 'town-center')).toBe(true);
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().ages[owner] === 'feudal-age',
        { maxSteps: 3000 },
      ),
    ).toBe(true);

    const builder = bridge
      .getEconomyState()
      .units.find((u) => u.owner === owner && u.unitType === 'villager');
    expect(builder).toBeDefined();
    expect(bridge.selectUnitsByIds([builder!.id])).toBe(true);
    expect(bridge.beginBuildingPlacement('outpost')).toBe(true);
    expect(bridge.confirmBuildingPlacement(16, 16)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge.getEconomyState().buildings.some(
          (b) => b.buildingType === 'outpost' && b.x === 16 && b.y === 16 && b.isComplete,
        ),
        { maxSteps: 2000 },
      ),
    ).toBe(true);

    const built = bridge
      .getEconomyState()
      .buildings.find((b) => b.buildingType === 'outpost' && b.x === 16 && b.y === 16);
    const radius = bridge.world.getComponent<{ radius: number }>(
      built!.id,
      'visionSource',
    )?.radius;
    expect(radius).toBe(8);
  }, 60_000);
});
