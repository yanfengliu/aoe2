import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  buildRateMultiplier,
  buildingHitPointMultiplier,
  heatedShotMultiplier,
} from '../../src/game/simulation/buildingTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';
import { selectOwnedBuildingDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const NONE = new Set<ResearchableTechnologyType>();
const set = (...techs: ResearchableTechnologyType[]) =>
  new Set<ResearchableTechnologyType>(techs);

describe('Masonry and Architecture', () => {
  it('each add 10% building hit points, and stack', () => {
    expect(buildingHitPointMultiplier(NONE)).toBe(1);
    expect(buildingHitPointMultiplier(set('masonry'))).toBeCloseTo(1.1, 5);
    expect(buildingHitPointMultiplier(set('architecture'))).toBeCloseTo(1.1, 5);
    expect(buildingHitPointMultiplier(set('masonry', 'architecture'))).toBeCloseTo(1.21, 5);
  });

  it('raises the hit points of a building already standing', () => {
    const bridge: Bridge = createSimulationBridge('university-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    const townCenter = bridge.getEconomyState().buildings
      .find((entry) => entry.owner === 1 && entry.buildingType === 'town-center');
    expect(townCenter).toBeDefined();
    const before = bridge.getEntityHealth(townCenter!.id);
    expect(before).not.toBeNull();

    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    expect(bridge.queueResearch('masonry')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => (bridge.getEntityHealth(townCenter!.id)?.maxHp ?? 0) > (before!.maxHp),
      { maxSteps: 900 },
    ), 'Masonry never reached the standing Town Center').toBe(true);

    const after = bridge.getEntityHealth(townCenter!.id)!;
    expect(after.maxHp).toBe(Math.round(before!.maxHp * 1.1));
    // Damage taken must not be healed by an upgrade, and a full-health
    // building must stay at full health.
    expect(after.currentHp).toBe(after.maxHp);
  }, 60_000);
});

describe('Treadmill Crane', () => {
  it('makes builders work 20% faster', () => {
    expect(buildRateMultiplier(NONE)).toBe(1);
    expect(buildRateMultiplier(set('treadmill-crane'))).toBeCloseTo(1.2, 5);
  });
});

describe('Heated Shot', () => {
  it('multiplies tower fire against ships and nothing else', () => {
    expect(heatedShotMultiplier(NONE, 'galley')).toBe(1);
    expect(heatedShotMultiplier(set('heated-shot'), 'galley')).toBeCloseTo(2.25, 5);
    expect(heatedShotMultiplier(set('heated-shot'), 'militia')).toBe(1);
    // Camels are the other AoE2 target class for it.
    expect(heatedShotMultiplier(set('heated-shot'), 'camel')).toBeCloseTo(2.25, 5);
  });
});

describe('the University research menu', () => {
  it('offers the Castle-Age defensive technologies', () => {
    const bridge: Bridge = createSimulationBridge('university-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).toContain('masonry');
    expect(options).toContain('treadmill-crane');
    expect(options).toContain('heated-shot');
    // Architecture is Imperial and needs Masonry first.
    expect(options).not.toContain('architecture');
  });

  it('opens Architecture only after Masonry, in Imperial Age', () => {
    const bridge: Bridge = createSimulationBridge('university-imperial-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'university')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).not.toContain('architecture');

    expect(bridge.queueResearch('masonry')).toBe(true);
    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'university');
        return bridge.getSelectionState().researchOptions.includes('architecture');
      },
      { maxSteps: 900 },
    ), 'Architecture never opened after Masonry').toBe(true);
  }, 60_000);
});

describe('Heated Shot on the water', () => {
  it('makes a Watch Tower burn a ship for more than it burns a land unit', () => {
    // The pure multiplier is one thing; this proves the tower's ARROWS carry
    // it. Same tower, same range, one volley at a Galley and one at a Militia,
    // measured with the technology on and off.
    const firstHit = (scenario: string, unitType: 'galley' | 'militia'): number => {
      const bridge: Bridge = createSimulationBridge(scenario);
      const target = bridge.getEconomyState().units
        .find((unit) => unit.owner === 2 && unit.unitType === unitType);
      expect(target, `${unitType} in ${scenario}`).toBeDefined();
      const start = bridge.getEntityHealth(target!.id)?.currentHp ?? 0;
      for (let step = 0; step < 300; step += 1) {
        bridge.step(100);
        const now = bridge.getEntityHealth(target!.id)?.currentHp;
        if (now === undefined) return start;
        if (now < start) return start - now;
      }
      return 0;
    };

    const plainShip = firstHit('heated-shot-fixture', 'galley');
    const burnedShip = firstHit('heated-shot-researched-fixture', 'galley');
    const plainLand = firstHit('heated-shot-fixture', 'militia');
    const burnedLand = firstHit('heated-shot-researched-fixture', 'militia');

    expect(plainShip, 'the tower never hit the ship').toBeGreaterThan(0);
    expect(burnedShip, 'Heated Shot did not raise the damage to the ship')
      .toBeGreaterThan(plainShip);
    // ...and it left the land unit exactly as it was.
    expect(burnedLand).toBe(plainLand);
  }, 90_000);
});
